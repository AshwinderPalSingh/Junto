/** Keep deployment URLs from creating separate cookie-based sign-in sessions. */
export function canonicalNavigation(url: URL, method: string): URL | null {
  if (process.env.VERCEL_ENV !== "production" || !process.env.APP_URL) return null;
  const canonical = new URL(process.env.APP_URL);
  if (canonical.protocol !== "https:" || canonical.username || canonical.password || url.origin === canonical.origin) return null;
  // OAuth callbacks must complete on the registered host with the initiating cookie.
  if (url.pathname === "/auth/campus/callback") return null;
  canonical.pathname = method === "GET" || method === "HEAD" ? url.pathname : "/";
  canonical.search = method === "GET" || method === "HEAD" ? url.search : "";
  canonical.hash = "";
  return canonical;
}
