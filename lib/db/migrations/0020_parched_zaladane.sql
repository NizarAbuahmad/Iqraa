CREATE TABLE "email_suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owner connection only: no policy and no grant, like guardian_consents (0018). The unsubscribe link has no user,
-- and the mail senders consult the list on behalf of whoever triggered the mail.
REVOKE ALL ON "email_suppressions" FROM iqraa_app;
