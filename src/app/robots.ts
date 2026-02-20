import type { MetadataRoute } from "next";

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

export default function robots(): MetadataRoute.Robots {
  const base = resolveBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/api/", "/fa/admin", "/en/admin", "/fa/dashboard", "/en/dashboard"]
      }
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`
  };
}
