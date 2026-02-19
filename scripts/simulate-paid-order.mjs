import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function sanitizeClerkId(email) {
  return `dev_${email.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48)}`;
}

async function ensureUserByEmail(email) {
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      clerkId: sanitizeClerkId(email),
      name: "Dev Test Buyer",
      locale: "en",
      country: "US"
    }
  });
}

async function main() {
  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = getArg("licenseType", "personal");
  const currency = getArg("currency", "USD");
  const provider = getArg("provider", "stripe");

  if (!["personal", "commercial"].includes(licenseType)) {
    throw new Error("licenseType must be personal or commercial.");
  }
  if (!["USD", "EUR"].includes(currency)) {
    throw new Error("currency must be USD or EUR.");
  }

  const user = await ensureUserByEmail(email);

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
    throw new Error(`Product variant not found for ${productId} / ${licenseType}. Run: npm run seed`);
  }

  const amount = currency === "EUR" ? variant.priceEUR : variant.priceUSD;

  const order = await prisma.order.create({
    data: {
      userId: user.id,
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
          provider,
          providerRef: `dev_${provider}_${Date.now()}`,
          status: "succeeded",
          meta: {
            source: "simulate-paid-order-script",
            testData: true,
            simulated: true,
            licenseType,
            currency
          }
        }
      }
    }
  });

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await prisma.downloadToken.create({
    data: {
      userId: user.id,
      productId,
      expiresAt,
      maxUses: 10
    }
  });

  console.log("Simulated paid order created.");
  console.log(JSON.stringify(
    {
      email,
      orderId: order.id,
      productId,
      productSlug: variant.product.slug,
      productTitle: variant.product.title,
      licenseType,
      currency,
      amount
    },
    null,
    2
  ));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
