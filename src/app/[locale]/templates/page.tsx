import { Container } from "@/components/container";
import { unstable_noStore as noStore } from "next/cache";
import { EmptyState } from "@/components/empty-state";
import { FiltersDrawer } from "@/components/filters-drawer";
import { FiltersPanel } from "@/components/filters-panel";
import { ProductCard } from "@/components/product-card";
import { getStoreCategories, getStoreProducts } from "@/lib/catalog";
import { BASE_CURRENCY, type Currency, type LicenseType, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { extractCategoryOptions, extractFilterOptions, filterProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

function getSingleValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveCurrency(input?: string): Currency {
  if (input && (SUPPORTED_CURRENCIES as readonly string[]).includes(input)) {
    return input as Currency;
  }
  return BASE_CURRENCY;
}

function resolveLicense(input?: string): LicenseType {
  return input === "commercial" ? "commercial" : "personal";
}

export default async function TemplatesPage({
  params,
  searchParams
}: {
  params: { locale: Locale };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  noStore();

  const locale = params.locale;
  const t = getDictionary(locale);

  const search = getSingleValue(searchParams.search);
  const category = getSingleValue(searchParams.category);
  const tech = getSingleValue(searchParams.tech);
  const rtl = getSingleValue(searchParams.rtl);
  const type = getSingleValue(searchParams.type);
  const min = getSingleValue(searchParams.min);
  const max = getSingleValue(searchParams.max);
  const sort = getSingleValue(searchParams.sort) ?? "new";
  const currency = resolveCurrency(getSingleValue(searchParams.currency));
  const licenseType = resolveLicense(getSingleValue(searchParams.licenseType));
  const [products, storeCategories] = await Promise.all([getStoreProducts(), getStoreCategories()]);

  const filtered = filterProducts(products, {
    search,
    category,
    type,
    tech,
    rtl,
    min: min ? Number(min) : undefined,
    max: max ? Number(max) : undefined,
    sort,
    currency,
    license: licenseType
  });

  const techOptions = extractFilterOptions(products);
  const availableCategorySlugs = new Set(extractCategoryOptions(products));
  const categoryOptions = storeCategories
    .filter((item) => availableCategorySlugs.has(item.slug))
    .map((item) => ({ slug: item.slug, title: item.title }));

  return (
    <Container className="py-10 sm:py-14">
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Catalog</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">{type === "bundle" ? "Bundles" : t.sections.products}</h1>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <a
                href={`/${locale}/templates`}
                className={type === "bundle" ? "secondary-btn px-3 py-1.5 text-xs" : "primary-btn px-3 py-1.5 text-xs"}
              >
                All Templates
              </a>
              <a
                href={`/${locale}/templates?type=bundle`}
                className={type === "bundle" ? "primary-btn px-3 py-1.5 text-xs" : "secondary-btn px-3 py-1.5 text-xs"}
              >
                Bundles
              </a>
            </div>
          </div>
          <form className="flex flex-wrap gap-2">
            <input type="hidden" name="type" value={type ?? ""} />
            <input type="hidden" name="search" value={search ?? ""} />
            <input type="hidden" name="category" value={category ?? "all"} />
            <input type="hidden" name="tech" value={tech ?? "all"} />
            <input type="hidden" name="rtl" value={rtl ?? "all"} />
            <input type="hidden" name="sort" value={sort} />
            <select name="currency" defaultValue={currency} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <select name="licenseType" defaultValue={licenseType} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
              <option value="personal">Personal</option>
              <option value="commercial">Commercial</option>
            </select>
            <button className="secondary-btn text-sm" type="submit">
              Update
            </button>
          </form>
        </div>

        <form className="surface-card flex flex-wrap items-center gap-2 p-3">
          <input type="hidden" name="type" value={type ?? ""} />
          <input type="hidden" name="category" value={category ?? "all"} />
          <input type="hidden" name="tech" value={tech ?? "all"} />
          <input type="hidden" name="rtl" value={rtl ?? "all"} />
          <input type="hidden" name="min" value={min ?? ""} />
          <input type="hidden" name="max" value={max ?? ""} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="licenseType" value={licenseType} />
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search templates..."
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500"
          />
          <button className="primary-btn text-sm" type="submit">
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 md:hidden">
        <FiltersDrawer
          locale={locale}
          currency={currency}
          licenseType={licenseType}
          options={{ type, search, category, tech, rtl, min, max, sort, techs: techOptions, categories: categoryOptions }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="hidden md:block">
          <FiltersPanel
            locale={locale}
            currency={currency}
            licenseType={licenseType}
            options={{ type, search, category, tech, rtl, min, max, sort, techs: techOptions, categories: categoryOptions }}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t.common.empty} description="Try changing filters or search keyword." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                locale={locale}
                currency={currency}
                licenseType={licenseType}
                product={product}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
