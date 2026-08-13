CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "friendships_addressee_id_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "group_channels_group_id_idx" ON "group_channels" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_messages_channel_created_idx" ON "group_messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_audio_journal_id_idx" ON "journal_audio" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "journal_images_journal_id_idx" ON "journal_images" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "journal_tags_tag_id_idx" ON "journal_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "journals_owner_id_idx" ON "journals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "journals_series_id_idx" ON "journals" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "reviews_item_id_idx" ON "reviews" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "saved_items_item_id_idx" ON "saved_items" USING btree ("item_id");