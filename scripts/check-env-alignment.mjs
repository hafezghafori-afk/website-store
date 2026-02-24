import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function readEnvFile(filePath) {
  const values = new Map();
  if (!fs.existsSync(filePath)) {
    return values;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1");
    values.set(key, value);
  }

  return values;
}

function mask(value) {
  const text = String(value ?? "");
  if (!text) {
    return "(empty)";
  }
  if (text.length <= 10) {
    return "***";
  }
  return `${text.slice(0, 5)}***${text.slice(-5)}`;
}

function sameNormalized(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function main() {
  const cwd = process.cwd();
  const envPath = path.resolve(cwd, getArg("env", ".env"));
  const envLocalPath = path.resolve(cwd, getArg("env-local", ".env.local"));
  const strict = ["1", "true", "yes", "on"].includes(getArg("strict", "true").toLowerCase());

  const env = readEnvFile(envPath);
  const envLocal = readEnvFile(envLocalPath);

  const keysToCompare = [
    "DATABASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "R2_ENDPOINT",
    "R2_BUCKET"
  ];

  const mismatches = [];
  const onlyInOne = [];
  const matches = [];

  for (const key of keysToCompare) {
    const a = env.get(key);
    const b = envLocal.get(key);

    if (!a && !b) {
      continue;
    }
    if (!a || !b) {
      onlyInOne.push({ key, env: Boolean(a), envLocal: Boolean(b) });
      continue;
    }
    if (sameNormalized(a, b)) {
      matches.push(key);
      continue;
    }
    mismatches.push({ key, envValue: a, envLocalValue: b });
  }

  console.log("Env alignment check");
  console.log(`- .env: ${envPath}`);
  console.log(`- .env.local: ${envLocalPath}`);

  if (matches.length > 0) {
    console.log("\nMatching keys:");
    for (const key of matches) {
      console.log(`- ${key}`);
    }
  }

  if (onlyInOne.length > 0) {
    console.log("\nKeys only defined in one file:");
    for (const row of onlyInOne) {
      console.log(`- ${row.key}: .env=${row.env ? "set" : "missing"}, .env.local=${row.envLocal ? "set" : "missing"}`);
    }
  }

  if (mismatches.length > 0) {
    console.log("\nMismatches:");
    for (const row of mismatches) {
      console.log(`- ${row.key}: .env=${mask(row.envValue)} | .env.local=${mask(row.envLocalValue)}`);
    }
  }

  const hasCriticalMismatch = mismatches.some((row) => row.key === "DATABASE_URL");

  if (hasCriticalMismatch) {
    console.log("\nCritical: DATABASE_URL mismatch detected. This can cause schema/runtime errors.");
  }

  if (strict && (hasCriticalMismatch || mismatches.length > 0)) {
    process.exit(1);
  }
}

main();
