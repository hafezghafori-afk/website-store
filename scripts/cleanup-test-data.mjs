import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArgValues(name) {
  const args = process.argv.slice(2);
  const values = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === `--${name}`) {
      values.push(args[i + 1]);
      i += 1;
    }
  }

  return values.filter(Boolean);
}

function getArg(name, fallback = "") {
  const values = getArgValues(name);
  return values[0] ?? fallback;
}

function parseBoolean(input, fallback) {
  if (!input) {
    return fallback;
  }
  const value = String(input).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(value)) {
    return false;
  }
  return fallback;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function pairKey(userId, productId) {
  return `${userId}::${productId}`;
}

async function main() {
  const emailArgs = getArgValues("email");
  const emails = unique(emailArgs.length > 0 ? emailArgs : ["devbuyer@example.com"]);

  const includeLocalProviderRefs = parseBoolean(getArg("include-local-ref", "true"), true);
  const removeUsers = parseBoolean(getArg("remove-users", "false"), false);
  const dryRun = parseBoolean(getArg("dry-run", "false"), false);

  const userMatches = emails.length
    ? await prisma.user.findMany({
        where: {
          email: {
            in: emails
          }
        },
        select: {
          id: true,
          email: true
        }
      })
    : [];

  const orderCandidatesFromUsers = userMatches.length
    ? await prisma.order.findMany({
        where: {
          userId: {
            in: userMatches.map((user) => user.id)
          }
        },
        select: {
          id: true
        }
      })
    : [];

  const paymentCandidates = includeLocalProviderRefs
    ? await prisma.payment.findMany({
        where: {
          OR: [
            {
              providerRef: {
                startsWith: "cs_test_local_"
              }
            },
            {
              providerRef: {
                startsWith: "dev_stripe_"
              }
            }
          ]
        },
        select: {
          orderId: true
        }
      })
    : [];

  const targetOrderIds = unique([
    ...orderCandidatesFromUsers.map((order) => order.id),
    ...paymentCandidates.map((payment) => payment.orderId)
  ]);

  const targetOrders = targetOrderIds.length
    ? await prisma.order.findMany({
        where: {
          id: {
            in: targetOrderIds
          }
        },
        include: {
          items: {
            include: {
              productVariant: {
                select: {
                  productId: true
                }
              }
            }
          }
        }
      })
    : [];

  const targetUserIds = unique([
    ...userMatches.map((user) => user.id),
    ...targetOrders.map((order) => order.userId)
  ]);

  const footprintSet = new Set();
  for (const order of targetOrders) {
    for (const item of order.items) {
      footprintSet.add(pairKey(order.userId, item.productVariant.productId));
    }
  }

  const footprints = Array.from(footprintSet).map((entry) => {
    const [userId, productId] = entry.split("::");
    return { userId, productId };
  });

  const cleanupStats = {
    targetEmails: emails,
    matchedUsers: userMatches.length,
    targetOrders: targetOrders.length,
    targetUsersFromOrders: targetUserIds.length,
    affectedProducts: unique(footprints.map((item) => item.productId)).length
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          cleanupStats,
          orderIds: targetOrders.map((order) => order.id),
          matchedUserEmails: userMatches.map((user) => user.email)
        },
        null,
        2
      )
    );
    return;
  }

  const operations = [];

  if (footprints.length > 0) {
    operations.push(
      prisma.downloadLog.deleteMany({
        where: {
          OR: footprints
        }
      })
    );
    operations.push(
      prisma.downloadToken.deleteMany({
        where: {
          OR: footprints
        }
      })
    );
  }

  if (targetOrderIds.length > 0) {
    operations.push(
      prisma.order.deleteMany({
        where: {
          id: {
            in: targetOrderIds
          }
        }
      })
    );
  }

  if (removeUsers && targetUserIds.length > 0) {
    operations.push(
      prisma.user.deleteMany({
        where: {
          id: {
            in: targetUserIds
          }
        }
      })
    );
  }

  const results = operations.length > 0 ? await prisma.$transaction(operations) : [];

  const deletedLogs = results[0]?.count ?? 0;
  const deletedTokens = results[1]?.count ?? 0;
  const deletedOrders = results[2]?.count ?? 0;
  const deletedUsers = removeUsers ? results[3]?.count ?? 0 : 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        cleanupStats,
        deleted: {
          logs: deletedLogs,
          tokens: deletedTokens,
          orders: deletedOrders,
          users: deletedUsers
        }
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
