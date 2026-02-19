import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const resolved = await resolveRequestUser(request);
  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const appUser = resolved.user;

  const tokens = await prisma.downloadToken.findMany({
    where: {
      userId: appUser.id
    },
    orderBy: {
      createdAt: "desc"
    },
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
    authType: resolved.authType,
    count: tokens.length,
    items: tokens.map((token: (typeof tokens)[number]) => ({
      id: token.id,
      productId: token.productId,
      productSlug: token.product.slug,
      productTitle: token.product.title,
      expiresAt: token.expiresAt,
      maxUses: token.maxUses,
      usedCount: token.usedCount,
      isActive: token.expiresAt.getTime() > Date.now() && token.usedCount < token.maxUses
    }))
  });
}
