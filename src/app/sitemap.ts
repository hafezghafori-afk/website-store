import type { MetadataRoute } from "next";
import { getStoreProducts } from "@/lib/catalog";
import { LOCALES } from "@/lib/constants";

function resolveBaseUrl() {
  const fallback = "http://localhost:3002";
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? fallback);
  } catch {
    return new URL(fallback);
  }
}

function toAbsolute(path: string) {
  const base = resolveBaseUrl();
  return new URL(path, base).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await getStoreProducts();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push(
      {
        url: toAbsolute(`/${locale}`),
        lastModified: now,
        changeFrequency: "daily",
        priority: 1
      },
      {
        url: toAbsolute(`/${locale}/templates`),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9
      },
      {
        url: toAbsolute(`/${locale}/docs`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5
      },
      {
        url: toAbsolute(`/${locale}/support`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5
      },
      {
        url: toAbsolute(`/${locale}/checkout`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.4
      }
    );

    for (const product of products) {
      entries.push({
        url: toAbsolute(`/${locale}/templates/${product.slug}`),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8
      });
    }
  }

  return entries;
}
