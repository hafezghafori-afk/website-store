import { prisma } from "@/lib/prisma";
import { PRODUCTS } from "@/lib/mock-data";
import type { Product } from "@/lib/types";

type DbProduct = Awaited<ReturnType<typeof fetchPublishedProductsFromDb>>[number];

async function fetchPublishedProductsFromDb() {
  return prisma.product.findMany({
    where: {
      status: "published"
    },
    include: {
      variants: true,
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      },
      tagMaps: {
        include: {
          tag: true
        }
      },
      techMaps: {
        include: {
          tech: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function fetchProductBySlugFromDb(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: "published"
    },
    include: {
      variants: true,
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      },
      tagMaps: {
        include: {
          tag: true
        }
      },
      techMaps: {
        include: {
          tech: true
        }
      }
    }
  });
}

async function fetchProductByIdFromDb(id: string) {
  return prisma.product.findFirst({
    where: {
      id,
      status: "published"
    },
    include: {
      variants: true,
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      },
      tagMaps: {
        include: {
          tag: true
        }
      },
      techMaps: {
        include: {
          tech: true
        }
      }
    }
  });
}

function isPublishedLike(status: string) {
  return status === "published";
}

function mapDbProduct(dbProduct: DbProduct): Product {
  const personal = dbProduct.variants.find((item) => item.licenseType === "personal");
  const commercial = dbProduct.variants.find((item) => item.licenseType === "commercial");
  const mock = PRODUCTS.find((item) => item.slug === dbProduct.slug);

  const tags = dbProduct.tagMaps.length > 0 ? dbProduct.tagMaps.map((entry) => entry.tag.name) : mock?.tags ?? [];
  const tech = dbProduct.techMaps.length > 0 ? dbProduct.techMaps.map((entry) => entry.tech.name) : mock?.tech ?? [];
  const changelog = dbProduct.versions.map((item) => `${item.version} - ${item.changelog}`);
  const versions = dbProduct.versions.map((item) => item.version);

  const isRecent = Date.now() - dbProduct.createdAt.getTime() <= 1000 * 60 * 60 * 24 * 30;
  const hasRtlTag = tags.some((tag) => tag.toLowerCase() === "rtl");

  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    title: dbProduct.title,
    summary: dbProduct.summary,
    description: dbProduct.description,
    coverImage: dbProduct.coverImage,
    demoUrl: dbProduct.demoUrl ?? mock?.demoUrl ?? "#",
    isBundle: dbProduct.isBundle ?? mock?.isBundle ?? false,
    status: isPublishedLike(dbProduct.status) ? "published" : "draft",
    category: mock?.category ?? "landing-pages",
    tags,
    tech,
    rtl: mock?.rtl ?? hasRtlTag,
    responsive: mock?.responsive ?? true,
    includes: mock?.includes ?? ["Source code", "Documentation"],
    versions: versions.length > 0 ? versions : mock?.versions ?? ["1.0.0"],
    basePriceUsd: {
      personal: personal?.priceUSD ?? mock?.basePriceUsd.personal ?? 0,
      commercial: commercial?.priceUSD ?? mock?.basePriceUsd.commercial ?? 0
    },
    changelog: changelog.length > 0 ? changelog : mock?.changelog ?? ["1.0.0 - Initial release"],
    faq:
      mock?.faq ?? [
        {
          q: "Does this template include documentation?",
          a: "Yes, documentation is included in the package."
        }
      ],
    reviews: mock?.reviews ?? [],
    isNew: mock?.isNew ?? isRecent,
    isBestSeller: mock?.isBestSeller ?? false
  };
}

export async function getStoreProducts() {
  try {
    const dbProducts = await fetchPublishedProductsFromDb();
    if (dbProducts.length === 0) {
      return PRODUCTS;
    }
    return dbProducts.map(mapDbProduct);
  } catch {
    return PRODUCTS;
  }
}

export async function getStoreProductBySlug(slug: string) {
  try {
    const dbProduct = await fetchProductBySlugFromDb(slug);
    if (dbProduct) {
      return mapDbProduct(dbProduct);
    }
  } catch {
    // fallback below
  }

  return PRODUCTS.find((item) => item.slug === slug) ?? null;
}

export async function getStoreProductById(id: string) {
  try {
    const dbProduct = await fetchProductByIdFromDb(id);
    if (dbProduct) {
      return mapDbProduct(dbProduct);
    }
  } catch {
    // fallback below
  }

  return PRODUCTS.find((item) => item.id === id) ?? null;
}
