import { RULES } from "@/config/app";
import { addMinutes, formatHHMM, isWithinCampusHours, toDate, type DateInput } from "@/lib/time";

export type PlanPhase = "upcoming" | "soon" | "live" | "ended";

/** Where a plan is in its life relative to `now`. "soon" = within the hour. */
export function planPhase(startsAt: DateInput, endsAt: DateInput, now: DateInput): PlanPhase {
  const n = toDate(now).getTime();
  const s = toDate(startsAt).getTime();
  if (n >= toDate(endsAt).getTime()) return "ended";
  if (n >= s) return "live";
  if (s - n <= 60 * 60_000) return "soon";
  return "upcoming";
}

/** Requests stay open until a few minutes after the start. */
export const joinWindowOpen = (startsAt: DateInput, now: DateInput) =>
  toDate(now).getTime() <= addMinutes(startsAt, RULES.joinGraceMinutes).getTime();

export const checkInOpen = (startsAt: DateInput, endsAt: DateInput, now: DateInput) => {
  const n = toDate(now).getTime();
  return n >= addMinutes(startsAt, -RULES.checkInOpensMinutes).getTime() && n <= toDate(endsAt).getTime();
};

/** Feedback opens once the meetup has been under way for a bit and stays open for a few days. */
export const feedbackOpen = (startsAt: DateInput, endsAt: DateInput, now: DateInput) => {
  const n = toDate(now).getTime();
  return (
    n >= addMinutes(startsAt, 10).getTime() &&
    n <= addMinutes(endsAt, RULES.feedbackWindowHours * 60).getTime()
  );
};

/** Cancelling close to the start is "late"; earlier is "early" (fine). */
export const cancellationKind = (startsAt: DateInput, now: DateInput): "early" | "late" =>
  toDate(startsAt).getTime() - toDate(now).getTime() < RULES.lateCancelMinutes * 60_000 ? "late" : "early";

/** Returns an error message, or null if the start time is acceptable. */
export function validatePlanStart(startsAt: DateInput, now: DateInput): string | null {
  const s = toDate(startsAt).getTime();
  const n = toDate(now).getTime();
  if (s < n - 2 * 60_000) return "That time has already passed.";
  if (s > n + RULES.planHorizonHours * 60 * 60_000) {
    return `Plans can be posted up to ${RULES.planHorizonHours} hours ahead.`;
  }
  if (!isWithinCampusHours(startsAt)) {
    return `Plans need to start between ${formatHHMM(RULES.campusHours.open)} and ${formatHHMM(RULES.campusHours.close)}.`;
  }
  return null;
}

export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
