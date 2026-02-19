import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      country: appUser.country,
      locale: appUser.locale,
      preferredCurrency: appUser.preferredCurrency
    }
  });
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = profileUpdateSchema.safeParse(await parseBody(request));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid profile payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const updated = await prisma.user.update({
    where: {
      id: appUser.id
    },
    data: {
      name: payload.name ?? null,
      country: payload.country ?? null,
      locale: payload.locale ?? appUser.locale,
      preferredCurrency: payload.preferredCurrency
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
    actorUserId: appUser.id,
    action: "profile.update",
    targetType: "user",
    targetId: appUser.id,
    details: {
      locale: updated.locale,
      country: updated.country,
      preferredCurrency: updated.preferredCurrency
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Profile updated.",
    profile: updated
  });
}
