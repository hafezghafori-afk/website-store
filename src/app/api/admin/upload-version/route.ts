import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isR2Configured, uploadR2Object } from "@/lib/r2";
import { isAdminUser } from "@/lib/server-auth";

function canUseAdminApi() {
  if (!isClerkEnabled()) {
    return { ok: true as const };
  }

  const { userId } = auth();
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }) };
  }

  if (!isAdminUser()) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 })
    };
  }

  return { ok: true as const };
}

function sanitizePathSegment(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const compact = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return compact || "file";
}

function buildVersionFileKey(productId: string, version: string, filename: string) {
  const safeVersion = sanitizePathSegment(version.replace(/^v/i, ""));
  const safeFilename = sanitizePathSegment(filename || `template-${safeVersion}.zip`);
  return `products/${productId}/v${safeVersion}/${safeFilename}`;
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const versions = await prisma.productVersion.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: versions.length,
    items: versions
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const contentType = request.headers.get("content-type") ?? "";
  let productId = "";
  let version = "";
  let fileKey = "";
  let changelog = "";
  let fileSize = 0;
  let uploadFile: File | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    productId = String(body.productId ?? "").trim();
    version = String(body.version ?? "").trim();
    fileKey = String(body.fileKey ?? "").trim();
    changelog = String(body.changelog ?? "").trim();
    fileSize = Number(body.fileSize ?? 0);
  } else {
    const body = await request.formData();
    productId = String(body.get("productId") ?? "").trim();
    version = String(body.get("version") ?? "").trim();
    fileKey = String(body.get("fileKey") ?? "").trim();
    changelog = String(body.get("changelog") ?? "").trim();
    fileSize = Number(body.get("fileSize") ?? 0);
    const maybeFile = body.get("file");
    if (maybeFile instanceof File && maybeFile.size > 0) {
      uploadFile = maybeFile;
    }
  }

  if (!productId || !version || (!fileKey && !uploadFile)) {
    return NextResponse.json({ ok: false, message: "productId, version, and either file or fileKey are required." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  if (!product) {
    return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
  }

  const existingVersion = await prisma.productVersion.findUnique({
    where: {
      productId_version: {
        productId,
        version
      }
    },
    select: {
      id: true
    }
  });

  if (existingVersion) {
    return NextResponse.json({ ok: false, message: "This version already exists for the selected product." }, { status: 409 });
  }

  let resolvedFileKey = fileKey;
  if (uploadFile) {
    if (!isR2Configured()) {
      return NextResponse.json(
        { ok: false, message: "R2 is not configured. Set R2 credentials in .env before uploading files." },
        { status: 500 }
      );
    }

    const uploadKey = resolvedFileKey || buildVersionFileKey(productId, version, uploadFile.name);
    const bytes = new Uint8Array(await uploadFile.arrayBuffer());
    await uploadR2Object({
      fileKey: uploadKey,
      body: bytes,
      contentType: uploadFile.type || "application/zip"
    });
    resolvedFileKey = uploadKey;
    fileSize = uploadFile.size;
  }

  let createdVersion;
  try {
    createdVersion = await prisma.productVersion.create({
      data: {
        productId,
        version,
        fileKey: resolvedFileKey,
        fileSize: Number.isFinite(fileSize) && fileSize > 0 ? Math.round(fileSize) : 0,
        changelog: changelog || "Version update."
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ ok: false, message: "This version already exists for the selected product." }, { status: 409 });
    }
    throw error;
  }

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "admin.product_version.create",
    targetType: "product_version",
    targetId: createdVersion.id,
    details: {
      productId,
      version,
      fileKey: resolvedFileKey,
      uploadedFile: Boolean(uploadFile)
    }
  });

  return NextResponse.json({
    ok: true,
    message: uploadFile ? "Version file uploaded and metadata saved." : "Version metadata saved.",
    data: createdVersion
  });
}
