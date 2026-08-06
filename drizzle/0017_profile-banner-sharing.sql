ALTER TABLE "playlists" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banner_image_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "show_playlists_on_profile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "show_counts_on_profile" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "searchable" boolean DEFAULT true NOT NULL;