import type { MetadataRoute } from "next";
import { getStoreProducts } from "@/lib/catalog";
import { LOCALES } from "@/lib/constants";

function resolveBaseUrl() {
  const fallback = "https://website-store-five.vercel.app";
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    fallback;
  const normalized = raw.replace(/^['"]|['"]$/g, "");

  try {
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return new URL(normalized).origin;
    }
    return new URL(`https://${normalized}`).origin;
  } catch {
    return fallback;
  }
}

function withBase(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveBaseUrl();
  const now = new Date();

  const staticPaths = [
    "",
    "/templates",
    "/cart",
    "/pricing",
    "/blog",
    "/docs",
    "/support",
    "/faq",
    "/contact",
    "/about",
    "/terms",
    "/privacy"
  ];

  const localizedStatic = LOCALES.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: withBase(base, `/${locale}${path}`),
      lastModified: now
    }))
  );

  const products = await getStoreProducts();
  const localizedProducts = LOCALES.flatMap((locale) =>
    products.map((product) => ({
      url: withBase(base, `/${locale}/templates/${product.slug}`),
      lastModified: now
    }))
  );

  return [...localizedStatic, ...localizedProducts];
}
