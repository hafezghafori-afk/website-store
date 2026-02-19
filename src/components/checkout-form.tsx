"use client";

import { useEffect, useMemo, useState } from "react";
import type { Currency, LicenseType } from "@/lib/constants";
import { getPaymentOptions } from "@/lib/payments";

type CheckoutFormProps = {
  productId: string;
  licenseType: LicenseType;
  currency: Currency;
  initialCountry: string;
};

type CheckoutResult = {
  ok: boolean;
  message?: string;
  redirectUrl?: string;
  orderId?: string;
};

export function CheckoutForm({ productId, licenseType, currency, initialCountry }: CheckoutFormProps) {
  const [country, setCountry] = useState(initialCountry.toUpperCase());
  const options = useMemo(() => getPaymentOptions(country, currency).filter((item) => item.enabled), [country, currency]);
  const [provider, setProvider] = useState(options[0]?.provider ?? "stripe");
  const [couponCode, setCouponCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProvider(options[0]?.provider ?? "stripe");
  }, [country, currency, options]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId,
          licenseType,
          currency,
          country,
          provider,
          couponCode: couponCode.trim() || undefined
        })
      });

      const result = (await response.json()) as CheckoutResult;

      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Checkout failed.");
        return;
      }

      setStatus("success");
      setMessage(result.message ?? "Order created.");

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface-card space-y-4 p-5">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Country</label>
        <select
          value={country}
          onChange={(event) => setCountry(event.target.value.toUpperCase())}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="US">United States</option>
          <option value="DE">Germany</option>
          <option value="IR">Iran</option>
          <option value="AF">Afghanistan</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Payment Method</label>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as typeof provider)}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        >
          {options.map((option) => (
            <option key={option.provider} value={option.provider}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {options.find((item) => item.provider === provider)?.description ?? "Select a payment method."}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Coupon (Optional)</label>
        <input
          value={couponCode}
          onChange={(event) => setCouponCode(event.target.value)}
          placeholder="SAVE20"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      <button type="submit" disabled={status === "loading"} className="primary-btn w-full text-sm disabled:opacity-60">
        {status === "loading" ? "Processing..." : "Continue to Payment"}
      </button>

      {message ? (
        <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-600"}>{message}</p>
      ) : null}
    </form>
  );
}
