import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
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

export default async function AdminCampaignsPage({
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
  const type = one(searchParams.type) ?? "all";
  const currency = one(searchParams.currency) ?? "all";
  const expiring = one(searchParams.expiring) ?? "all";
  const sort = one(searchParams.sort) ?? "new";

  const where: any = {};
  const andConditions: any[] = [];

  if (q) {
    andConditions.push({
      code: { contains: q.toUpperCase(), mode: "insensitive" }
    });
  }
  if (status === "active") {
    andConditions.push({ isActive: true });
  } else if (status === "inactive") {
    andConditions.push({ isActive: false });
  }
  if (type !== "all") {
    andConditions.push({ type });
  }
  if (currency === "USD" || currency === "EUR") {
    andConditions.push({
      OR: [{ currency }, { type: "percent" }]
    });
  }

  const now = new Date();
  if (expiring === "7d") {
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    andConditions.push({ expiresAt: { not: null, gte: now, lte: limit } });
  } else if (expiring === "expired") {
    andConditions.push({ expiresAt: { not: null, lt: now } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy: Prisma.CouponOrderByWithRelationInput | Prisma.CouponOrderByWithRelationInput[] =
    sort === "uses"
      ? { usedCount: "desc" }
      : sort === "expires"
        ? [{ expiresAt: "asc" }, { createdAt: "desc" }]
        : { createdAt: "desc" };

  const coupons = await prisma.coupon.findMany({
    where,
    orderBy,
    take: 200
  });

  const stats = {
    total: coupons.length,
    active: coupons.filter((c) => c.isActive).length,
    inactive: coupons.filter((c) => !c.isActive).length,
    expired: coupons.filter((c) => c.expiresAt && c.expiresAt.getTime() < now.getTime()).length,
    expiring7d: coupons.filter((c) => {
      if (!c.expiresAt) return false;
      const diff = c.expiresAt.getTime() - now.getTime();
      return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 7;
    }).length,
    nearCap: coupons.filter((c) => c.maxUses && c.maxUses > 0 && c.usedCount / c.maxUses >= 0.8).length
  };

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Campaigns</h1>
        <p className="mt-2 text-sm text-slate-600">Coupon-based campaign management with filtering and lifecycle monitoring.</p>
      </div>

      <AdminRouteNav locale={params.locale} active="campaigns" />

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Create Campaign Coupon</h2>
          <form action="/api/admin/coupons" method="post" target="admin-action-frame" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="action" value="create" />
            <input name="code" placeholder="SAVE20" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm lg:col-span-2" />
            <select name="type" defaultValue="percent" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
            <input name="amount" type="number" min="1" placeholder="Amount" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <select name="currency" defaultValue="USD" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <input name="maxUses" type="number" min="1" placeholder="Max uses" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="expiresAt" type="datetime-local" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm lg:col-span-2" />
            <button type="submit" className="primary-btn text-sm lg:col-span-6">
              Create Campaign
            </button>
          </form>
        </article>

        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Filter Campaigns</h2>
          <form className="grid gap-3 sm:grid-cols-2">
            <input name="q" defaultValue={q} placeholder="Search coupon code" className="rounded-xl border border-border bg-white px-3 py-2 text-sm sm:col-span-2" />
            <select name="status" defaultValue={status} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select name="type" defaultValue={type} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="all">All types</option>
              <option value="percent">Percent</option>
              <option value="fixed">Fixed</option>
            </select>
            <select name="currency" defaultValue={currency} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="all">All currencies</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <select name="expiring" defaultValue={expiring} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="all">All expiry states</option>
              <option value="7d">Expiring in 7d</option>
              <option value="expired">Expired</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-xl border border-border bg-white px-3 py-2 text-sm sm:col-span-2">
              <option value="new">Newest first</option>
              <option value="uses">Most used</option>
              <option value="expires">Earliest expiry</option>
            </select>
            <button type="submit" className="secondary-btn text-sm sm:col-span-2">
              Apply Filters
            </button>
          </form>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Campaigns</p>
          <p className="mt-2 text-2xl font-black text-brand-900">{stats.total}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Active</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{stats.active}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Inactive</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.inactive}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Expiring 7d</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{stats.expiring7d}</p>
        </article>
        <article className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-700">Expired</p>
          <p className="mt-2 text-2xl font-black text-red-900">{stats.expired}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Near Cap</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{stats.nearCap}</p>
          <p className="mt-1 text-xs text-amber-700">&gt;=80% usage</p>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Campaign Coupons</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Code</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Usage</th>
              <th className="pb-2">Expiry</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.map((coupon) => {
              const expired = coupon.expiresAt ? coupon.expiresAt.getTime() < now.getTime() : false;
              const nearCap = coupon.maxUses && coupon.maxUses > 0 ? coupon.usedCount / coupon.maxUses >= 0.8 : false;
              return (
                <tr key={coupon.id}>
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{coupon.code}</p>
                    <p className="mt-1 text-xs text-slate-500">{coupon.id}</p>
                  </td>
                  <td className="py-3 pr-4">{coupon.type}</td>
                  <td className="py-3 pr-4">
                    {coupon.type === "percent" ? `${coupon.amount}%` : `${coupon.amount} ${coupon.currency ?? "USD"}`}
                  </td>
                  <td className="py-3 pr-4">
                    {coupon.usedCount}/{coupon.maxUses ?? "-"}
                    {nearCap ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">near cap</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    {coupon.expiresAt ? formatDate(coupon.expiresAt) : "-"}
                    {expired ? <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">expired</span> : null}
                  </td>
                  <td className="py-3 pr-4">{coupon.isActive ? "active" : "inactive"}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action="/api/admin/coupons" method="post" target="admin-action-frame">
                        <input type="hidden" name="action" value="toggle" />
                        <input type="hidden" name="id" value={coupon.id} />
                        <input type="hidden" name="isActive" value={String(!coupon.isActive)} />
                        <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                          {coupon.isActive ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <form action="/api/admin/coupons" method="post" target="admin-action-frame">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={coupon.id} />
                        <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                          Delete
                        </button>
                      </form>
                    </div>
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
