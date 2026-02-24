import type { Currency, LicenseType, Locale } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

type FiltersPanelProps = {
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

export function FiltersPanel({ locale, currency, licenseType, options }: FiltersPanelProps) {
  const t = getDictionary(locale);

  return (
    <aside className="surface-card h-fit p-5">
      <p className="text-sm font-semibold text-text">{t.filters.title}</p>

      <form className="mt-4 space-y-4">
        <input type="hidden" name="type" value={options.type ?? ""} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="licenseType" value={licenseType} />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">{t.filters.search}</label>
          <input
            name="search"
            defaultValue={options.search}
            placeholder="SaaS, Dashboard, RTL..."
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500"
          />
        </div>

        {options.categories && options.categories.length > 0 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Category</label>
            <select
              name="category"
              defaultValue={options.category ?? "all"}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              {options.categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">{t.filters.tech}</label>
          <select name="tech" defaultValue={options.tech ?? "all"} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">All</option>
            {options.techs.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">{t.filters.rtl}</label>
          <select name="rtl" defaultValue={options.rtl ?? "all"} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Min ({currency})</label>
            <input name="min" type="number" defaultValue={options.min} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Max ({currency})</label>
            <input name="max" type="number" defaultValue={options.max} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">{t.filters.sort}</label>
          <select name="sort" defaultValue={options.sort ?? "new"} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="new">New</option>
            <option value="popular">Popular</option>
            <option value="price">Price</option>
          </select>
        </div>

        <button type="submit" className="primary-btn w-full text-sm">
          Apply
        </button>
      </form>
    </aside>
  );
}
