/**
 * Campus-time helpers. Isomorphic (used by server code and client views).
 *
 * Output is assembled by hand from numeric parts instead of locale strings so
 * the server and the browser always render identical text (no hydration
 * mismatches from differing ICU data).
 */
import { APP, RULES } from "@/config/app";

export type DateInput = Date | string | number;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

export type CampusParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export function campusParts(input: DateInput): CampusParts {
  const parts = partsFormatter.formatToParts(toDate(input));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/** Minutes the campus clock is ahead of UTC at a given instant (+330 for IST). */
export function campusOffsetMinutes(input: DateInput): number {
  const d = toDate(input);
  const p = campusParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** e.g. "5:30 pm" */
export function formatClock(input: DateInput): string {
  const { hour, minute } = campusParts(input);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** Whole campus-calendar days from `from` to `to` (0 = same day). */
export function campusDayDiff(from: DateInput, to: DateInput): number {
  const a = campusParts(from);
  const b = campusParts(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

/** "Today", "Tomorrow", "Yesterday" or "Sat, 12 Oct". */
export function formatDay(input: DateInput, now: DateInput): string {
  const diff = campusDayDiff(now, input);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const p = campusParts(input);
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]}`;
}

/** "Today · 5:30 pm" */
export const formatWhen = (input: DateInput, now: DateInput) =>
  `${formatDay(input, now)} · ${formatClock(input)}`;

/** "in 12 min", "now", "5 min ago", "in 2 h 10 min", "3 days ago". */
export function formatRelative(target: DateInput, now: DateInput): string {
  const diffMin = Math.round((toDate(target).getTime() - toDate(now).getTime()) / 60_000);
  const abs = Math.abs(diffMin);
  if (abs < 1) return "now";
  let text: string;
  if (abs < 60) text = `${abs} min`;
  else if (abs < 24 * 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    text = m && h < 3 ? `${h} h ${m} min` : `${h} h`;
  } else {
    const d = Math.round(abs / (24 * 60));
    text = `${d} day${d === 1 ? "" : "s"}`;
  }
  return diffMin > 0 ? `in ${text}` : `${text} ago`;
}

export const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const parseHHMM = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

/** "22:30" → "10:30 pm" */
export function formatHHMM(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "HH:mm" of an instant on the campus clock (for <input type="time">). */
export function campusHHMM(input: DateInput): string {
  const { hour, minute } = campusParts(input);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export const minutesOfCampusDay = (input: DateInput) => {
  const p = campusParts(input);
  return p.hour * 60 + p.minute;
};

export function isWithinCampusHours(input: DateInput): boolean {
  const minutes = minutesOfCampusDay(input);
  return (
    minutes >= parseHHMM(RULES.campusHours.open) && minutes <= parseHHMM(RULES.campusHours.close)
  );
}

/** The instant at which the campus clock shows `hhmm`, `dayOffset` campus days after `now`. */
export function campusTimeToDate(now: DateInput, dayOffset: number, hhmm: string): Date {
  const p = campusParts(now);
  const [h, m] = hhmm.split(":").map(Number);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day + dayOffset, h, m);
  const offset = campusOffsetMinutes(new Date(wallAsUtc));
  return new Date(wallAsUtc - offset * 60_000);
}

/** Round up to the next multiple of `step` minutes (keeps "start now" times tidy). */
export function roundUpMinutes(input: DateInput, step: number): Date {
  const ms = step * 60_000;
  return new Date(Math.ceil(toDate(input).getTime() / ms) * ms);
}

export const addMinutes = (input: DateInput, minutes: number) =>
  new Date(toDate(input).getTime() + minutes * 60_000);

/** Morning / afternoon / evening greeting in campus time. */
export function partOfDay(input: DateInput): "morning" | "afternoon" | "evening" | "night" {
  const hour = campusParts(input).hour;
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}
