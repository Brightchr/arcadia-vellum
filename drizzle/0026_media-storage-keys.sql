ALTER TABLE "journal_audio" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_images" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_images" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_audio" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "journal_images" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "profile_images" ADD COLUMN "storage_key" text;