"use client";

import { useState } from "react";
import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { FiltersPanel } from "@/components/filters-panel";

type FiltersDrawerProps = {
  locale: Locale;
  currency: Currency;
  licenseType: LicenseType;
  options: {
    techs: string[];
    categories?: { slug: string; title: string }[];
    search?: string;
    category?: string;
    tech?: string;
    rtl?: string;
    type?: string;
    min?: string;
    max?: string;
    sort?: string;
  };
};

export function FiltersDrawer({ locale, currency, licenseType, options }: FiltersDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="secondary-btn text-sm">
        Filters
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-full flex-1 bg-slate-950/35"
            aria-label="Close filters"
          />
          <div className="h-full w-full max-w-sm overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-text">Filters</p>
              <button type="button" onClick={() => setOpen(false)} className="secondary-btn px-3 py-1.5 text-xs">
                Close
              </button>
            </div>
            <FiltersPanel locale={locale} currency={currency} licenseType={licenseType} options={options} />
          </div>
        </div>
      ) : null}
    </>
  );
}
