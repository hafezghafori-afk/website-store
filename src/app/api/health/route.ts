import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isR2Configured } from "@/lib/r2";
import { isZarinpalConfigured, isZarinpalMockMode } from "@/lib/zarinpal";

export const dynamic = "force-dynamic";

function isProductionLike() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

function wantsDeepHealth(request: Request) {
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") ?? url.searchParams.get("detail") ?? "").toLowerCase();
  return scope === "deep" || scope === "full" || scope === "verbose" || scope === "1";
}

function hasDeepHealthAccess(request: Request) {
  if (!isProductionLike()) {
    return true;
  }

  const token = process.env.HEALTHCHECK_TOKEN?.trim();
  if (!token) {
    return false;
  }

  const url = new URL(request.url);
  const provided = request.headers.get("x-health-token")?.trim() || url.searchParams.get("token")?.trim() || "";
  return Boolean(provided) && provided === token;
}

function isPlaceholder(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return normalized.includes("xxx") || normalized.includes("example") || normalized === "your_key" || normalized === "your-secret";
}

async function checkDatabase() {
  const configured = Boolean(process.env.DATABASE_URL);
  if (!configured) {
    return {
      configured,
      reachable: false,
      latencyMs: null as number | null,
      error: "DATABASE_URL missing"
    };
  }

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured,
      reachable: true,
      latencyMs: Date.now() - startedAt,
      error: null as string | null
    };
  } catch (error) {
    return {
      configured,
      reachable: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Database ping failed"
    };
  }
}

export async function GET(request: Request) {
  const deepRequested = wantsDeepHealth(request);
  const deepAllowed = hasDeepHealthAccess(request);

  if (deepRequested && !deepAllowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "Deep health access requires a valid health token."
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const database = await checkDatabase();

  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const iranWebhookSecret = process.env.IRAN_GATEWAY_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const checks = {
    database,
    appUrl: {
      configured: Boolean(appUrl),
      https: typeof appUrl === "string" ? appUrl.startsWith("https://") : false
    },
    auth: {
      clerk: isClerkEnabled()
    },
    storage: {
      r2: isR2Configured()
    },
    payments: {
      stripe: Boolean(stripePublishable && stripeSecret && !isPlaceholder(stripePublishable) && !isPlaceholder(stripeSecret)),
      zarinpal: isZarinpalConfigured(),
      zarinpalMockMode: isZarinpalMockMode(),
      manualAf: true
    },
    webhooks: {
      stripe: Boolean(stripeWebhookSecret && !isPlaceholder(stripeWebhookSecret)),
      iranGateway: Boolean(iranWebhookSecret && !isPlaceholder(iranWebhookSecret))
    }
  };

  const warnings: string[] = [];
  if (checks.appUrl.configured && !checks.appUrl.https && process.env.VERCEL_ENV === "production") {
    warnings.push("NEXT_PUBLIC_APP_URL is not https in production.");
  }
  if (checks.payments.zarinpalMockMode && process.env.VERCEL_ENV === "production") {
    warnings.push("Zarinpal mock mode is enabled in production.");
  }
  if (!checks.payments.stripe) {
    warnings.push("Stripe is not fully configured.");
  }
  if (!checks.storage.r2) {
    warnings.push("Cloudflare R2 is not fully configured.");
  }
  if (!checks.auth.clerk) {
    warnings.push("Clerk is not fully configured.");
  }

  const ok =
    checks.database.reachable &&
    checks.storage.r2 &&
    checks.webhooks.iranGateway &&
    checks.webhooks.stripe &&
    checks.auth.clerk &&
    checks.payments.stripe;

  const body = {
    ok,
    scope: deepRequested && deepAllowed ? "deep" : "basic",
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null
    },
    checks:
      deepRequested && deepAllowed
        ? checks
        : {
            database: {
              configured: checks.database.configured,
              reachable: checks.database.reachable
            },
            appUrl: checks.appUrl,
            auth: checks.auth,
            storage: checks.storage,
            payments: {
              stripe: checks.payments.stripe,
              zarinpal: checks.payments.zarinpal,
              manualAf: checks.payments.manualAf
            },
            webhooks: checks.webhooks
          },
    warnings: deepRequested && deepAllowed ? warnings : warnings.length
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
