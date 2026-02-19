import Link from "next/link";
import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { getPriceLabel } from "@/lib/products";
import type { Product } from "@/lib/types";

type PriceBoxProps = {
  locale: Locale;
  currency: Currency;
  licenseType: LicenseType;
  product: Product;
};

export function PriceBox({ locale, currency, licenseType, product }: PriceBoxProps) {
  const t = getDictionary(locale);

  return (
    <div className="surface-card sticky top-24 space-y-4 p-5">
      <p className="text-sm text-slate-500">{licenseType === "personal" ? "Personal License" : "Commercial License"}</p>
      <p className="text-3xl font-black tracking-tight">{getPriceLabel(product, licenseType, currency, locale)}</p>
      <p className="text-sm text-slate-600">Instant digital delivery after payment confirmation.</p>

      <div className="space-y-2">
        <Link
          href={`/${locale}/checkout?productId=${product.id}&licenseType=${licenseType}&currency=${currency}`}
          className="primary-btn w-full text-sm"
        >
          {t.common.buyNow}
        </Link>
        <a href={product.demoUrl} target="_blank" rel="noreferrer" className="secondary-btn w-full text-sm">
          View Live Demo
        </a>
      </div>
    </div>
  );
}
