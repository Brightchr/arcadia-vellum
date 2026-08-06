CREATE TABLE "access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"item_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "access_grants_kind_item_id_user_id_unique" UNIQUE("kind","item_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;