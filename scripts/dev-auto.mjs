import net from "node:net";
import { spawn } from "node:child_process";

const candidatePorts = [3002, 3003, 3004, 3005, 3010];

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function resolvePort() {
  for (const port of candidatePorts) {
    const free = await isPortFree(port);
    if (free) {
      return port;
    }
  }

  return null;
}

async function run() {
  const port = await resolvePort();
  if (!port) {
    console.error("No free dev port found in:", candidatePorts.join(", "));
    process.exit(1);
  }

  console.log(`Starting Next.js on http://localhost:${port}`);
  const child = spawn("npx", ["next", "dev", "--port", String(port)], {
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

run();
