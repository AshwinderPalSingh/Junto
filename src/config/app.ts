/**
 * App-wide constants. Everything a campus admin might want to tune lives in
 * `src/config/*` so the rest of the code never hard-codes product rules.
 */
export const APP = {
  name: "Junto",
  tagline: "Your campus companion",
  campus: "Thapar Institute of Engineering & Technology",
  campusShort: "Thapar",
  /** All times are stored in UTC and displayed in campus time. */
  timeZone: "Asia/Kolkata",
  locale: "en-IN",
} as const;

export const RULES = {
  /** A member can host at most this many upcoming plans at once. */
  maxOpenHostedPlans: 2,
  /** A member can have at most this many join requests waiting at once. */
  maxPendingRequests: 5,
  /** Companions a plan can take (excluding the host). */
  minCapacity: 1,
  maxCapacity: 5,
  /** How far ahead a plan can be scheduled. */
  planHorizonHours: 24,
  /** Plans must start inside campus hours (campus time, 24h clock). */
  campusHours: { open: "06:00", close: "22:30" },
  /** People can still ask to join for a few minutes after a plan starts. */
  joinGraceMinutes: 10,
  /** Cancelling an accepted plan within this window counts as "late". */
  lateCancelMinutes: 60,
  /** After this many declines from the same host, their plans stop showing. */
  declinesBeforeHidden: 2,
  /** Reliability numbers are only shown once someone has this many meetups. */
  reliabilityMinMeetups: 5,
  /** One-sided no-show reports count only after this many different reporters. */
  noShowMinReporters: 2,
  /** Check-in opens this many minutes before the start. */
  checkInOpensMinutes: 15,
  /** Feedback can be left for this long after a plan ends. */
  feedbackWindowHours: 72,
  /** Reminders go out this many minutes before a plan starts. */
  reminderMinutes: 15,
  /** Durations offered when posting a plan (minutes). */
  durations: [15, 30, 45, 60, 90, 120, 180] as const,
  /** "I'm free" windows (minutes). */
  freeDurations: [30, 60, 90, 120] as const,
  noteMaxLength: 100,
  requestNoteMaxLength: 80,
  bioMaxLength: 140,
  maxInterests: 5,
  minInterests: 1,
  reportsPerDay: 10,
  otp: {
    length: 6,
    ttlMinutes: 10,
    maxAttempts: 5,
    maxPerWindow: 5,
    windowMinutes: 15,
    /** Minimum gap between two codes for the same address. */
    resendAfterSeconds: 30,
  },
  chat: {
    /** Longest message, in characters (also keeps live-update payloads small). */
    maxLength: 1000,
    /** Messages loaded per page when opening or scrolling back through a chat. */
    pageSize: 40,
    /** A plan's group chat stays open this long after the plan ends. */
    planChatOpenHoursAfterEnd: 24,
    /** Messages one member can send per minute, across all chats. */
    perMinute: 30,
    /** New direct chats one member can start per day. */
    newChatsPerDay: 30,
  },
  session: { ttlDays: 30 },
  photo: { maxBytes: 5 * 1024 * 1024, minSide: 200, outputSide: 640 },
} as const;
