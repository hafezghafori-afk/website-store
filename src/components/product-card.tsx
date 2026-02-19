import Image from "next/image";
import Link from "next/link";
import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { getPriceLabel } from "@/lib/products";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  locale: Locale;
  currency: Currency;
  licenseType: LicenseType;
  product: Product;
};

export function ProductCard({ locale, currency, licenseType, product }: ProductCardProps) {
  const t = getDictionary(locale);
  const priceLabel = getPriceLabel(product, licenseType, currency, locale);

  return (
    <article className="surface-card overflow-hidden shadow-soft">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        <Image src={product.coverImage} alt={product.title} fill className="object-cover" />
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{product.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{product.summary}</p>
          {product.isBundle ? (
            <p className="mt-2 inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">
              Bundle
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {product.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-base font-bold">{priceLabel}</p>
          <Link href={`/${locale}/templates/${product.slug}`} className="secondary-btn text-sm">
            {t.common.details}
          </Link>
        </div>
      </div>
    </article>
  );
}
