import "server-only";
import { memberOf, needsFeedbackFrom, PlanModel, type PlanBundle } from "@/models/plan.model";
import type { MyPlansVM } from "@/views/view-models";
import { requireMember } from "./guards";
import { buildContext, peopleIn, presentPlanCard } from "./presenters";

function outcome(b: PlanBundle, userId: string): string {
  const mine = memberOf(b, userId);
  if (b.plan.status === "cancelled") return b.plan.removedByAdmin ? "Removed by a moderator" : "Cancelled";
  if (b.plan.status === "expired") return "No one could make it";
  if (mine?.participation.selfReport === "missed") return "You couldn't make it";
  return "Met up";
}

/** GET /activity — everything I'm hosting, joining, waiting on, or did. */
export const ActivityController = {
  async index(): Promise<MyPlansVM> {
    const viewer = await requireMember();
    const now = new Date();
    const mine = await PlanModel.forMember(viewer.id, now);
    const past = mine.past.slice(0, 30);
    const ctx = await buildContext(viewer, peopleIn([...mine.upcoming, ...mine.requested, ...past]));
    return {
      now: now.toISOString(),
      upcoming: mine.upcoming.map((b) => presentPlanCard(b, ctx)),
      requested: mine.requested.map((b) => presentPlanCard(b, ctx)),
      past: past.map((b) => ({
        ...presentPlanCard(b, ctx),
        outcome: outcome(b, viewer.id),
        needsFeedback: needsFeedbackFrom(b, viewer.id, now),
      })),
    };
  },
};
