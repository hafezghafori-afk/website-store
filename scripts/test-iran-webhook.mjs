import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

function normalizeLicense(input) {
  return input === "commercial" ? "commercial" : "personal";
}

function normalizeCurrency(input) {
  return input === "EUR" ? "EUR" : "USD";
}

function normalizeProvider(input) {
  const value = String(input || "").trim().toLowerCase();
  return value || "idpay";
}

function toSafeClerkId(email) {
  return `dev_${email.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48)}`;
}

async function ensureUser(email) {
  const existing = await prisma.user.findUnique({
    where: { email }
  });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      clerkId: toSafeClerkId(email),
      name: "Iran Webhook Test User",
      locale: "fa",
      country: "IR",
      preferredCurrency: "USD"
    }
  });
}

async function ensureVariant(productId, licenseType) {
  const variant = await prisma.productVariant.findFirst({
    where: {
      productId,
      licenseType,
      isActive: true
    }
  });

  if (!variant) {
    throw new Error(`Variant not found for product=${productId} licenseType=${licenseType}.`);
  }
  return variant;
}

async function ensurePendingOrder({ email, productId, licenseType, currency, provider }) {
  const user = await ensureUser(email);
  const variant = await ensureVariant(productId, licenseType);
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
          provider,
          status: "pending",
          meta: {
            source: "test-iran-webhook-script",
            testData: true
          }
        }
      }
    },
    include: {
      payments: true
    }
  });

  return { order, user };
}

function signPayload(payloadString, secret) {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  const env = readEnvFile(path.join(cwd, ".env"));

  const baseUrlArg = getArg("baseUrl", "").trim();
  const baseUrl = (baseUrlArg || env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3002").replace(/\/$/, "");
  const webhookSecret = env.get("IRAN_GATEWAY_WEBHOOK_SECRET") ?? process.env.IRAN_GATEWAY_WEBHOOK_SECRET ?? "";

  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = normalizeLicense(getArg("licenseType", "personal"));
  const currency = normalizeCurrency(getArg("currency", "USD"));
  const provider = normalizeProvider(getArg("provider", "idpay"));

  const { order, user } = await ensurePendingOrder({
    email,
    productId,
    licenseType,
    currency,
    provider
  });

  const payload = {
    provider,
    orderId: order.id,
    status: "paid",
    reference: `IGW_${Date.now()}`
  };
  const payloadString = JSON.stringify(payload);

  const headers = {
    "content-type": "application/json"
  };
  if (webhookSecret.trim()) {
    headers["x-webhook-signature"] = signPayload(payloadString, webhookSecret.trim());
  }

  const response = await fetch(`${baseUrl}/api/webhooks/iran-gateway`, {
    method: "POST",
    headers,
    body: payloadString
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Webhook endpoint failed: ${JSON.stringify(result)}`);
  }

  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      payments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const tokenCount = await prisma.downloadToken.count({
    where: {
      userId: user.id,
      productId
    }
  });

  const latestPayment = updatedOrder?.payments?.[0] ?? null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        orderId: order.id,
        orderStatus: updatedOrder?.status ?? null,
        paymentStatus: latestPayment?.status ?? null,
        paymentProvider: latestPayment?.provider ?? null,
        paymentReference: latestPayment?.providerRef ?? null,
        tokenCountForProduct: tokenCount,
        signatureEnabled: Boolean(webhookSecret.trim())
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
