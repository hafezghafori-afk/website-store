import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Container } from "@/components/container";
import { ProductCard } from "@/components/product-card";
import { getStoreProducts } from "@/lib/catalog";
import { CATEGORIES, WHY_POINTS } from "@/lib/mock-data";
import { BASE_CURRENCY, type Currency, type LicenseType, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function resolveCurrency(input?: string): Currency {
  if (input && (SUPPORTED_CURRENCIES as readonly string[]).includes(input)) {
    return input as Currency;
  }
  return BASE_CURRENCY;
}

function resolveLicense(input?: string): LicenseType {
  return input === "commercial" ? "commercial" : "personal";
}

export default async function HomePage({
  params,
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { currency?: string; licenseType?: string };
}) {
  noStore();

  const locale = params.locale;
  const t = getDictionary(locale);
  const currency = resolveCurrency(searchParams.currency);
  const licenseType = resolveLicense(searchParams.licenseType);
  const products = await getStoreProducts();

  const newItems = products.filter((item) => item.isNew).slice(0, 3);
  const bestItems = products.filter((item) => item.isBestSeller).slice(0, 3);
  const bundleItems = products.filter((item) => item.isBundle).slice(0, 3);
  const fallbackNew = newItems.length > 0 ? newItems : products.slice(0, 3);
  const fallbackBest = bestItems.length > 0 ? bestItems : products.slice(0, 3);

  return (
    <Container className="space-y-16 py-10 sm:py-14">
      <section className="surface-card overflow-hidden p-8 shadow-soft sm:p-12">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Minimal Marketplace</p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">{t.hero.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">{t.hero.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/templates`} className="primary-btn">
              {t.hero.browse}
            </Link>
            <Link href={`/${locale}/templates/saas-indigo`} className="secondary-btn">
              {t.hero.demo}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-black tracking-tight">{t.sections.categories}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => (
            <article key={category.id} className="surface-card p-5">
              <h3 className="text-base font-bold">{category.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{category.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-black tracking-tight">{t.sections.newArrivals}</h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {fallbackNew.map((product) => (
            <ProductCard
              key={product.id}
              locale={locale}
              currency={currency}
              licenseType={licenseType}
              product={product}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-black tracking-tight">{t.sections.bestSellers}</h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {fallbackBest.map((product) => (
            <ProductCard
              key={product.id}
              locale={locale}
              currency={currency}
              licenseType={licenseType}
              product={product}
            />
          ))}
        </div>
      </section>

      {bundleItems.length > 0 ? (
        <section className="space-y-5">
          <h2 className="text-2xl font-black tracking-tight">{t.nav.bundles}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {bundleItems.map((product) => (
              <ProductCard
                key={product.id}
                locale={locale}
                currency={currency}
                licenseType={licenseType}
                product={product}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5 pb-4">
        <h2 className="text-2xl font-black tracking-tight">{t.sections.whyTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_POINTS.map((point) => (
            <article key={point.title} className="surface-card p-5">
              <div className="mb-4 h-8 w-8 rounded-full bg-brand-100" />
              <h3 className="text-base font-bold">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{point.description}</p>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
}
