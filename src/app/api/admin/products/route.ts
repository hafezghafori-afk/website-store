import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { EUR_RATE } from "@/lib/constants";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

type ActionType = "create" | "update" | "delete";

type ParsedPayload = {
  action: ActionType;
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  coverImage: string;
  demoUrl: string;
  status: string;
  isBundle: boolean;
  personalUsd: number | null;
  commercialUsd: number | null;
  tags: string[];
  tech: string[];
  hasTags: boolean;
  hasTech: boolean;
  hasCategoryId: boolean;
};

function toEurAmount(usdAmount: number) {
  return Math.max(1, Math.round(usdAmount * EUR_RATE));
}

function parseAmount(input: unknown): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBoolean(input: unknown, fallback = false) {
  if (typeof input === "boolean") {
    return input;
  }
  const value = String(input ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(value)) {
    return false;
  }
  return fallback;
}

function canUseAdminApi() {
  if (!isClerkEnabled()) {
    return { ok: true as const };
  }

  const { userId } = auth();
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }) };
  }

  if (!isAdminUser()) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 })
    };
  }

  return { ok: true as const };
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const hasTags = Object.prototype.hasOwnProperty.call(body, "tags");
    const hasTech = Object.prototype.hasOwnProperty.call(body, "tech");
    const hasCategoryId = Object.prototype.hasOwnProperty.call(body, "categoryId");
    return {
      action: String(body.action ?? "create").trim().toLowerCase() as ActionType,
      id: String(body.id ?? "").trim(),
      categoryId: String(body.categoryId ?? "").trim(),
      title: String(body.title ?? "").trim(),
      slug: String(body.slug ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      description: String(body.description ?? "").trim(),
      coverImage: String(body.coverImage ?? "").trim(),
      demoUrl: String(body.demoUrl ?? "").trim(),
      status: String(body.status ?? "").trim(),
      isBundle: parseBoolean(body.isBundle, false),
      personalUsd: parseAmount(body.personalUsd),
      commercialUsd: parseAmount(body.commercialUsd),
      tags: hasTags ? parseNameList(body.tags) : [],
      tech: hasTech ? parseNameList(body.tech) : [],
      hasTags,
      hasTech,
      hasCategoryId
    } satisfies ParsedPayload;
  }

  const body = await request.formData();
  const hasTags = body.has("tags");
  const hasTech = body.has("tech");
  const hasCategoryId = body.has("categoryId");
  return {
    action: String(body.get("action") ?? "create").trim().toLowerCase() as ActionType,
    id: String(body.get("id") ?? "").trim(),
    categoryId: String(body.get("categoryId") ?? "").trim(),
    title: String(body.get("title") ?? "").trim(),
    slug: String(body.get("slug") ?? "").trim(),
    summary: String(body.get("summary") ?? "").trim(),
    description: String(body.get("description") ?? "").trim(),
    coverImage: String(body.get("coverImage") ?? "").trim(),
    demoUrl: String(body.get("demoUrl") ?? "").trim(),
    status: String(body.get("status") ?? "").trim(),
    isBundle: parseBoolean(body.get("isBundle"), false),
    personalUsd: parseAmount(body.get("personalUsd")),
    commercialUsd: parseAmount(body.get("commercialUsd")),
    tags: hasTags ? parseNameList(body.get("tags")) : [],
    tech: hasTech ? parseNameList(body.get("tech")) : [],
    hasTags,
    hasTech,
    hasCategoryId
  } satisfies ParsedPayload;
}

function normalizeProductStatus(input: string) {
  if (input === "draft" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseNameList(input: unknown) {
  const rawValues = Array.isArray(input) ? input.map((item) => String(item ?? "")) : String(input ?? "").split(/[,\n]/g);
  const dedupe = new Map<string, string>();

  for (const entry of rawValues) {
    const normalized = normalizeName(entry);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!dedupe.has(key)) {
      dedupe.set(key, normalized);
    }
  }

  return Array.from(dedupe.values());
}

async function resolveTagIds(tagNames: string[]) {
  const ids: string[] = [];
  for (const name of tagNames) {
    const existing = await prisma.productTag.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        }
      },
      select: {
        id: true
      }
    });

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const created = await prisma.productTag.create({
      data: {
        name
      },
      select: {
        id: true
      }
    });
    ids.push(created.id);
  }

  return ids;
}

async function resolveTechIds(techNames: string[]) {
  const ids: string[] = [];
  for (const name of techNames) {
    const existing = await prisma.productTech.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        }
      },
      select: {
        id: true
      }
    });

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const created = await prisma.productTech.create({
      data: {
        name
      },
      select: {
        id: true
      }
    });
    ids.push(created.id);
  }

  return ids;
}

async function syncProductTags(productId: string, tagNames: string[]) {
  const tagIds = await resolveTagIds(tagNames);

  await prisma.productTagMap.deleteMany({
    where: {
      productId
    }
  });

  if (tagIds.length === 0) {
    return;
  }

  await prisma.productTagMap.createMany({
    data: tagIds.map((tagId) => ({
      productId,
      tagId
    })),
    skipDuplicates: true
  });
}

async function syncProductTech(productId: string, techNames: string[]) {
  const techIds = await resolveTechIds(techNames);

  await prisma.productTechMap.deleteMany({
    where: {
      productId
    }
  });

  if (techIds.length === 0) {
    return;
  }

  await prisma.productTechMap.createMany({
    data: techIds.map((techId) => ({
      productId,
      techId
    })),
    skipDuplicates: true
  });
}

async function syncLicensePrices(productId: string, personalUsd: number, commercialUsd: number) {
  const roundedPersonal = Math.round(personalUsd);
  const roundedCommercial = Math.round(commercialUsd);

  const personalUpdated = await prisma.productVariant.updateMany({
    where: {
      productId,
      licenseType: "personal"
    },
    data: {
      priceUSD: roundedPersonal,
      priceEUR: toEurAmount(roundedPersonal),
      isActive: true
    }
  });

  if (personalUpdated.count === 0) {
    await prisma.productVariant.create({
      data: {
        productId,
        licenseType: "personal",
        priceUSD: roundedPersonal,
        priceEUR: toEurAmount(roundedPersonal),
        isActive: true
      }
    });
  }

  const commercialUpdated = await prisma.productVariant.updateMany({
    where: {
      productId,
      licenseType: "commercial"
    },
    data: {
      priceUSD: roundedCommercial,
      priceEUR: toEurAmount(roundedCommercial),
      isActive: true
    }
  });

  if (commercialUpdated.count === 0) {
    await prisma.productVariant.create({
      data: {
        productId,
        licenseType: "commercial",
        priceUSD: roundedCommercial,
        priceEUR: toEurAmount(roundedCommercial),
        isActive: true
      }
    });
  }
}

async function createProduct(payload: ParsedPayload, actorUserId?: string | null) {
  if (!payload.title || !payload.slug) {
    return NextResponse.json({ ok: false, message: "title and slug are required." }, { status: 400 });
  }

  const personalUsd = payload.personalUsd ?? 39;
  const commercialUsd = payload.commercialUsd ?? 89;

  if (
    !Number.isFinite(personalUsd) ||
    personalUsd <= 0 ||
    !Number.isFinite(commercialUsd) ||
    commercialUsd <= 0
  ) {
    return NextResponse.json({ ok: false, message: "License prices must be positive numbers." }, { status: 400 });
  }

  const existingSlug = await prisma.product.findUnique({
    where: { slug: payload.slug }
  });

  if (existingSlug) {
    return NextResponse.json({ ok: false, message: "This slug already exists." }, { status: 409 });
  }

  let categoryConnect: { id: string } | undefined;
  if (payload.categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: payload.categoryId },
      select: { id: true }
    });
    if (!category) {
      return NextResponse.json({ ok: false, message: "Selected category was not found." }, { status: 404 });
    }
    categoryConnect = { id: category.id };
  }

  const product = await prisma.product.create({
    data: {
      slug: payload.slug,
      title: payload.title,
      summary: payload.summary || `${payload.title} template`,
      description: payload.description || payload.summary || `${payload.title} product description`,
      coverImage: payload.coverImage || "https://picsum.photos/seed/new-product/1200/760",
      demoUrl: payload.demoUrl || null,
      ...(categoryConnect ? { category: { connect: categoryConnect } } : {}),
      isBundle: payload.isBundle,
      status: normalizeProductStatus(payload.status),
      variants: {
        create: [
          {
            licenseType: "personal",
            priceUSD: Math.round(personalUsd),
            priceEUR: toEurAmount(personalUsd),
            isActive: true
          },
          {
            licenseType: "commercial",
            priceUSD: Math.round(commercialUsd),
            priceEUR: toEurAmount(commercialUsd),
            isActive: true
          }
        ]
      }
    },
    include: {
      variants: true
    }
  });

  if (payload.hasTags) {
    await syncProductTags(product.id, payload.tags);
  }
  if (payload.hasTech) {
    await syncProductTech(product.id, payload.tech);
  }

  await recordAuditEvent({
    actorUserId: actorUserId ?? null,
    action: "admin.product.create",
    targetType: "product",
    targetId: product.id,
    details: {
      slug: product.slug,
      status: product.status,
      isBundle: product.isBundle,
      tags: payload.tags,
      tech: payload.tech
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Product saved.",
    product
  });
}

async function updateProduct(payload: ParsedPayload, actorUserId?: string | null) {
  if (!payload.id) {
    return NextResponse.json({ ok: false, message: "id is required for update." }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({
    where: { id: payload.id },
    include: { variants: true }
  });

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
  }

  if (payload.slug && payload.slug !== existing.slug) {
    const sameSlug = await prisma.product.findUnique({
      where: { slug: payload.slug }
    });
    if (sameSlug) {
      return NextResponse.json({ ok: false, message: "This slug already exists." }, { status: 409 });
    }
  }

  if (payload.personalUsd !== null && payload.personalUsd <= 0) {
    return NextResponse.json({ ok: false, message: "Personal price must be a positive number." }, { status: 400 });
  }
  if (payload.commercialUsd !== null && payload.commercialUsd <= 0) {
    return NextResponse.json({ ok: false, message: "Commercial price must be a positive number." }, { status: 400 });
  }

  if (payload.hasCategoryId && payload.categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: payload.categoryId },
      select: { id: true }
    });
    if (!category) {
      return NextResponse.json({ ok: false, message: "Selected category was not found." }, { status: 404 });
    }
  }

  const product = await prisma.product.update({
    where: {
      id: payload.id
    },
    data: {
      title: payload.title || existing.title,
      slug: payload.slug || existing.slug,
      summary: payload.summary || existing.summary,
      description: payload.description || existing.description,
      coverImage: payload.coverImage || existing.coverImage,
      demoUrl: payload.demoUrl || existing.demoUrl,
      ...(payload.hasCategoryId
        ? payload.categoryId
          ? { category: { connect: { id: payload.categoryId } } }
          : { category: { disconnect: true } }
        : {}),
      isBundle: payload.isBundle,
      status: normalizeProductStatus(payload.status || existing.status)
    },
    include: {
      variants: true
    }
  });

  const personalInput = payload.personalUsd !== null ? payload.personalUsd : null;
  const commercialInput = payload.commercialUsd !== null ? payload.commercialUsd : null;
  if (personalInput || commercialInput) {
    const currentPersonal = existing.variants.find((item) => item.licenseType === "personal")?.priceUSD ?? 39;
    const currentCommercial = existing.variants.find((item) => item.licenseType === "commercial")?.priceUSD ?? 89;
    await syncLicensePrices(payload.id, personalInput ?? currentPersonal, commercialInput ?? currentCommercial);
  }

  if (payload.hasTags) {
    await syncProductTags(product.id, payload.tags);
  }
  if (payload.hasTech) {
    await syncProductTech(product.id, payload.tech);
  }

  await recordAuditEvent({
    actorUserId: actorUserId ?? null,
    action: "admin.product.update",
    targetType: "product",
    targetId: product.id,
    details: {
      slug: product.slug,
      status: product.status,
      isBundle: product.isBundle,
      categoryId: payload.hasCategoryId ? payload.categoryId || null : "unchanged",
      tags: payload.hasTags ? payload.tags : "unchanged",
      tech: payload.hasTech ? payload.tech : "unchanged"
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Product updated.",
    product
  });
}

async function deleteProduct(payload: ParsedPayload, actorUserId?: string | null) {
  if (!payload.id) {
    return NextResponse.json({ ok: false, message: "id is required for delete." }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({
    where: {
      id: payload.id
    },
    select: {
      id: true,
      slug: true,
      title: true
    }
  });

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
  }

  await prisma.product.delete({
    where: {
      id: payload.id
    }
  });

  await recordAuditEvent({
    actorUserId: actorUserId ?? null,
    action: "admin.product.delete",
    targetType: "product",
    targetId: existing.id,
    details: {
      slug: existing.slug,
      title: existing.title
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Product deleted."
  });
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const products = await prisma.product.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      variants: true,
      versions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: products.length,
    items: products
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const payload = await parsePayload(request);
  const actor = await requireAppUser();
  const actorUserId = actor?.id ?? null;

  if (payload.action === "update") {
    return updateProduct(payload, actorUserId);
  }

  if (payload.action === "delete") {
    return deleteProduct(payload, actorUserId);
  }

  return createProduct(payload, actorUserId);
}
