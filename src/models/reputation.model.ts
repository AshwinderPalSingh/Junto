import "server-only";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";
import { getDb } from "./db/client";
import { availability, notifications, participations, plans, reports, users } from "./db/schema";
import { FeedbackModel } from "./feedback.model";
import {
  computeReputation,
  ratingRestriction,
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

    const [meetupRows, cancelRows, feedbackRows, reviewRows, requestRows] = await Promise.all([
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
        .select({ id: participations.id, userId: participations.userId, kind: participations.cancelKind })
        .from(participations)
        .where(and(inArray(participations.userId, ids), eq(participations.status, "cancelled"))),
      FeedbackModel.forRatees(ids),
      db.select().from(reports)
        .where(and(inArray(reports.reportedId, ids), eq(reports.category, "no_show"), ne(reports.status, "open")))
        .orderBy(asc(reports.resolvedAt)),
      db.select({ userId: participations.userId, status: participations.status, cancelKind: participations.cancelKind })
        .from(participations).where(inArray(participations.userId, ids)),
    ]);

    const reviews = new Map<string, "confirmed" | "dismissed">();
    for (const r of reviewRows) {
      if (r.planId) reviews.set(`${r.planId}:${r.reportedId}`, r.status === "resolved" ? "confirmed" : "dismissed");
    }

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
        review: reviews.get(`${plan.id}:${p.userId}`),
      });
      meetupsByUser.set(p.userId, list);
    }

    const cancelsByUser = new Map<string, CancellationRecord[]>();
    for (const c of cancelRows) {
      if (!c.kind) continue;
      const list = cancelsByUser.get(c.userId) ?? [];
      list.push({ id: c.id, kind: c.kind });
      cancelsByUser.set(c.userId, list);
    }

    for (const id of ids) {
      const history = requestRows.filter((r) => r.userId === id);
      out.set(id, computeReputation(meetupsByUser.get(id) ?? [], cancelsByUser.get(id) ?? [], {
        acceptedPlans: history.filter((r) => r.status === "accepted" || (r.status === "cancelled" && r.cancelKind !== "removed")).length,
        declinedRequests: history.filter((r) => r.status === "declined").length,
      }));
    }
    return out;
  },

  async forUser(userId: string) {
    return (await ReputationModel.forUsers([userId])).get(userId)!;
  },

  async assessRestriction(userId: string, now = new Date()): Promise<Date | null> {
    const rep = await ReputationModel.forUser(userId);
    const db = await getDb();
    return db.transaction(async (tx) => {
      // Keep foreign-key inserts (companion notifications) available during concurrent assessments.
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("no key update");
      if (!user || user.status !== "active") return null;
      const next = ratingRestriction(rep, { until: user.ratingRestrictedUntil, reviewed: user.ratingReviewedPenalties }, now);
      if (next.until?.getTime() !== user.ratingRestrictedUntil?.getTime() || next.reviewed.length !== user.ratingReviewedPenalties.length) {
        await tx.update(users).set({ ratingRestrictedUntil: next.until, ratingReviewedPenalties: next.reviewed }).where(eq(users.id, userId));
        if (next.until && (!user.ratingRestrictedUntil || user.ratingRestrictedUntil <= now)) {
          await tx.delete(availability).where(eq(availability.userId, userId));
          // Release future commitments so a pause cannot itself cause more no-shows.
          const upcoming = await tx.select({ plan: plans, participation: participations }).from(participations)
            .innerJoin(plans, eq(plans.id, participations.planId))
            .where(and(eq(participations.userId, userId), inArray(participations.status, ["accepted", "requested"]), inArray(plans.status, ["open", "full"]), gt(plans.startsAt, now)))
            .orderBy(asc(plans.id)).for("update", { of: plans });
          for (const { plan, participation } of upcoming) {
            let recipients: string[] = [];
            if (plan.hostId === userId) {
              const members = await tx.select().from(participations).where(and(eq(participations.planId, plan.id), inArray(participations.status, ["accepted", "requested"])));
              recipients = members.filter((m) => m.userId !== userId).map((m) => m.userId);
              await tx.update(plans).set({ status: "cancelled", cancelledAt: now, cancelReason: "The host is unavailable.", updatedAt: now }).where(eq(plans.id, plan.id));
              await tx.update(participations).set({ status: "cancelled", cancelKind: "plan_cancelled", cancelledAt: now }).where(and(eq(participations.planId, plan.id), eq(participations.status, "accepted")));
              await tx.update(participations).set({ status: "expired", decidedAt: now }).where(and(eq(participations.planId, plan.id), eq(participations.status, "requested")));
            } else {
              await tx.update(participations).set({ status: participation.status === "requested" ? "withdrawn" : "cancelled", cancelKind: "removed", cancelledAt: now }).where(eq(participations.id, participation.id));
              if (participation.status === "accepted") {
                recipients = [plan.hostId];
                if (plan.status === "full") await tx.update(plans).set({ status: "open", updatedAt: now }).where(eq(plans.id, plan.id));
              }
            }
            if (recipients.length) await tx.insert(notifications).values(recipients.map((id) => ({
              userId: id, kind: "account_notice" as const, planId: plan.id,
              data: { title: "Plan updated", body: plan.hostId === userId ? "The host is unavailable, so this upcoming plan was cancelled." : "A companion is unavailable and their spot is open again.", href: `/plans/${plan.id}` },
            })));
          }
        }
      }
      return next.until;
    });
  },
};
