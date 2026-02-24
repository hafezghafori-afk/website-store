function getArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function normalizeBaseUrl(input) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error("Missing --base-url (example: https://website-store-five.vercel.app)");
  }
  return value.replace(/\/+$/, "");
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options
  });
  return response;
}

async function checkPage(baseUrl, path, expected = [200]) {
  const response = await request(baseUrl, path);
  const ok = expected.includes(response.status);
  return {
    kind: "page",
    path,
    ok,
    status: response.status,
    location: response.headers.get("location") ?? null
  };
}

async function checkJson(baseUrl, path, validate) {
  const response = await request(baseUrl, path, {
    headers: {
      accept: "application/json"
    }
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const validation = validate(response, body);
  return {
    kind: "json",
    path,
    ok: validation.ok,
    status: response.status,
    note: validation.note
  };
}

async function main() {
  const baseUrl = normalizeBaseUrl(getArg("base-url"));
  const locale = getArg("locale", "fa");
  const healthToken = getArg("health-token", "");
  const deepHealth = ["1", "true", "yes", "on"].includes(getArg("deep-health", "false").toLowerCase());

  const checks = [
    () => checkPage(baseUrl, "/", [200, 301, 302, 307, 308]),
    () => checkPage(baseUrl, `/${locale}`),
    () => checkPage(baseUrl, `/${locale}/templates`),
    () => checkPage(baseUrl, `/${locale}/contact`),
    () => checkPage(baseUrl, "/robots.txt"),
    () => checkPage(baseUrl, "/sitemap.xml"),
    () =>
      checkJson(baseUrl, "/api/health", (response, body) => ({
        ok: response.status === 200 || response.status === 503,
        note: body && typeof body.ok === "boolean" ? `ok=${String(body.ok)}` : "invalid body"
      })),
    () =>
      checkJson(baseUrl, "/api/products", (response, body) => ({
        ok: response.status === 200 && Boolean(body?.ok) && Array.isArray(body?.items),
        note: body?.count !== undefined ? `count=${body.count}` : "invalid catalog response"
      })),
    () => checkPage(baseUrl, `/${locale}/dashboard`, [200, 302, 307]),
    () => checkPage(baseUrl, `/${locale}/admin`, [200, 302, 307])
  ];

  if (deepHealth) {
    const healthPath = healthToken ? `/api/health?scope=deep&token=${encodeURIComponent(healthToken)}` : "/api/health?scope=deep";
    checks.splice(
      7,
      0,
      () =>
        checkJson(baseUrl, healthPath, (response, body) => ({
          ok:
            (response.status === 200 || response.status === 503) &&
            body &&
            body.scope === "deep" &&
            typeof body.checks === "object",
          note: body?.scope ? `scope=${body.scope}` : "deep health unavailable"
        }))
    );
  }

  console.log(`Running deploy smoke tests on ${baseUrl}`);

  const results = [];
  for (const runCheck of checks) {
    try {
      const result = await runCheck();
      results.push(result);
      const statusText = result.ok ? "PASS" : "FAIL";
      const extra =
        "note" in result && result.note
          ? ` (${result.note})`
          : result.location
            ? ` (location: ${result.location})`
            : "";
      console.log(`[${statusText}] ${result.path} -> ${result.status}${extra}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      results.push({ kind: "error", path: "unknown", ok: false, status: 0, note: message });
      console.log(`[FAIL] request error: ${message}`);
    }
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.log(`\nSmoke test result: FAIL (${failed.length} checks failed)`);
    process.exit(1);
  }

  console.log("\nSmoke test result: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
