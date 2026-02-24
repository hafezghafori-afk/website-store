import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function parseBoolean(input, fallback = false) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }
  return fallback;
}

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

function isPlaceholder(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.includes("xxx") ||
    normalized.includes("example") ||
    normalized.includes("<accountid>") ||
    normalized === "your_key" ||
    normalized === "your-secret"
  );
}

function isLikelyHttpsUrl(value) {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function getEnvValue(key, fileMap) {
  if (typeof process.env[key] === "string" && process.env[key] !== "") {
    return process.env[key];
  }
  return fileMap.get(key) ?? "";
}

function maskValue(value) {
  const input = String(value ?? "");
  if (input.length <= 6) {
    return "***";
  }
  return `${input.slice(0, 3)}***${input.slice(-3)}`;
}

function checkRequiredKey(result, key, value) {
  if (!value || isPlaceholder(value)) {
    result.errors.push(`${key} is missing or placeholder.`);
    return;
  }
  result.passed.push(`${key} is set (${maskValue(value)}).`);
}

function checkOptionalKey(result, key, value) {
  if (!value) {
    result.warnings.push(`${key} is empty (optional).`);
    return;
  }
  result.passed.push(`${key} is set (${maskValue(value)}).`);
}

function main() {
  const cwd = process.cwd();
  const envPath = getArg("env-file", path.join(cwd, ".env"));
  const allowHttp = parseBoolean(getArg("allow-http", "false"), false);
  const requireZarinpal = parseBoolean(getArg("require-zarinpal", "true"), true);
  const fileEnv = readEnvFile(envPath);

  const result = {
    errors: [],
    warnings: [],
    passed: []
  };

  const requiredKeys = [
    "DATABASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "IRAN_GATEWAY_WEBHOOK_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT"
  ];

  for (const key of requiredKeys) {
    checkRequiredKey(result, key, getEnvValue(key, fileEnv));
  }

  const appUrl = getEnvValue("NEXT_PUBLIC_APP_URL", fileEnv);
  if (!allowHttp && !isLikelyHttpsUrl(appUrl)) {
    result.errors.push("NEXT_PUBLIC_APP_URL must use https in hosting.");
  }

  const mockMode = getEnvValue("ZARINPAL_MOCK_MODE", fileEnv).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(mockMode)) {
    result.errors.push("ZARINPAL_MOCK_MODE must be false in hosting.");
  } else {
    result.passed.push("ZARINPAL_MOCK_MODE is disabled.");
  }

  const zarinpalMerchantId = getEnvValue("ZARINPAL_MERCHANT_ID", fileEnv);
  if (requireZarinpal) {
    checkRequiredKey(result, "ZARINPAL_MERCHANT_ID", zarinpalMerchantId);
  } else {
    checkOptionalKey(result, "ZARINPAL_MERCHANT_ID", zarinpalMerchantId);
  }

  const r2Endpoint = getEnvValue("R2_ENDPOINT", fileEnv);
  if (r2Endpoint && !r2Endpoint.includes(".r2.cloudflarestorage.com")) {
    result.warnings.push("R2_ENDPOINT does not look like a standard Cloudflare R2 S3 endpoint.");
  }

  const databaseUrl = getEnvValue("DATABASE_URL", fileEnv);
  const directUrl = getEnvValue("DIRECT_URL", fileEnv);
  if (databaseUrl.includes("@localhost")) {
    result.warnings.push("DATABASE_URL points to localhost. For hosting use managed production Postgres.");
  }
  if (databaseUrl.includes("-pooler.") && (!directUrl || isPlaceholder(directUrl))) {
    result.warnings.push("DATABASE_URL looks like a Neon pooler URL. Add DIRECT_URL (non-pooler) for Prisma migrations.");
  }
  if (directUrl) {
    if (isPlaceholder(directUrl)) {
      result.warnings.push("DIRECT_URL is set but looks like a placeholder.");
    } else {
      result.passed.push(`DIRECT_URL is set (${maskValue(directUrl)}).`);
    }
  } else {
    result.warnings.push("DIRECT_URL is empty. Recommended for Prisma migrate deploy (especially on Neon).");
  }

  if (result.errors.length === 0) {
    console.log("Hosting preflight: PASS");
  } else {
    console.log("Hosting preflight: FAIL");
  }

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const item of result.errors) {
      console.log(`- ${item}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const item of result.warnings) {
      console.log(`- ${item}`);
    }
  }

  if (result.passed.length > 0) {
    console.log("\nChecks passed:");
    for (const item of result.passed) {
      console.log(`- ${item}`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main();
