"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { clearCart, readCart, removeCartItem, type CartItem } from "@/lib/cart-client";
import { getPaymentOptions } from "@/lib/payments";
import { getPriceValue } from "@/lib/products";
import type { PaymentProvider, Product } from "@/lib/types";

type CartPageClientProps = {
  locale: Locale;
};

type CartApiResponse = {
  ok: boolean;
  items?: Product[];
};

type CheckoutApiResponse = {
  ok: boolean;
  message?: string;
  redirectUrl?: string;
  orderId?: string;
};

type CartLine = CartItem & {
  product: Product;
  amount: number;
};

export function CartPageClient({ locale }: CartPageClientProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [country, setCountry] = useState("US");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("USD");
  const [provider, setProvider] = useState<PaymentProvider>("stripe");
  const [couponCode, setCouponCode] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [checkoutMessage, setCheckoutMessage] = useState("");

  useEffect(() => {
    const localItems = readCart();
    setCartItems(localItems);
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        const result = (await response.json()) as CartApiResponse;
        if (!response.ok || !result.ok || !Array.isArray(result.items)) {
          throw new Error("Could not load products.");
        }
        const map = result.items.reduce<Record<string, Product>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
        setProductsMap(map);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Could not load products.");
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, []);

  const lines = useMemo(() => {
    return cartItems
      .map((item) => {
        const product = productsMap[item.productId];
        if (!product) {
          return null;
        }
        const amount = getPriceValue(product, item.licenseType as LicenseType, item.currency as Currency);
        return { ...item, product, amount } satisfies CartLine;
      })
      .filter((item): item is CartLine => Boolean(item));
  }, [cartItems, productsMap]);

  const availableCurrencies = useMemo(() => {
    return Array.from(new Set(lines.map((line) => line.currency as Currency)));
  }, [lines]);

  useEffect(() => {
    if (availableCurrencies.length === 0) {
      setSelectedCurrency("USD");
      return;
    }
    if (availableCurrencies.includes(selectedCurrency)) {
      return;
    }
    setSelectedCurrency(availableCurrencies[0]);
  }, [availableCurrencies, selectedCurrency]);

  const selectedLines = useMemo(() => {
    return lines.filter((line) => line.currency === selectedCurrency);
  }, [lines, selectedCurrency]);

  const providerOptions = useMemo(() => {
    return getPaymentOptions(country, selectedCurrency).filter((item) => item.enabled);
  }, [country, selectedCurrency]);

  useEffect(() => {
    if (providerOptions.length === 0) {
      setProvider("stripe");
      return;
    }
    if (providerOptions.some((item) => item.provider === provider)) {
      return;
    }
    setProvider(providerOptions[0].provider);
  }, [providerOptions, provider]);

  const totals = useMemo(() => {
    return lines.reduce<Record<Currency, number>>(
      (acc, line) => {
        acc[line.currency as Currency] += line.amount;
        return acc;
      },
      { USD: 0, EUR: 0 }
    );
  }, [lines]);

  function onRemove(item: CartItem) {
    const next = removeCartItem({
      productId: item.productId,
      licenseType: item.licenseType,
      currency: item.currency
    });
    setCartItems(next);
  }

  function onClear() {
    clearCart();
    setCartItems([]);
  }

  async function onCheckoutAll() {
    if (selectedLines.length === 0) {
      return;
    }

    setCheckoutStatus("loading");
    setCheckoutMessage("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: selectedLines.map((line) => ({
            productId: line.productId,
            licenseType: line.licenseType
          })),
          currency: selectedCurrency,
          country,
          provider,
          couponCode: couponCode.trim() || undefined
        })
      });

      const result = (await response.json()) as CheckoutApiResponse;
      if (!response.ok || !result.ok) {
        setCheckoutStatus("error");
        setCheckoutMessage(result.message ?? "Checkout failed.");
        return;
      }

      setCheckoutStatus("success");
      setCheckoutMessage(result.message ?? "Order created.");
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (checkoutError) {
      setCheckoutStatus("error");
      setCheckoutMessage(checkoutError instanceof Error ? checkoutError.message : "Unexpected checkout error.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        {loading ? <div className="surface-card p-5 text-sm text-slate-600">Loading cart...</div> : null}
        {!loading && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && lines.length === 0 ? (
          <div className="surface-card space-y-3 p-5">
            <h2 className="text-xl font-black tracking-tight">Your cart is empty</h2>
            <p className="text-sm text-slate-600">Add templates from catalog, then continue to checkout.</p>
            <div>
              <Link href={`/${locale}/templates`} className="primary-btn text-sm">
                Browse Templates
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && !error && lines.length > 0
          ? lines.map((line) => (
              <article key={`${line.productId}-${line.licenseType}-${line.currency}`} className="surface-card space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{line.product.title}</h2>
                  <button
                    type="button"
                    onClick={() => onRemove(line)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  License: {line.licenseType} | Currency: {line.currency} | Price: {line.amount} {line.currency}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/${locale}/templates/${line.product.slug}`} className="secondary-btn text-sm">
                    View Details
                  </Link>
                  <Link
                    href={`/${locale}/checkout?productId=${line.productId}&licenseType=${line.licenseType}&currency=${line.currency}`}
                    className="primary-btn text-sm"
                  >
                    Checkout This Item
                  </Link>
                </div>
              </article>
            ))
          : null}
      </section>

      <aside className="surface-card h-fit space-y-4 p-5">
        <p className="text-sm font-semibold text-text">Cart Summary</p>
        <p className="text-sm text-slate-600">Items: {lines.length}</p>
        <div className="space-y-2 text-sm text-slate-700">
          <p>USD Total: {totals.USD}</p>
          <p>EUR Total: {totals.EUR}</p>
        </div>

        {availableCurrencies.length > 1 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            You have mixed currencies in cart. Checkout processes one currency per order.
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Currency</label>
          <select
            value={selectedCurrency}
            onChange={(event) => setSelectedCurrency(event.target.value as Currency)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            disabled={availableCurrencies.length <= 1}
          >
            {(availableCurrencies.length > 0 ? availableCurrencies : ["USD", "EUR"]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Country</label>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          >
            {COUNTRY_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Payment Method</label>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as PaymentProvider)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            disabled={providerOptions.length === 0}
          >
            {providerOptions.map((option) => (
              <option key={option.provider} value={option.provider}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {providerOptions.find((item) => item.provider === provider)?.description ?? "Select a payment method."}
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

        <button
          type="button"
          onClick={onCheckoutAll}
          disabled={checkoutStatus === "loading" || selectedLines.length === 0 || providerOptions.length === 0}
          className="primary-btn w-full text-sm disabled:opacity-60"
        >
          {checkoutStatus === "loading" ? "Processing..." : `Checkout ${selectedLines.length} Item(s)`}
        </button>

        <button type="button" onClick={onClear} className="secondary-btn w-full text-sm" disabled={lines.length === 0}>
          Clear Cart
        </button>

        {checkoutMessage ? (
          <p className={checkoutStatus === "error" ? "text-sm text-red-600" : "text-sm text-emerald-600"}>{checkoutMessage}</p>
        ) : null}

        {checkoutStatus === "error" && checkoutMessage.toLowerCase().includes("login required") ? (
          <Link href={`/${locale}/login`} className="text-sm font-semibold text-brand-700 underline">
            Login to continue checkout
          </Link>
        ) : null}
      </aside>
    </div>
  );
}
