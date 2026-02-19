import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { supportTicketReplySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function parseMessage(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      message: String(body.message ?? "").trim()
    };
  }

  const form = await request.formData();
  return {
    message: String(form.get("message") ?? "").trim()
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const ticketId = String(params.id ?? "").trim();
  if (!ticketId) {
    return NextResponse.json({ ok: false, message: "Ticket id is required." }, { status: 400 });
  }

  const parsed = supportTicketReplySchema.safeParse(await parseMessage(request));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid reply payload." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      OR: [{ userId: appUser.id }, { email: appUser.email }]
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

  const shouldReopen = ticket.status === "resolved" || ticket.status === "closed";
  const [updatedTicket, reply] = await prisma.$transaction([
    prisma.supportTicket.update({
      where: {
        id: ticket.id
      },
      data: {
        status: shouldReopen ? "open" : ticket.status,
        resolvedAt: shouldReopen ? null : ticket.resolvedAt
      },
      select: {
        id: true,
        status: true,
        updatedAt: true
      }
    }),
    prisma.supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        userId: appUser.id,
        authorType: "user",
        message: parsed.data.message
      },
      select: {
        id: true,
        message: true,
        authorType: true,
        createdAt: true
      }
    })
  ]);

  await recordAuditEvent({
    actorUserId: appUser.id,
    action: "support.ticket.reply.user",
    targetType: "support_ticket",
    targetId: ticket.id,
    details: {
      reopened: shouldReopen
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Reply submitted.",
    ticket: updatedTicket,
    reply
  });
}
