ALTER TABLE "homework_submissions" ADD COLUMN "author_user_id" uuid;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_submissions_author_idx" ON "homework_submissions" USING btree ("author_user_id");--> statement-breakpoint
-- Backfill: a row written before this column existed belongs to the account self-linked to its roster row, when
-- exactly one is. Otherwise it stays NULL (author unknown): nobody can change it, and a draft is replaced by the
-- next account that writes. A row whose record changed hands before this ran is credited to the account linked
-- now; production's table is empty when this ships (no screen could make a homework ask for a project).
UPDATE "homework_submissions" s
   SET "author_user_id" = l.user_id
  FROM (SELECT student_id, (array_agg(user_id))[1] AS user_id
          FROM roster_links
         WHERE relation = 'self'
         GROUP BY student_id
        HAVING count(*) = 1) l
 WHERE s.student_id = l.student_id
   AND s.author_user_id IS NULL;--> statement-breakpoint
-- Row-level security follows the author, not only the link (policies from 0021, altered in place, so nothing is
-- removed and recreated). A student reads their own rows; anyone linked to the record (the student's teacher, a
-- guardian, and the account linked now) or the homework's teacher reads a HANDED-IN row whoever wrote it. A
-- student writes only a row they authored, on a record they are self-linked to. Taking over another account's
-- draft changes the author, which these policies refuse on purpose: lib/homeworkSubmission.ts does it on the owner
-- connection in one guarded statement that also empties the draft.
ALTER POLICY "homework_submissions_select" ON "homework_submissions"
  USING ((app_is_student_self(student_id) AND author_user_id = app_uid())
         OR (submitted_at IS NOT NULL AND (app_linked_to_student(student_id) OR app_teaches_homework(homework_id))));--> statement-breakpoint
ALTER POLICY "homework_submissions_insert" ON "homework_submissions"
  WITH CHECK (app_is_student_self(student_id) AND author_user_id = app_uid());--> statement-breakpoint
ALTER POLICY "homework_submissions_update" ON "homework_submissions"
  USING (app_is_student_self(student_id) AND author_user_id = app_uid())
  WITH CHECK (app_is_student_self(student_id) AND author_user_id = app_uid());
