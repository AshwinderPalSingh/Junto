/** Fixed vocabularies for one-tap meetup updates, feedback and reports. */

/** One-tap updates offered in a plan's group chat (sent as ordinary messages). */
export const MESSAGE_PRESETS = [
  { id: "on_my_way", text: "On my way", icon: "footprints" },
  { id: "here", text: "I'm here", icon: "map-pin-check" },
  { id: "late_5", text: "Running about 5 min late", icon: "timer" },
  { id: "late_15", text: "Running about 15 min late", icon: "hourglass" },
  { id: "wearing", text: "I'm wearing", icon: "shirt", needsDetail: true },
  { id: "thanks", text: "Thanks, that was fun", icon: "sparkles" },
] as const;
export type MessagePresetId = (typeof MESSAGE_PRESETS)[number]["id"];
export const MESSAGE_PRESET_IDS = MESSAGE_PRESETS.map((m) => m.id) as [
  MessagePresetId,
  ...MessagePresetId[],
];
export const getPreset = (id: string) => MESSAGE_PRESETS.find((m) => m.id === id);

export const FEEDBACK_FLAGS = [
  { id: "late", label: "Was very late" },
  { id: "disrespectful", label: "Was disrespectful" },
  { id: "uncomfortable", label: "Made me uncomfortable" },
  { id: "profile_mismatch", label: "Didn't match their profile" },
] as const;
export type FeedbackFlag = (typeof FEEDBACK_FLAGS)[number]["id"];
export const FEEDBACK_FLAG_IDS = FEEDBACK_FLAGS.map((f) => f.id) as [FeedbackFlag, ...FeedbackFlag[]];

export const REPORT_CATEGORIES = [
  { id: "harassment", label: "Harassment or unwanted attention" },
  { id: "unsafe", label: "I felt unsafe" },
  { id: "romantic_pressure", label: "Treated it like a date" },
  { id: "profile_mismatch", label: "Fake or misleading profile" },
  { id: "no_show", label: "Repeatedly didn't show up" },
  { id: "spam", label: "Spam or selling something" },
  { id: "other", label: "Something else" },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];
export const REPORT_CATEGORY_IDS = REPORT_CATEGORIES.map((r) => r.id) as [
  ReportCategory,
  ...ReportCategory[],
];
export const reportCategoryLabel = (id: string) =>
  REPORT_CATEGORIES.find((r) => r.id === id)?.label ?? id;

export const CANCEL_REASONS = [
  { id: "came_up", label: "Something came up" },
  { id: "changed_plans", label: "My plans changed" },
  { id: "unsafe", label: "I don't feel safe going" },
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number]["id"];
export const CANCEL_REASON_IDS = CANCEL_REASONS.map((c) => c.id) as [CancelReason, ...CancelReason[]];

export const COMMUNITY_GUIDELINES = [
  {
    title: "It's about the activity",
    body: "Junto is for chai, walks, games and errands, not dating. Don't pursue anyone romantically, and don't keep messaging someone who isn't interested.",
  },
  {
    title: "Meet in public spots",
    body: "Every plan uses a public campus meeting point. Never ask someone to come to a hostel room or get into a vehicle.",
  },
  {
    title: "Show up, or say so early",
    body: "Saying no is always fine. Once you've said yes, show up — or cancel as early as you can.",
  },
  {
    title: "Be yourself",
    body: "Use your real name and a clear, recent photo of your face. One photo is all we need.",
  },
  {
    title: "Respect boundaries",
    body: "People can decline, leave, or block without explanation. Pressure, insults or harassment get accounts removed.",
  },
] as const;
