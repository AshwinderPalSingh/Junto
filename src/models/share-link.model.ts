import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { randomToken } from "@/lib/crypto";
import { getDb } from "./db/client";
import { shareLinks } from "./db/schema";

/** Read-only links for a trusted contact. They expire a few hours after the meetup. */
export const ShareLinkModel = {
  async getOrCreate(planId: string, userId: string, expiresAt: Date) {
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.planId, planId), eq(shareLinks.userId, userId), gt(shareLinks.expiresAt, new Date())))
      .limit(1);
    if (existing) return existing;
    const [row] = await db
      .insert(shareLinks)
      .values({ token: randomToken(18), planId, userId, expiresAt })
      .returning();
    return row;
  },

  async find(token: string, now: Date) {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.token, token), gt(shareLinks.expiresAt, now)))
      .limit(1);
    return row ?? null;
  },
};
