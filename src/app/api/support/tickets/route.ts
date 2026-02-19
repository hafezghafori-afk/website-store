import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";
import { supportTicketSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: {
      OR: [{ userId: appUser.id }, { email: appUser.email }]
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      replies: {
        orderBy: {
          createdAt: "asc"
        },
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
    },
    take: 100
  });

  return NextResponse.json({
    ok: true,
    count: tickets.length,
    items: tickets
  });
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();

  try {
    const body = await request.json();
    const parsed = supportTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid support ticket payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const email = appUser?.email ?? payload.email;
    if (!email) {
      return NextResponse.json({ ok: false, message: "Email is required." }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: appUser?.id ?? null,
        email,
        name: payload.name ?? appUser?.name ?? null,
        subject: payload.subject,
        message: payload.message,
        status: "open",
        meta: {
          source: "support-page",
          locale: appUser?.locale ?? null,
          country: appUser?.country ?? null
        }
      },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true
      }
    });

    await recordAuditEvent({
      actorUserId: appUser?.id ?? null,
      action: "support.ticket.create",
      targetType: "support_ticket",
      targetId: ticket.id,
      details: {
        status: ticket.status,
        subject: ticket.subject
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Support request submitted.",
      ticket
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected support request error."
      },
      { status: 500 }
    );
  }
}
