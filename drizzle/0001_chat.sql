CREATE TYPE "public"."chat_policy" AS ENUM('anyone', 'met', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."conversation_kind" AS ENUM('direct', 'plan');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"plan_id" uuid,
	"direct_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	CONSTRAINT "conversations_plan_id_unique" UNIQUE("plan_id"),
	CONSTRAINT "conversations_direct_key_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "chat_policy" "chat_policy" DEFAULT 'anyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_created_by_idx" ON "conversations" USING btree ("created_by","created_at");--> statement-breakpoint
-- Carry the existing one-tap meetup updates over into each plan's new group chat.
INSERT INTO "conversations" ("kind", "plan_id", "created_at", "last_message_at")
SELECT 'plan', "plan_id", min("created_at"), max("created_at") FROM "messages" GROUP BY "plan_id";--> statement-breakpoint
INSERT INTO "conversation_members" ("conversation_id", "user_id", "joined_at", "last_read_at")
SELECT c."id", pa."user_id", c."created_at", now()
FROM "conversations" c
JOIN "plans" pl ON pl."id" = c."plan_id"
JOIN "participations" pa ON pa."plan_id" = c."plan_id"
WHERE c."kind" = 'plan'
  AND (
    pa."status" = 'accepted'
    OR (pl."status" = 'cancelled' AND pa."status" = 'cancelled' AND (pa."role" = 'host' OR pa."cancel_kind" = 'plan_cancelled'))
  )
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "chat_messages" ("conversation_id", "sender_id", "body", "icon", "created_at")
SELECT
  c."id",
  m."sender_id",
  CASE m."preset"
    WHEN 'on_my_way' THEN 'On my way'
    WHEN 'here' THEN 'I''m here'
    WHEN 'late_5' THEN 'Running about 5 min late'
    WHEN 'late_15' THEN 'Running about 15 min late'
    WHEN 'wearing' THEN 'I''m wearing'
    WHEN 'thanks' THEN 'Thanks, that was fun'
    ELSE 'Update'
  END || coalesce(' ' || m."detail", ''),
  CASE m."preset"
    WHEN 'on_my_way' THEN 'footprints'
    WHEN 'here' THEN 'map-pin-check'
    WHEN 'late_5' THEN 'timer'
    WHEN 'late_15' THEN 'hourglass'
    WHEN 'wearing' THEN 'shirt'
    WHEN 'thanks' THEN 'sparkles'
  END,
  m."created_at"
FROM "messages" m
JOIN "conversations" c ON c."plan_id" = m."plan_id";
