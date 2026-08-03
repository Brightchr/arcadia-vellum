CREATE TABLE "journal_audio" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL,
	"title" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_audio" ADD CONSTRAINT "journal_audio_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;