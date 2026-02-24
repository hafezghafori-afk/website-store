import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AccountRouteNav } from "@/components/account-route-nav";
import { Container } from "@/components/container";
import { DashboardPaymentStatusAlert } from "@/components/dashboard-payment-status-alert";
import { EmptyState } from "@/components/empty-state";
import { ManualReceiptForm } from "@/components/manual-receipt-form";
import { requireAppUser } from "@/lib/app-user";
import { getDashboardOrders, getManualReceiptMeta } from "@/lib/account-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardOrdersPage({
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

  const orders = await getDashboardOrders(appUser.id);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">My Orders</h1>
      </div>

      <AccountRouteNav locale={params.locale} active="orders" />

      <DashboardPaymentStatusAlert paymentStatus={searchParams.payment} paymentProvider={searchParams.provider} />

      <section className="space-y-4">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" description="After checkout, paid and pending orders will appear here." />
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => {
              const latestPayment = order.payments[0];
              const receipt = getManualReceiptMeta(latestPayment?.meta);
              const needsManualReceipt = latestPayment?.provider === "manual-af" && order.status === "pending";

              return (
                <article key={order.id} className="surface-card space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-500">{order.id}</p>
                    <p className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {order.status.toUpperCase()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-bold">
                      {order.total} {order.currency}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("en")}</p>
                  </div>

                  <ul className="space-y-2 text-sm text-slate-700">
                    {order.items.map((item) => (
                      <li key={item.id} className="rounded-xl border border-border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{item.productVariant.product.title}</p>
                          <p className="text-xs uppercase tracking-[0.06em] text-slate-500">{item.productVariant.licenseType}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.price} {item.currency}
                        </p>
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
                      submittedAt={receipt.submittedAt}
                      existingReference={receipt.existingReference}
                      existingReceiptUrl={receipt.existingReceiptUrl}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </Container>
  );
}
