import { spawn } from "node:child_process";
import path from "node:path";

const candidatePorts = [3002, 3003, 3004, 3005, 3010];

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isAppReady(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/products`, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return false;
    }

    const body = await response.json();
    return Boolean(body?.ok) && Array.isArray(body?.items);
  } catch {
    return false;
  }
}

async function waitForAppReady(baseUrl, server, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    if (server.exitCode !== null) {
      return false;
    }

    const ready = await isAppReady(baseUrl);
    if (ready) {
      return true;
    }
    await wait(1000);
  }
  return false;
}

function runCommand(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ...extraEnv
      }
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function killServer(server) {
  if (!server || server.killed || server.exitCode !== null) {
    return;
  }
  server.kill();
}

async function startServerOnAvailablePort(cwd) {
  const nextCli = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

  for (const port of candidatePorts) {
    const baseUrl = `http://localhost:${port}`;
    console.log(`Trying temporary dev server on ${baseUrl}`);

    const server = spawn(process.execPath, [nextCli, "dev", "--port", String(port)], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ZARINPAL_MOCK_MODE: process.env.ZARINPAL_MOCK_MODE || "true",
        NEXT_PUBLIC_APP_URL: baseUrl
      }
    });
    const serverLogs = [];
    const onData = (chunk) => {
      serverLogs.push(String(chunk));
    };
    server.stdout?.on("data", onData);
    server.stderr?.on("data", onData);

    await wait(2000);
    if (server.exitCode !== null) {
      const lastLog = serverLogs.join("").trim().split(/\r?\n/).slice(-1)[0];
      if (lastLog) {
        console.log(`Port ${port} unavailable (${lastLog})`);
      }
      continue;
    }

    const ready = await waitForAppReady(baseUrl, server);
    if (ready) {
      console.log(`Temporary dev server is ready on ${baseUrl}`);
      return { server, baseUrl, port };
    }

    killServer(server);
  }

  return null;
}

async function main() {
  const cwd = process.cwd();
  const email = getArg("email", "devbuyer@example.com");
  const productId = getArg("productId", "prd-1");
  const licenseType = getArg("licenseType", "personal");
  const currency = getArg("currency", "USD");
  const locale = getArg("locale", "fa");

  const started = await startServerOnAvailablePort(cwd);
  if (!started) {
    throw new Error(`Could not start temporary dev server on candidate ports: ${candidatePorts.join(", ")}`);
  }

  const { server, baseUrl } = started;
  console.log(`Running payment smoke tests on ${baseUrl}`);

  try {
    await runCommand(
      "node",
      [
        "scripts/test-stripe-webhook.mjs",
        "--email",
        email,
        "--productId",
        productId,
        "--licenseType",
        licenseType,
        "--currency",
        currency,
        "--baseUrl",
        baseUrl
      ],
      cwd
    );

    await runCommand(
      "node",
      [
        "scripts/test-zarinpal-callback.mjs",
        "--email",
        email,
        "--productId",
        productId,
        "--licenseType",
        licenseType,
        "--currency",
        currency,
        "--baseUrl",
        baseUrl,
        "--locale",
        locale
      ],
      cwd
    );

    await runCommand(
      "node",
      [
        "scripts/test-iran-webhook.mjs",
        "--email",
        email,
        "--productId",
        productId,
        "--licenseType",
        licenseType,
        "--currency",
        currency,
        "--provider",
        "idpay",
        "--baseUrl",
        baseUrl
      ],
      cwd
    );

    console.log(`Payment smoke tests passed on ${baseUrl}`);
  } finally {
    killServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
