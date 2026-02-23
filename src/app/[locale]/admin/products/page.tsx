import Link from "next/link";
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

export default async function AdminProductsPage({
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
  const sort = one(searchParams.sort) ?? "new";
  const onlyNoVersions = one(searchParams.noVersions) === "yes";

  const where: any = {};
  const andConditions: any[] = [];

  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { tagMaps: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
        { techMaps: { some: { tech: { name: { contains: q, mode: "insensitive" } } } } }
      ]
    });
  }

  if (status !== "all") {
    andConditions.push({ status });
  }

  if (type === "bundle") {
    andConditions.push({ isBundle: true });
  } else if (type === "template") {
    andConditions.push({ isBundle: false });
  }

  if (onlyNoVersions) {
    andConditions.push({ versions: { none: {} } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy =
    sort === "title"
      ? ({ title: "asc" } as const)
      : sort === "updated"
        ? ({ updatedAt: "desc" } as const)
        : ({ createdAt: "desc" } as const);

  const [products, recentVersions] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      include: {
        variants: true,
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1
        },
        _count: {
          select: {
            versions: true,
            variants: true
          }
        },
        tagMaps: {
          include: {
            tag: { select: { name: true } }
          }
        },
        techMaps: {
          include: {
            tech: { select: { name: true } }
          }
        }
      },
      take: 120
    }),
    prisma.productVersion.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    })
  ]);

  const publishedCount = products.filter((item) => item.status === "published").length;
  const bundleCount = products.filter((item) => item.isBundle).length;
  const noVersionCount = products.filter((item) => item._count.versions === 0).length;

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin - Products</h1>
      </div>

      <AdminRouteNav locale={params.locale} active="products" />

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <form className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title / slug / tag / tech"
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm xl:col-span-2"
          />
          <select name="status" defaultValue={status} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select name="type" defaultValue={type} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option value="template">Template</option>
            <option value="bundle">Bundle</option>
          </select>
          <select name="sort" defaultValue={sort} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="new">Newest</option>
            <option value="updated">Recently updated</option>
            <option value="title">Title A-Z</option>
          </select>
          <select name="noVersions" defaultValue={onlyNoVersions ? "yes" : "no"} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="no">All version states</option>
            <option value="yes">Only no-version products</option>
          </select>
          <button type="submit" className="primary-btn text-sm sm:col-span-2 xl:col-span-6">
            Apply Filters
          </button>
        </form>

        <div className="grid gap-2 content-start">
          <Link href={`/${params.locale}/admin#catalog-create`} className="secondary-btn text-sm">
            Create Product
          </Link>
          <Link href={`/${params.locale}/admin#catalog-create`} className="secondary-btn text-sm">
            Upload Version
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">Catalog Size</p>
          <p className="mt-2 text-2xl font-black text-brand-900">{products.length}</p>
          <p className="mt-1 text-xs text-brand-700">Filtered products</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Published</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{publishedCount}</p>
          <p className="mt-1 text-xs text-emerald-700">{bundleCount} bundles in current result</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Version Gaps</p>
          <p className="mt-2 text-2xl font-black text-amber-900">{noVersionCount}</p>
          <p className="mt-1 text-xs text-amber-700">Products without uploaded versions</p>
        </article>
      </section>

      <section className="surface-card overflow-x-auto p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Products (Filtered)</h2>
            <p className="text-xs text-slate-500">Inline update/delete actions use existing admin APIs.</p>
          </div>
        </div>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Product</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Tech / Tags</th>
              <th className="pb-2">Price (USD)</th>
              <th className="pb-2">Versions</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const personalPrice = product.variants.find((item) => item.licenseType === "personal")?.priceUSD ?? 0;
              const commercialPrice = product.variants.find((item) => item.licenseType === "commercial")?.priceUSD ?? 0;
              const techList = product.techMaps.map((entry) => entry.tech.name);
              const tagList = product.tagMaps.map((entry) => entry.tag.name);
              const latestVersion = product.versions[0];

              return (
                <tr key={product.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{product.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.slug}</p>
                    <p className="mt-1 text-xs text-slate-400">{product.id}</p>
                  </td>
                  <td className="py-3 pr-4">{product.status}</td>
                  <td className="py-3 pr-4">{product.isBundle ? "bundle" : "template"}</td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <p>Tech: {techList.length > 0 ? techList.join(", ") : "-"}</p>
                    <p className="mt-1">Tags: {tagList.length > 0 ? tagList.join(", ") : "-"}</p>
                  </td>
                  <td className="py-3 pr-4">
                    {personalPrice} / {commercialPrice}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <p>{product._count.versions} version(s)</p>
                    <p className="mt-1">{latestVersion ? `${latestVersion.version} · ${formatDate(latestVersion.createdAt)}` : "No version"}</p>
                  </td>
                  <td className="py-3">
                    <form action="/api/admin/products" method="post" target="admin-action-frame" className="mb-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={product.id} />
                      <select name="status" defaultValue={product.status} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                        <option value="archived">archived</option>
                      </select>
                      <select name="isBundle" defaultValue={product.isBundle ? "true" : "false"} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                        <option value="false">template</option>
                        <option value="true">bundle</option>
                      </select>
                      <input
                        name="personalUsd"
                        defaultValue={personalPrice}
                        type="number"
                        min="1"
                        className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <input
                        name="commercialUsd"
                        defaultValue={commercialPrice}
                        type="number"
                        min="1"
                        className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                        Update
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/${params.locale}/templates/${product.slug}`} className="secondary-btn px-3 py-1.5 text-xs">
                        View
                      </Link>
                      <form action="/api/admin/products" method="post" target="admin-action-frame">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={product.id} />
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

      <section className="surface-card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Recent Versions</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Product</th>
              <th className="pb-2">Version</th>
              <th className="pb-2">File Key</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentVersions.map((version) => (
              <tr key={version.id}>
                <td className="py-3 pr-4">
                  <p className="font-semibold">{version.product.title}</p>
                  <p className="text-xs text-slate-500">{version.product.slug}</p>
                </td>
                <td className="py-3 pr-4">{version.version}</td>
                <td className="py-3 pr-4 text-xs text-slate-600">{version.fileKey}</td>
                <td className="py-3">{formatDate(version.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Container>
  );
}
