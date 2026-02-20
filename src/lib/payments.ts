import type { Currency } from "@/lib/constants";
import type { PaymentProvider } from "@/lib/types";

export type PaymentOption = {
  provider: PaymentProvider;
  label: string;
  description: string;
  enabled: boolean;
};

function hasValidStripePublishableKey() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key) {
    return false;
  }

  const normalized = key.toLowerCase();
  if (
    normalized.includes("xxx") ||
    normalized.includes("example") ||
    normalized.includes("your_")
  ) {
    return false;
  }

  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
}

export function getPaymentOptions(countryCode: string, currency: Currency): PaymentOption[] {
  const country = countryCode.toUpperCase();
  const stripeEnabled = (currency === "USD" || currency === "EUR") && hasValidStripePublishableKey();

  if (country === "IR") {
    return [
      {
        provider: "zarinpal",
        label: "Zarinpal",
        description: "Online payment in IRR/Toman via local gateway.",
        enabled: true
      },
      {
        provider: "stripe",
        label: "Stripe",
        description: "International cards if customer has foreign payment option.",
        enabled: stripeEnabled
      }
    ];
  }

  if (country === "AF") {
    return [
      {
        provider: "manual-af",
        label: "Manual Transfer",
        description: "Bank transfer receipt with admin verification.",
        enabled: true
      },
      {
        provider: "stripe",
        label: "Stripe",
        description: "Pay with international cards in USD/EUR.",
        enabled: stripeEnabled
      }
    ];
  }

  if (stripeEnabled) {
    return [
      {
        provider: "stripe",
        label: "Stripe",
        description: "Cards, Apple Pay, and Google Pay.",
        enabled: true
      }
    ];
  }

  return [
    {
      provider: "manual-af",
      label: "Manual Transfer",
      description: "Fallback option: submit transfer receipt for admin verification.",
      enabled: true
    }
  ];
}
