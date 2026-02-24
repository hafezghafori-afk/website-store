import { BASE_CURRENCY, type Currency, type LicenseType, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { convertFromUsd, formatMoney } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function isCurrency(input: string): input is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(input);
}

export function getPriceValue(product: Product, licenseType: LicenseType, currency: Currency): number {
  const usdPrice = product.basePriceUsd[licenseType];
  if (currency === BASE_CURRENCY) {
    return usdPrice;
  }
  return convertFromUsd(usdPrice, currency);
}

export function getPriceLabel(product: Product, licenseType: LicenseType, currency: Currency, locale = "en") {
  const value = getPriceValue(product, licenseType, currency);
  return formatMoney(value, currency, locale);
}

export function filterProducts(products: Product[], query: {
  search?: string;
  category?: string;
  tech?: string;
  rtl?: string;
  type?: string;
  license?: LicenseType;
  min?: number;
  max?: number;
  currency?: Currency;
  sort?: string;
}) {
  const currency = query.currency && isCurrency(query.currency) ? query.currency : BASE_CURRENCY;
  const normalizedSearch = query.search?.trim().toLowerCase();

  let result = products.filter((item) => {
    if (normalizedSearch) {
      const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")} ${item.tech.join(" ")}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    if (query.tech && query.tech !== "all" && !item.tech.some((t) => t.toLowerCase() === query.tech?.toLowerCase())) {
      return false;
    }

    if (query.category && query.category !== "all" && item.category !== query.category) {
      return false;
    }

    if (query.rtl === "yes" && !item.rtl) {
      return false;
    }

    if (query.rtl === "no" && item.rtl) {
      return false;
    }

    if (query.type === "bundle" && !item.isBundle) {
      return false;
    }
    if (query.type === "template" && item.isBundle) {
      return false;
    }

    const license = query.license ?? "personal";
    const price = getPriceValue(item, license, currency);
    if (typeof query.min === "number" && !Number.isNaN(query.min) && price < query.min) {
      return false;
    }
    if (typeof query.max === "number" && !Number.isNaN(query.max) && price > query.max) {
      return false;
    }

    return true;
  });

  const sort = query.sort ?? "new";
  if (sort === "price") {
    result = result.sort((a, b) => getPriceValue(a, "personal", currency) - getPriceValue(b, "personal", currency));
  } else if (sort === "popular") {
    result = result.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));
  } else {
    result = result.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  }

  return result;
}

export function extractFilterOptions(products: Product[]) {
  return Array.from(new Set(products.flatMap((item) => item.tech))).sort((a, b) => a.localeCompare(b));
}

export function extractCategoryOptions(products: Product[]) {
  return Array.from(new Set(products.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
