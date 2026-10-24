CREATE TABLE "guardian_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_email" text NOT NULL,
	"token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision" text,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "guardian_consents_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guardian_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardian_consents_user_idx" ON "guardian_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guardian_consents_parent_idx" ON "guardian_consents" USING btree ("parent_email","created_at");--> statement-breakpoint
ALTER TABLE "guardian_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owner connection only: no policy and no grant, like the token tables (0008). The parent has no account,
-- so the public route and the sign-up code read and write this table on systemDb.
REVOKE ALL ON "guardian_consents" FROM iqraa_app;
