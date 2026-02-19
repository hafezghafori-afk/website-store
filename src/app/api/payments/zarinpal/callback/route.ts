import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { grantDownloadTokensForOrder } from "@/lib/download-entitlement";
import { BASE_CURRENCY, DEFAULT_LOCALE, LOCALES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { toIrrAmount, verifyZarinpalPayment } from "@/lib/zarinpal";

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveLocale(value: string | null) {
  if (value && LOCALES.includes(value as (typeof LOCALES)[number])) {
    return value as (typeof LOCALES)[number];
  }
  return DEFAULT_LOCALE;
}

function buildRedirectUrl(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, appUrl);
}

function getIrrAmountFromPaymentMeta(paymentMeta: Record<string, unknown>, orderTotal: number, orderCurrency: string) {
  const metaAmount = paymentMeta.zarinpalAmountIrr;
  if (typeof metaAmount === "number" && Number.isFinite(metaAmount) && metaAmount > 0) {
    return Math.round(metaAmount);
  }

  const currency = orderCurrency === "EUR" ? "EUR" : BASE_CURRENCY;
  return toIrrAmount(orderTotal, currency);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const locale = resolveLocale(url.searchParams.get("locale"));
  const authority = url.searchParams.get("Authority");
  const status = (url.searchParams.get("Status") ?? "").toUpperCase();

  if (!orderId || !authority) {
    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/dashboard?payment=failed&provider=zarinpal&reason=invalid_callback`)
    );
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId
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
    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/dashboard?payment=failed&provider=zarinpal&reason=order_not_found`)
    );
  }

  const zarinpalPayment = order.payments.find((item) => item.provider === "zarinpal");
  if (!zarinpalPayment) {
    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/dashboard?payment=failed&provider=zarinpal&reason=payment_not_found`)
    );
  }

  const existingMeta = asRecord(zarinpalPayment.meta);
  const couponId = typeof existingMeta.couponId === "string" && existingMeta.couponId ? existingMeta.couponId : null;

  if (status !== "OK") {
    await prisma.$transaction([
      prisma.payment.update({
        where: {
          id: zarinpalPayment.id
        },
        data: {
          status: "failed",
          meta: {
            ...existingMeta,
            zarinpalCallbackStatus: status || "NOK",
            zarinpalAuthority: authority
          }
        }
      }),
      prisma.order.updateMany({
        where: {
          id: order.id,
          status: {
            not: "paid"
          }
        },
        data: {
          status: "failed"
        }
      })
    ]);

    await recordAuditEvent({
      actorUserId: null,
      action: "zarinpal.callback.cancelled",
      targetType: "order",
      targetId: order.id,
      details: {
        authority,
        status
      }
    });

    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/dashboard?payment=cancelled&provider=zarinpal&orderId=${order.id}`)
    );
  }

  const amountIrr = getIrrAmountFromPaymentMeta(existingMeta, order.total, order.currency);
  const verifyResult = await verifyZarinpalPayment({
    authority,
    amountIrr
  });

  if (!verifyResult.ok) {
    await prisma.$transaction([
      prisma.payment.update({
        where: {
          id: zarinpalPayment.id
        },
        data: {
          status: "failed",
          meta: {
            ...existingMeta,
            zarinpalCallbackStatus: status,
            zarinpalAuthority: authority,
            zarinpalVerifyCode: verifyResult.code ?? null,
            zarinpalVerifyMessage: verifyResult.message ?? null
          }
        }
      }),
      prisma.order.updateMany({
        where: {
          id: order.id,
          status: {
            not: "paid"
          }
        },
        data: {
          status: "failed"
        }
      })
    ]);

    await recordAuditEvent({
      actorUserId: null,
      action: "zarinpal.callback.verify_failed",
      targetType: "order",
      targetId: order.id,
      details: {
        authority,
        code: verifyResult.code ?? null,
        message: verifyResult.message ?? null
      }
    });

    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/dashboard?payment=failed&provider=zarinpal&orderId=${order.id}`)
    );
  }

  await prisma.payment.update({
    where: {
      id: zarinpalPayment.id
    },
    data: {
      status: "succeeded",
      providerRef: authority,
      meta: {
        ...existingMeta,
        zarinpalCallbackStatus: status,
        zarinpalAuthority: authority,
        zarinpalVerifyCode: verifyResult.code ?? null,
        zarinpalRefId: verifyResult.refId ?? null,
        zarinpalCardPan: verifyResult.cardPan ?? null,
        zarinpalFeeType: verifyResult.feeType ?? null,
        zarinpalFee: verifyResult.fee ?? null
      }
    }
  });

  const transition = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: {
        not: "paid"
      }
    },
    data: {
      status: "paid"
    }
  });

  if (transition.count > 0) {
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
  }

  await recordAuditEvent({
    actorUserId: null,
    action: "zarinpal.callback.verified",
    targetType: "order",
    targetId: order.id,
    details: {
      authority,
      refId: verifyResult.refId ?? null,
      transitioned: transition.count > 0,
      alreadyVerified: verifyResult.alreadyVerified ?? false
    }
  });

  return NextResponse.redirect(
    buildRedirectUrl(`/${locale}/dashboard?payment=success&provider=zarinpal&orderId=${order.id}`)
  );
}
