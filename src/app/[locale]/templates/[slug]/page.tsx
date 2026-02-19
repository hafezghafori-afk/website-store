import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getStoreProductBySlug } from "@/lib/catalog";
import { Container } from "@/components/container";
import { LicenseSelector } from "@/components/license-selector";
import { PriceBox } from "@/components/price-box";
import { TemplateTabs } from "@/components/template-tabs";
import { BASE_CURRENCY, type Currency, type LicenseType, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";

type ProductDetailsProps = {
  params: { locale: Locale; slug: string };
  searchParams: { licenseType?: string; currency?: string };
};

function resolveCurrency(input?: string): Currency {
  if (input && (SUPPORTED_CURRENCIES as readonly string[]).includes(input)) {
    return input as Currency;
  }
  return BASE_CURRENCY;
}

function resolveLicense(input?: string): LicenseType {
  return input === "commercial" ? "commercial" : "personal";
}

export async function generateMetadata({ params }: ProductDetailsProps): Promise<Metadata> {
  const product = await getStoreProductBySlug(params.slug);

  if (!product) {
    return {
      title: "Product not found"
    };
  }

  return {
    title: `${product.title} | TemplateBaz`,
    description: product.summary,
    openGraph: {
      title: `${product.title} | TemplateBaz`,
      description: product.summary,
      images: [
        `/${params.locale}/templates/${params.slug}/opengraph-image`,
        product.coverImage
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} | TemplateBaz`,
      description: product.summary,
      images: [`/${params.locale}/templates/${params.slug}/opengraph-image`]
    }
  };
}

export default async function ProductDetailsPage({ params, searchParams }: ProductDetailsProps) {
  const product = await getStoreProductBySlug(params.slug);
  if (!product) {
    notFound();
  }

  const currency = resolveCurrency(searchParams.currency);
  const licenseType = resolveLicense(searchParams.licenseType);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.summary,
    image: product.coverImage,
    brand: "TemplateBaz",
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price: licenseType === "commercial" ? product.basePriceUsd.commercial : product.basePriceUsd.personal,
      availability: "https://schema.org/InStock"
    }
  };

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-white">
            <Image src={product.coverImage} alt={product.title} fill className="object-cover" priority />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-white">
                <Image
                  src={`${product.coverImage}?preview=${item}`}
                  alt={`${product.title} preview ${item}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <a href={product.demoUrl} target="_blank" rel="noreferrer" className="secondary-btn w-full sm:w-auto">
            Open Live Demo
          </a>

          <div className="surface-card grid gap-3 p-5 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-text">Tech Stack</p>
              <p className="mt-1">{product.tech.join(", ")}</p>
            </div>
            <div>
              <p className="font-semibold text-text">Versions</p>
              <p className="mt-1">{product.versions.join(", ")}</p>
            </div>
            <div>
              <p className="font-semibold text-text">RTL</p>
              <p className="mt-1">{product.rtl ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="font-semibold text-text">Responsive</p>
              <p className="mt-1">{product.responsive ? "Yes" : "No"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-semibold text-text">Files in ZIP</p>
              <p className="mt-1">{product.includes.join(", ")}</p>
            </div>
          </div>

          <TemplateTabs product={product} />
        </section>

        <aside className="space-y-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{product.title}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">{product.summary}</p>
          </div>

          <LicenseSelector locale={params.locale} slug={product.slug} currency={currency} current={licenseType} />

          <PriceBox locale={params.locale} currency={currency} licenseType={licenseType} product={product} />
        </aside>
      </div>
    </Container>
  );
}
