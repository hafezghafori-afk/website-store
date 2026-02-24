import Link from "next/link";

type AdminRouteKey = "overview" | "products" | "categories" | "campaigns" | "orders" | "users" | "reports";

type AdminRouteNavProps = {
  locale: string;
  active: AdminRouteKey;
};

const ROUTES: Array<{ key: AdminRouteKey; label: string; href: (locale: string) => string; hint: string }> = [
  {
    key: "overview",
    label: "Overview",
    href: (locale) => `/${locale}/admin`,
    hint: "Control center"
  },
  {
    key: "products",
    label: "Products",
    href: (locale) => `/${locale}/admin/products`,
    hint: "Catalog & versions"
  },
  {
    key: "categories",
    label: "Categories",
    href: (locale) => `/${locale}/admin/categories`,
    hint: "Taxonomy & grouping"
  },
  {
    key: "campaigns",
    label: "Campaigns",
    href: (locale) => `/${locale}/admin/campaigns`,
    hint: "Coupons & promos"
  },
  {
    key: "orders",
    label: "Orders",
    href: (locale) => `/${locale}/admin/orders`,
    hint: "Payments & reviews"
  },
  {
    key: "users",
    label: "Users",
    href: (locale) => `/${locale}/admin/users`,
    hint: "Profiles & billing prefs"
  },
  {
    key: "reports",
    label: "Reports",
    href: (locale) => `/${locale}/admin/reports`,
    hint: "Sales analytics"
  }
];

export function AdminRouteNav({ locale, active }: AdminRouteNavProps) {
  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {ROUTES.map((route) => {
          const isActive = route.key === active;
          return (
            <Link
              key={route.key}
              href={route.href(locale)}
              className={
                isActive
                  ? "rounded-xl border border-brand-200 bg-brand-50 px-3 py-3"
                  : "rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50"
              }
            >
              <p className={isActive ? "text-sm font-bold text-brand-900" : "text-sm font-bold text-slate-900"}>{route.label}</p>
              <p className={isActive ? "mt-1 text-xs text-brand-700" : "mt-1 text-xs text-slate-500"}>{route.hint}</p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
