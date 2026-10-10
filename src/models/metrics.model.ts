import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { ACTIVITIES } from "@/config/campus";
import { addMinutes, campusParts } from "@/lib/time";
import { getDb } from "./db/client";
import { availability, feedback, participations, plans, reports, users } from "./db/schema";

const DAY = 24 * 60;

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Product health metrics for moderators. Success is measured in completed
 * meetups, not sign-ups: fulfilment, speed, completion, repeat use, safety.
 */
export const MetricsModel = {
  async dashboard(now: Date) {
    const db = await getDb();
    const since7 = addMinutes(now, -7 * DAY);
    const since14 = addMinutes(now, -14 * DAY);

    const [members, freeNow, openNow, recentPlans, reportRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*) filter (where ${users.onboardedAt} is not null)::int`,
          // Members who finished setup and were seen this week. gt() maps the Date through the
          // column type: a bare Date in a raw template breaks the postgres.js driver.
          active7: sql<number>`count(*) filter (where ${users.onboardedAt} is not null and ${gt(users.lastSeenAt, since7)})::int`,
          suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
        })
        .from(users)
        .where(sql`${users.status} <> 'deleted'`),
      db.select({ n: sql<number>`count(*)::int` }).from(availability).where(gt(availability.until, now)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(plans)
        .where(and(inArray(plans.status, ["open", "full"]), gt(plans.endsAt, now))),
      db.select().from(plans).where(gt(plans.createdAt, since14)),
      db.select({ createdAt: reports.createdAt, status: reports.status }).from(reports).where(gt(reports.createdAt, since14)),
    ]);

    const planIds = recentPlans.map((p) => p.id);
    const [parts, fb] = planIds.length
      ? await Promise.all([
          db.select().from(participations).where(inArray(participations.planId, planIds)),
          db
            .select({ planId: feedback.planId, rateeId: feedback.rateeId, showedUp: feedback.showedUp })
            .from(feedback)
            .where(inArray(feedback.planId, planIds)),
        ])
      : [[], []];

    const partsByPlan = new Map<string, typeof parts>();
    for (const p of parts) partsByPlan.set(p.planId, [...(partsByPlan.get(p.planId) ?? []), p]);
    const confirmed = new Set(fb.filter((f) => f.showedUp).map((f) => `${f.planId}:${f.rateeId}`));
    const attended = (p: (typeof parts)[number]) =>
      Boolean(p.checkedInAt) || p.selfReport === "attended" || confirmed.has(`${p.planId}:${p.userId}`);

    // Fulfilment: of plans whose start has passed in the last 7 days (ignoring ones the
    // host withdrew before anyone joined), how many found at least one companion?
    // A cancelled guest row always started as an accepted one.
    const everAccepted = (planId: string) =>
      (partsByPlan.get(planId) ?? []).some(
        (x) => x.role === "guest" && (x.status === "accepted" || x.status === "cancelled"),
      );
    const decided = recentPlans.filter(
      (p) => p.startsAt > since7 && p.startsAt <= now && !(p.status === "cancelled" && !everAccepted(p.id)),
    );
    const fulfilled = decided.filter((p) => everAccepted(p.id));

    // Time to first request (minutes), plans posted in the last 7 days.
    const firstRequestMinutes: number[] = [];
    for (const p of recentPlans.filter((x) => x.createdAt > since7)) {
      const guests = (partsByPlan.get(p.id) ?? []).filter((x) => x.role === "guest");
      if (guests.length === 0) continue;
      const first = Math.min(...guests.map((g) => g.requestedAt.getTime()));
      firstRequestMinutes.push(Math.max(0, (first - p.createdAt.getTime()) / 60_000));
    }

    // Completion: accepted spots on completed plans that turned into real meetings.
    const completed = recentPlans.filter((p) => p.status === "completed" && p.endsAt > since7);
    const acceptedOnCompleted = completed.flatMap((p) =>
      (partsByPlan.get(p.id) ?? []).filter((x) => x.status === "accepted"),
    );
    const met = acceptedOnCompleted.filter(attended);

    // Repeat usage & new connections over 14 days.
    const completed14 = recentPlans.filter((p) => p.status === "completed");
    const meetupsPerUser = new Map<string, number>();
    const pairs: string[] = [];
    for (const p of completed14) {
      const present = (partsByPlan.get(p.id) ?? []).filter((x) => x.status === "accepted" && attended(x));
      for (const x of present) meetupsPerUser.set(x.userId, (meetupsPerUser.get(x.userId) ?? 0) + 1);
      for (let i = 0; i < present.length; i++)
        for (let j = i + 1; j < present.length; j++)
          pairs.push([present[i].userId, present[j].userId].sort().join(":"));
    }
    const pairCounts = new Map<string, number>();
    for (const key of pairs) pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    const usersWithMeetup = [...meetupsPerUser.values()];

    // Daily series (campus days) for the last 14 days.
    const days: { key: string; label: string; posted: number; fulfilled: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = campusParts(addMinutes(now, -i * DAY));
      days.push({ key: `${d.year}-${d.month}-${d.day}`, label: `${d.day}/${d.month}`, posted: 0, fulfilled: 0 });
    }
    const dayIndex = new Map(days.map((d, i) => [d.key, i]));
    for (const p of recentPlans) {
      const d = campusParts(p.createdAt);
      const idx = dayIndex.get(`${d.year}-${d.month}-${d.day}`);
      if (idx === undefined) continue;
      days[idx].posted += 1;
      if ((partsByPlan.get(p.id) ?? []).some((x) => x.role === "guest" && x.status === "accepted")) days[idx].fulfilled += 1;
    }

    const byActivity = ACTIVITIES.map((a) => ({
      id: a.id,
      label: a.short,
      icon: a.icon,
      count: recentPlans.filter((p) => p.activity === a.id).length,
    })).sort((a, b) => b.count - a.count);

    const meetups14 = completed14.length;
    return {
      members: members[0]?.total ?? 0,
      active7: members[0]?.active7 ?? 0,
      suspended: members[0]?.suspended ?? 0,
      freeNow: freeNow[0]?.n ?? 0,
      openNow: openNow[0]?.n ?? 0,
      plansPosted7: recentPlans.filter((p) => p.createdAt > since7).length,
      fulfilmentRate: decided.length ? fulfilled.length / decided.length : null,
      fulfilmentSample: decided.length,
      medianMinutesToFirstRequest: median(firstRequestMinutes),
      completionRate: acceptedOnCompleted.length ? met.length / acceptedOnCompleted.length : null,
      completionSample: acceptedOnCompleted.length,
      repeatRate: usersWithMeetup.length
        ? usersWithMeetup.filter((n) => n >= 2).length / usersWithMeetup.length
        : null,
      newConnections14: [...pairCounts.values()].filter((n) => n === 1).length,
      meetups14,
      reportsPer100: meetups14 ? (reportRows.length / meetups14) * 100 : null,
      openReports: reportRows.filter((r) => r.status === "open").length,
      days,
      byActivity,
    };
  },

  async openReportCount() {
    const db = await getDb();
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open"));
    return row?.n ?? 0;
  },
};

export type Dashboard = Awaited<ReturnType<typeof MetricsModel.dashboard>>;
