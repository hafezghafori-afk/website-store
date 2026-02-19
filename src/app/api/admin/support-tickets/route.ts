import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";
import { adminSupportTicketActionSchema } from "@/lib/validators";

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

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      id: String(body.id ?? "").trim(),
      status: String(body.status ?? "").trim().toLowerCase(),
      reply: String(body.reply ?? "").trim()
    };
  }

  const form = await request.formData();
  return {
    id: String(form.get("id") ?? "").trim(),
    status: String(form.get("status") ?? "").trim().toLowerCase(),
    reply: String(form.get("reply") ?? "").trim()
  };
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const tickets = await prisma.supportTicket.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      replies: {
        orderBy: {
          createdAt: "asc"
        },
        take: 30,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: tickets.length,
    items: tickets
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const rawPayload = await parsePayload(request);
  const normalizedPayload = {
    id: rawPayload.id,
    status: rawPayload.status || undefined,
    reply: rawPayload.reply || undefined
  };
  const parsed = adminSupportTicketActionSchema.safeParse(normalizedPayload);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid ticket action payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const ticket = await prisma.supportTicket.findUnique({
    where: {
      id: payload.id
    },
    select: {
      id: true,
      status: true,
      resolvedAt: true
    }
  });

  if (!ticket) {
    return NextResponse.json({ ok: false, message: "Ticket not found." }, { status: 404 });
  }

  const hasStatusChange = typeof payload.status !== "undefined";
  const nextStatus = payload.status ?? ticket.status;
  const shouldResolve = nextStatus === "resolved" || nextStatus === "closed";
  const nextResolvedAt = shouldResolve ? (hasStatusChange ? new Date() : ticket.resolvedAt) : null;
  const [updatedTicket, createdReply] = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.update({
      where: {
        id: payload.id
      },
      data: {
        status: nextStatus,
        resolvedAt: nextResolvedAt
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        resolvedAt: true
      }
    });

    let reply: {
      id: string;
      message: string;
      authorType: string;
      createdAt: Date;
    } | null = null;

    if (payload.reply) {
      reply = await tx.supportTicketReply.create({
        data: {
          ticketId: payload.id,
          userId: actor?.id ?? null,
          authorType: "admin",
          message: payload.reply
        },
        select: {
          id: true,
          message: true,
          authorType: true,
          createdAt: true
        }
      });
    }

    return [updated, reply] as const;
  });

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "support.ticket.update.admin",
    targetType: "support_ticket",
    targetId: payload.id,
    details: {
      previousStatus: ticket.status,
      nextStatus,
      replied: Boolean(payload.reply),
      statusChanged: hasStatusChange
    }
  });

  return NextResponse.json({
    ok: true,
    message: payload.reply ? "Ticket updated and admin reply posted." : "Ticket status updated.",
    data: updatedTicket,
    reply: createdReply
  });
}
