CREATE TABLE "roster_link_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_link_requests_unique" UNIQUE("student_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "roster_link_requests" ADD CONSTRAINT "roster_link_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_link_requests" ADD CONSTRAINT "roster_link_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_link_requests_student_idx" ON "roster_link_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "roster_link_requests_user_idx" ON "roster_link_requests" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "roster_link_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "roster_link_requests" TO iqraa_app;--> statement-breakpoint
-- Readable and deletable by the account that asked and by the student's teacher. No INSERT or
-- UPDATE policy: under a user's identity nobody may create a request (a claim is made on the
-- owner connection, routes/auth.ts), which is the same rule roster_links_insert states.
CREATE POLICY "roster_link_requests_select" ON "roster_link_requests" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "roster_link_requests_delete" ON "roster_link_requests" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));