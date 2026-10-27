ALTER TABLE "site_signups" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_signups" ADD COLUMN "last_messaged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_signups" ADD COLUMN "unsubscribed_at" timestamp with time zone;