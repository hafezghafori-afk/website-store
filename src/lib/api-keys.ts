import { createHash, randomBytes } from "node:crypto";

export function generatePlainApiKey() {
  const token = randomBytes(24).toString("hex");
  return `wsk_${token}`;
}

export function hashApiKey(plainKey: string) {
  return createHash("sha256").update(plainKey).digest("hex");
}

export function getApiKeyPrefix(plainKey: string) {
  return plainKey.slice(0, 14);
}
