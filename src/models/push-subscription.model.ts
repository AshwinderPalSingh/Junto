import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { pushSubscriptions } from "./db/schema";

export const PushSubscriptionModel = {
  async save(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
    const db = await getDb();
    await db
      .insert(pushSubscriptions)
      .values({ userId, ...sub })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
  },

  async remove(userId: string, endpoint: string) {
    const db = await getDb();
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  },

  async removeByEndpoint(endpoint: string) {
    const db = await getDb();
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  },

  async removeAllForUser(userId: string) {
    const db = await getDb();
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  },

  async forUser(userId: string) {
    const db = await getDb();
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  },

  async countForUser(userId: string) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return row?.n ?? 0;
  },
};
