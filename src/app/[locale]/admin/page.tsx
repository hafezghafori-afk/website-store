import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AdminControlCenter } from "@/components/admin-control-center";
import { AdminRouteNav } from "@/components/admin-route-nav";
import { Container } from "@/components/container";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, isAdminUser } from "@/lib/server-auth";
export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export default async function AdminPage({ params }: { params: { locale: string } }) {
  noStore();

  const clerkEnabled = isClerkEnabled();
  if (clerkEnabled) {
    const userId = getCurrentUserId();

    if (!userId) {
      redirect(`/${params.locale}/login`);
    }

    if (!isAdminUser()) {
      return (
        <Container className="py-14">
          <div className="surface-card p-6">
            <h1 className="text-xl font-bold">Admin Access Required</h1>
            <p className="mt-2 text-sm text-slate-600">Set Clerk metadata role to admin to access product management.</p>
          </div>
        </Container>
      );
    }
  }

  const [products, versions, orders, users, logs, coupons, supportTickets, auditEvents] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variants: true,
        versions: {
          orderBy: {
            createdAt: "desc"
          }
        },
        tagMaps: {
          include: {
            tag: {
              select: {
                name: true
              }
            }
          }
        },
        techMaps: {
          include: {
            tech: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.productVersion.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        product: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: {
          select: {
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
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      }
    }),
    prisma.downloadLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    }),
    prisma.coupon.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    }),
    prisma.supportTicket.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 50,
      include: {
        user: {
          select: {
            email: true
          }
        },
        replies: {
          orderBy: {
            createdAt: "asc"
          },
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    }),
    prisma.auditEvent.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 80,
      include: {
        actorUser: {
          select: {
            email: true
          }
        }
      }
    })
  ]);

  const recentPaidOrders = orders.filter((order) => order.status === "paid");
  const recentPendingOrders = orders.filter((order) => order.status === "pending");
  const recentFailedOrders = orders.filter((order) => order.status === "failed" || order.status === "cancelled");
  const publishedProducts = products.filter((product) => product.status === "published");
  const bundleProducts = products.filter((product) => product.isBundle);
  const openSupportTickets = supportTickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress");
  const activeCoupons = coupons.filter((coupon) => coupon.isActive);

  const recentRevenue = orders.reduce(
    (acc, order) => {
      if (order.status !== "paid") {
        return acc;
      }
      if (order.currency === "EUR") {
        acc.EUR += order.total;
      } else {
        acc.USD += order.total;
      }
      return acc;
    },
    { USD: 0, EUR: 0 }
  );

  const manualReviewQueue = orders
    .map((order) => {
      const latestPayment = order.payments[0];
      const paymentMeta =
        latestPayment?.meta && typeof latestPayment.meta === "object" && !Array.isArray(latestPayment.meta)
          ? (latestPayment.meta as Record<string, unknown>)
          : {};
      const manualReceipt =
        paymentMeta.manualReceipt && typeof paymentMeta.manualReceipt === "object" && !Array.isArray(paymentMeta.manualReceipt)
          ? (paymentMeta.manualReceipt as Record<string, unknown>)
          : null;
      const submittedAt = typeof manualReceipt?.submittedAt === "string" ? manualReceipt.submittedAt : null;
      const hasReceipt = Boolean(manualReceipt);
      const isPendingManual = latestPayment?.provider === "manual-af" && latestPayment.status === "pending";
      if (!isPendingManual) {
        return null;
      }
      return {
        id: order.id,
        title: `${order.total} ${order.currency} - ${order.user.email}`,
        subtitle: `Order ${order.id.slice(0, 12)}...`,
        status: "pending",
        note: hasReceipt
          ? `Receipt submitted${submittedAt ? ` (${submittedAt})` : ""}`
          : "Waiting for customer receipt upload",
        href: "#ops-orders-users",
        tone: "warn" as const
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);

  const supportQueue = openSupportTickets.slice(0, 6).map((ticket) => ({
    id: ticket.id,
    title: ticket.subject,
    subtitle: ticket.user?.email ?? ticket.email,
    status: ticket.status,
    note: `${ticket.replies.length} repl${ticket.replies.length === 1 ? "y" : "ies"} · ${formatDate(ticket.createdAt)}`,
    href: "#support-tickets",
    tone: ticket.status === "open" ? ("warn" as const) : ("brand" as const)
  }));

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const salesPointMap = new Map(
    last7Days.map((date) => [date.toISOString().slice(0, 10), { orders: 0, paidOrders: 0, label: `${date.getMonth() + 1}/${date.getDate()}` }])
  );

  for (const order of orders) {
    const dateKey = new Date(order.createdAt);
    dateKey.setHours(0, 0, 0, 0);
    const key = dateKey.toISOString().slice(0, 10);
    const bucket = salesPointMap.get(key);
    if (!bucket) {
      continue;
    }
    bucket.orders += 1;
    if (order.status === "paid") {
      bucket.paidOrders += 1;
    }
  }

  const salesPoints = Array.from(salesPointMap.values());

  const topProductMap = new Map<string, { title: string; orderItems: number; paidUsd: number; paidEur: number }>();
  for (const order of recentPaidOrders) {
    for (const item of order.items) {
      const key = item.productVariant.product.id;
      const existing = topProductMap.get(key) ?? {
        title: item.productVariant.product.title,
        orderItems: 0,
        paidUsd: 0,
        paidEur: 0
      };
      existing.orderItems += 1;
      if (order.currency === "EUR") {
        existing.paidEur += item.price;
      } else {
        existing.paidUsd += item.price;
      }
      topProductMap.set(key, existing);
    }
  }
  const topProducts = Array.from(topProductMap.values())
    .sort((a, b) => b.orderItems - a.orderItems || b.paidUsd + b.paidEur - (a.paidUsd + a.paidEur))
    .slice(0, 5);

  const expiringCouponsSoon = coupons.filter((coupon) => {
    if (!coupon.expiresAt) {
      return false;
    }
    const diff = coupon.expiresAt.getTime() - Date.now();
    return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;
  const highUsageCoupons = coupons.filter((coupon) => {
    if (!coupon.maxUses || coupon.maxUses <= 0) {
      return false;
    }
    return coupon.usedCount / coupon.maxUses >= 0.8;
  }).length;

  const productsWithNoVersions = products.filter((product) => product.versions.length === 0).length;
  const recentDownloadLogs = logs.filter((log) => Date.now() - log.createdAt.getTime() <= 1000 * 60 * 60 * 24 * 7).length;
  const recentAuditWrites = auditEvents.filter((event) => Date.now() - event.createdAt.getTime() <= 1000 * 60 * 60 * 24).length;

  const kpis = [
    {
      label: "Products",
      value: formatCompactNumber(products.length),
      hint: `${publishedProducts.length} published · ${bundleProducts.length} bundles`,
      tone: "brand" as const
    },
    {
      label: "Orders (Recent)",
      value: formatCompactNumber(orders.length),
      hint: `${recentPaidOrders.length} paid · ${recentPendingOrders.length} pending · ${recentFailedOrders.length} failed`,
      tone: recentPendingOrders.length > 0 ? ("warn" as const) : ("neutral" as const)
    },
    {
      label: "Revenue USD",
      value: `${formatCompactNumber(recentRevenue.USD)} USD`,
      hint: "Recent admin scope",
      tone: "success" as const
    },
    {
      label: "Revenue EUR",
      value: `${formatCompactNumber(recentRevenue.EUR)} EUR`,
      hint: "Recent admin scope",
      tone: "success" as const
    },
    {
      label: "Users (Recent)",
      value: formatCompactNumber(users.length),
      hint: `${users.filter((user) => user._count.orders > 0).length} with orders`,
      tone: "neutral" as const
    },
    {
      label: "Manual Review Queue",
      value: formatCompactNumber(manualReviewQueue.length),
      hint: "Pending receipt verification",
      tone: manualReviewQueue.length > 0 ? ("warn" as const) : ("success" as const)
    },
    {
      label: "Support Queue",
      value: formatCompactNumber(openSupportTickets.length),
      hint: `${supportTickets.filter((ticket) => ticket.status === "resolved").length} resolved in current list`,
      tone: openSupportTickets.length > 0 ? ("warn" as const) : ("success" as const)
    },
    {
      label: "Audit Activity",
      value: formatCompactNumber(auditEvents.length),
      hint: `${recentAuditWrites} events in last 24h`,
      tone: "neutral" as const
    }
  ];

  const healthCards = [
    {
      title: "Catalog Health",
      tone: productsWithNoVersions > 0 ? ("warn" as const) : ("success" as const),
      lines: [
        `${products.length} total products`,
        `${publishedProducts.length} published / ${products.filter((product) => product.status === "draft").length} draft`,
        `${versions.length} recent version entries shown`,
        `${productsWithNoVersions} products without uploaded versions`
      ]
    },
    {
      title: "Coupons & Campaigns",
      tone: activeCoupons.length > 0 ? ("brand" as const) : ("neutral" as const),
      lines: [
        `${coupons.length} coupons total`,
        `${activeCoupons.length} active coupons`,
        `${expiringCouponsSoon} expiring within 7 days`,
        `${highUsageCoupons} near usage cap (>=80%)`
      ]
    },
    {
      title: "Security & Delivery",
      tone: "neutral" as const,
      lines: [
        `${logs.length} recent download logs shown`,
        `${recentDownloadLogs} download logs in last 7 days`,
        `${auditEvents.length} recent audit events shown`,
        `${manualReviewQueue.length} manual receipts pending review`
      ]
    }
  ];

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Back Office</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Admin Panel</h1>
      </div>

      <AdminRouteNav locale={params.locale} active="overview" />

      {!clerkEnabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Clerk is not configured. Admin mode is enabled for local development.
        </div>
      ) : null}

      <iframe name="admin-action-frame" className="hidden" title="admin-action-frame" />

      <AdminControlCenter
        locale={params.locale}
        kpis={kpis}
        salesPoints={salesPoints}
        topProducts={topProducts}
        manualReviewQueue={manualReviewQueue}
        supportQueue={supportQueue}
        healthCards={healthCards}
      />

      <section id="catalog-create" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Create Product</h2>
          <form action="/api/admin/products" method="post" target="admin-action-frame" className="space-y-3">
            <input type="hidden" name="action" value="create" />
            <input name="title" placeholder="Product title" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="slug" placeholder="product-slug" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="summary" placeholder="Short summary" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <textarea
              name="description"
              placeholder="Description"
              rows={3}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <input name="coverImage" placeholder="Cover image URL" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="demoUrl" placeholder="Demo URL" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input
              name="tech"
              placeholder="Tech stack (comma separated)"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <input
              name="tags"
              placeholder="Tags (comma separated)"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <input type="checkbox" name="isBundle" value="true" />
              Mark as bundle
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input name="personalUsd" type="number" min="1" placeholder="Personal USD" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
              <input name="commercialUsd" type="number" min="1" placeholder="Commercial USD" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="primary-btn text-sm">
              Save Product
            </button>
          </form>
        </article>

        <article className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Upload Version</h2>
          <form action="/api/admin/upload-version" method="post" target="admin-action-frame" encType="multipart/form-data" className="space-y-3">
            <input name="productId" placeholder="product-id" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="version" placeholder="1.2.0" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="changelog" placeholder="Changelog summary" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input name="file" type="file" accept=".zip,.rar,.7z,.tar,.gz,.tgz,.tar.gz" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <input
              name="fileKey"
              placeholder="Optional custom key (auto-generated if empty)"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <button type="submit" className="primary-btn text-sm">
              Save Version
            </button>
          </form>
        </article>
      </section>

      <section id="catalog-products" className="surface-card scroll-mt-24 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Products (CRUD)</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Title</th>
              <th className="pb-2">Slug</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Tech / Tags</th>
              <th className="pb-2">Prices</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const personalPrice = product.variants.find((item) => item.licenseType === "personal")?.priceUSD ?? 0;
              const commercialPrice = product.variants.find((item) => item.licenseType === "commercial")?.priceUSD ?? 0;
              const techList = product.techMaps.map((entry) => entry.tech.name);
              const tagList = product.tagMaps.map((entry) => entry.tag.name);

              return (
                <tr key={product.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{product.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.id}</p>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{product.slug}</td>
                  <td className="py-3 pr-4">{product.isBundle ? "bundle" : "template"}</td>
                  <td className="py-3 pr-4">{product.status}</td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <p>Tech: {techList.length > 0 ? techList.join(", ") : "-"}</p>
                    <p className="mt-1">Tags: {tagList.length > 0 ? tagList.join(", ") : "-"}</p>
                  </td>
                  <td className="py-3 pr-4">
                    {personalPrice} / {commercialPrice} USD
                  </td>
                  <td className="py-3">
                    <form action="/api/admin/products" method="post" target="admin-action-frame" className="mb-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={product.id} />
                      <select
                        name="status"
                        defaultValue={product.status}
                        className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      >
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
                        className="w-24 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <input
                        name="commercialUsd"
                        defaultValue={commercialPrice}
                        type="number"
                        min="1"
                        className="w-24 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <input
                        name="tech"
                        defaultValue={techList.join(", ")}
                        placeholder="Tech"
                        className="w-36 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <input
                        name="tags"
                        defaultValue={tagList.join(", ")}
                        placeholder="Tags"
                        className="w-36 rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      />
                      <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                        Update
                      </button>
                    </form>

                    <form action="/api/admin/products" method="post" target="admin-action-frame">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section id="catalog-versions" className="surface-card scroll-mt-24 overflow-x-auto p-5">
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
            {versions.map((version) => (
              <tr key={version.id}>
                <td className="py-3 pr-4">{version.product.title}</td>
                <td className="py-3 pr-4">{version.version}</td>
                <td className="py-3 pr-4 text-xs text-slate-600">{version.fileKey}</td>
                <td className="py-3">{formatDate(version.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="ops-orders-users" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
        <article className="surface-card overflow-x-auto p-5">
          <h2 className="text-lg font-bold">Orders</h2>
          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">ID</th>
                <th className="pb-2">User</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Payment</th>
                <th className="pb-2">Manual Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const latestPayment = order.payments[0];
                const paymentMeta =
                  latestPayment?.meta && typeof latestPayment.meta === "object" && !Array.isArray(latestPayment.meta)
                    ? (latestPayment.meta as Record<string, unknown>)
                    : {};
                const manualReceipt =
                  paymentMeta.manualReceipt && typeof paymentMeta.manualReceipt === "object" && !Array.isArray(paymentMeta.manualReceipt)
                    ? (paymentMeta.manualReceipt as Record<string, unknown>)
                    : null;
                const receiptRef = typeof manualReceipt?.reference === "string" ? manualReceipt.reference : null;
                const receiptUrl = typeof manualReceipt?.receiptUrl === "string" ? manualReceipt.receiptUrl : null;
                const receiptAt = typeof manualReceipt?.submittedAt === "string" ? manualReceipt.submittedAt : null;
                const pendingManual = latestPayment?.provider === "manual-af" && latestPayment.status === "pending";

                return (
                  <tr key={order.id} className="align-top">
                    <td className="py-3 pr-4 text-xs">{order.id.slice(0, 10)}...</td>
                    <td className="py-3 pr-4">{order.user.email}</td>
                    <td className="py-3 pr-4">
                      {order.total} {order.currency}
                    </td>
                    <td className="py-3 pr-4">{order.status}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">
                      {latestPayment ? (
                        <>
                          <p>
                            {latestPayment.provider} ({latestPayment.status})
                          </p>
                          {receiptRef ? <p className="mt-1">Ref: {receiptRef}</p> : null}
                          {receiptAt ? <p>Submitted: {receiptAt}</p> : null}
                          {receiptUrl ? (
                            <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                              Receipt Link
                            </a>
                          ) : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
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
        </article>

        <article className="surface-card overflow-x-auto p-5">
          <h2 className="text-lg font-bold">Users</h2>
          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Country</th>
                <th className="pb-2">Locale</th>
                <th className="pb-2">Currency</th>
                <th className="pb-2">Orders</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 pr-4">{user.name ?? "-"}</td>
                  <td className="py-3 pr-4 text-xs">{user.email}</td>
                  <td className="py-3 pr-4">{user.country ?? "-"}</td>
                  <td className="py-3 pr-4">{user.locale}</td>
                  <td className="py-3 pr-4">{user.preferredCurrency}</td>
                  <td className="py-3">{user._count.orders}</td>
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
                      <select
                        name="preferredCurrency"
                        defaultValue={user.preferredCurrency}
                        className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
                      >
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
        </article>
      </section>

      <section id="logs-downloads" className="surface-card scroll-mt-24 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Download Logs</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Time</th>
              <th className="pb-2">User</th>
              <th className="pb-2">Product ID</th>
              <th className="pb-2">IP</th>
              <th className="pb-2">User Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="py-3 pr-4">{formatDate(log.createdAt)}</td>
                <td className="py-3 pr-4">{log.user.email}</td>
                <td className="py-3 pr-4">{log.productId}</td>
                <td className="py-3 pr-4">{log.ip ?? "-"}</td>
                <td className="max-w-[300px] truncate py-3">{log.userAgent ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="logs-audit" className="surface-card scroll-mt-24 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Audit Events</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Time</th>
              <th className="pb-2">Actor</th>
              <th className="pb-2">Action</th>
              <th className="pb-2">Target</th>
              <th className="pb-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditEvents.map((event) => (
              <tr key={event.id} className="align-top">
                <td className="py-3 pr-4 text-xs">{formatDate(event.createdAt)}</td>
                <td className="py-3 pr-4 text-xs">{event.actorUser?.email ?? "-"}</td>
                <td className="py-3 pr-4">{event.action}</td>
                <td className="py-3 pr-4 text-xs text-slate-600">
                  {event.targetType}
                  {event.targetId ? ` (${event.targetId})` : ""}
                </td>
                <td className="max-w-[420px] py-3 text-xs text-slate-600">
                  {event.details ? JSON.stringify(event.details) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="marketing-coupons" className="surface-card scroll-mt-24 space-y-4 p-5">
        <h2 className="text-lg font-bold">Coupons</h2>

        <form action="/api/admin/coupons" method="post" target="admin-action-frame" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
          <input type="hidden" name="action" value="create" />
          <input
            name="code"
            placeholder="SAVE20"
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm lg:col-span-2"
          />
          <select name="type" defaultValue="percent" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
          <input name="amount" type="number" min="1" placeholder="Amount" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
          <select name="currency" defaultValue="USD" className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <input
            name="maxUses"
            type="number"
            min="1"
            placeholder="Max uses"
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <input
            name="expiresAt"
            type="datetime-local"
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <button type="submit" className="primary-btn text-sm">
            Create
          </button>
        </form>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Code</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Usage</th>
              <th className="pb-2">Expires</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className="py-3 pr-4 font-semibold">{coupon.code}</td>
                <td className="py-3 pr-4">{coupon.type}</td>
                <td className="py-3 pr-4">
                  {coupon.type === "percent" ? `${coupon.amount}%` : `${coupon.amount} ${coupon.currency ?? "USD"}`}
                </td>
                <td className="py-3 pr-4">
                  {coupon.usedCount}/{coupon.maxUses ?? "-"}
                </td>
                <td className="py-3 pr-4 text-xs text-slate-600">{coupon.expiresAt ? formatDate(coupon.expiresAt) : "-"}</td>
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
            ))}
          </tbody>
        </table>
      </section>

      <section id="support-tickets" className="surface-card scroll-mt-24 overflow-x-auto p-5">
        <h2 className="text-lg font-bold">Support Tickets</h2>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-2">Created</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Subject</th>
              <th className="pb-2">Thread</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {supportTickets.map((ticket) => (
              <tr key={ticket.id} className="align-top">
                <td className="py-3 pr-4 text-xs">{formatDate(ticket.createdAt)}</td>
                <td className="py-3 pr-4 text-xs">{ticket.user?.email ?? ticket.email}</td>
                <td className="py-3 pr-4">{ticket.subject}</td>
                <td className="max-w-[420px] py-3 pr-4 text-xs text-slate-600">
                  <div className="space-y-2">
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                      <span className="font-semibold text-slate-700">Customer:</span> {ticket.message}
                    </p>
                    {ticket.replies.map((reply) => (
                      <p key={reply.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <span className="font-semibold text-slate-700">
                          {reply.authorType === "admin" ? "Admin" : "User"}:
                        </span>{" "}
                        {reply.message}
                      </p>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4">{ticket.status}</td>
                <td className="py-3">
                  <form action="/api/admin/support-tickets" method="post" target="admin-action-frame" className="space-y-2">
                    <input type="hidden" name="id" value={ticket.id} />
                    <div className="flex items-center gap-2">
                      <select name="status" defaultValue={ticket.status} className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                      </select>
                      <button type="submit" className="secondary-btn px-3 py-1.5 text-xs">
                        Update
                      </button>
                    </div>
                    <textarea
                      name="reply"
                      rows={2}
                      placeholder="Reply to customer (optional)"
                      className="w-full rounded-lg border border-border bg-white px-2 py-1 text-xs"
                    />
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

