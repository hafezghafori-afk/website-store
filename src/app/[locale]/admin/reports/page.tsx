import { unstable_noStore as noStore } from "next/cache";
import { AdminRouteNav } from "@/components/admin-route-nav";
import { Container } from "@/components/container";
import { ensureAdminAccess } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function one(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateStart(input?: string | null) {
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

function parseDateEnd(input?: string | null) {
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

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function formatDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default async function AdminReportsPage({
  params,
  searchParams
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  noStore();
  ensureAdminAccess(params.locale);

  const daysRaw = Number(one(searchParams.days) ?? "30");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(180, Math.round(daysRaw))) : 30;
  const status = one(searchParams.status) ?? "all";
  const currency = one(searchParams.currency) ?? "all";
  const provider = one(searchParams.provider) ?? "all";
  const fromRaw = one(searchParams.from) ?? "";
  const toRaw = one(searchParams.to) ?? "";

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - (days - 1));
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setHours(23, 59, 59, 999);

  const fromDate = parseDateStart(fromRaw) ?? defaultFrom;
  const toDate = parseDateEnd(toRaw) ?? defaultTo;

  const where: any = {
    createdAt: {
      gte: fromDate,
      lte: toDate
    }
  };

  const andConditions: any[] = [];
  if (status !== "all") {
    andConditions.push({ status });
  }
  if (currency !== "all") {
    andConditions.push({ currency });
  }
  if (provider !== "all") {
    andConditions.push({ payments: { some: { provider } } });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      },
      items: {
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true
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

  const metrics = orders.reduce(
    (acc, order) => {
      acc.totalOrders += 1;
      acc.uniqueUsers.add(order.userId);
      if (order.status === "paid") {
        acc.paidOrders += 1;
      } else if (order.status === "pending") {
        acc.pendingOrders += 1;
      } else {
        acc.failedOrders += 1;
      }

      if (order.currency === "EUR") {
        acc.totalEur += order.total;
        if (order.status === "paid") {
          acc.paidEur += order.total;
        }
      } else {
        acc.totalUsd += order.total;
        if (order.status === "paid") {
          acc.paidUsd += order.total;
        }
      }

      const latestPayment = order.payments[0];
      const providerKey = latestPayment?.provider ?? "none";
      const providerBucket = acc.providerBreakdown.get(providerKey) ?? { orders: 0, paid: 0, pending: 0, failed: 0 };
      providerBucket.orders += 1;
      if (order.status === "paid") {
        providerBucket.paid += 1;
      } else if (order.status === "pending") {
        providerBucket.pending += 1;
      } else {
        providerBucket.failed += 1;
      }
      acc.providerBreakdown.set(providerKey, providerBucket);

      return acc;
    },
    {
      totalOrders: 0,
      paidOrders: 0,
      pendingOrders: 0,
      failedOrders: 0,
      totalUsd: 0,
      totalEur: 0,
      paidUsd: 0,
      paidEur: 0,
      uniqueUsers: new Set<string>(),
      providerBreakdown: new Map<string, { orders: number; paid: number; pending: number; failed: number }>()
    }
  );

  const rangeDays = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const dailyBuckets = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return {
      key: d.toISOString().slice(0, 10),
      label: formatDayLabel(d),
      orders: 0,
      paidOrders: 0,
      usd: 0,
      eur: 0
    };
  });
  const dailyMap = new Map(dailyBuckets.map((b) => [b.key, b]));

  const topProductMap = new Map<string, { title: string; orderItems: number; paidUsd: number; paidEur: number }>();
  for (const order of orders) {
    const d = new Date(order.createdAt);
    d.setHours(0, 0, 0, 0);
    const bucket = dailyMap.get(d.toISOString().slice(0, 10));
    if (bucket) {
      bucket.orders += 1;
      if (order.status === "paid") {
        bucket.paidOrders += 1;
      }
      if (order.currency === "EUR") {
        bucket.eur += order.total;
      } else {
        bucket.usd += order.total;
      }
    }

    if (order.status !== "paid") {
      continue;
    }

    for (const item of order.items) {
      const key = item.productVariant.product.id;
      const row = topProductMap.get(key) ?? {
        title: item.productVariant.product.title,
        orderItems: 0,
        paidUsd: 0,
        paidEur: 0
      };
      row.orderItems += 1;
      if (order.currency === "EUR") {
        row.paidEur += item.price;
      } else {
        row.paidUsd += item.price;
      }
      topProductMap.set(key, row);
    }
  }

  const topProducts = Array.from(topProductMap.values())
    .sort((a, b) => b.orderItems - a.orderItems || b.paidUsd + b.paidEur - (a.paidUsd + a.paidEur))
    .slice(0, 10);

  const providerRows = Array.from(metrics.providerBreakdown.entries())
    .map(([providerName, counts]) => ({ providerName, ...counts }))
    .sort((a, b) => b.orders - a.orders);

  const maxBucketOrders = Math.max(1, ...dailyBuckets.map((b) => b.orders));
  const paidRate = metrics.totalOrders > 0 ? Math.round((metrics.paidOrders / metrics.totalOrders) * 100) : 0;
  const avgUsd = metrics.paidOrders > 0 ? Math.round(metrics.paidUsd / Math.max(1, orders.filter((o) => o.status === "paid" && o.currency === "USD").length)) : 0;
  const avgEur = metrics.paidOrders > 0 ? Math.round(metrics.paidEur / Math.max(1, orders.filter((o) => o.status === "paid" && o.currency === "EUR").length)) : 0;

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Reports</h1>
        <p className="mt-2 text-sm text-slate-600">Sales analytics and payment performance for the selected timeframe.</p>
      </div>

      <AdminRouteNav locale={params.locale} active="reports" />

      <form className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-8">
        <select name="days" defaultValue={String(days)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
        </select>
        <input name="from" type="date" defaultValue={fromRaw || dateInputValue(fromDate)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" />
        <input name="to" type="date" defaultValue={toRaw || dateInputValue(toDate)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
          <option value="refunded">refunded</option>
        </select>
        <select name="currency" defaultValue={currency} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All currencies</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <select name="provider" defaultValue={provider} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All providers</option>
          <option value="stripe">stripe</option>
          <option value="zarinpal">zarinpal</option>
          <option value="manual-af">manual-af</option>
        </select>
        <button type="submit" className="primary-btn text-sm sm:col-span-2 xl:col-span-2">
          Run Report
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Orders</p>
          <p className="mt-2 text-2xl font-black text-brand-900">{metrics.totalOrders}</p>
          <p className="mt-1 text-xs text-brand-700">Paid rate {paidRate}% · Unique buyers {metrics.uniqueUsers.size}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Paid Revenue (USD)</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{formatMoney(metrics.paidUsd, "USD", "en")}</p>
          <p className="mt-1 text-xs text-emerald-700">Avg paid order (USD): {avgUsd}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Paid Revenue (EUR)</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{formatMoney(metrics.paidEur, "EUR", "en")}</p>
          <p className="mt-1 text-xs text-emerald-700">Avg paid order (EUR): {avgEur}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Pending / Failed</p>
          <p className="mt-2 text-2xl font-black text-amber-900">
            {metrics.pendingOrders} / {metrics.failedOrders}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Range: {formatDate(fromDate)} - {formatDate(toDate)}
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">Daily Trend</h2>
          <p className="mt-1 text-xs text-slate-500">Orders and paid orders across the selected date range.</p>
          <div className="mt-4 space-y-3">
            {dailyBuckets.map((bucket) => (
              <div key={bucket.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>{bucket.label}</span>
                  <span>
                    {bucket.orders} orders / {bucket.paidOrders} paid
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.round((bucket.orders / maxBucketOrders) * 100))}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  USD {bucket.usd} · EUR {bucket.eur}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">Provider Breakdown</h2>
          <p className="mt-1 text-xs text-slate-500">Latest payment provider per order (in selected scope).</p>
          <div className="mt-4 space-y-3">
            {providerRows.length === 0 ? (
              <p className="text-sm text-slate-500">No orders found for selected filters.</p>
            ) : (
              providerRows.map((row) => (
                <div key={row.providerName} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{row.providerName}</p>
                    <p className="text-xs text-slate-500">{row.orders} orders</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <p>Paid: {row.paid}</p>
                    <p>Pending: {row.pending}</p>
                    <p>Failed: {row.failed}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Top Products (Paid Orders)</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Product</th>
              <th className="pb-2">Order Items</th>
              <th className="pb-2">Paid USD</th>
              <th className="pb-2">Paid EUR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topProducts.length === 0 ? (
              <tr>
                <td className="py-3 pr-4 text-slate-500" colSpan={4}>
                  No paid product sales in selected scope.
                </td>
              </tr>
            ) : (
              topProducts.map((row) => (
                <tr key={`${row.title}-${row.orderItems}`}>
                  <td className="py-3 pr-4 font-medium">{row.title}</td>
                  <td className="py-3 pr-4">{row.orderItems}</td>
                  <td className="py-3 pr-4">{row.paidUsd}</td>
                  <td className="py-3 pr-4">{row.paidEur}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </Container>
  );
}
