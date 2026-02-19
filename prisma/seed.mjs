import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EUR_RATE = 0.92;

const products = [
  {
    id: "prd-1",
    slug: "saas-indigo",
    title: "SaaS Indigo",
    summary: "Modern SaaS landing template with pricing, features, and FAQ blocks.",
    description:
      "A minimal Next.js + Tailwind template focused on conversion with clean layout, high readability, and accessible components.",
    coverImage: "https://picsum.photos/seed/saas-indigo/1200/760",
    demoUrl: "https://example.com/demo/saas-indigo",
    isBundle: false,
    personalUsd: 39,
    commercialUsd: 89,
    tags: ["RTL", "Tailwind", "Next.js", "SEO Ready"],
    tech: ["Next.js", "React", "Tailwind"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      },
      {
        version: "1.1.0",
        changelog: "Added pricing switch and FAQ accordion"
      }
    ]
  },
  {
    id: "prd-2",
    slug: "commerce-lite",
    title: "Commerce Lite",
    summary: "Minimal ecommerce UI kit with category, search, and checkout pages.",
    description: "Built for template shops and digital product stores with lightweight components.",
    coverImage: "https://picsum.photos/seed/commerce-lite/1200/760",
    demoUrl: "https://example.com/demo/commerce-lite",
    isBundle: false,
    personalUsd: 49,
    commercialUsd: 109,
    tags: ["Responsive", "Tailwind", "React"],
    tech: ["React", "Tailwind"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      }
    ]
  },
  {
    id: "prd-3",
    slug: "corporate-core",
    title: "Corporate Core",
    summary: "Business-oriented multipage template for agencies and consulting firms.",
    description: "Professional sections for services, case studies, and trust blocks.",
    coverImage: "https://picsum.photos/seed/corporate-core/1200/760",
    demoUrl: "https://example.com/demo/corporate-core",
    isBundle: false,
    personalUsd: 45,
    commercialUsd: 95,
    tags: ["Next.js", "i18n", "RTL"],
    tech: ["Next.js", "Tailwind", "Node"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      },
      {
        version: "1.2.0",
        changelog: "Improved hero and testimonial cards"
      }
    ]
  },
  {
    id: "prd-4",
    slug: "admin-focus",
    title: "Admin Focus",
    summary: "Dashboard starter with analytics cards and user management pages.",
    description: "Designed for SaaS admin experiences with neutral, minimal components.",
    coverImage: "https://picsum.photos/seed/admin-focus/1200/760",
    demoUrl: "https://example.com/demo/admin-focus",
    isBundle: true,
    personalUsd: 55,
    commercialUsd: 119,
    tags: ["Dashboard", "React", "Responsive"],
    tech: ["React", "Tailwind", "Node"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      },
      {
        version: "1.0.1",
        changelog: "Improved table pagination"
      }
    ]
  },
  {
    id: "prd-5",
    slug: "portfolio-clean",
    title: "Portfolio Clean",
    summary: "Minimal personal portfolio with project cards and CV section.",
    description: "Ideal for designers and developers who need a polished online profile.",
    coverImage: "https://picsum.photos/seed/portfolio-clean/1200/760",
    demoUrl: "https://example.com/demo/portfolio-clean",
    isBundle: false,
    personalUsd: 29,
    commercialUsd: 69,
    tags: ["Portfolio", "SEO Ready", "Tailwind"],
    tech: ["Next.js", "Tailwind"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      }
    ]
  },
  {
    id: "prd-6",
    slug: "kit-neo",
    title: "Kit Neo",
    summary: "Reusable UI kit with buttons, cards, and marketing sections.",
    description: "Component-first template kit for rapid product page building.",
    coverImage: "https://picsum.photos/seed/kit-neo/1200/760",
    demoUrl: "https://example.com/demo/kit-neo",
    isBundle: true,
    personalUsd: 59,
    commercialUsd: 129,
    tags: ["Components", "Tailwind", "Dark Mode"],
    tech: ["React", "Tailwind"],
    versions: [
      {
        version: "1.0.0",
        changelog: "Initial release"
      },
      {
        version: "1.3.0",
        changelog: "Added eCommerce sections"
      }
    ]
  }
];

function toEur(usd) {
  return Math.max(1, Math.round(usd * EUR_RATE));
}

async function upsertProductBase(product) {
  return prisma.product.upsert({
    where: { id: product.id },
    update: {
      slug: product.slug,
      title: product.title,
      summary: product.summary,
      description: product.description,
      coverImage: product.coverImage,
      demoUrl: product.demoUrl,
      isBundle: Boolean(product.isBundle),
      status: "published"
    },
    create: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      summary: product.summary,
      description: product.description,
      coverImage: product.coverImage,
      demoUrl: product.demoUrl,
      isBundle: Boolean(product.isBundle),
      status: "published"
    }
  });
}

async function syncVariants(product) {
  await prisma.productVariant.deleteMany({
    where: { productId: product.id }
  });

  await prisma.productVariant.createMany({
    data: [
      {
        productId: product.id,
        licenseType: "personal",
        priceUSD: product.personalUsd,
        priceEUR: toEur(product.personalUsd),
        isActive: true
      },
      {
        productId: product.id,
        licenseType: "commercial",
        priceUSD: product.commercialUsd,
        priceEUR: toEur(product.commercialUsd),
        isActive: true
      }
    ]
  });
}

async function syncVersions(product) {
  const keepVersions = product.versions.map((item) => item.version);
  await prisma.productVersion.deleteMany({
    where: {
      productId: product.id,
      version: {
        notIn: keepVersions
      }
    }
  });

  for (const version of product.versions) {
    await prisma.productVersion.upsert({
      where: {
        productId_version: {
          productId: product.id,
          version: version.version
        }
      },
      update: {
        changelog: version.changelog,
        fileKey: `products/${product.slug}/${version.version}.zip`,
        fileSize: 0
      },
      create: {
        productId: product.id,
        version: version.version,
        changelog: version.changelog,
        fileKey: `products/${product.slug}/${version.version}.zip`,
        fileSize: 0
      }
    });
  }
}

async function syncTagsAndTech(product) {
  await prisma.productTagMap.deleteMany({
    where: { productId: product.id }
  });
  await prisma.productTechMap.deleteMany({
    where: { productId: product.id }
  });

  for (const tagName of product.tags) {
    const tag = await prisma.productTag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName }
    });

    await prisma.productTagMap.create({
      data: {
        productId: product.id,
        tagId: tag.id
      }
    });
  }

  for (const techName of product.tech) {
    const tech = await prisma.productTech.upsert({
      where: { name: techName },
      update: {},
      create: { name: techName }
    });

    await prisma.productTechMap.create({
      data: {
        productId: product.id,
        techId: tech.id
      }
    });
  }
}

async function main() {
  for (const product of products) {
    await upsertProductBase(product);
    await syncVariants(product);
    await syncVersions(product);
    await syncTagsAndTech(product);
  }

  console.log(`Seeded ${products.length} products with variants, versions, tags, and tech stack.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
