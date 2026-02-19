import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

function readEnvFile(envPath) {
  const map = new Map();
  if (!fs.existsSync(envPath)) {
    return map;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    map.set(key, value);
  }

  return map;
}

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureUser(prisma, email) {
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    return existing;
  }

  const clerkId = `dev_${email.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48)}`;
  return prisma.user.create({
    data: {
      email,
      clerkId,
      name: "Webhook Test User",
      locale: "en",
      country: "US"
    }
  });
}

async function createPendingStripeOrder(prisma, email, productId, licenseType, currency) {
  const user = await ensureUser(prisma, email);

  const variant = await prisma.productVariant.findFirst({
    where: {
      productId,
      licenseType,
      isActive: true
    }
  });

  if (!variant) {
    throw new Error(`Variant not found for product ${productId} and license ${licenseType}.`);
  }

  const amount = currency === "EUR" ? variant.priceEUR : variant.priceUSD;

  const order = await prisma.order.create({
    data: {
      userId: user.id,
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
          provider: "stripe",
          status: "pending",
          meta: {
            source: "test-stripe-webhook-script",
            testData: true
          }
        }
      }
    },
    include: {
      payments: true
    }
  });

  return {
    orderId: order.id,
    paymentId: order.payments[0]?.id
  };
}

async function main() {
  const cwd = process.cwd();
  const env = readEnvFile(path.join(cwd, ".env"));
  const stripeSecret = env.get("STRIPE_SECRET_KEY") ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = env.get("STRIPE_WEBHOOK_SECRET") ?? process.env.STRIPE_WEBHOOK_SECRET;
  const baseUrlArg = getArg("baseUrl", "").trim();
  const appUrl = (baseUrlArg || env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000").replace(/\/$/, "");

  if (!stripeSecret || !webhookSecret) {
    throw new Error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in .env");
  }

  const prisma = new PrismaClient();
  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = getArg("licenseType", "personal");
  const currency = getArg("currency", "USD");

  if (!["personal", "commercial"].includes(licenseType)) {
    throw new Error("licenseType must be personal or commercial.");
  }
  if (!["USD", "EUR"].includes(currency)) {
    throw new Error("currency must be USD or EUR.");
  }

  const { orderId, paymentId } = await createPendingStripeOrder(prisma, email, productId, licenseType, currency);
  if (!paymentId) {
    throw new Error("Failed to create pending payment for test order.");
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
  const sessionId = nowId("cs_test_local");

  const eventPayload = {
    id: nowId("evt_test_local"),
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: nowId("pi_test_local"),
        metadata: {
          orderId,
          paymentId,
          testData: "true"
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: "checkout.session.completed"
  };

  const payloadString = JSON.stringify(eventPayload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret: webhookSecret
  });

  const response = await fetch(`${appUrl}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature
    },
    body: payloadString
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Webhook endpoint failed: ${JSON.stringify(result)}`);
  }

  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: true
    }
  });

  const tokenCount = await prisma.downloadToken.count({
    where: {
      userId: updatedOrder?.userId,
      productId
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        orderId,
        orderStatus: updatedOrder?.status ?? null,
        paymentStatus: updatedOrder?.payments?.[0]?.status ?? null,
        paymentProviderRef: updatedOrder?.payments?.[0]?.providerRef ?? null,
        tokenCountForProduct: tokenCount
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
