import Link from "next/link";

type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

type KpiCard = {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
};

type SalesPoint = {
  label: string;
  orders: number;
  paidOrders: number;
};

type TopProductRow = {
  title: string;
  orderItems: number;
  paidUsd: number;
  paidEur: number;
};

type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  note?: string;
  href: string;
  tone?: Tone;
};

type HealthCard = {
  title: string;
  tone?: Tone;
  lines: string[];
};

type AdminControlCenterProps = {
  locale: string;
  kpis: KpiCard[];
  salesPoints: SalesPoint[];
  topProducts: TopProductRow[];
  manualReviewQueue: QueueItem[];
  supportQueue: QueueItem[];
  healthCards: HealthCard[];
};

function toneClasses(tone: Tone = "neutral") {
  if (tone === "brand") {
    return "border-brand-200 bg-brand-50 text-brand-900";
  }
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (tone === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  return "border-slate-200 bg-white text-slate-900";
}

function statusBadgeTone(status: string): Tone {
  const value = status.toLowerCase();
  if (["paid", "succeeded", "resolved", "closed", "published", "active"].includes(value)) {
    return "success";
  }
  if (["pending", "open", "in_progress"].includes(value)) {
    return "warn";
  }
  if (["failed", "cancelled", "archived", "inactive"].includes(value)) {
    return "danger";
  }
  return "neutral";
}

export function AdminControlCenter({
  locale,
  kpis,
  salesPoints,
  topProducts,
  manualReviewQueue,
  supportQueue,
  healthCards
}: AdminControlCenterProps) {
  const maxOrders = Math.max(1, ...salesPoints.map((point) => point.orders));

  return (
    <section id="overview" className="space-y-6 scroll-mt-24">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-brand-50 via-slate-50 to-emerald-50" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Control Center</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">Modern Admin Workspace</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                One-page operational view for catalog, payments, users, support, coupons, and audit activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${locale}`} className="secondary-btn px-3 py-2 text-xs">
                Storefront
              </Link>
              <Link href={`/${locale}/templates`} className="secondary-btn px-3 py-2 text-xs">
                Catalog
              </Link>
              <Link href={`/${locale}/support`} className="secondary-btn px-3 py-2 text-xs">
                Support
              </Link>
              <Link href={`/${locale}/docs`} className="secondary-btn px-3 py-2 text-xs">
                API Docs
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["Overview", "#overview"],
              ["Create", "#catalog-create"],
              ["Products", "#catalog-products"],
              ["Orders", "#ops-orders-users"],
              ["Logs", "#logs-downloads"],
              ["Coupons", "#marketing-coupons"],
              ["Support", "#support-tickets"]
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <article key={item.label} className={`rounded-2xl border p-4 ${toneClasses(item.tone)}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-80">{item.label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight">{item.value}</p>
            {item.hint ? <p className="mt-1 text-xs opacity-80">{item.hint}</p> : null}
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Sales Snapshot (Recent Orders)</h3>
              <p className="text-xs text-slate-500">Quick daily order trend from the current admin dataset.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {salesPoints.map((point) => (
              <div key={point.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>{point.label}</span>
                  <span>
                    {point.orders} orders / {point.paidOrders} paid
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-brand-600"
                    style={{ width: `${Math.max(4, Math.round((point.orders / maxOrders) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card p-5">
          <h3 className="text-lg font-bold">Top Products (Recent)</h3>
          <p className="mt-1 text-xs text-slate-500">Ranked by purchased order items in the loaded admin scope.</p>
          <div className="mt-4 space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No sales data available yet.</p>
            ) : (
              topProducts.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.orderItems} order items</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p>USD: {item.paidUsd}</p>
                      <p>EUR: {item.paidEur}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Manual Payment Review Queue</h3>
            <a href="#ops-orders-users" className="text-xs font-semibold text-brand-700 underline">
              Go to orders
            </a>
          </div>
          <div className="space-y-3">
            {manualReviewQueue.length === 0 ? (
              <p className="text-sm text-slate-500">No pending manual reviews right now.</p>
            ) : (
              manualReviewQueue.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                      {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses(item.tone ?? statusBadgeTone(item.status))}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <a href={item.href} className="text-xs font-semibold text-brand-700 underline">
                      Open queue
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Support Queue</h3>
            <a href="#support-tickets" className="text-xs font-semibold text-brand-700 underline">
              Open tickets
            </a>
          </div>
          <div className="space-y-3">
            {supportQueue.length === 0 ? (
              <p className="text-sm text-slate-500">No open support tickets in queue.</p>
            ) : (
              supportQueue.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                      {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses(item.tone ?? statusBadgeTone(item.status))}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <a href={item.href} className="text-xs font-semibold text-brand-700 underline">
                      Open queue
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {healthCards.map((card) => (
          <article key={card.title} className={`rounded-2xl border p-4 ${toneClasses(card.tone)}`}>
            <h3 className="text-sm font-bold">{card.title}</h3>
            <ul className="mt-3 space-y-2 text-xs">
              {card.lines.map((line) => (
                <li key={line} className="leading-5 opacity-90">
                  {line}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
