import { isClerkEnabled } from "@/lib/clerk-config";

function getClerkAuth() {
  const clerk = require("@clerk/nextjs/server") as typeof import("@clerk/nextjs/server");
  return clerk.auth;
}

export function getUserRole(): string {
  if (!isClerkEnabled()) {
    return "admin";
  }

  const { sessionClaims } = getClerkAuth()();
  const metadataRole = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  const publicMetadataRole = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  const privateMetadataRole = (sessionClaims?.privateMetadata as { role?: string } | undefined)?.role;

  return metadataRole ?? publicMetadataRole ?? privateMetadataRole ?? "user";
}

export function isAdminUser() {
  return getUserRole() === "admin";
}

export function getCurrentUserId() {
  if (!isClerkEnabled()) {
    return "dev-local-user";
  }

  const { userId } = getClerkAuth()();
  return userId ?? null;
}

export function canAccessAdmin() {
  if (!isClerkEnabled()) {
    return true;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    return false;
  }

  return isAdminUser();
}
