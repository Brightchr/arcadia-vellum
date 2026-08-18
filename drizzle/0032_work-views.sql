CREATE TABLE "work_views" (
	"journal_id" text NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "work_views_journal_id_day_pk" PRIMARY KEY("journal_id","day")
);
--> statement-breakpoint
ALTER TABLE "work_views" ADD CONSTRAINT "work_views_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;