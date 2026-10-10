import "server-only";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { ACTIVITY_IDS } from "@/config/campus";
import { BlockModel } from "./block.model";
import { getDb } from "./db/client";
import { availability, users, type UserRow } from "./db/schema";
import { isMutuallyCompatible } from "./rules/compatibility";

/**
 * "I'm free": a member opts into spontaneous plans for a limited window.
 * Free members are never listed to others — they only receive matching plans,
 * and hosts only ever see a count.
 */
export const AvailabilityModel = {
  async setFree(userId: string, minutes: number, activities: string[], now: Date) {
    const db = await getDb();
    const until = new Date(now.getTime() + minutes * 60_000);
    await db
      .insert(availability)
      .values({ userId, activities, until, createdAt: now })
      .onConflictDoUpdate({ target: availability.userId, set: { activities, until, createdAt: now } });
    return until;
  },

  async clear(userId: string) {
    const db = await getDb();
    await db.delete(availability).where(eq(availability.userId, userId));
  },

  async current(userId: string, now: Date) {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(availability)
      .where(and(eq(availability.userId, userId), gt(availability.until, now)))
      .limit(1);
    return row ?? null;
  },

  async countFree(now: Date, excludeUserId?: string) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(availability)
      .innerJoin(users, eq(users.id, availability.userId))
      .where(
        and(
          gt(availability.until, now),
          eq(users.status, "active"),
          excludeUserId ? ne(availability.userId, excludeUserId) : undefined,
        ),
      );
    return row?.n ?? 0;
  },

  /** Active free members (with their profile) who are up for `activity`. */
  async freeFor(activity: string | null, now: Date) {
    const db = await getDb();
    const rows = await db
      .select({ user: users, availability })
      .from(availability)
      .innerJoin(users, eq(users.id, availability.userId))
      .where(and(gt(availability.until, now), eq(users.status, "active")));
    return rows.filter(
      (r) => !activity || r.availability.activities.length === 0 || r.availability.activities.includes(activity),
    );
  },

  /**
   * For the "post a plan" form: per activity, how many free members could
   * join a plan by `host` (mutual consent, no blocks). A count, never a list.
   */
  async matchCountsFor(host: UserRow, now: Date): Promise<Record<string, number>> {
    const [free, blocked] = await Promise.all([AvailabilityModel.freeFor(null, now), BlockModel.relatedIds(host.id)]);
    const hostTraits = { id: host.id, gender: host.gender, companionGenders: host.companionGenders, groupPref: host.groupPref };
    const plan = { hostId: host.id, allowedGenders: host.companionGenders, capacity: 1 };
    const counts: Record<string, number> = {};
    for (const { user, availability: a } of free) {
      if (user.id === host.id || blocked.has(user.id)) continue;
      const joiner = { id: user.id, gender: user.gender, companionGenders: user.companionGenders, groupPref: user.groupPref };
      if (!isMutuallyCompatible(joiner, plan, hostTraits, [])) continue;
      for (const activity of ACTIVITY_IDS) {
        if (a.activities.length === 0 || a.activities.includes(activity)) counts[activity] = (counts[activity] ?? 0) + 1;
      }
    }
    return counts;
  },

  async purge(now: Date) {
    const db = await getDb();
    await db.delete(availability).where(lt(availability.until, now));
  },
};
