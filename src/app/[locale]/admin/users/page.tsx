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

export default async function AdminUsersPage({
  params,
  searchParams
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  noStore();
  ensureAdminAccess(params.locale);

  const q = one(searchParams.q)?.trim() ?? "";
  const localeFilter = one(searchParams.locale) ?? "all";
  const currencyFilter = one(searchParams.currency) ?? "all";
  const hasOrders = one(searchParams.hasOrders) ?? "all";
  const sort = one(searchParams.sort) ?? "new";

  const where: any = {};
  const andConditions: any[] = [];

  if (q) {
    andConditions.push({
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { clerkId: { contains: q, mode: "insensitive" } }
      ]
    });
  }

  if (localeFilter !== "all") {
    andConditions.push({ locale: localeFilter });
  }

  if (currencyFilter !== "all") {
    andConditions.push({ preferredCurrency: currencyFilter });
  }

  if (hasOrders === "yes") {
    andConditions.push({ orders: { some: {} } });
  } else if (hasOrders === "no") {
    andConditions.push({ orders: { none: {} } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = sort === "old" ? ({ createdAt: "asc" } as const) : ({ createdAt: "desc" } as const);

  const users = await prisma.user.findMany({
    where,
    orderBy,
    take: 150,
    include: {
      _count: {
        select: {
          orders: true,
          supportTickets: true,
          apiKeys: true
        }
      }
    }
  });

  const metrics = users.reduce(
    (acc, user) => {
      acc.total += 1;
      if (user._count.orders > 0) {
        acc.buyers += 1;
      }
      if (user.locale === "fa") {
        acc.fa += 1;
      } else {
        acc.en += 1;
      }
      if (user.preferredCurrency === "EUR") {
        acc.eur += 1;
      } else {
        acc.usd += 1;
      }
      return acc;
    },
    { total: 0, buyers: 0, fa: 0, en: 0, usd: 0, eur: 0 }
  );

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Users</h1>
      </div>

      <AdminRouteNav locale={params.locale} active="users" />

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <form className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search email / name / country / clerkId"
          className="rounded-xl border border-border bg-white px-3 py-2 text-sm xl:col-span-2"
        />
        <select name="locale" defaultValue={localeFilter} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All locales</option>
          <option value="fa">fa</option>
          <option value="en">en</option>
        </select>
        <select name="currency" defaultValue={currencyFilter} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All currencies</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <select name="hasOrders" defaultValue={hasOrders} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="all">All users</option>
          <option value="yes">Buyers only</option>
          <option value="no">No-order users</option>
        </select>
        <select name="sort" defaultValue={sort} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
        <button type="submit" className="primary-btn text-sm sm:col-span-2 xl:col-span-6">
          Apply Filters
        </button>
      </form>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Users</p>
          <p className="mt-2 text-2xl font-black text-brand-900">{metrics.total}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Buyers</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{metrics.buyers}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Locale fa</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.fa}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Locale en</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.en}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Currency USD</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.usd}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Currency EUR</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.eur}</p>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Users (Filtered)</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">User</th>
              <th className="pb-2">Identity</th>
              <th className="pb-2">Locale/Billing</th>
              <th className="pb-2">Activity</th>
              <th className="pb-2">Created</th>
              <th className="pb-2">Quick Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="py-3 pr-4">
                  <p className="font-semibold">{user.name ?? "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-600">
                  <p>User ID: {user.id}</p>
                  <p className="mt-1">Clerk: {user.clerkId}</p>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-600">
                  <p>Locale: {user.locale}</p>
                  <p className="mt-1">Currency: {user.preferredCurrency}</p>
                  <p className="mt-1">Country: {user.country ?? "-"}</p>
                </td>
                <td className="py-3 pr-4 text-xs text-slate-600">
                  <p>Orders: {user._count.orders}</p>
                  <p className="mt-1">Tickets: {user._count.supportTickets}</p>
                  <p className="mt-1">API Keys: {user._count.apiKeys}</p>
                </td>
                <td className="py-3 pr-4 text-xs">{formatDate(user.createdAt)}</td>
                <td className="py-3">
                  <form action="/api/admin/users" method="post" target="admin-action-frame" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={user.id} />
                    <input
                      name="name"
                      defaultValue={user.name ?? ""}
                      placeholder="Name"
                      className="w-28 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                    />
                    <input
                      name="country"
                      defaultValue={user.country ?? ""}
                      placeholder="US"
                      maxLength={2}
                      className="w-14 rounded-lg border border-border bg-white px-2 py-1 text-xs uppercase"
                    />
                    <select name="locale" defaultValue={user.locale} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                      <option value="fa">fa</option>
                      <option value="en">en</option>
                    </select>
                    <select name="preferredCurrency" defaultValue={user.preferredCurrency} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Container>
  );
}
