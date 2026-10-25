CREATE TABLE "math_practice_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"practiced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "math_practice_results_unique" UNIQUE("student_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "math_practice_results" ADD CONSTRAINT "math_practice_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "math_practice_results_student_idx" ON "math_practice_results" USING btree ("student_id");
-- Row-level security (0008): a new table gets no grant to iqraa_app on its own.
-- math_practice_results is classified DEFERRED in lib/db/src/__tests__/rlsCoverage.test.ts, like
-- game_results: reachable by the app role, no policy yet, read and written
-- through the API's own roster checks.
GRANT SELECT, INSERT, UPDATE, DELETE ON "math_practice_results" TO iqraa_app;
