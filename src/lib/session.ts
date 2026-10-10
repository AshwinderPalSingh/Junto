import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";

/** Cookie plumbing for sessions. The cookie only carries a random token. */
export async function readSessionCookie() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure whenever the site is served over https. Keyed on the real scheme rather than
    // NODE_ENV, so a production build on http://localhost still signs in (Safari drops
    // Secure cookies on plain-http localhost).
    secure: (await requestOrigin()).startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requestUserAgent() {
  return (await headers()).get("user-agent");
}

/** The origin the member is using (works for localhost, LAN IPs and deployments). */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (/^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
