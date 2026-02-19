import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { grantDownloadTokensForOrder } from "@/lib/download-entitlement";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  const paymentId = session.metadata?.paymentId;
  const couponId = session.metadata?.couponId ? session.metadata.couponId.trim() : "";
  const isTestData = session.metadata?.testData === "true";

  if (!orderId) {
    return;
  }

  const paymentStatusMeta = {
    checkoutSessionId: session.id,
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripeStatus: session.payment_status,
    testData: isTestData
  };

  if (paymentId) {
    const existingPayment = await prisma.payment.findUnique({
      where: {
        id: paymentId
      },
      select: {
        meta: true
      }
    });

    await prisma.payment.updateMany({
      where: { id: paymentId },
      data: {
        status: "succeeded",
        providerRef: session.id,
        meta: {
          ...(typeof existingPayment?.meta === "object" && existingPayment?.meta ? (existingPayment.meta as Record<string, unknown>) : {}),
          ...paymentStatusMeta
        }
      }
    });
  } else {
    await prisma.payment.updateMany({
      where: {
        provider: "stripe",
        providerRef: session.id
      },
      data: {
        status: "succeeded",
        meta: paymentStatusMeta
      }
    });
  }

  const transition = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: {
        not: "paid"
      }
    },
    data: {
      status: "paid"
    }
  });

  if (transition.count > 0) {
    await grantDownloadTokensForOrder(orderId);

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
  }

  await recordAuditEvent({
    actorUserId: null,
    action: "webhook.stripe.checkout_completed",
    targetType: "order",
    targetId: orderId,
    details: {
      checkoutSessionId: session.id,
      paymentId: paymentId ?? null,
      paymentStatus: session.payment_status
    }
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const relatedPayments = await prisma.payment.findMany({
    where: {
      provider: "stripe",
      providerRef: session.id
    },
    select: {
      id: true,
      orderId: true
    }
  });

  if (relatedPayments.length === 0) {
    return;
  }

  const orderIds = Array.from(new Set(relatedPayments.map((item: (typeof relatedPayments)[number]) => item.orderId)));

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        id: {
          in: relatedPayments.map((item: (typeof relatedPayments)[number]) => item.id)
        }
      },
      data: {
        status: "failed",
        meta: {
          checkoutSessionId: session.id,
          stripeStatus: session.status ?? "expired"
        }
      }
    }),
    prisma.order.updateMany({
      where: {
        id: {
          in: orderIds
        },
        status: "pending"
      },
      data: {
        status: "failed"
      }
    })
  ]);

  const firstOrderId = orderIds[0] ?? null;
  await recordAuditEvent({
    actorUserId: null,
    action: "webhook.stripe.checkout_expired",
    targetType: "order",
    targetId: firstOrderId,
    details: {
      checkoutSessionId: session.id,
      orderIds
    }
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ ok: false, message: "Stripe webhook is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }

    if (event.type === "checkout.session.expired") {
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid Stripe webhook payload."
      },
      { status: 400 }
    );
  }
}
