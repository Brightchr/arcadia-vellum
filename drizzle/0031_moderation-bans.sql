CREATE TABLE "ip_bans" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"reason" text NOT NULL,
	"target_user_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "ip_bans_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "banned_at" timestamp;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_until" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "ip_bans" ADD CONSTRAINT "ip_bans_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_bans" ADD CONSTRAINT "ip_bans_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;