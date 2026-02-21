import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { requireAppUser } from "@/lib/app-user";
import { isClerkEnabled } from "@/lib/clerk-config";
import { ensureProductInDatabase, getVariantAmount, getVariantForLicense } from "@/lib/catalog-db";
import { BASE_CURRENCY, EUR_RATE, type LicenseType, type Locale, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { getPaymentOptions } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { checkoutCartSchema, checkoutSingleSchema } from "@/lib/validators";
import { createZarinpalPaymentRequest, isZarinpalConfigured, toIrrAmount } from "@/lib/zarinpal";

type CheckoutCurrency = "USD" | "EUR";

type CheckoutInputItem = {
  productId: string;
  licenseType: LicenseType;
};

type PreparedCheckoutLine = {
  productId: string;
  productTitle: string;
  licenseType: LicenseType;
  variantId: string;
  unitAmount: number;
  finalAmount: number;
};

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

function dedupeCheckoutItems(items: CheckoutInputItem[]) {
  const seen = new Set<string>();
  const unique: CheckoutInputItem[] = [];

  for (const item of items) {
    const key = `${item.productId}:${item.licenseType}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function distributeDiscount(lines: Omit<PreparedCheckoutLine, "finalAmount">[], totalDiscount: number): PreparedCheckoutLine[] {
  if (totalDiscount <= 0) {
    return lines.map((line) => ({ ...line, finalAmount: line.unitAmount }));
  }

  const subtotal = lines.reduce((acc, line) => acc + line.unitAmount, 0);
  if (subtotal <= 0) {
    return lines.map((line) => ({ ...line, finalAmount: line.unitAmount }));
  }

  const allocations = lines.map((line, index) => {
    const raw = (line.unitAmount * totalDiscount) / subtotal;
    const base = Math.floor(raw);
    return {
      index,
      discount: base,
      fraction: raw - base
    };
  });

  let distributed = allocations.reduce((acc, item) => acc + item.discount, 0);
  let remaining = Math.max(0, totalDiscount - distributed);

  allocations.sort((a, b) => b.fraction - a.fraction);
  let cursor = 0;
  while (remaining > 0 && allocations.length > 0) {
    allocations[cursor].discount += 1;
    remaining -= 1;
    cursor = (cursor + 1) % allocations.length;
  }

  const discountByIndex = new Map<number, number>();
  for (const item of allocations) {
    discountByIndex.set(item.index, item.discount);
  }

  return lines.map((line, index) => {
    const lineDiscount = discountByIndex.get(index) ?? 0;
    return {
      ...line,
      finalAmount: Math.max(0, line.unitAmount - lineDiscount)
    };
  });
}

export async function POST(request: Request) {
  let clerkUserId: string | null = null;

  if (isClerkEnabled()) {
    try {
      const clerk = await import("@clerk/nextjs/server");
      clerkUserId = clerk.auth().userId ?? null;
    } catch (error) {
      console.error("[checkout] failed to resolve Clerk auth context", error);
      return NextResponse.json(
        {
          ok: false,
          message: "Authentication context is not available on server. Check Clerk middleware and environment keys."
        },
        { status: 500 }
      );
    }
  }

  const appUser = await requireAppUser();
  if (!appUser) {
    if (isClerkEnabled() && clerkUserId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Signed-in session detected, but user profile could not be loaded from database. Check DATABASE_URL and run Prisma migrations."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: false, message: "Login required for checkout." }, { status: 401 });
  }

  try {
    const json = await request.json();

    const parsedCart = checkoutCartSchema.safeParse(json);
    const parsedSingle = parsedCart.success ? null : checkoutSingleSchema.safeParse(json);

    if (!parsedCart.success && (!parsedSingle || !parsedSingle.success)) {
      return NextResponse.json({ ok: false, message: "Invalid checkout payload." }, { status: 400 });
    }

    let payload: {
      currency: CheckoutCurrency;
      country: string;
      provider: "stripe" | "zarinpal" | "manual-af";
      couponCode?: string;
    };
    let requestItems: CheckoutInputItem[];

    if (parsedCart.success) {
      payload = {
        currency: parsedCart.data.currency,
        country: parsedCart.data.country,
        provider: parsedCart.data.provider,
        couponCode: parsedCart.data.couponCode
      };
      requestItems = parsedCart.data.items;
    } else {
      if (!parsedSingle || !parsedSingle.success) {
        return NextResponse.json({ ok: false, message: "Invalid checkout payload." }, { status: 400 });
      }
      const single = parsedSingle.data;
      payload = {
        currency: single.currency,
        country: single.country,
        provider: single.provider,
        couponCode: single.couponCode
      };
      requestItems = [{ productId: single.productId, licenseType: single.licenseType }];
    }
    const checkoutItems = dedupeCheckoutItems(requestItems);

    if (checkoutItems.length === 0) {
      return NextResponse.json({ ok: false, message: "No checkout items provided." }, { status: 400 });
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

    const baseLines: Omit<PreparedCheckoutLine, "finalAmount">[] = [];
    for (const item of checkoutItems) {
      const product = await ensureProductInDatabase(item.productId);
      if (!product) {
        return NextResponse.json({ ok: false, message: `Product not found: ${item.productId}` }, { status: 404 });
      }

      const variant = getVariantForLicense(product.variants, item.licenseType);
      if (!variant) {
        return NextResponse.json(
          { ok: false, message: `Selected license is not available for ${product.title}.` },
          { status: 400 }
        );
      }

      baseLines.push({
        productId: product.id,
        productTitle: product.title,
        licenseType: item.licenseType,
        variantId: variant.id,
        unitAmount: getVariantAmount(variant, currency)
      });
    }

    const subtotal = baseLines.reduce((acc, line) => acc + line.unitAmount, 0);
    if (subtotal <= 0) {
      return NextResponse.json({ ok: false, message: "Subtotal is invalid." }, { status: 400 });
    }

    const couponCode = normalizeCouponCode(payload.couponCode);
    let couponId: string | null = null;
    let discount = 0;
    let couponMeta: Prisma.JsonObject | null = null;

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

    const checkoutLines = distributeDiscount(baseLines, discount);
    const amount = checkoutLines.reduce((acc, line) => acc + line.finalAmount, 0);
    if (amount <= 0) {
      return NextResponse.json({ ok: false, message: "Checkout total must be greater than zero." }, { status: 400 });
    }

    const isMultiItemOrder = checkoutLines.length > 1;
    const firstLine = checkoutLines[0];

    const paymentMeta: Prisma.JsonObject = {
      country: payload.country,
      selectedCurrency: currency,
      subtotal,
      discount,
      checkoutMode: isMultiItemOrder ? "cart" : "single",
      itemCount: checkoutLines.length,
      items: checkoutLines.map((line) => ({
        productId: line.productId,
        title: line.productTitle,
        licenseType: line.licenseType,
        unitAmount: line.unitAmount,
        finalAmount: line.finalAmount
      })),
      ...couponMeta
    };

    if (!isMultiItemOrder) {
      paymentMeta.licenseType = firstLine.licenseType;
    }

    const order = await prisma.order.create({
      data: {
        userId: appUser.id,
        total: amount,
        currency,
        status: "pending",
        items: {
          create: checkoutLines.map((line) => ({
            productVariantId: line.variantId,
            price: line.finalAmount,
            currency
          }))
        },
        payments: {
          create: {
            provider: payload.provider,
            status: "pending",
            meta: paymentMeta as Prisma.InputJsonValue
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
                ...paymentMeta,
                reason: "Stripe not configured"
              } as Prisma.InputJsonValue
            }
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: "failed" }
          })
        ]);
        return NextResponse.json({ ok: false, message: "Stripe is not configured." }, { status: 500 });
      }

      const productIds = checkoutLines.map((line) => line.productId).join(",");
      const stripeProductName = isMultiItemOrder
        ? `${checkoutLines.length} template items`
        : `${firstLine.productTitle} (${firstLine.licenseType})`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appUrl}/${locale}/dashboard?payment=success&orderId=${order.id}`,
        cancel_url: isMultiItemOrder
          ? `${appUrl}/${locale}/cart?payment=cancelled`
          : `${appUrl}/${locale}/checkout?payment=cancelled&productId=${firstLine.productId}`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amount * 100,
              product_data: {
                name: stripeProductName
              }
            }
          }
        ],
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
          productId: isMultiItemOrder ? "" : firstLine.productId,
          appUserId: appUser.id,
          licenseType: isMultiItemOrder ? "multiple" : firstLine.licenseType,
          provider: payload.provider,
          currency,
          couponId: couponId ?? "",
          couponCode: couponCode ?? "",
          itemCount: String(checkoutLines.length),
          productIds
        }
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: session.id,
          meta: {
            ...paymentMeta,
            checkoutSessionId: session.id
          } as Prisma.InputJsonValue
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
                ...paymentMeta,
                reason: "Zarinpal not configured"
              } as Prisma.InputJsonValue
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
      const description = isMultiItemOrder
        ? `${firstLine.productTitle} + ${checkoutLines.length - 1} more items`
        : `${firstLine.productTitle} (${firstLine.licenseType})`;
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
                ...paymentMeta,
                zarinpalErrorCode: requestResult.code ?? null,
                zarinpalErrorMessage: requestResult.message ?? "Request failed."
              } as Prisma.InputJsonValue
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

        return NextResponse.json(
          {
            ok: false,
            message: requestResult.message ?? "Could not initialize Zarinpal payment."
          },
          { status: 502 }
        );
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: requestResult.authority,
          meta: {
            ...paymentMeta,
            zarinpalAmountIrr: amountIrr,
            zarinpalAuthority: requestResult.authority,
            zarinpalRequestCode: requestResult.code ?? null
          } as Prisma.InputJsonValue
        }
      });

      await recordAuditEvent({
        actorUserId: appUser.id,
        action: "checkout.zarinpal.request_created",
        targetType: "order",
        targetId: order.id,
        details: {
          authority: requestResult.authority,
          amountIrr,
          itemCount: checkoutLines.length
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
      redirectUrl: `${appUrl}/${locale}/dashboard?payment=pending&provider=manual-af&orderId=${order.id}`
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
