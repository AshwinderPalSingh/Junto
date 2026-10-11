import "server-only";
import { lt, sql } from "drizzle-orm";
import { sha256 } from "@/lib/crypto";
import { getDb } from "@/models/db/client";
import { rateLimits } from "@/models/db/schema";

/** Atomic fixed windows shared by all Vercel instances; DB failures fail closed. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) throw new Error("Invalid rate limit");
  const db = await getDb();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const currentTime = sql`${now.toISOString()}::timestamptz`;
  const nextReset = sql`${resetAt.toISOString()}::timestamptz`;
  const [row] = await db.insert(rateLimits).values({ keyHash: sha256(key), count: 1, resetAt })
    .onConflictDoUpdate({ target: rateLimits.keyHash, set: {
      count: sql`case when ${rateLimits.resetAt} <= ${currentTime} then 1 else least(${rateLimits.count} + 1, ${limit + 1}) end`,
      resetAt: sql`case when ${rateLimits.resetAt} <= ${currentTime} then ${nextReset} else ${rateLimits.resetAt} end`,
    } }).returning();
  const ok = row.count <= limit;
  return { ok, retryAfterMs: ok ? 0 : Math.max(1, row.resetAt.getTime() - now.getTime()) };
}

export async function purgeRateLimits(now: Date) {
  const db = await getDb();
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
}
