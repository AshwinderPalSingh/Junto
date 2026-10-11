import "server-only";
import { getActivity } from "@/config/campus";
import { partOfDay } from "@/lib/time";
import { AvailabilityModel } from "@/models/availability.model";
import { firstNameOf } from "@/models/user.model";
import { needsFeedbackFrom, PlanModel, pendingRequests } from "@/models/plan.model";
import type { BoardVM } from "@/views/view-models";
import { requireMember } from "./guards";
import { buildContext, peopleIn, presentPlanCard } from "./presenters";

const GREETINGS = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Up late",
} as const;

/** GET /board — the home feed. */
export const BoardController = {
  async index(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<BoardVM> {
    const viewer = await requireMember();
    const params = await searchParams;
    const now = new Date();
    const [entries, freeCount, myFree, mine] = await Promise.all([
      PlanModel.board(viewer, now),
      AvailabilityModel.countFree(now, viewer.id),
      AvailabilityModel.current(viewer.id, now),
      PlanModel.forMember(viewer.id, now),
    ]);

    // Plans I'm confirmed on live in "Coming up"; the feed shows the rest.
    const confirmedIds = new Set(mine.upcoming.map((b) => b.plan.id));
    const feed = entries.map((e) => e.bundle).filter((b) => !confirmedIds.has(b.plan.id));
    const ctx = await buildContext(viewer, peopleIn([...feed, ...mine.upcoming]));

    const feedbackDue = mine.past.find((b) => needsFeedbackFrom(b, viewer.id, now));
    return {
      now: now.toISOString(),
      firstName: viewer.identityVerifiedAt ? firstNameOf(viewer) : "there",
      greeting: GREETINGS[partOfDay(now)],
      welcome: params.welcome === "1",
      freeCount,
      myFree: myFree ? { until: myFree.until.toISOString(), activities: myFree.activities } : null,
      mine: mine.upcoming.map((b) => presentPlanCard(b, ctx)),
      plans: feed.map((b) => presentPlanCard(b, ctx)),
      hostRequests: mine.upcoming
        .filter((b) => b.plan.hostId === viewer.id)
        .reduce((sum, b) => sum + pendingRequests(b).length, 0),
      needsFeedback: feedbackDue
        ? { planId: feedbackDue.plan.id, label: getActivity(feedbackDue.plan.activity).short.toLowerCase() }
        : null,
    };
  },
};
