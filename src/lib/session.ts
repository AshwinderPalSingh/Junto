import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { env } from "@/lib/env";
import { isIP } from "node:net";

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
    secure: Boolean(process.env.VERCEL) || (await requestOrigin()).startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Account creation and password resets: a random token kept in the browser that
 * chose the new password. The password only applies if the code is entered there.
 */
const FLOW_COOKIE = "junto_password_flow";

export async function writeFlowCookie(token: string) {
  (await cookies()).set(FLOW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.VERCEL) || (await requestOrigin()).startsWith("https://"),
    path: "/",
    maxAge: 30 * 60,
  });
}

export async function readFlowCookie() {
  return (await cookies()).get(FLOW_COOKIE)?.value ?? null;
}

export async function clearFlowCookie() {
  (await cookies()).delete(FLOW_COOKIE);
}

export async function requestUserAgent() {
  return (await headers()).get("user-agent");
}

/** The origin the member is using (works for localhost, LAN IPs and deployments). */
export async function requestOrigin() {
  if (env().NODE_ENV === "production") return new URL(env().APP_URL).origin;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  if (/^(localhost|127\.[0-9.]+|10\.[0-9.]+|192\.168\.[0-9.]+|\[::1\])(:\d+)?$/.test(host)) {
    return new URL(`http://${host}`).origin;
  }
  return new URL(env().APP_URL).origin;
}

export async function requestIp() {
  const h = await headers();
  if (!process.env.VERCEL) return "local";
  // Vercel overwrites this header; arbitrary reverse-proxy headers are not trusted locally.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && isIP(ip) ? ip : "unknown";
}
