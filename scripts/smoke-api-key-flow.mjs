import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name, fallback = "") {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) {
    return fallback;
  }
  return process.argv[idx + 1] ?? fallback;
}

function normalizeLicense(input) {
  return input === "commercial" ? "commercial" : "personal";
}

function normalizeCurrency(input) {
  return input === "EUR" ? "EUR" : "USD";
}

function hashApiKey(plain) {
  return createHash("sha256").update(plain).digest("hex");
}

function buildApiKey() {
  return `wsk_${randomBytes(24).toString("hex")}`;
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
      name: "Smoke Test User",
      locale: "en",
      country: "US",
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
    },
    include: {
      product: true
    }
  });

  if (!variant) {
    throw new Error(`No active variant for product=${productId} licenseType=${licenseType}. Run seed first.`);
  }

  return variant;
}

async function ensureVersion(productId, slug) {
  const existing = await prisma.productVersion.findFirst({
    where: { productId },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    return existing;
  }

  return prisma.productVersion.create({
    data: {
      productId,
      version: `smoke-${Date.now()}`,
      changelog: "Smoke test version",
      fileKey: `products/${slug}/smoke-test.zip`,
      fileSize: 0
    }
  });
}

async function createPaidOrder(userId, variant, currency) {
  const amount = currency === "EUR" ? variant.priceEUR : variant.priceUSD;

  return prisma.order.create({
    data: {
      userId,
      total: amount,
      currency,
      status: "paid",
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
          providerRef: `smoke_${Date.now()}`,
          status: "succeeded",
          meta: {
            source: "smoke-api-key-flow-script",
            testData: true
          }
        }
      }
    },
    include: {
      items: true
    }
  });
}

async function ensureToken(userId, productId) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  return prisma.downloadToken.create({
    data: {
      userId,
      productId,
      expiresAt,
      maxUses: 10
    }
  });
}

async function createApiKey(userId) {
  const plainKey = buildApiKey();
  const keyHash = hashApiKey(plainKey);
  const keyPrefix = plainKey.slice(0, 14);

  const key = await prisma.apiKey.create({
    data: {
      userId,
      name: "Smoke Key",
      keyPrefix,
      keyHash,
      isActive: true
    },
    select: {
      id: true,
      keyPrefix: true
    }
  });

  return { plainKey, key };
}

async function runApiChecks(baseUrl, apiKey, productId) {
  const headers = {
    "x-api-key": apiKey
  };

  const ordersRes = await fetch(`${baseUrl}/api/me/orders`, { headers });
  const ordersJson = await ordersRes.json();

  const downloadsRes = await fetch(`${baseUrl}/api/me/downloads`, { headers });
  const downloadsJson = await downloadsRes.json();

  let downloadResult = null;
  let downloadStatus = null;
  try {
    const response = await fetch(`${baseUrl}/api/download`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json"
      },
      body: JSON.stringify({ productId })
    });
    downloadStatus = response.status;
    downloadResult = await response.json();
  } catch (error) {
    downloadResult = {
      ok: false,
      message: error instanceof Error ? error.message : "Download call failed."
    };
  }

  return {
    orders: {
      status: ordersRes.status,
      ok: ordersRes.ok,
      body: ordersJson
    },
    downloads: {
      status: downloadsRes.status,
      ok: downloadsRes.ok,
      body: downloadsJson
    },
    signedDownload: {
      status: downloadStatus,
      body: downloadResult
    }
  };
}

async function main() {
  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = normalizeLicense(getArg("licenseType", "personal"));
  const currency = normalizeCurrency(getArg("currency", "USD"));
  const baseUrlRaw = getArg("baseUrl", "").trim();
  const baseUrl = baseUrlRaw ? baseUrlRaw.replace(/\/$/, "") : "";

  const user = await ensureUser(email);
  const variant = await ensureVariant(productId, licenseType);
  const version = await ensureVersion(productId, variant.product.slug);
  const order = await createPaidOrder(user.id, variant, currency);
  const token = await ensureToken(user.id, productId);
  const { plainKey, key } = await createApiKey(user.id);

  const result = {
    ok: true,
    setup: {
      email,
      userId: user.id,
      orderId: order.id,
      productId,
      productSlug: variant.product.slug,
      versionId: version.id,
      tokenId: token.id,
      apiKeyId: key.id,
      apiKeyPrefix: key.keyPrefix,
      apiKey: plainKey
    }
  };

  if (baseUrl) {
    const checks = await runApiChecks(baseUrl, plainKey, productId);
    console.log(JSON.stringify({ ...result, checks }, null, 2));
    return;
  }

  console.log(JSON.stringify(result, null, 2));
  console.log("\nTo run API checks, start dev server and run:");
  console.log(
    `npm run smoke:api-key-flow -- --email ${email} --productId ${productId} --licenseType ${licenseType} --currency ${currency} --baseUrl http://localhost:3002`
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
