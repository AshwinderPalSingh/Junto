import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notificationCopy, type NotificationData } from "@/lib/notification-copy";
import { sendPush } from "@/lib/push";
import { localListenerCount, publish } from "@/lib/realtime";
import { getDb } from "./db/client";
import { notifications, type NotificationKind } from "./db/schema";
import { PushSubscriptionModel } from "./push-subscription.model";

export type NewNotification = {
  userId: string;
  kind: NotificationKind;
  planId?: string | null;
  actorId?: string | null;
  data?: NotificationData;
};

/**
 * Notifications are stored (for the inbox), streamed live to open tabs (SSE,
 * via Postgres LISTEN/NOTIFY across servers) and, when the member has no tab
 * open on this server, delivered as Web Push.
 */
export const NotificationModel = {
  async send(input: NewNotification) {
    const db = await getDb();
    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        kind: input.kind,
        planId: input.planId ?? null,
        actorId: input.actorId ?? null,
        data: input.data ?? {},
      })
      .returning();
    const copy = notificationCopy(row.kind, row.data, row.planId);
    await publish(row.userId, {
      type: "notification",
      id: row.id,
      kind: row.kind,
      title: copy.title,
      body: copy.body,
      href: copy.href,
      planId: row.planId,
    });
    if (localListenerCount(row.userId) === 0) void deliverPush(row.userId, copy, row.kind);
    return row;
  },

  async sendMany(list: NewNotification[]) {
    for (const item of list) await NotificationModel.send(item);
  },

  async list(userId: string, limit = 60) {
    const db = await getDb();
    return db
      .select({ notification: notifications })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async unreadCount(userId: string) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  },

  async markAllRead(userId: string) {
    const db = await getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  },
};

async function deliverPush(userId: string, copy: ReturnType<typeof notificationCopy>, tag: string) {
  try {
    const subs = await PushSubscriptionModel.forUser(userId);
    await Promise.all(
      subs.map(async (sub) => {
        const result = await sendPush(sub, { title: copy.title, body: copy.body, url: copy.href, tag });
        if (result === "gone") await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
      }),
    );
  } catch (error) {
    console.warn("[push] failed", error);
  }
}
