/** Constants shared by server code, the proxy and client code (no secrets here). */
export const SESSION_COOKIE = "junto_session";

/** Routes that need a signed-in member. The proxy does a fast cookie check; controllers do the real one. */
export const PROTECTED_PREFIXES = [
  "/board",
  "/plans",
  "/activity",
  "/free",
  "/messages",
  "/notifications",
  "/profile",
  "/u/",
  "/settings",
  "/admin",
  "/onboarding",
] as const;
