export const LOCALES = ["fa", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fa";
export const RTL_LOCALES: Locale[] = ["fa"];

export const NAV_PATHS = {
  templates: "/templates",
  bundles: "/templates?type=bundle",
  docs: "/docs",
  support: "/support"
} as const;

export const SUPPORTED_CURRENCIES = ["USD", "EUR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY: Currency = "USD";
export const EUR_RATE = 0.92;

export const LICENSE_TYPES = ["personal", "commercial"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
