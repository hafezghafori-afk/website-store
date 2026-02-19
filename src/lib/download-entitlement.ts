import { prisma } from "@/lib/prisma";

export async function grantDownloadTokensForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          productVariant: {
            select: {
              productId: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  const productIds = Array.from(
    new Set(order.items.map((item: (typeof order.items)[number]) => item.productVariant.productId))
  );

  for (const productId of productIds) {
    const activeTokens = await prisma.downloadToken.findMany({
      where: {
        userId: order.userId,
        productId,
        expiresAt: {
          gt: now
        }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    const hasUsableToken = activeTokens.some(
      (token: (typeof activeTokens)[number]) => token.usedCount < token.maxUses
    );
    if (!hasUsableToken) {
      await prisma.downloadToken.create({
        data: {
          userId: order.userId,
          productId,
          expiresAt,
          maxUses: 10
        }
      });
    }
  }
}
