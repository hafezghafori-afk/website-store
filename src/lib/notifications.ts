import { prisma } from "@/lib/prisma";

type PaymentProvider = "stripe" | "zarinpal" | "manual-af" | "iran-gateway";

type PaidOrderEmailInput = {
  orderId: string;
  provider: PaymentProvider;
};

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function resolveAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3002";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return new URL(raw).origin;
    }
    return new URL(`https://${raw}`).origin;
  } catch {
    return "http://localhost:3002";
  }
}

function labelProvider(provider: PaymentProvider) {
  if (provider === "manual-af") {
    return "Manual Transfer";
  }
  if (provider === "zarinpal") {
    return "Zarinpal";
  }
  if (provider === "iran-gateway") {
    return "Iran Gateway";
  }
  return "Stripe";
}

export async function sendPaidOrderEmail(input: PaidOrderEmailInput) {
  if (!isEmailConfigured()) {
    return { ok: false as const, skipped: true as const, reason: "Email provider is not configured." };
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: {
        select: {
          email: true,
          locale: true
        }
      },
      items: {
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  title: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!order || !order.user?.email) {
    return { ok: false as const, skipped: true as const, reason: "Order or user email not found." };
  }

  const locale = order.user.locale === "en" ? "en" : "fa";
  const dashboardPath = `/${locale}/dashboard?payment=success&orderId=${order.id}`;
  const dashboardUrl = `${resolveAppUrl().replace(/\/$/, "")}${dashboardPath}`;
  const items = order.items
    .map((item) => `${item.productVariant.product.title} (${item.productVariant.licenseType})`)
    .join(", ");

  const isFa = locale === "fa";
  const subject = isFa
    ? `تایید سفارش ${order.id} - دانلود فعال شد`
    : `Order ${order.id} confirmed - downloads unlocked`;

  const html = isFa
    ? `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#111">
        <h2 style="margin:0 0 12px">سفارش شما با موفقیت تایید شد</h2>
        <p>شماره سفارش: <strong>${order.id}</strong></p>
        <p>روش پرداخت: <strong>${labelProvider(input.provider)}</strong></p>
        <p>محصولات: ${items}</p>
        <p>مبلغ: <strong>${order.total} ${order.currency}</strong></p>
        <p style="margin-top:18px">
          برای دانلود امن فایل‌ها وارد داشبورد شوید:
          <a href="${dashboardUrl}" target="_blank" rel="noreferrer">ورود به داشبورد</a>
        </p>
      </div>
    `
    : `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#111">
        <h2 style="margin:0 0 12px">Your order is confirmed</h2>
        <p>Order ID: <strong>${order.id}</strong></p>
        <p>Payment method: <strong>${labelProvider(input.provider)}</strong></p>
        <p>Items: ${items}</p>
        <p>Total: <strong>${order.total} ${order.currency}</strong></p>
        <p style="margin-top:18px">
          Open dashboard for secure downloads:
          <a href="${dashboardUrl}" target="_blank" rel="noreferrer">Go to dashboard</a>
        </p>
      </div>
    `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [order.user.email],
      subject,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false as const,
      skipped: false as const,
      reason: `Resend error (${response.status}): ${body.slice(0, 300)}`
    };
  }

  return { ok: true as const };
}
