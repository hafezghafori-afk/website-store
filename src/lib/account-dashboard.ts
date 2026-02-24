import { prisma } from "@/lib/prisma";

export async function getDashboardOrders(userId: string) {
  return prisma.order.findMany({
    where: {
      userId
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
                  title: true
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
}

export async function getDashboardDownloadables(userId: string) {
  const now = new Date();
  const activeTokens = await prisma.downloadToken.findMany({
    where: {
      userId,
      expiresAt: {
        gt: now
      }
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

  const tokenMap = new Map<string, (typeof activeTokens)[number]>();
  for (const token of activeTokens) {
    if (!tokenMap.has(token.productId)) {
      tokenMap.set(token.productId, token);
    }
  }

  return Array.from(tokenMap.values());
}

export async function getDashboardApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true
    }
  });
}

export function getManualReceiptMeta(meta: unknown) {
  const paymentMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
  const manualReceipt =
    paymentMeta.manualReceipt && typeof paymentMeta.manualReceipt === "object" && !Array.isArray(paymentMeta.manualReceipt)
      ? (paymentMeta.manualReceipt as Record<string, unknown>)
      : null;

  return {
    submittedAt: typeof manualReceipt?.submittedAt === "string" ? manualReceipt.submittedAt : undefined,
    existingReference: typeof manualReceipt?.reference === "string" ? manualReceipt.reference : undefined,
    existingReceiptUrl: typeof manualReceipt?.receiptUrl === "string" ? manualReceipt.receiptUrl : undefined
  };
}
