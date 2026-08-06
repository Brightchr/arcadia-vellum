CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"kind" text NOT NULL,
	"item_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"expires_at" timestamp,
	"open_count" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "share_links" ("id", "token", "kind", "item_id", "owner_id", "label", "created_at")
SELECT md5('sl' || j."id" || clock_timestamp()::text),
       md5(random()::text || j."id") || md5(random()::text || clock_timestamp()::text),
       'journal', j."id", j."owner_id", 'Original link', now()
FROM "journals" j WHERE j."listed" = false;