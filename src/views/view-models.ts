/**
 * View models — the contract between Controllers and Views.
 * Views declare exactly the (serialisable) data they render; controllers build
 * it from models. Nothing here exposes emails, raw rows or private preferences
 * of other members.
 */

export type PhotoVM = { url: string | null; initials: string };

export type BadgeVM = { id: string; label: string; icon: string; description: string };

export type ReputationVM = {
  level: "new" | "reliable" | "good" | "mixed";
  summary: string;
  attended: number;
  badges: BadgeVM[];
  rating: number | null;
  ratingSample: number;
};

export type InterestVM = { id: string; label: string; shared: boolean };

export type MemberVM = {
  id: string;
  name: string;
  firstName: string;
  year: string;
  branch: string | null;
  bio: string | null;
  vibe: { label: string } | null;
  interests: InterestVM[];
  photo: PhotoVM;
  reputation: ReputationVM;
  isYou: boolean;
};

export type ActivityVM = { id: string; label: string; short: string; icon: string; hint: string };
export type SpotVM = { id: string; name: string; area: string };

export type PlanStatusVM = "open" | "full" | "cancelled" | "completed" | "expired";

export type PlanCardVM = {
  id: string;
  activity: ActivityVM;
  spot: SpotVM;
  note: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  capacity: number;
  joined: number;
  spotsLeft: number;
  isGroup: boolean;
  status: PlanStatusVM;
  host: MemberVM;
  companions: { id: string; name: string; photo: PhotoVM }[];
  my: { role: "host" | "guest" | null; status: string | null };
  sharedInterests: number;
  pendingRequests: number;
};

export type FreeStatusVM = { until: string; activities: string[] } | null;

export type BoardVM = {
  now: string;
  firstName: string;
  greeting: string;
  welcome: boolean;
  freeCount: number;
  myFree: FreeStatusVM;
  /** Upcoming plans I'm hosting or confirmed on. */
  mine: PlanCardVM[];
  /** Other people's plans I can join (or have asked to). */
  plans: PlanCardVM[];
  hostRequests: number;
  needsFeedback: { planId: string; label: string } | null;
};

export type ShellVM = {
  name: string;
  photo: PhotoVM;
  unread: number;
  /** Chats with unread messages. */
  unreadChats: number;
  isAdmin: boolean;
  openReports: number;
};

export type PlanViewerRole = "host" | "guest" | "requested" | "outsider";

export type PlanDetailVM = {
  now: string;
  plan: PlanCardVM & { allowedGenders: string[]; cancelReason: string | null; removedByAdmin: boolean };
  phase: "upcoming" | "soon" | "live" | "ended";
  viewer: {
    id: string;
    role: PlanViewerRole;
    participationStatus: string | null;
    checkedIn: boolean;
    feedbackDone: boolean;
  };
  requestBlockedReason: string | null;
  requests: { participationId: string; note: string | null; requestedAt: string; member: MemberVM }[];
  members: { member: MemberVM; role: "host" | "guest"; checkedIn: boolean; canMessage: boolean }[];
  /** The plan's group chat, for the host and confirmed guests once someone has joined. */
  chat: ChatThreadVM | null;
  /** An outsider may message the host directly about the plan. */
  canMessageHost: boolean;
  can: {
    request: boolean;
    withdraw: boolean;
    checkIn: boolean;
    feedback: boolean;
    cancelPlan: boolean;
    leave: boolean;
    share: boolean;
  };
  feedbackTargets: { id: string; name: string; photo: PhotoVM }[];
};

export type PastPlanVM = PlanCardVM & { outcome: string; needsFeedback: boolean };

export type MyPlansVM = {
  now: string;
  upcoming: PlanCardVM[];
  requested: PlanCardVM[];
  past: PastPlanVM[];
};

export type FreeVM = {
  now: string;
  current: FreeStatusVM;
  freeCount: number;
  matchingPlans: PlanCardVM[];
};

export type NewPlanVM = {
  now: string;
  host: MemberVM;
  myGender: string;
  defaultAllowed: string[];
  freeCounts: Record<string, number>;
  activeHosted: number;
  maxHosted: number;
  campusHours: { open: string; close: string };
  presetActivity: string | null;
};

export type NotificationVM = {
  id: string;
  kind: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  at: string;
  read: boolean;
};

export type NotificationsVM = { now: string; items: NotificationVM[] };

export type ProfileVM = {
  now: string;
  member: MemberVM;
  isMe: boolean;
  blockedByMe: boolean;
  badges: (BadgeVM & { earned: boolean })[];
  stats: {
    attended: number;
    activitiesTried: number;
    hostedGroups: number;
    lateCancels: number;
    noShows: number;
    pendingReports: number;
    acceptedPlans: number;
    declinedRequests: number;
  } | null;
  /** Starting a direct chat with this member (null on your own profile). */
  chat: { canStart: boolean; note: string | null } | null;
};

export type SettingsVM = {
  email: string;
  identity: { fullName: string | null; connected: boolean; available: boolean };
  gender: string;
  companionGenders: string[];
  groupPref: string;
  chatPolicy: "anyone" | "met" | "nobody";
  hasPassword: boolean;
  vapidPublicKey: string | null;
  pushDevices: number;
  blocked: { id: string; name: string; photo: PhotoVM }[];
  isAdmin: boolean;
};

export type OnboardingStep = "about" | "preferences" | "photo" | "guidelines";

export type OnboardingVM = {
  email: string;
  step: OnboardingStep;
  completed: OnboardingStep[];
  profile: {
    fullName: string | null;
    identityConnected: boolean;
    identityAvailable: boolean;
    year: string;
    branch: string;
    bio: string;
    interests: string[];
    vibe: string | null;
    gender: string | null;
    genderLocked: boolean;
  };
  preferences: { companionGenders: string[]; groupPref: string };
  photo: { url: string | null; rejected: boolean };
  editing: boolean;
};

export type AdminMetricsVM = {
  members: number;
  active7: number;
  suspended: number;
  freeNow: number;
  openNow: number;
  plansPosted7: number;
  fulfilmentRate: number | null;
  fulfilmentSample: number;
  medianMinutesToFirstRequest: number | null;
  completionRate: number | null;
  completionSample: number;
  repeatRate: number | null;
  newConnections14: number;
  meetups14: number;
  reportsPer100: number | null;
  openReports: number;
  days: { key: string; label: string; posted: number; fulfilled: number }[];
  byActivity: { id: string; label: string; icon: string; count: number }[];
};

export type AdminPersonVM = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  status: string;
};

export type AdminReportVM = {
  id: string;
  category: string;
  categoryLabel: string;
  details: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  reporter: AdminPersonVM;
  reported: AdminPersonVM & { reportsAgainst: number };
  plan: { id: string; label: string; startsAt: string } | null;
};

export type AdminMemberVM = AdminPersonVM & {
  role: string;
  gender: string | null;
  year: string;
  branch: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  onboarded: boolean;
  reportsAgainst: number;
  suspendedReason: string | null;
};

export type ShareVM = {
  now: string;
  sharer: string;
  activity: ActivityVM;
  spot: SpotVM;
  startsAt: string;
  endsAt: string;
  people: string[];
  status: PlanStatusVM;
};

/* ───────────── Chat ───────────── */

export type ChatMessageVM = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhoto: PhotoVM;
  body: string;
  /** Line icon for one-tap plan updates. */
  icon: string | null;
  at: string;
  mine: boolean;
};

/** Everything a chat thread needs to render and keep itself live. */
export type ChatThreadVM = {
  conversationId: string;
  kind: "direct" | "plan";
  messages: ChatMessageVM[];
  hasEarlier: boolean;
  /** Unread messages from others when the chat was opened. */
  unreadOnOpen: number;
  canSend: boolean;
  /** Why sending is off (blocked, plan cancelled, chat closed…). */
  closedReason: string | null;
};

export type ConversationListItemVM = {
  id: string;
  kind: "direct" | "plan";
  title: string;
  subtitle: string | null;
  photo: PhotoVM | null;
  activity: ActivityVM | null;
  lastMessage: { body: string; senderName: string; mine: boolean; at: string } | null;
  unread: number;
};

export type InboxVM = { now: string; items: ConversationListItemVM[] };

export type ConversationVM = {
  now: string;
  title: string;
  subtitle: string | null;
  /** The other person's profile, or the plan. */
  href: string | null;
  photo: PhotoVM | null;
  activity: ActivityVM | null;
  members: { id: string; name: string; photo: PhotoVM }[];
  /** The other person in a direct chat (for report / block). */
  peer: { id: string; firstName: string; blockedByMe: boolean } | null;
  thread: ChatThreadVM;
};
