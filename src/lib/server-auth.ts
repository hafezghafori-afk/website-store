import { isClerkEnabled } from "@/lib/clerk-config";

function getClerkAuth() {
  try {
    const clerk = require("@clerk/nextjs/server") as typeof import("@clerk/nextjs/server");
    return clerk.auth;
  } catch (error) {
    console.error("[server-auth] failed to load Clerk server module", error);
    return null;
  }
}

function getClerkSession() {
  const authFn = getClerkAuth();
  if (!authFn) {
    return null;
  }

  try {
    return authFn();
  } catch (error) {
    console.error("[server-auth] auth() failed", error);
    return null;
  }
}

export function getUserRole(): string {
  if (!isClerkEnabled()) {
    return "admin";
  }

  const session = getClerkSession();
  const sessionClaims = session?.sessionClaims;
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

  const session = getClerkSession();
  return session?.userId ?? null;
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
