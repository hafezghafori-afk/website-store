import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Container } from "@/components/container";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { DownloadButton } from "@/components/download-button";
import { EmptyState } from "@/components/empty-state";
import { ManualReceiptForm } from "@/components/manual-receipt-form";
import { ProfileBillingForm } from "@/components/profile-billing-form";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
  searchParams
}: {
  params: { locale: string };
  searchParams: { payment?: string; provider?: string };
}) {
  noStore();

  const appUser = await requireAppUser();
  if (!appUser) {
    redirect(`/${params.locale}/login`);
  }

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

  const now = new Date();
  const activeTokens = await prisma.downloadToken.findMany({
    where: {
      userId: appUser.id,
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

  const downloadableProducts = Array.from(tokenMap.values());
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: appUser.id
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
  const paymentStatus = searchParams.payment?.toLowerCase() ?? "";
  const paymentProvider = searchParams.provider?.toLowerCase() ?? "";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Dashboard</h1>
      </div>

      {paymentStatus === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Payment confirmed. Your downloads are now available.
        </div>
      ) : null}

      {paymentStatus === "pending" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Payment is pending verification{paymentProvider ? ` (${paymentProvider})` : ""}. You can submit receipt details below for manual review.
        </div>
      ) : null}

      {paymentStatus === "cancelled" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Payment was cancelled{paymentProvider ? ` (${paymentProvider})` : ""}. You can retry checkout anytime.
        </div>
      ) : null}

      {paymentStatus === "failed" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Payment failed{paymentProvider ? ` (${paymentProvider})` : ""}. Please retry checkout or contact support.
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight">Orders</h2>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" description="After checkout, paid and pending orders will appear here." />
        ) : (
          <div className="grid gap-4">
            {orders.map((order: (typeof orders)[number]) => (
              <article key={order.id} className="surface-card space-y-4 p-5">
                {(() => {
                  const latestPayment = order.payments[0];
                  const paymentMeta =
                    latestPayment?.meta && typeof latestPayment.meta === "object" && !Array.isArray(latestPayment.meta)
                      ? (latestPayment.meta as Record<string, unknown>)
                      : {};
                  const manualReceipt =
                    paymentMeta.manualReceipt && typeof paymentMeta.manualReceipt === "object" && !Array.isArray(paymentMeta.manualReceipt)
                      ? (paymentMeta.manualReceipt as Record<string, unknown>)
                      : null;
                  const submittedAt = typeof manualReceipt?.submittedAt === "string" ? manualReceipt.submittedAt : undefined;
                  const existingReference = typeof manualReceipt?.reference === "string" ? manualReceipt.reference : undefined;
                  const existingReceiptUrl = typeof manualReceipt?.receiptUrl === "string" ? manualReceipt.receiptUrl : undefined;
                  const needsManualReceipt = latestPayment?.provider === "manual-af" && order.status === "pending";

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-500">{order.id}</p>
                        <p className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {order.status.toUpperCase()}
                        </p>
                      </div>
                      <p className="text-lg font-bold">
                        {order.total} {order.currency}
                      </p>
                      <ul className="space-y-2 text-sm text-slate-700">
                        {order.items.map((item: (typeof order.items)[number]) => (
                          <li key={item.id} className="rounded-xl border border-border bg-white p-3">
                            {item.productVariant.product.title} - {item.productVariant.licenseType}
                          </li>
                        ))}
                      </ul>
                      {latestPayment ? (
                        <p className="text-xs text-slate-500">
                          Payment: {latestPayment.provider} ({latestPayment.status})
                        </p>
                      ) : null}

                      {needsManualReceipt ? (
                        <ManualReceiptForm
                          orderId={order.id}
                          submittedAt={submittedAt}
                          existingReference={existingReference}
                          existingReceiptUrl={existingReceiptUrl}
                        />
                      ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight">Downloads</h2>
        {downloadableProducts.length === 0 ? (
          <EmptyState
            title="No active downloads"
            description="After a paid order is confirmed, secure download links will be available here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {downloadableProducts.map((token: (typeof downloadableProducts)[number]) => (
              <article key={token.id} className="surface-card space-y-3 p-5">
                <p className="text-lg font-bold">{token.product.title}</p>
                <p className="text-xs text-slate-500">
                  Uses: {token.usedCount}/{token.maxUses}
                </p>
                <DownloadButton productId={token.productId} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ProfileBillingForm
          initialProfile={{
            email: appUser.email,
            name: appUser.name,
            country: appUser.country,
            locale: appUser.locale as "fa" | "en",
            preferredCurrency: appUser.preferredCurrency as "USD" | "EUR"
          }}
        />

        <ApiKeysManager
          initialKeys={apiKeys.map((key) => ({
            ...key,
            lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
            revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
            createdAt: key.createdAt.toISOString()
          }))}
        />
      </section>
    </Container>
  );
}
