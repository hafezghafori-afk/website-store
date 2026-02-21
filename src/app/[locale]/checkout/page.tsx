import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getStoreProductById, getStoreProducts } from "@/lib/catalog";
import { CheckoutForm } from "@/components/checkout-form";
import { CheckoutSummary } from "@/components/checkout-summary";
import { Container } from "@/components/container";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { BASE_CURRENCY, type Currency, type LicenseType, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/server-auth";

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

export default async function CheckoutPage({
  params,
  searchParams
}: {
  params: { locale: Locale };
  searchParams: { productId?: string; licenseType?: string; currency?: string; country?: string };
}) {
  noStore();

  const appUser = await requireAppUser();
  const clerkEnabled = isClerkEnabled();
  const currentUserId = clerkEnabled ? getCurrentUserId() : null;
  const needsLogin = clerkEnabled && !currentUserId;
  const currency = resolveCurrency(searchParams.currency ?? appUser?.preferredCurrency);
  const licenseType = resolveLicense(searchParams.licenseType);
  const country = (searchParams.country ?? appUser?.country ?? "US").toUpperCase();
  const countryOptions = COUNTRY_OPTIONS.some((item) => item.code === country)
    ? COUNTRY_OPTIONS
    : [{ code: country, name: country }, ...COUNTRY_OPTIONS];
  const products = await getStoreProducts();
  const productId = searchParams.productId ?? products[0]?.id;

  const product = productId ? await getStoreProductById(productId) : null;
  if (!product) {
    notFound();
  }

  return (
    <Container className="py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Payment</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Checkout</h1>
      </div>

      <form className="mb-6 grid gap-3 rounded-2xl border border-border bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Product</label>
          <select name="productId" defaultValue={product.id} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">License</label>
          <select name="licenseType" defaultValue={licenseType} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="personal">Personal</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Currency</label>
          <select name="currency" defaultValue={currency} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Country</label>
          <select name="country" defaultValue={country} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm">
            {countryOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="secondary-btn text-sm sm:col-span-2 lg:col-span-4">
          Update Checkout Options
        </button>
      </form>

      {needsLogin ? (
        <div className="surface-card space-y-4 p-5">
          <h2 className="text-xl font-black tracking-tight">Login Required</h2>
          <p className="text-sm text-slate-600">
            Please login to continue checkout and access secure downloads from your dashboard.
          </p>
          <div>
            <Link href={`/${params.locale}/login`} className="primary-btn text-sm">
              Login
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <CheckoutForm
            locale={params.locale}
            productId={product.id}
            licenseType={licenseType}
            currency={currency}
            initialCountry={country}
          />
          <CheckoutSummary product={product} licenseType={licenseType} currency={currency} locale={params.locale} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        After successful payment you will be redirected to Downloads in your dashboard.
      </div>
    </Container>
  );
}
