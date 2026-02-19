import { type Currency, type LicenseType, EUR_RATE } from "@/lib/constants";
import { PRODUCTS } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

function toPrismaLicenseType(value: LicenseType) {
  return value === "commercial" ? "commercial" : "personal";
}

function toEurAmount(usdAmount: number) {
  return Math.max(1, Math.round(usdAmount * EUR_RATE));
}

export async function ensureProductInDatabase(productId: string) {
  const byId = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      versions: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (byId) {
    return byId;
  }

  const mockProduct = PRODUCTS.find((item) => item.id === productId);
  if (!mockProduct) {
    return null;
  }

  const bySlug = await prisma.product.findUnique({
    where: { slug: mockProduct.slug },
    include: {
      variants: true,
      versions: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (bySlug) {
    return bySlug;
  }

  return prisma.product.create({
    data: {
      id: mockProduct.id,
      slug: mockProduct.slug,
      title: mockProduct.title,
      summary: mockProduct.summary,
      description: mockProduct.description,
      coverImage: mockProduct.coverImage,
      demoUrl: mockProduct.demoUrl,
      isBundle: mockProduct.isBundle,
      status: "published",
      variants: {
        create: [
          {
            licenseType: "personal",
            priceUSD: mockProduct.basePriceUsd.personal,
            priceEUR: toEurAmount(mockProduct.basePriceUsd.personal),
            isActive: true
          },
          {
            licenseType: "commercial",
            priceUSD: mockProduct.basePriceUsd.commercial,
            priceEUR: toEurAmount(mockProduct.basePriceUsd.commercial),
            isActive: true
          }
        ]
      },
      versions: {
        create: mockProduct.versions.map((version, index) => ({
          version,
          changelog: mockProduct.changelog[index] ?? "General maintenance updates.",
          fileKey: `products/${mockProduct.slug}/${version}.zip`,
          fileSize: 0
        }))
      }
    },
    include: {
      variants: true,
      versions: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

type ProductVariantLike = {
  id: string;
  licenseType: string;
  priceUSD: number;
  priceEUR: number;
  isActive: boolean;
};

export function getVariantForLicense(variants: ProductVariantLike[], licenseType: LicenseType) {
  const prismaLicense = toPrismaLicenseType(licenseType);
  return variants.find((item) => item.licenseType === prismaLicense && item.isActive);
}

export function getVariantAmount(variant: ProductVariantLike, currency: Currency) {
  return currency === "EUR" ? variant.priceEUR : variant.priceUSD;
}
