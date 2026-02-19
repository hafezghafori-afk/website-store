import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { grantDownloadTokensForOrder } from "@/lib/download-entitlement";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

type ReviewAction = "approve" | "reject";

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

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function parsePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      orderId: String(body.orderId ?? "").trim(),
      action: String(body.action ?? "").trim().toLowerCase() as ReviewAction,
      note: String(body.note ?? "").trim()
    };
  }

  const form = await request.formData();
  return {
    orderId: String(form.get("orderId") ?? "").trim(),
    action: String(form.get("action") ?? "").trim().toLowerCase() as ReviewAction,
    note: String(form.get("note") ?? "").trim()
  };
}

export async function GET() {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      items: {
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  title: true
                }
              }
            }
          }
        }
      },
      payments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    count: orders.length,
    items: orders
  });
}

export async function POST(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const actor = await requireAppUser();
  const payload = await parsePayload(request);
  if (!payload.orderId || (payload.action !== "approve" && payload.action !== "reject")) {
    return NextResponse.json({ ok: false, message: "orderId and valid action are required." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: {
      id: payload.orderId
    },
    include: {
      payments: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ ok: false, message: "Order not found." }, { status: 404 });
  }

  const pendingManualPayment = order.payments.find((item) => item.provider === "manual-af" && item.status === "pending");
  if (!pendingManualPayment) {
    return NextResponse.json(
      { ok: false, message: "No pending manual payment found for this order." },
      { status: 400 }
    );
  }

  const paymentMeta = asRecord(pendingManualPayment.meta);
  const couponId = typeof paymentMeta.couponId === "string" && paymentMeta.couponId ? paymentMeta.couponId : null;
  const reviewMeta = {
    ...paymentMeta,
    manualReview: {
      action: payload.action,
      note: payload.note || null,
      reviewedAt: new Date().toISOString()
    }
  };

  if (payload.action === "approve") {
    await prisma.$transaction([
      prisma.payment.update({
        where: {
          id: pendingManualPayment.id
        },
        data: {
          status: "succeeded",
          meta: reviewMeta
        }
      }),
      prisma.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "paid"
        }
      })
    ]);

    await grantDownloadTokensForOrder(order.id);

    if (couponId) {
      await prisma.coupon.updateMany({
        where: {
          id: couponId,
          isActive: true
        },
        data: {
          usedCount: {
            increment: 1
          }
        }
      });
    }

    await recordAuditEvent({
      actorUserId: actor?.id ?? null,
      action: "admin.order.manual_review",
      targetType: "order",
      targetId: order.id,
      details: {
        reviewAction: payload.action,
        paymentId: pendingManualPayment.id
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Manual payment approved. Order marked as paid and downloads unlocked."
    });
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: {
        id: pendingManualPayment.id
      },
      data: {
        status: "failed",
        meta: reviewMeta
      }
    }),
    prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        status: "failed"
      }
    })
  ]);

  await recordAuditEvent({
    actorUserId: actor?.id ?? null,
    action: "admin.order.manual_review",
    targetType: "order",
    targetId: order.id,
    details: {
      reviewAction: payload.action,
      paymentId: pendingManualPayment.id
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Manual payment rejected and order marked as failed."
  });
}
