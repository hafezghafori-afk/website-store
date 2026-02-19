import { PRODUCTS } from "@/lib/mock-data";
import { getPriceValue } from "@/lib/products";
import type { Currency, LicenseType } from "@/lib/constants";

export function buildMockOrder(params: {
  userId: string;
  productId: string;
  currency: Currency;
  licenseType: LicenseType;
}) {
  const product = PRODUCTS.find((item) => item.id === params.productId);
  if (!product) {
    return null;
  }

  const total = getPriceValue(product, params.licenseType, params.currency);
  return {
    id: `ord_${Math.random().toString(36).slice(2, 10)}`,
    userId: params.userId,
    status: "pending",
    currency: params.currency,
    total,
    items: [
      {
        productId: product.id,
        productTitle: product.title,
        licenseType: params.licenseType,
        price: total
      }
    ]
  };
}
