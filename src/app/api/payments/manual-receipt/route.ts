import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { manualReceiptSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = manualReceiptSchema.safeParse(body);

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

    const existingMeta = asRecord(pendingManualPayment.meta);
    const manualReceipt = {
      reference: payload.reference,
      note: payload.note || null,
      receiptUrl: payload.receiptUrl || null,
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
        reference: payload.reference
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Receipt submitted. Admin review is pending.",
      orderId: order.id
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
