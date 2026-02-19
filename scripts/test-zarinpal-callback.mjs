import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

function toSafeClerkId(email) {
  return `dev_${email.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48)}`;
}

function toIrrAmount(amount, currency) {
  const irrPerUsd = Number(process.env.IRR_PER_USD ?? "650000");
  const irrPerEur = Number(process.env.IRR_PER_EUR ?? "700000");
  const rate = currency === "EUR" ? irrPerEur : irrPerUsd;
  const validRate = Number.isFinite(rate) && rate > 0 ? rate : currency === "EUR" ? 700000 : 650000;
  return Math.max(1000, Math.round(amount * validRate));
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
      name: "Zarinpal Callback Test User",
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
      version: `zarinpal-test-${Date.now()}`,
      changelog: "Zarinpal callback smoke test version",
      fileKey: `products/${slug}/zarinpal-test.zip`,
      fileSize: 0
    }
  });
}

async function createPendingZarinpalOrder(userId, variant, currency) {
  const amount = currency === "EUR" ? variant.priceEUR : variant.priceUSD;
  const authority = `A${Date.now()}${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`;

  const order = await prisma.order.create({
    data: {
      userId,
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
          provider: "zarinpal",
          providerRef: authority,
          status: "pending",
          meta: {
            source: "test-zarinpal-callback-script",
            testData: true,
            zarinpalAuthority: authority,
            zarinpalAmountIrr: toIrrAmount(amount, currency)
          }
        }
      }
    },
    include: {
      payments: true
    }
  });

  return {
    order,
    authority
  };
}

async function main() {
  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = normalizeLicense(getArg("licenseType", "personal"));
  const currency = normalizeCurrency(getArg("currency", "USD"));
  const locale = getArg("locale", "fa");
  const baseUrlRaw = getArg("baseUrl", "http://localhost:3002").trim();
  const baseUrl = baseUrlRaw.replace(/\/$/, "");

  const user = await ensureUser(email);
  const variant = await ensureVariant(productId, licenseType);
  await ensureVersion(productId, variant.product.slug);
  const { order, authority } = await createPendingZarinpalOrder(user.id, variant, currency);

  const callbackUrl = new URL(`${baseUrl}/api/payments/zarinpal/callback`);
  callbackUrl.searchParams.set("orderId", order.id);
  callbackUrl.searchParams.set("locale", locale);
  callbackUrl.searchParams.set("Authority", authority);
  callbackUrl.searchParams.set("Status", "OK");

  const response = await fetch(callbackUrl.toString(), {
    method: "GET",
    redirect: "manual"
  });

  const location = response.headers.get("location");
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

  const latestPayment = updatedOrder?.payments[0] ?? null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        callbackRequest: callbackUrl.toString(),
        callbackResponse: {
          status: response.status,
          redirectedTo: location
        },
        order: {
          id: updatedOrder?.id ?? order.id,
          status: updatedOrder?.status ?? null,
          total: updatedOrder?.total ?? null,
          currency: updatedOrder?.currency ?? null
        },
        payment: latestPayment
          ? {
              id: latestPayment.id,
              provider: latestPayment.provider,
              status: latestPayment.status,
              providerRef: latestPayment.providerRef
            }
          : null,
        tokenCountForProduct: tokenCount
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
