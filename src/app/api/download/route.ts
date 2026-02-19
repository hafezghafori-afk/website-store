import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { ensureProductInDatabase } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { createSignedDownloadUrl } from "@/lib/r2";
import { resolveRequestUser } from "@/lib/request-user";
import { downloadSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const resolved = await resolveRequestUser(request);
  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const appUser = resolved.user;

  try {
    const body = await request.json();
    const parsed = downloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid download request." }, { status: 400 });
    }

    const product = await ensureProductInDatabase(parsed.data.productId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
    }

    const now = new Date();
    const tokens = await prisma.downloadToken.findMany({
      where: {
        userId: appUser.id,
        productId: product.id,
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    const token = tokens.find((item: { usedCount: number; maxUses: number }) => item.usedCount < item.maxUses);
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "You do not have an active download entitlement for this product." },
        { status: 403 }
      );
    }

    const latestVersion = await prisma.productVersion.findFirst({
      where: {
        productId: product.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (!latestVersion) {
      return NextResponse.json({ ok: false, message: "No downloadable file version exists for this product yet." }, { status: 404 });
    }

    const ipHeader = request.headers.get("x-forwarded-for");
    const ip = ipHeader ? ipHeader.split(",")[0].trim() : request.headers.get("x-real-ip") ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    const signedUrl = await createSignedDownloadUrl(latestVersion.fileKey, 600);
    if (!signedUrl) {
      return NextResponse.json({ ok: false, message: "R2 credentials are missing." }, { status: 500 });
    }

    await prisma.$transaction([
      prisma.downloadToken.update({
        where: { id: token.id },
        data: {
          usedCount: {
            increment: 1
          }
        }
      }),
      prisma.downloadLog.create({
        data: {
          userId: appUser.id,
          productId: product.id,
          ip,
          userAgent
        }
      })
    ]);

    await recordAuditEvent({
      actorUserId: appUser.id,
      action: "download.signed_url.issue",
      targetType: "product",
      targetId: product.id,
      details: {
        authType: resolved.authType,
        tokenId: token.id,
        version: latestVersion.version
      }
    });

    return NextResponse.json({
      ok: true,
      authType: resolved.authType,
      url: signedUrl,
      expiresInSeconds: 600,
      productId: product.id,
      version: latestVersion.version,
      message: "Signed download URL generated."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected download error."
      },
      { status: 500 }
    );
  }
}
