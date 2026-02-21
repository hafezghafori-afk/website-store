import type { Currency } from "@/lib/constants";
import type { PaymentProvider } from "@/lib/types";

export type PaymentOption = {
  provider: PaymentProvider;
  label: string;
  description: string;
  enabled: boolean;
};

function supportsStripeCurrency(currency: Currency) {
  return currency === "USD" || currency === "EUR";
}

export function getPaymentOptions(countryCode: string, currency: Currency): PaymentOption[] {
  const country = countryCode.toUpperCase();
  const stripeEnabled = supportsStripeCurrency(currency);

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

  return [
    {
      provider: "stripe",
      label: "Stripe",
      description: "Cards, Apple Pay, and Google Pay.",
      enabled: stripeEnabled
    }
  ];
}
