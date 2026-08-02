ALTER TABLE "journals" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "journals" ADD COLUMN "author" text;--> statement-breakpoint
UPDATE "journals" SET "author" = "character_name" WHERE "character_name" IS NOT NULL;