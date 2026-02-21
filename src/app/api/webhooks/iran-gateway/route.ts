import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { grantDownloadTokensForOrder } from "@/lib/download-entitlement";
import { sendPaidOrderEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

function normalizeSignature(input: string) {
  const value = input.trim();
  if (!value) {
    return "";
  }

  if (value.toLowerCase().startsWith("sha256=")) {
    return value.slice(7).trim();
  }

  return value;
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(aa, bb);
}

function isValidWebhookSignature(rawBody: string, signatureHeader: string, secret: string) {
  const provided = normalizeSignature(signatureHeader);
  if (!provided) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = createHmac("sha256", secret).update(rawBody).digest("base64");

  return safeEqual(provided, expectedHex) || safeEqual(provided, expectedBase64);
}

function getSignatureHeader(request: Request) {
  return (
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("x-iran-webhook-signature") ??
    ""
  );
}

export async function POST(request: Request) {
  const webhookSecret = process.env.IRAN_GATEWAY_WEBHOOK_SECRET?.trim();

  const rawBody = await request.text();
  if (webhookSecret) {
    const signatureHeader = getSignatureHeader(request);
    const isValid = isValidWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      return NextResponse.json({ ok: false, message: "Invalid webhook signature." }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const provider = String(payload.provider ?? "zarinpal").trim();
    const orderId = String(payload.orderId ?? "").trim();
    const reference = String(payload.reference ?? payload.providerRef ?? "").trim();
    const status = String(payload.status ?? "").trim().toLowerCase();
    const isPaid = ["paid", "success", "succeeded", "ok", "verified"].includes(status);

    if (!orderId) {
      return NextResponse.json({ ok: false, message: "orderId is required." }, { status: 400 });
    }

    const paymentRecord = await prisma.payment.findFirst({
      where: {
        orderId,
        provider
      },
      select: {
        meta: true
      }
    });
    const existingMeta = typeof paymentRecord?.meta === "object" && paymentRecord?.meta ? (paymentRecord.meta as Record<string, unknown>) : {};
    const couponId = typeof existingMeta.couponId === "string" ? existingMeta.couponId : "";

    await prisma.payment.updateMany({
      where: {
        orderId,
        provider
      },
      data: {
        status: isPaid ? "succeeded" : "failed",
        providerRef: reference || null,
        meta: {
          ...existingMeta,
          ...payload,
          provider,
          status,
          reference: reference || null
        }
      }
    });

    if (isPaid) {
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

        const emailResult = await sendPaidOrderEmail({
          orderId,
          provider: "iran-gateway"
        });
        if (!emailResult.ok && !emailResult.skipped) {
          console.error("[iran-webhook] failed to send paid order email", emailResult.reason);
        }
      }
    } else {
      await prisma.order.updateMany({
        where: {
          id: orderId,
          status: {
            not: "paid"
          }
        },
        data: {
          status: "failed"
        }
      });
    }

    console.info("[iran-gateway-webhook] received", {
      provider,
      status,
      reference: reference || null,
      orderId
    });

    await recordAuditEvent({
      actorUserId: null,
      action: "webhook.iran_gateway.received",
      targetType: "order",
      targetId: orderId,
      details: {
        provider,
        status,
        isPaid,
        reference: reference || null
      }
    });

    return NextResponse.json({
      ok: true,
      message: isPaid ? "Payment verified and order unlocked." : "Payment callback recorded as failed.",
      orderId
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid callback payload." }, { status: 400 });
  }
}
