/**
 * Database schema (Model layer). One table per domain entity.
 *
 * Two state machines live here:
 *   plans.status           open → full → completed | cancelled | expired
 *   participations.status  requested → accepted | declined | withdrawn | expired
 *                          accepted  → cancelled (early | late | safety | plan_cancelled | removed)
 * Attendance is not a status: it is derived from check-ins, self reports and
 * peer feedback (see models/rules/reliability.ts).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const emptyTextArray = sql`'{}'::text[]`;

export const roleEnum = pgEnum("role", ["member", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const genderEnum = pgEnum("gender", ["woman", "man", "nonbinary"]);
export const groupPrefEnum = pgEnum("group_pref", ["both", "one_on_one", "group"]);
export const vibeEnum = pgEnum("vibe", ["quiet", "activity", "social"]);
export const planStatusEnum = pgEnum("plan_status", [
  "open",
  "full",
  "cancelled",
  "completed",
  "expired",
]);
export const participantRoleEnum = pgEnum("participant_role", ["host", "guest"]);
export const participationStatusEnum = pgEnum("participation_status", [
  "requested",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
  "cancelled",
]);
export const cancelKindEnum = pgEnum("cancel_kind", [
  "early",
  "late",
  "safety",
  "plan_cancelled",
  "removed",
]);
export const selfReportEnum = pgEnum("self_report", ["attended", "missed"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "join_request",
  "request_accepted",
  "request_declined",
  "request_expired",
  "plan_cancelled",
  "guest_cancelled",
  "plan_reminder",
  "feedback_prompt",
  "free_match",
  "message",
  "checked_in",
  "plan_expired",
  "photo_rejected",
  "account_notice",
]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const conversationKindEnum = pgEnum("conversation_kind", ["direct", "plan"]);
/** Who may start a new direct chat with a member. Plan group chats are unaffected. */
export const chatPolicyEnum = pgEnum("chat_policy", ["anyone", "met", "nobody"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    role: roleEnum("role").notNull().default("member"),
    status: userStatusEnum("status").notNull().default("active"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    verifiedFullName: text("verified_full_name"),
    identityProvider: text("identity_provider"),
    identitySubject: text("identity_subject"),
    identityVerifiedAt: ts("identity_verified_at"),
    /** Locked once onboarding is complete; changes go through an admin. */
    gender: genderEnum("gender"),
    year: text("year"),
    branch: text("branch"),
    bio: text("bio"),
    interests: text("interests").array().notNull().default(emptyTextArray),
    /** Private: which genders this person is comfortable meeting. Never shown to others. */
    companionGenders: text("companion_genders").array().notNull().default(emptyTextArray),
    groupPref: groupPrefEnum("group_pref").notNull().default("both"),
    vibe: vibeEnum("vibe"),
    chatPolicy: chatPolicyEnum("chat_policy").notNull().default("anyone"),
    /** scrypt hash; null for members who only sign in with email codes. */
    passwordHash: text("password_hash"),
    passwordUpdatedAt: ts("password_updated_at"),
    /** Consecutive wrong passwords; reaching the limit locks password sign-in for a while. */
    failedLogins: smallint("failed_logins").notNull().default(0),
    lockedUntil: ts("locked_until"),
    ratingRestrictedUntil: ts("rating_restricted_until"),
    /** Incident IDs already assessed: an expired pause must not renew for the same history. */
    ratingReviewedPenalties: text("rating_reviewed_penalties").array().notNull().default(emptyTextArray),
    /** Set while a photo is stored; also its cache-busting version. */
    photoUpdatedAt: ts("photo_updated_at"),
    photoRejectedAt: ts("photo_rejected_at"),
    isAdult: boolean("is_adult").notNull().default(false),
    guidelinesAcceptedAt: ts("guidelines_accepted_at"),
    onboardedAt: ts("onboarded_at"),
    suspendedReason: text("suspended_reason"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [index("users_status_idx").on(t.status), uniqueIndex("users_identity_idx").on(t.identityProvider, t.identitySubject)],
);

/** Shared, hashed rate-limit keys work across serverless instances. */
export const rateLimits = pgTable("rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  count: integer("count").notNull(),
  resetAt: ts("reset_at").notNull(),
}, (t) => [index("rate_limits_expiry_idx").on(t.resetAt)]);

/** Short-lived sign-in transactions, bound to a browser or existing session. */
export const identityFlows = pgTable("identity_flows", {
  stateHash: text("state_hash").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash").notNull(),
  verifier: text("verifier").notNull(),
  nonce: text("nonce").notNull(),
  provider: text("provider").notNull(),
  expiresAt: ts("expires_at").notNull(),
}, (t) => [index("identity_flows_expiry_idx").on(t.expiresAt)]);

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

/** Profile photos (WebP, ~640×640, metadata stripped) — stored in the database so any host works. */
export const photos = pgTable("photos", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull().default("image/webp"),
  bytes: integer("bytes").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** sha256 of the cookie token — the raw token never touches the database. */
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastUsedAt: ts("last_used_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    /**
     * Account creation and password resets: the chosen password (hashed) waits on the
     * code until the inbox owner enters it, and only applies in the browser that chose it
     * (`flow_hash` = hash of a cookie set there).
     */
    passwordHash: text("password_hash"),
    flowHash: text("flow_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_codes_email_idx").on(t.email, t.createdAt)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activity: text("activity").notNull(),
    spot: text("spot").notNull(),
    note: text("note"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    /** Companions wanted, excluding the host. */
    capacity: smallint("capacity").notNull(),
    /** Hard filter: who may ask to join. */
    allowedGenders: text("allowed_genders").array().notNull(),
    status: planStatusEnum("status").notNull().default("open"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    removedByAdmin: boolean("removed_by_admin").notNull().default(false),
    reminderSentAt: ts("reminder_sent_at"),
    completedAt: ts("completed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("plans_status_starts_idx").on(t.status, t.startsAt),
    index("plans_host_idx").on(t.hostId, t.startsAt),
  ],
);

export const participations = pgTable(
  "participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: participantRoleEnum("role").notNull(),
    status: participationStatusEnum("status").notNull(),
    note: text("note"),
    requestedAt: ts("requested_at").notNull().defaultNow(),
    decidedAt: ts("decided_at"),
    cancelledAt: ts("cancelled_at"),
    cancelKind: cancelKindEnum("cancel_kind"),
    cancelReason: text("cancel_reason"),
    checkedInAt: ts("checked_in_at"),
    selfReport: selfReportEnum("self_report"),
    feedbackAt: ts("feedback_at"),
  },
  (t) => [
    uniqueIndex("participations_plan_user_uq").on(t.planId, t.userId),
    index("participations_user_status_idx").on(t.userId, t.status),
    index("participations_plan_status_idx").on(t.planId, t.status),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rateeId: uuid("ratee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    showedUp: boolean("showed_up").notNull(),
    wouldMeetAgain: boolean("would_meet_again"),
    flags: text("flags").array().notNull().default(emptyTextArray),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feedback_plan_rater_ratee_uq").on(t.planId, t.raterId, t.rateeId),
    index("feedback_ratee_idx").on(t.rateeId),
  ],
);

/** "I'm free": one row per member while they are open to spontaneous plans. */
export const availability = pgTable("availability", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Activity ids the member is up for; empty means "anything". */
  activities: text("activities").array().notNull().default(emptyTextArray),
  until: ts("until").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, string | number | boolean | null>>(),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
);

/**
 * Chats. A conversation is either a direct chat between two members
 * (`direct_key` = "<smaller id>:<larger id>", so each pair has exactly one) or the
 * group chat of a plan (one per plan; members are the host and accepted guests).
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: conversationKindEnum("kind").notNull(),
    planId: uuid("plan_id")
      .unique()
      .references(() => plans.id, { onDelete: "cascade" }),
    directKey: text("direct_key").unique(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastMessageAt: ts("last_message_at"),
  },
  (t) => [index("conversations_created_by_idx").on(t.createdBy, t.createdAt)],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
    /** Everything after this is unread for the member. */
    lastReadAt: ts("last_read_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_members_user_idx").on(t.userId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Line icon for one-tap plan updates ("On my way"); null for typed messages. */
    icon: text("icon"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: uuid("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    category: text("category").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_reported_idx").on(t.reportedId),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

/** A read-only link a member can send to a trusted contact for one meetup. */
export const shareLinks = pgTable(
  "share_links",
  {
    token: text("token").primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("share_links_plan_user_idx").on(t.planId, t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type ParticipationRow = typeof participations.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type ChatPolicy = (typeof chatPolicyEnum.enumValues)[number];
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
export type PlanStatus = (typeof planStatusEnum.enumValues)[number];
export type ParticipationStatus = (typeof participationStatusEnum.enumValues)[number];
export type CancelKind = (typeof cancelKindEnum.enumValues)[number];
