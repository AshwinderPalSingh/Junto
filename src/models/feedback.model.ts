import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { getDb } from "./db/client";
import { feedback, participations, plans, reports } from "./db/schema";
import { feedbackOpen } from "./rules/plan-timing";

export type FeedbackEntry = {
  rateeId: string;
  showedUp: boolean;
  wouldMeetAgain: boolean | null;
  flags: string[];
};

/** Private post-meetup feedback. Never shown to the person it is about. */
export const FeedbackModel = {
  async submit(planId: string, raterId: string, attended: boolean, entries: FeedbackEntry[], now: Date) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [plan] = await tx.select().from(plans).where(eq(plans.id, planId)).limit(1).for("update");
      if (!plan) throw new DomainError("Plan not found.");
      if (plan.status === "cancelled" || plan.status === "expired") throw new DomainError("Feedback isn't open for this plan.");
      const members = await tx
        .select()
        .from(participations)
        .where(and(eq(participations.planId, planId), eq(participations.status, "accepted")));
      const mine = members.find((m) => m.userId === raterId);
      if (!mine) throw new DomainError("You weren't booked on this plan.");
      if (mine.feedbackAt) throw new DomainError("You've already shared feedback for this one.");
      if (!feedbackOpen(plan.startsAt, plan.endsAt, now)) throw new DomainError("Feedback isn't open for this plan.");
      if (plan.status !== "completed" && members.some((m) => m.role === "guest")) {
        await tx.update(plans).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(plans.id, planId));
      }

      await tx
        .update(participations)
        .set({ selfReport: attended ? "attended" : "missed", feedbackAt: now })
        .where(eq(participations.id, mine.id));

      if (!attended) return { flagged: [] as string[] };
      const valid = new Set(members.filter((m) => m.userId !== raterId).map((m) => m.userId));
      const rows = entries
        .filter((e) => valid.has(e.rateeId))
        .map((e) => ({
          planId,
          raterId,
          rateeId: e.rateeId,
          showedUp: e.showedUp,
          wouldMeetAgain: e.wouldMeetAgain,
          flags: e.flags,
          createdAt: now,
        }));
      if (rows.length) await tx.insert(feedback).values(rows).onConflictDoNothing();
      const noShows = rows.filter((r) => !r.showedUp);
      if (noShows.length) await tx.insert(reports).values(noShows.map((r) => ({
        reporterId: raterId, reportedId: r.rateeId, planId, category: "no_show",
        details: "Did not show up after accepting and did not cancel. Submitted by a participant in post-meetup feedback.",
        createdAt: now,
      })));
      return { flagged: rows.filter((r) => r.flags.length > 0).map((r) => r.rateeId) };
    });
  },

  async forRatees(rateeIds: readonly string[]) {
    if (rateeIds.length === 0) return [];
    const db = await getDb();
    return db
      .select({
        planId: feedback.planId,
        raterId: feedback.raterId,
        rateeId: feedback.rateeId,
        showedUp: feedback.showedUp,
      })
      .from(feedback)
      .where(inArray(feedback.rateeId, [...rateeIds]));
  },

  async forPlans(planIds: readonly string[]) {
    if (planIds.length === 0) return [];
    const db = await getDb();
    return db
      .select({ planId: feedback.planId, rateeId: feedback.rateeId, showedUp: feedback.showedUp })
      .from(feedback)
      .where(inArray(feedback.planId, [...planIds]));
  },
};
