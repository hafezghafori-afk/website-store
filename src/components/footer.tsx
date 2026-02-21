import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

type FooterProps = {
  locale: Locale;
};

export function Footer({ locale }: FooterProps) {
  const t = getDictionary(locale);

  return (
    <footer className="mt-20 border-t border-border bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <p className="text-lg font-semibold">{t.brandName}</p>
          <p className="mt-2 text-sm text-slate-600">Minimal template marketplace for fast product launches.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link href={`/${locale}/templates`}>Templates</Link>
            </li>
            <li>
              <Link href={`/${locale}/templates?type=bundle`}>Bundles</Link>
            </li>
            <li>
              <Link href={`/${locale}/about`}>About</Link>
            </li>
            <li>
              <Link href={`/${locale}/pricing`}>Pricing</Link>
            </li>
            <li>
              <Link href={`/${locale}/blog`}>Blog</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Support</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link href={`/${locale}/docs`}>Docs</Link>
            </li>
            <li>
              <Link href={`/${locale}/faq`}>FAQ</Link>
            </li>
            <li>
              <Link href={`/${locale}/contact`}>Contact</Link>
            </li>
            <li>
              <Link href={`/${locale}/terms`}>Terms</Link>
            </li>
            <li>
              <Link href={`/${locale}/privacy`}>Privacy</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
