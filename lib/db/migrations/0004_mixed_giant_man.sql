DROP INDEX "chat_message_reactions_message_idx";--> statement-breakpoint
CREATE INDEX "chat_message_reactions_user_idx" ON "chat_message_reactions" USING btree ("user_id");