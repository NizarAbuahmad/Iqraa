CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_submissions_unique" UNIQUE("homework_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "requires_submission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_homework_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homework"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_submissions_student_idx" ON "homework_submissions" USING btree ("student_id");
--> statement-breakpoint
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "homework_submissions" TO iqraa_app;--> statement-breakpoint
-- The teacher of a homework. SECURITY DEFINER like the other helpers (0008): `homework` is not
-- itself protected, but the helper keeps this policy independent of whatever later protects it.
CREATE OR REPLACE FUNCTION app_teaches_homework(hid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM homework WHERE id = hid AND teacher_id = app_uid()) $$;--> statement-breakpoint
-- The author (the account self-linked to the roster row) reads everything of theirs, draft or not.
-- Anyone else — the student's teacher, the homework's teacher, a guardian — sees only a handed-in row.
CREATE POLICY "homework_submissions_select" ON "homework_submissions" FOR SELECT TO iqraa_app
  USING (app_is_student_self(student_id)
         OR (submitted_at IS NOT NULL AND (app_linked_to_student(student_id) OR app_teaches_homework(homework_id))));--> statement-breakpoint
-- Only the author writes. A guardian link grants read, never write; a teacher cannot write a student's work.
-- No DELETE policy: removing the rows of an archived homework is systemDb's job (lib/homeworkSubmission.ts).
CREATE POLICY "homework_submissions_insert" ON "homework_submissions" FOR INSERT TO iqraa_app
  WITH CHECK (app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "homework_submissions_update" ON "homework_submissions" FOR UPDATE TO iqraa_app
  USING (app_is_student_self(student_id))
  WITH CHECK (app_is_student_self(student_id));
