import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { NavbarAuthControls } from "@/components/navbar-auth-controls";
import { isClerkEnabled } from "@/lib/clerk-config";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUserId, isAdminUser } from "@/lib/server-auth";

const locales: Locale[] = ["fa", "en"];

type NavbarProps = {
  locale: Locale;
};

export function Navbar({ locale }: NavbarProps) {
  const t = getDictionary(locale);
  const clerkEnabled = isClerkEnabled();
  const currentUserId = clerkEnabled ? getCurrentUserId() : null;
  const showAdminLink = clerkEnabled && currentUserId ? isAdminUser() : false;
  const dashboardLabel = locale === "fa" ? "داشبورد" : "Dashboard";
  const adminLabel = locale === "fa" ? "ادمین" : "Admin";
  const logoutLabel = locale === "fa" ? "خروج" : "Logout";

  return (
    <header className="border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="text-lg font-black tracking-tight text-text">
          {t.brandName}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href={`/${locale}/templates`}>{t.nav.templates}</Link>
          <Link href={`/${locale}/templates?type=bundle`}>{t.nav.bundles}</Link>
          <Link href={`/${locale}/pricing`}>Pricing</Link>
          <Link href={`/${locale}/blog`}>Blog</Link>
          <Link href={`/${locale}/faq`}>FAQ</Link>
          <Link href={`/${locale}/contact`}>Contact</Link>
          <Link href={`/${locale}/docs`}>{t.nav.docs}</Link>
          <Link href={`/${locale}/support`}>{t.nav.support}</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden rounded-xl border border-border bg-white px-2 py-1 text-xs text-slate-600 sm:flex sm:items-center sm:gap-1">
            {locales.map((item) => (
              <Link
                key={item}
                href={`/${item}`}
                className={item === locale ? "rounded-md bg-slate-100 px-2 py-1 font-semibold text-text" : "rounded-md px-2 py-1"}
              >
                {item}
              </Link>
            ))}
          </div>
          <NavbarAuthControls
            locale={locale}
            clerkEnabled={clerkEnabled}
            showAdminLink={showAdminLink}
            labels={{
              login: t.nav.login,
              dashboard: dashboardLabel,
              admin: adminLabel,
              logout: logoutLabel
            }}
          />
          <Link href={`/${locale}/cart`} className="primary-btn text-sm">
            {t.nav.cart}
          </Link>
        </div>
      </div>
    </header>
  );
}
