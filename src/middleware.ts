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

function applyLocaleRedirect(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/clerk_") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, req.url));
  }

  const maybeLocale = segments[0];
  if (!LOCALES.includes(maybeLocale as (typeof LOCALES)[number])) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, req.url));
  }

  return NextResponse.next();
}

const withClerkAuth = clerkMiddleware((auth, req) => {
  if (protectedRoutes(req)) {
    auth().protect();
  }

  return applyLocaleRedirect(req);
});

const middleware = isClerkEnabled() ? withClerkAuth : applyLocaleRedirect;

export default middleware;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/(api|trpc)(.*)"]
};
