"use client";

import type { Currency, LicenseType } from "@/lib/constants";

export const CART_STORAGE_KEY = "templatebaz-cart-v1";

export type CartItem = {
  productId: string;
  licenseType: LicenseType;
  currency: Currency;
  addedAt: string;
};

function normalizeCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const productId = String(record.productId ?? "").trim();
  const licenseType = String(record.licenseType ?? "").trim();
  const currency = String(record.currency ?? "").trim();
  const addedAt = String(record.addedAt ?? "").trim();

  if (!productId) {
    return null;
  }
  if (licenseType !== "personal" && licenseType !== "commercial") {
    return null;
  }
  if (currency !== "USD" && currency !== "EUR") {
    return null;
  }

  return {
    productId,
    licenseType,
    currency,
    addedAt: addedAt || new Date().toISOString()
  };
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeCartItem(item))
      .filter((item): item is CartItem => Boolean(item));
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addCartItem(input: Omit<CartItem, "addedAt">) {
  const existing = readCart();
  const alreadyExists = existing.some(
    (item) =>
      item.productId === input.productId &&
      item.licenseType === input.licenseType &&
      item.currency === input.currency
  );
  if (alreadyExists) {
    return existing;
  }

  const next = [...existing, { ...input, addedAt: new Date().toISOString() }];
  writeCart(next);
  return next;
}

export function removeCartItem(input: Omit<CartItem, "addedAt">) {
  const existing = readCart();
  const next = existing.filter(
    (item) =>
      !(
        item.productId === input.productId &&
        item.licenseType === input.licenseType &&
        item.currency === input.currency
      )
  );
  writeCart(next);
  return next;
}

export function clearCart() {
  writeCart([]);
}
