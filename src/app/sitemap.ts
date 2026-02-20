import type { MetadataRoute } from "next";
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

function toAbsolute(path: string) {
  const base = resolveBaseUrl();
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  try {
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
        }
      );
    }

    return entries;
  } catch (error) {
    console.error("[sitemap] failed to build sitemap entries", error);
    const now = new Date();
    return LOCALES.map((locale) => ({
      url: toAbsolute(`/${locale}`),
      lastModified: now
    }));
  }
}
