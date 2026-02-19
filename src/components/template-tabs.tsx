"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";

type TabKey = "description" | "changelog" | "faq" | "reviews";

const tabs: { key: TabKey; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "changelog", label: "Changelog" },
  { key: "faq", label: "FAQ" },
  { key: "reviews", label: "Reviews" }
];

type TemplateTabsProps = {
  product: Product;
};

export function TemplateTabs({ product }: TemplateTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("description");

  const content = useMemo(() => {
    if (activeTab === "changelog") {
      return (
        <ul className="space-y-2 text-sm text-slate-700">
          {product.changelog.map((entry) => (
            <li key={entry} className="rounded-xl border border-border bg-slate-50 p-3">
              {entry}
            </li>
          ))}
        </ul>
      );
    }

    if (activeTab === "faq") {
      return (
        <ul className="space-y-3 text-sm text-slate-700">
          {product.faq.map((item) => (
            <li key={item.q} className="rounded-xl border border-border bg-white p-3">
              <p className="font-semibold text-text">{item.q}</p>
              <p className="mt-1 text-slate-600">{item.a}</p>
            </li>
          ))}
        </ul>
      );
    }

    if (activeTab === "reviews") {
      return (
        <ul className="space-y-3 text-sm text-slate-700">
          {product.reviews.map((review) => (
            <li key={`${review.name}-${review.message}`} className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-text">{review.name}</p>
                <p className="text-xs text-slate-500">{review.rating}/5</p>
              </div>
              <p className="mt-1 text-slate-600">{review.message}</p>
            </li>
          ))}
        </ul>
      );
    }

    return <p className="text-sm leading-7 text-slate-700">{product.description}</p>;
  }, [activeTab, product]);

  return (
    <div className="surface-card p-5">
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? "rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-slate-600"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      {content}
    </div>
  );
}
