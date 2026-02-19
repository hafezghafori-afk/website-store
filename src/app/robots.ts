import type { MetadataRoute } from "next";

function resolveBaseUrl() {
  const fallback = "http://localhost:3002";
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? fallback);
  } catch {
    return new URL(fallback);
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
    sitemap: `${base.toString().replace(/\/$/, "")}/sitemap.xml`
  };
}
