import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { createSignedDownloadUrl, isR2Configured, uploadR2Object } from "@/lib/r2";
import { isAdminUser } from "@/lib/server-auth";
import { manualReceiptSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
const MAX_RECEIPT_IMAGE_BYTES = 8 * 1024 * 1024;

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const collapsed = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed || "receipt-image.jpg";
}

function buildReceiptImageKey(userId: string, orderId: string, fileName: string) {
  return `manual-receipts/${userId}/${orderId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

function buildReceiptProxyUrl(paymentId: string) {
  return `/api/payments/manual-receipt?paymentId=${encodeURIComponent(paymentId)}`;
}

function toAbsoluteUrl(pathOrUrl: string, request: Request) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return new URL(pathOrUrl, request.url).toString();
}

async function parseSubmission(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const maybeFile = form.get("receiptFile");
    const receiptFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

    return {
      orderId: String(form.get("orderId") ?? "").trim(),
      reference: String(form.get("reference") ?? "").trim(),
      note: normalizeOptionalString(form.get("note")),
      receiptUrl: normalizeOptionalString(form.get("receiptUrl")),
      receiptFile
    };
  }

  const body = await request.json();
  return {
    orderId: String(body.orderId ?? "").trim(),
    reference: String(body.reference ?? "").trim(),
    note: normalizeOptionalString(body.note),
    receiptUrl: normalizeOptionalString(body.receiptUrl),
    receiptFile: null as File | null
  };
}

export async function GET(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim();
  if (!paymentId) {
    return NextResponse.json({ ok: false, message: "paymentId is required." }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId
    },
    include: {
      order: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!payment) {
    return NextResponse.json({ ok: false, message: "Payment not found." }, { status: 404 });
  }

  const ownerAccess = payment.order.userId === appUser.id;
  const adminAccess = isAdminUser();
  if (!ownerAccess && !adminAccess) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const paymentMeta = asRecord(payment.meta);
  const manualReceipt = asRecord(paymentMeta.manualReceipt);
  const fileKey = typeof manualReceipt.fileKey === "string" ? manualReceipt.fileKey.trim() : "";
  const directUrl = typeof manualReceipt.receiptUrl === "string" ? manualReceipt.receiptUrl.trim() : "";

  if (!fileKey) {
    if (directUrl && !directUrl.startsWith("/api/payments/manual-receipt?")) {
      return NextResponse.redirect(toAbsoluteUrl(directUrl, request));
    }
    return NextResponse.json({ ok: false, message: "Receipt file not found." }, { status: 404 });
  }

  const signedUrl = await createSignedDownloadUrl(fileKey, 300);
  if (!signedUrl) {
    return NextResponse.json({ ok: false, message: "Could not create receipt download link." }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const submission = await parseSubmission(request);
    const parsed = manualReceiptSchema.safeParse({
      orderId: submission.orderId,
      reference: submission.reference,
      note: submission.note,
      receiptUrl: submission.receiptUrl
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid manual receipt payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const order = await prisma.order.findFirst({
      where: {
        id: payload.orderId,
        userId: appUser.id
      },
      include: {
        payments: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ ok: false, message: "Order not found." }, { status: 404 });
    }

    if (order.status === "paid") {
      return NextResponse.json({ ok: false, message: "This order is already paid." }, { status: 400 });
    }

    const pendingManualPayment = order.payments.find((item) => item.provider === "manual-af" && item.status === "pending");
    if (!pendingManualPayment) {
      return NextResponse.json(
        { ok: false, message: "No pending manual payment found for this order." },
        { status: 400 }
      );
    }

    let uploadedFileKey: string | null = null;
    let uploadedMimeType: string | null = null;
    let uploadedFileName: string | null = null;

    if (submission.receiptFile) {
      const mimeType = submission.receiptFile.type?.trim() || "";
      if (!mimeType.startsWith("image/")) {
        return NextResponse.json({ ok: false, message: "Receipt file must be an image." }, { status: 400 });
      }
      if (submission.receiptFile.size > MAX_RECEIPT_IMAGE_BYTES) {
        return NextResponse.json({ ok: false, message: "Receipt image must be 8MB or smaller." }, { status: 400 });
      }
      if (!isR2Configured()) {
        return NextResponse.json({ ok: false, message: "R2 is not configured for image upload." }, { status: 500 });
      }

      const fileKey = buildReceiptImageKey(appUser.id, order.id, submission.receiptFile.name);
      const bytes = new Uint8Array(await submission.receiptFile.arrayBuffer());

      const uploaded = await uploadR2Object({
        fileKey,
        body: bytes,
        contentType: mimeType
      });

      if (!uploaded) {
        return NextResponse.json({ ok: false, message: "Could not store receipt image." }, { status: 500 });
      }

      uploadedFileKey = fileKey;
      uploadedMimeType = mimeType;
      uploadedFileName = submission.receiptFile.name;
    }

    const existingMeta = asRecord(pendingManualPayment.meta);
    const previousManualReceipt = asRecord(existingMeta.manualReceipt);
    const previousFileKey = typeof previousManualReceipt.fileKey === "string" ? previousManualReceipt.fileKey : null;
    const previousReceiptUrl = typeof previousManualReceipt.receiptUrl === "string" ? previousManualReceipt.receiptUrl : null;
    const previousFileName = typeof previousManualReceipt.fileName === "string" ? previousManualReceipt.fileName : null;
    const previousMimeType = typeof previousManualReceipt.mimeType === "string" ? previousManualReceipt.mimeType : null;

    const fileKey = uploadedFileKey ?? previousFileKey;
    const proxyReceiptUrl = fileKey ? buildReceiptProxyUrl(pendingManualPayment.id) : null;
    const resolvedReceiptUrl = proxyReceiptUrl ?? payload.receiptUrl ?? previousReceiptUrl ?? null;
    const manualReceipt = {
      reference: payload.reference,
      note: payload.note || null,
      receiptUrl: resolvedReceiptUrl,
      fileKey,
      fileName: uploadedFileName ?? previousFileName,
      mimeType: uploadedMimeType ?? previousMimeType,
      submittedAt: new Date().toISOString()
    };

    await prisma.payment.update({
      where: {
        id: pendingManualPayment.id
      },
      data: {
        providerRef: payload.reference,
        meta: {
          ...existingMeta,
          manualReceipt
        }
      }
    });

    await recordAuditEvent({
      actorUserId: appUser.id,
      action: "payment.manual_receipt.submit",
      targetType: "order",
      targetId: order.id,
      details: {
        paymentId: pendingManualPayment.id,
        reference: payload.reference,
        hasReceiptImage: Boolean(uploadedFileKey)
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Receipt submitted. Admin review is pending.",
      orderId: order.id,
      receiptUrl: manualReceipt.receiptUrl
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected receipt submission error."
      },
      { status: 500 }
    );
  }
}
