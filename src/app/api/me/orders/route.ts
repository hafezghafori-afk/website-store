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

  const orders = await prisma.order.findMany({
    where: {
      userId: appUser.id
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  coverImage: true
                }
              }
            }
          }
        }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return NextResponse.json({
    ok: true,
    authType: resolved.authType,
    count: orders.length,
    items: orders.map((order: (typeof orders)[number]) => ({
      id: order.id,
      status: order.status,
      currency: order.currency,
      total: order.total,
      createdAt: order.createdAt,
      latestPayment: order.payments[0]
        ? {
            provider: order.payments[0].provider,
            status: order.payments[0].status,
            reference: order.payments[0].providerRef
          }
        : null,
      items: order.items.map((item: (typeof order.items)[number]) => ({
        id: item.id,
        productId: item.productVariant.product.id,
        slug: item.productVariant.product.slug,
        title: item.productVariant.product.title,
        coverImage: item.productVariant.product.coverImage,
        licenseType: item.productVariant.licenseType,
        price: item.price,
        currency: item.currency
      }))
    }))
  });
}
