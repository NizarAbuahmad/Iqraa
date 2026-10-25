CREATE TABLE "game_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"game" text NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_results_unique" UNIQUE("homework_id","student_id","lesson_id","game")
);
--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_results_student_idx" ON "game_results" USING btree ("student_id");--> statement-breakpoint

-- Row-level security (0008): a new table gets no grant to iqraa_app on its own.
-- game_results is classified DEFERRED in lib/db/src/__tests__/rlsCoverage.test.ts, like
-- homework_completions: reachable by the app role, no policy yet, read and written
-- through the API's own roster checks.
GRANT SELECT, INSERT, UPDATE, DELETE ON "game_results" TO iqraa_app;
