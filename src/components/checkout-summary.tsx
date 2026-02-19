import type { Currency, LicenseType } from "@/lib/constants";
import { getPriceLabel } from "@/lib/products";
import type { Product } from "@/lib/types";

type CheckoutSummaryProps = {
  product: Product;
  licenseType: LicenseType;
  currency: Currency;
  locale: string;
};

export function CheckoutSummary({ product, licenseType, currency, locale }: CheckoutSummaryProps) {
  return (
    <div className="surface-card space-y-4 p-5">
      <p className="text-sm font-semibold text-text">Order Summary</p>
      <div className="space-y-2 text-sm text-slate-700">
        <p>{product.title}</p>
        <p className="text-slate-500">License: {licenseType}</p>
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-sm text-slate-500">Total</p>
        <p className="text-2xl font-black">{getPriceLabel(product, licenseType, currency, locale)}</p>
      </div>
    </div>
  );
}
