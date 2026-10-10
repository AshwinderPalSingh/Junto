import "server-only";
import { AvailabilityModel } from "@/models/availability.model";
import { PlanModel } from "@/models/plan.model";
import type { FreeVM } from "@/views/view-models";
import { requireMember } from "./guards";
import { buildContext, peopleIn, presentPlanCard } from "./presenters";

/** GET /free — the "I'm free" switch and plans you could join right now. */
export const FreeController = {
  async show(): Promise<FreeVM> {
    const viewer = await requireMember();
    const now = new Date();
    const [current, freeCount, entries] = await Promise.all([
      AvailabilityModel.current(viewer.id, now),
      AvailabilityModel.countFree(now, viewer.id),
      PlanModel.board(viewer, now),
    ]);
    const horizon = current ? current.until.getTime() : now.getTime() + 3 * 60 * 60_000;
    const wanted = current?.activities ?? [];
    const matching = entries
      .filter((e) => e.check.ok)
      .map((e) => e.bundle)
      .filter((b) => b.plan.startsAt.getTime() <= horizon)
      .filter((b) => wanted.length === 0 || wanted.includes(b.plan.activity))
      .slice(0, 10);
    const ctx = await buildContext(viewer, peopleIn(matching));
    return {
      now: now.toISOString(),
      current: current ? { until: current.until.toISOString(), activities: current.activities } : null,
      freeCount,
      matchingPlans: matching.map((b) => presentPlanCard(b, ctx)),
    };
  },
};
