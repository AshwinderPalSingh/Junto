import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, SESSION_COOKIE } from "@/lib/constants";
import { randomBytes } from "node:crypto";
import { contentSecurityPolicy } from "@/lib/content-security-policy";

/**
 * Optimistic gate: bounce visitors without a session cookie to /login before
 * any rendering happens. The real check (is the session valid? is the member
 * suspended or still onboarding?) is done by the controllers.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSession = PROTECTED_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (needsSession && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const nonce = randomBytes(18).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  if (needsSession || /^\/(login|signup|reset-password|onboarding|auth|s)(\/|$)/.test(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
