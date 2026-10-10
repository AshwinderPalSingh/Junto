import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db/client";
import { participations, plans } from "./db/schema";
import { FeedbackModel } from "./feedback.model";
import {
  computeReputation,
  type CancellationRecord,
  type MeetupRecord,
  type Reputation,
} from "./rules/reliability";

/** Loads the raw history for a set of members and derives their reputation. */
export const ReputationModel = {
  async forUsers(userIds: readonly string[]): Promise<Map<string, Reputation>> {
    const ids = [...new Set(userIds)];
    const out = new Map<string, Reputation>();
    if (ids.length === 0) return out;
    const db = await getDb();

    const [meetupRows, cancelRows, feedbackRows] = await Promise.all([
      db
        .select({ p: participations, plan: plans })
        .from(participations)
        .innerJoin(plans, eq(plans.id, participations.planId))
        .where(
          and(
            inArray(participations.userId, ids),
            eq(participations.status, "accepted"),
            eq(plans.status, "completed"),
          ),
        ),
      db
        .select({ userId: participations.userId, kind: participations.cancelKind })
        .from(participations)
        .where(and(inArray(participations.userId, ids), eq(participations.status, "cancelled"))),
      FeedbackModel.forRatees(ids),
    ]);

    // Guests who attended each hosted plan (for the community-builder badge).
    const hostedPlanIds = meetupRows.filter((r) => r.p.role === "host").map((r) => r.plan.id);
    const guestAttendance = new Map<string, number>();
    if (hostedPlanIds.length) {
      const [guestRows, planFeedback] = await Promise.all([
        db
          .select()
          .from(participations)
          .where(
            and(
              inArray(participations.planId, hostedPlanIds),
              eq(participations.role, "guest"),
              eq(participations.status, "accepted"),
            ),
          ),
        FeedbackModel.forPlans(hostedPlanIds),
      ]);
      const confirmed = new Set(planFeedback.filter((f) => f.showedUp).map((f) => `${f.planId}:${f.rateeId}`));
      for (const g of guestRows) {
        const attended = g.checkedInAt || g.selfReport === "attended" || confirmed.has(`${g.planId}:${g.userId}`);
        if (attended) guestAttendance.set(g.planId, (guestAttendance.get(g.planId) ?? 0) + 1);
      }
    }

    const feedbackFor = new Map<string, { confirmed: string[]; missing: string[] }>();
    for (const f of feedbackRows) {
      const key = `${f.planId}:${f.rateeId}`;
      const entry = feedbackFor.get(key) ?? { confirmed: [], missing: [] };
      (f.showedUp ? entry.confirmed : entry.missing).push(f.raterId);
      feedbackFor.set(key, entry);
    }

    const meetupsByUser = new Map<string, MeetupRecord[]>();
    for (const { p, plan } of meetupRows) {
      const fb = feedbackFor.get(`${plan.id}:${p.userId}`);
      const list = meetupsByUser.get(p.userId) ?? [];
      list.push({
        planId: plan.id,
        activity: plan.activity,
        role: p.role,
        capacity: plan.capacity,
        checkedIn: Boolean(p.checkedInAt),
        selfReport: p.selfReport,
        confirmedBy: fb?.confirmed ?? [],
        reportedMissingBy: fb?.missing ?? [],
        guestsAttended: guestAttendance.get(plan.id) ?? 0,
      });
      meetupsByUser.set(p.userId, list);
    }

    const cancelsByUser = new Map<string, CancellationRecord[]>();
    for (const c of cancelRows) {
      if (!c.kind) continue;
      const list = cancelsByUser.get(c.userId) ?? [];
      list.push({ kind: c.kind });
      cancelsByUser.set(c.userId, list);
    }

    for (const id of ids) {
      out.set(id, computeReputation(meetupsByUser.get(id) ?? [], cancelsByUser.get(id) ?? []));
    }
    return out;
  },

  async forUser(userId: string) {
    return (await ReputationModel.forUsers([userId])).get(userId)!;
  },
};
