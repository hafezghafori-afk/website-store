import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { ensureProductInDatabase, getVariantAmount, getVariantForLicense } from "@/lib/catalog-db";
import { BASE_CURRENCY, EUR_RATE, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getPaymentOptions } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validators";
import { createZarinpalPaymentRequest, isZarinpalConfigured, toIrrAmount } from "@/lib/zarinpal";

type CheckoutCurrency = "USD" | "EUR";

function localeFromCountry(country: string): Locale {
  const normalized = country.toUpperCase();
  if (normalized === "IR" || normalized === "AF") {
    return "fa";
  }
  return "en";
}

function resolveCurrency(input: string): CheckoutCurrency {
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(input)) {
    return input as CheckoutCurrency;
  }
  return BASE_CURRENCY;
}

function normalizeCouponCode(input: string | undefined) {
  if (!input) {
    return null;
  }
  const code = input.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

function convertFixedDiscount(amount: number, from: CheckoutCurrency, to: CheckoutCurrency) {
  if (from === to) {
    return amount;
  }

  if (from === "USD" && to === "EUR") {
    return Math.max(1, Math.round(amount * EUR_RATE));
  }

  if (from === "EUR" && to === "USD") {
    return Math.max(1, Math.round(amount / EUR_RATE));
  }

  return amount;
}

function getCouponDiscount(subtotal: number, coupon: { type: string; amount: number; currency: string | null }, currency: CheckoutCurrency) {
  if (coupon.type === "percent") {
    return Math.max(0, Math.round((subtotal * coupon.amount) / 100));
  }

  const fromCurrency = (coupon.currency ?? BASE_CURRENCY) as CheckoutCurrency;
  return Math.max(0, convertFixedDiscount(coupon.amount, fromCurrency, currency));
}

export async function POST(request: Request) {
  const appUser = await requireAppUser();
  if (!appUser) {
    return NextResponse.json({ ok: false, message: "Login required for checkout." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = checkoutSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid checkout payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const product = await ensureProductInDatabase(payload.productId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
    }

    const locale = localeFromCountry(payload.country);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const currency = resolveCurrency(payload.currency);

    const enabledProviders = getPaymentOptions(payload.country, currency)
      .filter((item) => item.enabled)
      .map((item) => item.provider);
    if (!enabledProviders.includes(payload.provider)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Payment provider '${payload.provider}' is not available for country ${payload.country} and currency ${currency}.`
        },
        { status: 400 }
      );
    }

    const variant = getVariantForLicense(product.variants, payload.licenseType);
    if (!variant) {
      return NextResponse.json({ ok: false, message: "Selected license is not available." }, { status: 400 });
    }

    const subtotal = getVariantAmount(variant, currency);
    const couponCode = normalizeCouponCode(payload.couponCode);
    let couponId: string | null = null;
    let discount = 0;
    let couponMeta: Record<string, unknown> | null = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: {
          code: couponCode
        }
      });

      if (!coupon || !coupon.isActive) {
        return NextResponse.json({ ok: false, message: "Coupon is invalid or inactive." }, { status: 400 });
      }
      if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ ok: false, message: "Coupon has expired." }, { status: 400 });
      }
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json({ ok: false, message: "Coupon usage limit reached." }, { status: 400 });
      }

      couponId = coupon.id;
      discount = getCouponDiscount(subtotal, coupon, currency);
      if (discount >= subtotal) {
        discount = subtotal - 1;
      }
      couponMeta = {
        couponId: coupon.id,
        couponCode: coupon.code,
        couponType: coupon.type,
        couponAmount: coupon.amount,
        couponCurrency: coupon.currency,
        discount
      };
    }

    const amount = Math.max(1, subtotal - discount);

    const order = await prisma.order.create({
      data: {
        userId: appUser.id,
        total: amount,
        currency,
        status: "pending",
        items: {
          create: {
            productVariantId: variant.id,
            price: amount,
            currency
          }
        },
        payments: {
          create: {
            provider: payload.provider,
            status: "pending",
            meta: {
              country: payload.country,
              selectedCurrency: currency,
              licenseType: payload.licenseType,
              subtotal,
              discount,
              ...couponMeta
            }
          }
        }
      },
      include: {
        payments: true
      }
    });

    const payment = order.payments[0];
    if (!payment) {
      return NextResponse.json({ ok: false, message: "Payment initialization failed." }, { status: 500 });
    }

    if (payload.provider === "stripe") {
      const stripe = getStripe();
      if (!stripe) {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
              meta: {
                reason: "Stripe not configured"
              }
            }
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: "failed" }
          })
        ]);
        return NextResponse.json({ ok: false, message: "Stripe is not configured." }, { status: 500 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appUrl}/${locale}/dashboard?payment=success&orderId=${order.id}`,
        cancel_url: `${appUrl}/${locale}/checkout?payment=cancelled&productId=${product.id}`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amount * 100,
              product_data: {
                name: `${product.title} (${payload.licenseType})`
              }
            }
          }
        ],
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
          productId: product.id,
          appUserId: appUser.id,
          licenseType: payload.licenseType,
          provider: payload.provider,
          currency,
          couponId: couponId ?? "",
          couponCode: couponCode ?? ""
        }
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: session.id,
          meta: {
            country: payload.country,
            selectedCurrency: currency,
            licenseType: payload.licenseType,
            checkoutSessionId: session.id,
            subtotal,
            discount,
            ...couponMeta
          }
        }
      });

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        redirectUrl: session.url,
        message: discount > 0 ? "Coupon applied. Redirecting to Stripe checkout..." : "Redirecting to Stripe checkout..."
      });
    }

    if (payload.provider === "zarinpal") {
      if (!isZarinpalConfigured()) {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
              meta: {
                reason: "Zarinpal not configured"
              }
            }
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: "failed" }
          })
        ]);
        return NextResponse.json({ ok: false, message: "Zarinpal is not configured." }, { status: 500 });
      }

      const amountIrr = toIrrAmount(amount, currency);
      const callbackUrl = `${appUrl}/api/payments/zarinpal/callback?orderId=${order.id}&locale=${locale}`;
      const description = `${product.title} (${payload.licenseType})`;
      const requestResult = await createZarinpalPaymentRequest({
        amountIrr,
        callbackUrl,
        description,
        email: appUser.email
      });

      if (!requestResult.ok || !requestResult.gatewayUrl || !requestResult.authority) {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
              meta: {
                country: payload.country,
                selectedCurrency: currency,
                licenseType: payload.licenseType,
                subtotal,
                discount,
                zarinpalErrorCode: requestResult.code ?? null,
                zarinpalErrorMessage: requestResult.message ?? "Request failed.",
                ...couponMeta
              }
            }
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: "failed" }
          })
        ]);

        await recordAuditEvent({
          actorUserId: appUser.id,
          action: "checkout.zarinpal.request_failed",
          targetType: "order",
          targetId: order.id,
          details: {
            code: requestResult.code ?? null,
            message: requestResult.message ?? null
          }
        });

        return NextResponse.json({
          ok: false,
          message: requestResult.message ?? "Could not initialize Zarinpal payment."
        }, { status: 502 });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: requestResult.authority,
          meta: {
            country: payload.country,
            selectedCurrency: currency,
            licenseType: payload.licenseType,
            subtotal,
            discount,
            zarinpalAmountIrr: amountIrr,
            zarinpalAuthority: requestResult.authority,
            zarinpalRequestCode: requestResult.code ?? null,
            ...couponMeta
          }
        }
      });

      await recordAuditEvent({
        actorUserId: appUser.id,
        action: "checkout.zarinpal.request_created",
        targetType: "order",
        targetId: order.id,
        details: {
          authority: requestResult.authority,
          amountIrr
        }
      });

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        message: discount > 0 ? "Coupon applied. Redirecting to Zarinpal..." : "Redirecting to Zarinpal...",
        redirectUrl: requestResult.gatewayUrl
      });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      message:
        discount > 0
          ? "Coupon applied. Manual payment selected. Upload transfer receipt for admin approval."
          : "Manual payment selected. Upload transfer receipt for admin approval.",
      redirectUrl: `${appUrl}/${locale}/dashboard?payment=manual`
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected checkout error."
      },
      { status: 500 }
    );
  }
}
