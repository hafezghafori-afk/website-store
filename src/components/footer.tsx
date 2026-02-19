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
            <li>Templates</li>
            <li>Bundles</li>
            <li>Licenses</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Support</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Docs</li>
            <li>Billing</li>
            <li>Contact</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
