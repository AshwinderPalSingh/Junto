import { RULES } from "@/config/app";
import type { BadgeId } from "@/config/badges";

/**
 * Reputation that rewards showing up and communicating — never saying yes.
 *
 * - Declining is never counted.
 * - Early cancellations are fine; late ones are noted; safety ones never count.
 * - A mutual "we met" always wins over a no-show report.
 * - One-sided no-show reports only count once 2+ different people have filed
 *   them, so a single bad actor can't damage someone's record.
 * - Numbers are hidden until there is a meaningful sample size.
 */

export type MeetupRecord = {
  planId: string;
  activity: string;
  role: "host" | "guest";
  capacity: number;
  checkedIn: boolean;
  selfReport: "attended" | "missed" | null;
  /** People who said this member showed up. */
  confirmedBy: readonly string[];
  /** People who said this member did not show up. */
  reportedMissingBy: readonly string[];
  /** For hosts: how many guests attended. */
  guestsAttended: number;
};

export type CancellationRecord = { kind: "early" | "late" | "safety" | "plan_cancelled" | "removed" };

export type Attendance = "attended" | "no_show" | "reported" | "unknown";

export function attendanceOf(m: MeetupRecord): Attendance {
  if (m.confirmedBy.length > 0) return "attended";
  if (m.selfReport === "missed") return "no_show";
  if (m.reportedMissingBy.length > 0 && !m.checkedIn) return "reported";
  if (m.checkedIn || m.selfReport === "attended") return "attended";
  return "unknown";
}

export type Reputation = {
  attended: number;
  noShows: number;
  pendingReports: number;
  lateCancels: number;
  earlyCancels: number;
  activitiesTried: number;
  hostedGroups: number;
  sample: number;
  showUpRate: number | null;
  level: "new" | "reliable" | "good" | "mixed";
  summary: string;
  badges: BadgeId[];
};

export function computeReputation(
  meetups: readonly MeetupRecord[],
  cancellations: readonly CancellationRecord[],
): Reputation {
  let attended = 0;
  let selfMissed = 0;
  const reported: MeetupRecord[] = [];
  const activities = new Set<string>();
  let hostedGroups = 0;

  for (const m of meetups) {
    const a = attendanceOf(m);
    if (a === "attended") {
      attended += 1;
      activities.add(m.activity);
      if (m.role === "host" && m.capacity > 1 && m.guestsAttended >= 2) hostedGroups += 1;
    } else if (a === "no_show") {
      selfMissed += 1;
    } else if (a === "reported") {
      reported.push(m);
    }
  }

  const distinctReporters = new Set(reported.flatMap((m) => m.reportedMissingBy));
  const reportsCount = distinctReporters.size >= RULES.noShowMinReporters;
  const noShows = selfMissed + (reportsCount ? reported.length : 0);
  const pendingReports = reportsCount ? 0 : reported.length;

  const lateCancels = cancellations.filter((c) => c.kind === "late").length;
  const earlyCancels = cancellations.filter((c) => c.kind === "early").length;

  const sample = attended + noShows;
  const showUpRate = sample >= RULES.reliabilityMinMeetups ? attended / sample : null;
  const level: Reputation["level"] =
    showUpRate === null ? "new" : showUpRate >= 0.9 ? "reliable" : showUpRate >= 0.75 ? "good" : "mixed";

  const summary =
    showUpRate !== null
      ? `Showed up to ${attended} of ${sample} meetups`
      : attended === 0
        ? "New to Junto"
        : `New here · ${attended} meetup${attended === 1 ? "" : "s"} so far`;

  const badges: BadgeId[] = [];
  if (attended >= 1) badges.push("first_meetup");
  if (showUpRate !== null && showUpRate >= 0.9) badges.push("reliable");
  if (earlyCancels >= 1 && lateCancels === 0 && noShows === 0) badges.push("communicator");
  if (activities.size >= 4) badges.push("explorer");
  if (hostedGroups >= 3) badges.push("builder");

  return {
    attended,
    noShows,
    pendingReports,
    lateCancels,
    earlyCancels,
    activitiesTried: activities.size,
    hostedGroups,
    sample,
    showUpRate,
    level,
    summary,
    badges,
  };
}

export const emptyReputation = (): Reputation => computeReputation([], []);
