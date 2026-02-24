import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

type ActionType = "create" | "update" | "delete";

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

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseBoolean(value: unknown, fallback = true) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseNumber(value: unknown, fallback = 0) {
  const num = Number(String(value ?? "").trim());
  return Number.isFinite(num) ? Math.round(num) : fallback;
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      action: String(body.action ?? "create").trim().toLowerCase() as ActionType,
      id: normalizeText(body.id),
      name: normalizeText(body.name),
      slug: normalizeSlug(String(body.slug ?? "")),
      description: normalizeText(body.description),
      sortOrder: parseNumber(body.sortOrder, 0),
      isActive: parseBoolean(body.isActive, true)
    };
  }

  const form = await request.formData();
  return {
    action: String(form.get("action") ?? "create").trim().toLowerCase() as ActionType,
    id: normalizeText(form.get("id")),
    name: normalizeText(form.get("name")),
    slug: normalizeSlug(String(form.get("slug") ?? "")),
    description: normalizeText(form.get("description")),
    sortOrder: parseNumber(form.get("sortOrder"), 0),
    isActive: parseBoolean(form.get("isActive"), true)
  };
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const items = await prisma.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: items.length,
    items
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const payload = await parsePayload(request);

  if (payload.action === "delete") {
    if (!payload.id) {
      return NextResponse.json({ ok: false, message: "Category id is required." }, { status: 400 });
    }

    const existing = await prisma.productCategory.findUnique({
      where: { id: payload.id },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ ok: false, message: "Category not found." }, { status: 404 });
    }

    if (existing._count.products > 0) {
      return NextResponse.json(
        { ok: false, message: "Category is assigned to products. Reassign/remove product category first." },
        { status: 409 }
      );
    }

    await prisma.productCategory.delete({
      where: { id: payload.id }
    });

    await recordAuditEvent({
      actorUserId: actor?.id ?? null,
      action: "admin.category.delete",
      targetType: "product_category",
      targetId: payload.id,
      details: {
        name: existing.name,
        slug: existing.slug
      }
    });

    return NextResponse.json({ ok: true, message: "Category deleted." });
  }

  if (!payload.name) {
    return NextResponse.json({ ok: false, message: "Category name is required." }, { status: 400 });
  }

  const slug = payload.slug || normalizeSlug(payload.name);
  if (!slug) {
    return NextResponse.json({ ok: false, message: "Valid category slug is required." }, { status: 400 });
  }

  if (payload.action === "update") {
    if (!payload.id) {
      return NextResponse.json({ ok: false, message: "Category id is required for update." }, { status: 400 });
    }

    const existing = await prisma.productCategory.findUnique({
      where: { id: payload.id }
    });
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Category not found." }, { status: 404 });
    }

    const duplicate = await prisma.productCategory.findFirst({
      where: {
        id: { not: payload.id },
        OR: [{ name: { equals: payload.name, mode: "insensitive" } }, { slug }]
      },
      select: { id: true }
    });
    if (duplicate) {
      return NextResponse.json({ ok: false, message: "Another category already uses this name or slug." }, { status: 409 });
    }

    const updated = await prisma.productCategory.update({
      where: { id: payload.id },
      data: {
        name: payload.name,
        slug,
        description: payload.description || null,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive
      }
    });

    await recordAuditEvent({
      actorUserId: actor?.id ?? null,
      action: "admin.category.update",
      targetType: "product_category",
      targetId: updated.id,
      details: {
        name: updated.name,
        slug: updated.slug,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder
      }
    });

    return NextResponse.json({ ok: true, message: "Category updated.", item: updated });
  }

  const duplicate = await prisma.productCategory.findFirst({
    where: {
      OR: [{ name: { equals: payload.name, mode: "insensitive" } }, { slug }]
    },
    select: { id: true }
  });
  if (duplicate) {
    return NextResponse.json({ ok: false, message: "Category with same name or slug already exists." }, { status: 409 });
  }

  const created = await prisma.productCategory.create({
    data: {
      name: payload.name,
      slug,
      description: payload.description || null,
      sortOrder: payload.sortOrder,
      isActive: payload.isActive
    }
  });

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "admin.category.create",
    targetType: "product_category",
    targetId: created.id,
    details: {
      name: created.name,
      slug: created.slug,
      isActive: created.isActive,
      sortOrder: created.sortOrder
    }
  });

  return NextResponse.json({ ok: true, message: "Category created.", item: created });
}
