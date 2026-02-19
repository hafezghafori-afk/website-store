import { NextResponse } from "next/server";
import { generatePlainApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/api-keys";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ActionType = "create" | "revoke";

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      action: String(body.action ?? "create").trim().toLowerCase() as ActionType,
      id: String(body.id ?? "").trim(),
      name: String(body.name ?? "").trim()
    };
  }

  const form = await request.formData();
  return {
    action: String(form.get("action") ?? "create").trim().toLowerCase() as ActionType,
    id: String(form.get("id") ?? "").trim(),
    name: String(form.get("name") ?? "").trim()
  };
}

export async function GET() {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: {
      userId: appUser.id
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({
    ok: true,
    count: keys.length,
    items: keys
  });
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await parseBody(request);

    if (payload.action === "revoke") {
      if (!payload.id) {
        return NextResponse.json({ ok: false, message: "Key id is required." }, { status: 400 });
      }

      const revoked = await prisma.apiKey.updateMany({
        where: {
          id: payload.id,
          userId: appUser.id,
          isActive: true
        },
        data: {
          isActive: false,
          revokedAt: new Date()
        }
      });

      if (revoked.count > 0) {
        await recordAuditEvent({
          actorUserId: appUser.id,
          action: "api_key.revoke",
          targetType: "api_key",
          targetId: payload.id
        });
      }

      return NextResponse.json({
        ok: true,
        message: "API key revoked."
      });
    }

    const keyName = payload.name || "Default Key";
    if (keyName.length > 80) {
      return NextResponse.json({ ok: false, message: "Key name is too long." }, { status: 400 });
    }

    const plainKey = generatePlainApiKey();
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = getApiKeyPrefix(plainKey);

    const created = await prisma.apiKey.create({
      data: {
        userId: appUser.id,
        name: keyName,
        keyPrefix,
        keyHash
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true
      }
    });

    await recordAuditEvent({
      actorUserId: appUser.id,
      action: "api_key.create",
      targetType: "api_key",
      targetId: created.id,
      details: {
        keyPrefix: created.keyPrefix,
        name: created.name
      }
    });

    return NextResponse.json({
      ok: true,
      message: "API key created.",
      plainKey,
      key: created
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected API key error."
      },
      { status: 500 }
    );
  }
}
