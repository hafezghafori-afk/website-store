import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    include: {
      orders: {
        select: {
          id: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: users.length,
    items: users
  });
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    out[key] = value;
  }
  return out;
}

function normalizeLocale(input: unknown) {
  const value = String(input ?? "").trim().toLowerCase();
  return value === "fa" || value === "en" ? value : null;
}

function normalizeCurrency(input: unknown) {
  const value = String(input ?? "").trim().toUpperCase();
  return value === "USD" || value === "EUR" ? value : null;
}

function normalizeCountry(input: unknown) {
  const value = String(input ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const body = await parseBody(request);
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "User id is required." }, { status: 400 });
  }

  const locale = normalizeLocale(body.locale);
  const preferredCurrency = normalizeCurrency(body.preferredCurrency);
  const country = normalizeCountry(body.country);
  const name = String(body.name ?? "").trim();

  if (body.locale !== undefined && !locale) {
    return NextResponse.json({ ok: false, message: "Invalid locale." }, { status: 400 });
  }
  if (body.preferredCurrency !== undefined && !preferredCurrency) {
    return NextResponse.json({ ok: false, message: "Invalid preferred currency." }, { status: 400 });
  }
  if (body.country !== undefined && String(body.country).trim() !== "" && !country) {
    return NextResponse.json({ ok: false, message: "Invalid country code." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: {
      id
    },
    data: {
      name: name ? name : null,
      country: country,
      locale: locale ?? undefined,
      preferredCurrency: preferredCurrency ?? undefined
    },
    select: {
      id: true,
      email: true,
      name: true,
      country: true,
      locale: true,
      preferredCurrency: true,
      updatedAt: true
    }
  });

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "admin.user.update",
    targetType: "user",
    targetId: id,
    details: {
      email: updated.email,
      locale: updated.locale,
      country: updated.country,
      preferredCurrency: updated.preferredCurrency
    }
  });

  return NextResponse.json({
    ok: true,
    message: "User profile updated.",
    data: updated
  });
}
