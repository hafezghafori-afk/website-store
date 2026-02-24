import Link from "next/link";

type AccountRouteKey = "overview" | "orders" | "downloads" | "profile";

type AccountRouteNavProps = {
  locale: string;
  active: AccountRouteKey;
};

const ROUTES: Array<{ key: AccountRouteKey; label: string; href: (locale: string) => string; hint: string }> = [
  {
    key: "overview",
    label: "Overview",
    href: (locale) => `/${locale}/dashboard`,
    hint: "Account summary"
  },
  {
    key: "orders",
    label: "My Orders",
    href: (locale) => `/${locale}/dashboard/orders`,
    hint: "Payments & status"
  },
  {
    key: "downloads",
    label: "Downloads",
    href: (locale) => `/${locale}/dashboard/downloads`,
    hint: "Secure download links"
  },
  {
    key: "profile",
    label: "Profile & Billing",
    href: (locale) => `/${locale}/dashboard/profile`,
    hint: "Preferences & API keys"
  }
];

export function AccountRouteNav({ locale, active }: AccountRouteNavProps) {
  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
