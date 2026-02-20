import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/constants";

const protectedRoutes = createRouteMatcher([
  "/:locale/dashboard(.*)",
  "/:locale/admin(.*)",
  "/api/me(.*)",
  "/api/download(.*)",
  "/api/admin(.*)"
]);

function resolveLocaleRedirect(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/clerk_") ||
    pathname.includes(".")
  ) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return new URL(`/${DEFAULT_LOCALE}`, req.url);
  }

  const maybeLocale = segments[0];
  if (!LOCALES.includes(maybeLocale as (typeof LOCALES)[number])) {
    return new URL(`/${DEFAULT_LOCALE}${pathname}`, req.url);
  }

  return null;
}

const withClerkAuth = clerkMiddleware((auth, req) => {
  if (protectedRoutes(req)) {
    auth().protect();
  }

  const redirectUrl = resolveLocaleRedirect(req);
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  return undefined;
});

function localeOnlyMiddleware(req: Request) {
  const redirectUrl = resolveLocaleRedirect(req);
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

const middleware = isClerkEnabled() ? withClerkAuth : localeOnlyMiddleware;

export default middleware;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/(api|trpc)(.*)"]
};
