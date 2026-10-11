CREATE TABLE "identity_flows" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_hash" text NOT NULL,
	"verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"provider" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_full_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_flows" ADD CONSTRAINT "identity_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_flows_expiry_idx" ON "identity_flows" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_limits_expiry_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_identity_idx" ON "users" USING btree ("identity_provider","identity_subject");