import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, SESSION_COOKIE } from "@/lib/constants";

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
