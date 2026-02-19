import { clsx, type ClassValue } from "clsx";
import { BASE_CURRENCY, EUR_RATE, type Currency } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function convertFromUsd(amount: number, currency: Currency): number {
  if (currency === BASE_CURRENCY) {
    return amount;
  }
  return Math.round(amount * EUR_RATE);
}

function resolveIntlLocale(locale: string) {
  const normalized = locale.trim().toLowerCase();
  const preferred =
    normalized === "fa"
      ? ["fa-IR", "fa", "en-US"]
      : normalized === "en"
        ? ["en-US", "en"]
        : [locale, "en-US"];

  for (const candidate of preferred) {
    try {
      if (Intl.NumberFormat.supportedLocalesOf([candidate]).length > 0) {
        return candidate;
      }
    } catch {
      // Ignore invalid locale candidate and keep fallback chain.
    }
  }

  return "en-US";
}

export function formatMoney(amount: number, currency: Currency, locale = "en"): string {
  return new Intl.NumberFormat(resolveIntlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}
