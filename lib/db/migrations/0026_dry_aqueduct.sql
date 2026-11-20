CREATE TABLE "usage_minutes" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"area" text NOT NULL,
	"platform" text NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"last_beat_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_minutes_user_id_day_area_platform_pk" PRIMARY KEY("user_id","day","area","platform")
);
--> statement-breakpoint
ALTER TABLE "usage_minutes" ADD CONSTRAINT "usage_minutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_minutes_day_idx" ON "usage_minutes" USING btree ("day");--> statement-breakpoint
-- The app role reads and writes it like the other deferred tables (rlsCoverage.test.ts): a new table gets no grant on its own.
GRANT SELECT, INSERT, UPDATE, DELETE ON "usage_minutes" TO iqraa_app;
