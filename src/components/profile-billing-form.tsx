"use client";

import { useState } from "react";
import type { Currency, Locale } from "@/lib/constants";

type ProfileBillingFormProps = {
  initialProfile: {
    email: string;
    name: string | null;
    country: string | null;
    locale: Locale;
    preferredCurrency: Currency;
  };
};

type ProfileResponse = {
  ok: boolean;
  message?: string;
  profile?: {
    name: string | null;
    country: string | null;
    locale: Locale;
    preferredCurrency: Currency;
  };
};

export function ProfileBillingForm({ initialProfile }: ProfileBillingFormProps) {
  const [name, setName] = useState(initialProfile.name ?? "");
  const [country, setCountry] = useState(initialProfile.country ?? "");
  const [locale, setLocale] = useState<Locale>(initialProfile.locale);
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>(initialProfile.preferredCurrency);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/me/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          country: country.trim().toUpperCase() || undefined,
          locale,
          preferredCurrency
        })
      });

      const result = (await response.json()) as ProfileResponse;
      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Could not update profile.");
        return;
      }

      setStatus("success");
      setMessage(result.message ?? "Profile updated.");
      if (result.profile) {
        setName(result.profile.name ?? "");
        setCountry(result.profile.country ?? "");
        setLocale(result.profile.locale);
        setPreferredCurrency(result.profile.preferredCurrency);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected profile error.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-black tracking-tight">Profile & Billing</h2>

      <div className="space-y-1 text-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Email</p>
        <p className="font-medium text-slate-700">{initialProfile.email}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Country (2-letter)</label>
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            placeholder="US"
            maxLength={2}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm uppercase"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Locale</label>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="fa">fa</option>
            <option value="en">en</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Preferred Currency</label>
        <select
          value={preferredCurrency}
          onChange={(event) => setPreferredCurrency(event.target.value as Currency)}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="secondary-btn text-sm disabled:opacity-60"
      >
        {status === "loading" ? "Saving..." : "Save Profile"}
      </button>

      {message ? (
        <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>{message}</p>
      ) : null}
    </form>
  );
}
