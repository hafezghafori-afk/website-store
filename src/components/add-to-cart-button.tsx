"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { addCartItem } from "@/lib/cart-client";

type AddToCartButtonProps = {
  locale: Locale;
  productId: string;
  licenseType: LicenseType;
  currency: Currency;
  label: string;
};

export function AddToCartButton({ locale, productId, licenseType, currency, label }: AddToCartButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function onClick() {
    setLoading(true);
    addCartItem({
      productId,
      licenseType,
      currency
    });
    router.push(`/${locale}/cart`);
  }

  return (
    <button type="button" onClick={onClick} className="primary-btn text-sm" disabled={loading}>
      {loading ? "..." : label}
    </button>
  );
}
