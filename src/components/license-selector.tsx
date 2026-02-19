import Link from "next/link";
import type { Currency, LicenseType, Locale } from "@/lib/constants";

type LicenseSelectorProps = {
  locale: Locale;
  slug: string;
  currency: Currency;
  current: LicenseType;
};

export function LicenseSelector({ locale, slug, currency, current }: LicenseSelectorProps) {
  return (
    <div className="surface-card flex flex-wrap gap-2 p-2">
      {(["personal", "commercial"] as const).map((item) => (
        <Link
          key={item}
          href={`/${locale}/templates/${slug}?licenseType=${item}&currency=${currency}`}
          className={
            current === item
              ? "rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
              : "rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-slate-600"
          }
        >
          {item === "personal" ? "Personal" : "Commercial"}
        </Link>
      ))}
    </div>
  );
}
