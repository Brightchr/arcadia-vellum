ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_at" timestamp;--> statement-breakpoint
UPDATE "user" SET "role" = 'admin' WHERE lower("username") = 'caboose';