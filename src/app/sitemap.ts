import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/constants";
import { PRODUCTS } from "@/lib/mock-data";

function resolveBaseUrl() {
  const fallback = "https://website-store-five.vercel.app";
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim() || fallback;
  const normalized = raw.replace(/^['"]|['"]$/g, "");

  try {
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return new URL(normalized);
    }
    return new URL(`https://${normalized}`);
  } catch {
    return new URL(fallback);
  }
}

function toAbsolute(path: string) {
  const base = resolveBaseUrl();
  return new URL(path, base).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
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

    for (const product of PRODUCTS) {
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
