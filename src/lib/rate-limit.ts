import "server-only";

/**
 * Small fixed-window rate limiter kept in memory. Good for a single server;
 * move to Redis/Upstash when running several instances.
 */
type Window = { count: number; resetAt: number };
const globalForLimits = globalThis as unknown as { __juntoLimits?: Map<string, Window> };
const windows = (globalForLimits.__juntoLimits ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    }
    return { ok: true as const, retryAfterMs: 0 };
  }
  if (current.count >= limit) return { ok: false as const, retryAfterMs: current.resetAt - now };
  current.count += 1;
  return { ok: true as const, retryAfterMs: 0 };
}
