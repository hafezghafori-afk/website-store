import type { Currency, LicenseType } from "@/lib/constants";

export type ProductCategory = {
  id: string;
  title: string;
  slug: string;
  description: string;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  coverImage: string;
  demoUrl: string;
  isBundle: boolean;
  status: "draft" | "published";
  category: string;
  tags: string[];
  tech: string[];
  rtl: boolean;
  responsive: boolean;
  includes: string[];
  versions: string[];
  basePriceUsd: {
    personal: number;
    commercial: number;
  };
  changelog: string[];
  faq: { q: string; a: string }[];
  reviews: { name: string; message: string; rating: number }[];
  isNew: boolean;
  isBestSeller: boolean;
};

export type ProductPriceInput = {
  product: Product;
  licenseType: LicenseType;
  currency: Currency;
};

export type PaymentProvider = "stripe" | "zarinpal" | "manual-af";
