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

export default async function AdminCategoriesPage({
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
  const sort = one(searchParams.sort) ?? "order";

  const where: any = {};
  const andConditions: any[] = [];
  if (q) {
    andConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ]
    });
  }
  if (status === "active") {
    andConditions.push({ isActive: true });
  } else if (status === "inactive") {
    andConditions.push({ isActive: false });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy =
    sort === "name"
      ? [{ name: "asc" as const }]
      : sort === "new"
        ? [{ createdAt: "desc" as const }]
        : [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

  const categories = await prisma.productCategory.findMany({
    where,
    orderBy,
    include: {
      _count: {
        select: {
          products: true
        }
      }
    },
    take: 200
  });

  const summary = {
    total: categories.length,
    active: categories.filter((item) => item.isActive).length,
    inactive: categories.filter((item) => !item.isActive).length,
    used: categories.filter((item) => item._count.products > 0).length
  };

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Categories</h1>
      </div>

      <AdminRouteNav locale={params.locale} active="categories" />

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Create Category</h2>
          <form action="/api/admin/categories" method="post" target="admin-action-frame" className="space-y-3">
            <input type="hidden" name="action" value="create" />
            <input name="name" placeholder="Category name" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="slug" placeholder="category-slug (optional auto-generate)" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <textarea
              name="description"
              rows={3}
              placeholder="Category description (optional)"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="sortOrder" type="number" defaultValue={0} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
              <select name="isActive" defaultValue="true" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
                <option value="true">active</option>
                <option value="false">inactive</option>
              </select>
            </div>
            <button type="submit" className="primary-btn text-sm">
              Save Category
            </button>
          </form>
        </article>

        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Filter Categories</h2>
          <form className="space-y-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name / slug / description"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="status" defaultValue={status} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select name="sort" defaultValue={sort} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                <option value="order">Sort order</option>
                <option value="name">Name A-Z</option>
                <option value="new">Newest first</option>
              </select>
            </div>
            <button type="submit" className="secondary-btn text-sm">
              Apply Filters
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Categories</p>
              <p className="mt-1 text-xl font-black text-brand-900">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Active / Inactive</p>
              <p className="mt-1 text-xl font-black text-emerald-900">
                {summary.active} / {summary.inactive}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Used in products</p>
              <p className="mt-1 text-xl font-black text-slate-900">{summary.used}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Categories (CRUD)</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Name / Slug</th>
              <th className="pb-2">Description</th>
              <th className="pb-2">Products</th>
              <th className="pb-2">Sort</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Created</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((category) => (
              <tr key={category.id} className="align-top">
                <td className="py-3 pr-4">
                  <p className="font-semibold">{category.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{category.slug}</p>
                  <p className="mt-1 text-xs text-slate-400">{category.id}</p>
                </td>
                <td className="max-w-[360px] py-3 pr-4 text-xs text-slate-600">{category.description ?? "-"}</td>
                <td className="py-3 pr-4">{category._count.products}</td>
                <td className="py-3 pr-4">{category.sortOrder}</td>
                <td className="py-3 pr-4">{category.isActive ? "active" : "inactive"}</td>
                <td className="py-3 pr-4 text-xs">{formatDate(category.createdAt)}</td>
                <td className="py-3">
                  <form action="/api/admin/categories" method="post" target="admin-action-frame" className="mb-2 grid gap-2">
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="id" value={category.id} />
                    <input name="name" defaultValue={category.name} className="w-44 rounded-lg border border-border bg-white px-2 py-1 text-xs" />
                    <input name="slug" defaultValue={category.slug} className="w-44 rounded-lg border border-border bg-white px-2 py-1 text-xs" />
                    <input
                      name="description"
                      defaultValue={category.description ?? ""}
                      placeholder="Description"
                      className="w-56 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={category.sortOrder}
                        className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <select name="isActive" defaultValue={String(category.isActive)} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                        <option value="true">active</option>
                        <option value="false">inactive</option>
                      </select>
                      <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                        Update
                      </button>
                    </div>
                  </form>

                  <form action="/api/admin/categories" method="post" target="admin-action-frame">
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={category.id} />
                    <button
                      type="submit"
                      disabled={category._count.products > 0}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                      title={category._count.products > 0 ? "Reassign products before deleting." : "Delete category"}
                    >
                      Delete
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
