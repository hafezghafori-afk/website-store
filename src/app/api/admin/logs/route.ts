import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

  const [logs, auditEvents] = await Promise.all([
    prisma.downloadLog.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    }),
    prisma.auditEvent.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 200,
      include: {
        actorUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })
  ]);

  return NextResponse.json({
    ok: true,
    count: logs.length,
    items: logs,
    auditCount: auditEvents.length,
    auditEvents
  });
}
