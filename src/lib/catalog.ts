import { prisma } from "@/lib/prisma";
import { CATEGORIES, PRODUCTS } from "@/lib/mock-data";
import type { Product, ProductCategory } from "@/lib/types";

type DbProduct = Awaited<ReturnType<typeof fetchPublishedProductsFromDb>>[number];
let categorySchemaSupport: boolean | null = null;

function isCategorySchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("product.categoryid") || normalized.includes("column `product.categoryid` does not exist");
}

async function hasCategorySchemaSupport() {
  if (categorySchemaSupport !== null) {
    return categorySchemaSupport;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'categoryId'
      ) as "exists"
    `;
    categorySchemaSupport = Boolean(rows[0]?.exists);
    return categorySchemaSupport;
  } catch {
    // If introspection fails (network/db unavailable), fall back to regular query behavior.
    return true;
  }
}

async function fetchPublishedProductsFromDbWithCategory() {
  return prisma.product.findMany({
    where: {
      status: "published"
    },
    include: {
      category: true,
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

async function fetchPublishedProductsFromDbLegacy() {
  const rows = await prisma.product.findMany({
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

  return rows.map((row) => ({ ...row, category: null }));
}

async function fetchPublishedProductsFromDb() {
  if (!(await hasCategorySchemaSupport())) {
    return fetchPublishedProductsFromDbLegacy();
  }

  try {
    return await fetchPublishedProductsFromDbWithCategory();
  } catch (error) {
    if (!isCategorySchemaMismatch(error)) {
      throw error;
    }
    return fetchPublishedProductsFromDbLegacy();
  }
}

async function fetchProductBySlugFromDbWithCategory(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: "published"
    },
    include: {
      category: true,
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

async function fetchProductBySlugFromDbLegacy(slug: string) {
  const row = await prisma.product.findFirst({
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

  return row ? { ...row, category: null } : null;
}

async function fetchProductBySlugFromDb(slug: string) {
  if (!(await hasCategorySchemaSupport())) {
    return fetchProductBySlugFromDbLegacy(slug);
  }

  try {
    return await fetchProductBySlugFromDbWithCategory(slug);
  } catch (error) {
    if (!isCategorySchemaMismatch(error)) {
      throw error;
    }
    return fetchProductBySlugFromDbLegacy(slug);
  }
}

async function fetchProductByIdFromDbWithCategory(id: string) {
  return prisma.product.findFirst({
    where: {
      id,
      status: "published"
    },
    include: {
      category: true,
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

async function fetchProductByIdFromDbLegacy(id: string) {
  const row = await prisma.product.findFirst({
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

  return row ? { ...row, category: null } : null;
}

async function fetchProductByIdFromDb(id: string) {
  if (!(await hasCategorySchemaSupport())) {
    return fetchProductByIdFromDbLegacy(id);
  }

  try {
    return await fetchProductByIdFromDbWithCategory(id);
  } catch (error) {
    if (!isCategorySchemaMismatch(error)) {
      throw error;
    }
    return fetchProductByIdFromDbLegacy(id);
  }
}

async function fetchActiveCategoriesFromDb() {
  return prisma.productCategory.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true
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
    category: dbProduct.category?.slug ?? mock?.category ?? "landing-pages",
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

export async function getStoreCategories(): Promise<ProductCategory[]> {
  try {
    const dbCategories = await fetchActiveCategoriesFromDb();
    if (dbCategories.length === 0) {
      return CATEGORIES;
    }

    return dbCategories.map((category) => ({
      id: category.id,
      title: category.name,
      slug: category.slug,
      description: category.description ?? ""
    }));
  } catch {
    return CATEGORIES;
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
