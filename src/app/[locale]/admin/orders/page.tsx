import { unstable_noStore as noStore } from "next/cache";
import { AdminRouteNav } from "@/components/admin-route-nav";
import { Container } from "@/components/container";
import { ensureAdminAccess } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function one(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseDateStart(input?: string) {
  if (!input) {
    return null;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(input?: string) {
  if (!input) {
    return null;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

export default async function AdminOrdersPage({
  params,
  searchParams
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  noStore();
  ensureAdminAccess(params.locale);

  const q = one(searchParams.q)?.trim() ?? "";
  const status = one(searchParams.status) ?? "all";
  const provider = one(searchParams.provider) ?? "all";
  const currency = one(searchParams.currency) ?? "all";
  const review = one(searchParams.review) ?? "all";
  const sort = one(searchParams.sort) ?? "new";
  const dateFrom = one(searchParams.from) ?? "";
  const dateTo = one(searchParams.to) ?? "";

  const where: any = {};
  const andConditions: any[] = [];
  const qTrim = q.trim();

  if (qTrim) {
    andConditions.push({
      OR: [
        { id: { contains: qTrim, mode: "insensitive" } },
        { user: { email: { contains: qTrim, mode: "insensitive" } } }
      ]
    });
  }

  if (status !== "all") {
    andConditions.push({ status });
  }

  if (currency !== "all") {
    andConditions.push({ currency });
  }

  if (provider !== "all") {
    andConditions.push({ payments: { some: { provider } } });
  }

  if (review === "manual_pending") {
    andConditions.push({ payments: { some: { provider: "manual-af", status: "pending" } } });
  } else if (review === "manual_submitted") {
    andConditions.push({
      payments: {
        some: {
          provider: "manual-af",
          meta: {
            path: ["manualReceipt"],
            not: null
          }
        }
      }
    });
  }

  const fromDate = parseDateStart(dateFrom);
  const toDate = parseDateEnd(dateTo);
  if (fromDate || toDate) {
    andConditions.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {})
      }
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = sort === "old" ? ({ createdAt: "asc" } as const) : ({ createdAt: "desc" } as const);

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    take: 150,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
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

  const summary = orders.reduce(
    (acc, order) => {
      acc.total += 1;
      if (order.status === "paid") {
        acc.paid += 1;
      } else if (order.status === "pending") {
        acc.pending += 1;
      } else {
        acc.failed += 1;
      }

      if (order.currency === "EUR") {
        acc.eur += order.total;
      } else {
        acc.usd += order.total;
      }

      const latestPayment = order.payments[0];
      if (latestPayment?.provider === "manual-af" && latestPayment.status === "pending") {
        acc.manualPending += 1;
      }
      return acc;
    },
    { total: 0, paid: 0, pending: 0, failed: 0, usd: 0, eur: 0, manualPending: 0 }
  );

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Orders</h1>
      </div>

      <AdminRouteNav locale={params.locale} active="orders" />

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <form className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Order ID or user email"
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm xl:col-span-2"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All status</option>
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
          <option value="refunded">refunded</option>
        </select>
        <select name="provider" defaultValue={provider} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All providers</option>
          <option value="stripe">stripe</option>
          <option value="zarinpal">zarinpal</option>
          <option value="manual-af">manual-af</option>
        </select>
        <select name="currency" defaultValue={currency} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All currencies</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <select name="review" defaultValue={review} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All review states</option>
          <option value="manual_pending">Manual pending</option>
          <option value="manual_submitted">Manual receipt submitted</option>
        </select>
        <select name="sort" defaultValue={sort} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>

        <input name="from" type="date" defaultValue={dateFrom} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" />
        <input name="to" type="date" defaultValue={dateTo} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" />
        <button type="submit" className="primary-btn text-sm sm:col-span-2 xl:col-span-8">
          Apply Filters
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Orders</p>
          <p className="mt-2 text-2xl font-black text-brand-900">{summary.total}</p>
          <p className="mt-1 text-xs text-brand-700">Paid {summary.paid} · Pending {summary.pending}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Revenue USD</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{summary.usd}</p>
          <p className="mt-1 text-xs text-emerald-700">Filtered order totals</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Revenue EUR</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{summary.eur}</p>
          <p className="mt-1 text-xs text-emerald-700">Filtered order totals</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Manual Queue</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{summary.manualPending}</p>
          <p className="mt-1 text-xs text-amber-700">Pending manual transfer reviews</p>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Orders (Filtered)</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Order</th>
              <th className="pb-2">Customer</th>
              <th className="pb-2">Items</th>
              <th className="pb-2">Payment</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Created</th>
              <th className="pb-2">Manual Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const latestPayment = order.payments[0];
              const paymentMeta = asRecord(latestPayment?.meta);
              const manualReceipt = asRecord(paymentMeta.manualReceipt);
              const receiptRef = typeof manualReceipt.reference === "string" ? manualReceipt.reference : null;
              const receiptUrl = typeof manualReceipt.receiptUrl === "string" ? manualReceipt.receiptUrl : null;
              const submittedAt = typeof manualReceipt.submittedAt === "string" ? manualReceipt.submittedAt : null;
              const pendingManual = latestPayment?.provider === "manual-af" && latestPayment.status === "pending";

              return (
                <tr key={order.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{order.id.slice(0, 14)}...</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.total} {order.currency}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{order.user.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{order.user.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <p key={item.id}>
                          {item.productVariant.product.title} ({item.productVariant.licenseType})
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    {latestPayment ? (
                      <>
                        <p>
                          {latestPayment.provider} ({latestPayment.status})
                        </p>
                        {receiptRef ? <p className="mt-1">Ref: {receiptRef}</p> : null}
                        {submittedAt ? <p>{submittedAt}</p> : null}
                        {receiptUrl ? (
                          <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                            Receipt
                          </a>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 pr-4">{order.status}</td>
                  <td className="py-3 pr-4 text-xs">{formatDate(order.createdAt)}</td>
                  <td className="py-3">
                    {pendingManual ? (
                      <div className="flex flex-wrap gap-2">
                        <form action="/api/admin/orders" method="post" target="admin-action-frame">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="action" value="approve" />
                          <button type="submit" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            Approve
                          </button>
                        </form>
                        <form action="/api/admin/orders" method="post" target="admin-action-frame">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="action" value="reject" />
                          <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </Container>
  );
}
