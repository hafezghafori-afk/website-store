import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

const locales: Locale[] = ["fa", "en"];

type NavbarProps = {
  locale: Locale;
};

export function Navbar({ locale }: NavbarProps) {
  const t = getDictionary(locale);

  return (
    <header className="border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="text-lg font-black tracking-tight text-text">
          {t.brandName}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href={`/${locale}/templates`}>{t.nav.templates}</Link>
          <Link href={`/${locale}/templates?type=bundle`}>{t.nav.bundles}</Link>
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
          <Link href={`/${locale}/login`} className="secondary-btn text-sm">
            {t.nav.login}
          </Link>
          <Link href={`/${locale}/checkout`} className="primary-btn text-sm">
            {t.nav.cart}
          </Link>
        </div>
      </div>
    </header>
  );
}
