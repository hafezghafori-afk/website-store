import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

type CouponAction = "create" | "toggle" | "delete";

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

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return body as Record<string, unknown>;
  }

  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    out[key] = value;
  }
  return out;
}

function normalizeCurrency(input: unknown) {
  const value = String(input ?? BASE_CURRENCY).toUpperCase();
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(value)) {
    return value as "USD" | "EUR";
  }
  return BASE_CURRENCY;
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const coupons = await prisma.coupon.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json({
    ok: true,
    count: coupons.length,
    items: coupons
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const body = await parseBody(request);
  const action = String(body.action ?? "create").trim().toLowerCase() as CouponAction;

  if (action === "toggle") {
    const id = String(body.id ?? "").trim();
    const isActive = String(body.isActive ?? "").trim().toLowerCase() === "true";

    if (!id) {
      return NextResponse.json({ ok: false, message: "id is required." }, { status: 400 });
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        isActive
      }
    });

    await recordAuditEvent({
      actorUserId: actor?.id ?? null,
      action: "admin.coupon.toggle",
      targetType: "coupon",
      targetId: updated.id,
      details: {
        code: updated.code,
        isActive: updated.isActive
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Coupon status updated.",
      data: updated
    });
  }

  if (action === "delete") {
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, message: "id is required." }, { status: 400 });
    }

    await prisma.coupon.delete({
      where: {
        id
      }
    });

    await recordAuditEvent({
      actorUserId: actor?.id ?? null,
      action: "admin.coupon.delete",
      targetType: "coupon",
      targetId: id
    });

    return NextResponse.json({
      ok: true,
      message: "Coupon deleted."
    });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  const type = String(body.type ?? "percent").trim().toLowerCase();
  const amount = Number(body.amount ?? 0);
  const currency = normalizeCurrency(body.currency);
  const maxUsesRaw = Number(body.maxUses ?? 0);
  const maxUses = Number.isFinite(maxUsesRaw) && maxUsesRaw > 0 ? Math.round(maxUsesRaw) : null;
  const expiresAtRaw = String(body.expiresAt ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  if (!code) {
    return NextResponse.json({ ok: false, message: "code is required." }, { status: 400 });
  }
  if (type !== "percent" && type !== "fixed") {
    return NextResponse.json({ ok: false, message: "type must be percent or fixed." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, message: "amount must be greater than zero." }, { status: 400 });
  }
  if (type === "percent" && amount > 90) {
    return NextResponse.json({ ok: false, message: "percent coupon cannot exceed 90." }, { status: 400 });
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ ok: false, message: "expiresAt is invalid." }, { status: 400 });
  }

  const existing = await prisma.coupon.findUnique({
    where: { code }
  });
  if (existing) {
    return NextResponse.json({ ok: false, message: "Coupon code already exists." }, { status: 409 });
  }

  const created = await prisma.coupon.create({
    data: {
      code,
      type: type === "fixed" ? "fixed" : "percent",
      amount: Math.round(amount),
      currency: type === "fixed" ? currency : null,
      maxUses,
      expiresAt
    }
  });

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "admin.coupon.create",
    targetType: "coupon",
    targetId: created.id,
    details: {
      code: created.code,
      type: created.type,
      amount: created.amount,
      currency: created.currency
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Coupon created.",
    data: created
  });
}
