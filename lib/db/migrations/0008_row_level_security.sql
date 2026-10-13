-- lib/db/migrations/0008_row_level_security.sql
-- Row-level security foundation (scope A). Hand-written: drizzle-kit does not
-- track roles, functions or policies, so `generate` stays quiet about them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iqraa_app') THEN
    CREATE ROLE iqraa_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
GRANT iqraa_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO iqraa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iqraa_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iqraa_app;--> statement-breakpoint
REVOKE ALL ON "refresh_tokens", "password_reset_tokens", "email_verification_tokens" FROM iqraa_app;--> statement-breakpoint

-- Identity, as set by the API per statement (lib/db/src/scopedPool.ts).
CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.role', true), '') $$;--> statement-breakpoint

-- Helpers read other protected tables. SECURITY DEFINER runs them as the table
-- owner, which bypasses RLS, so policies on students / roster_links /
-- class_memberships can refer to each other without "infinite recursion".
CREATE OR REPLACE FUNCTION app_teaches_student(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM students WHERE id = sid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_linked_to_student(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_teaches_student(sid)
        OR EXISTS (SELECT 1 FROM roster_links WHERE student_id = sid AND user_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_student_self(sid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM roster_links
                       WHERE student_id = sid AND user_id = app_uid() AND relation = 'self') $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_owns_class(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM class_groups WHERE id = cid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_in_class(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_class(cid)
        OR EXISTS (SELECT 1 FROM class_memberships m
                   JOIN roster_links r ON r.student_id = m.student_id
                   WHERE m.class_group_id = cid AND r.user_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_owns_thread(tid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM chat_threads t
                       WHERE t.id = tid
                         AND (t.created_by = app_uid()
                              OR (t.class_group_id IS NOT NULL AND app_owns_class(t.class_group_id)))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_in_thread(tid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_thread(tid)
        OR EXISTS (SELECT 1 FROM chat_participants WHERE thread_id = tid AND user_id = app_uid()) $$;--> statement-breakpoint
-- Either party of a direct thread may add either party (openDirectThread
-- inserts both rows, ON CONFLICT DO NOTHING — and Postgres checks an INSERT
-- policy before it detects the conflict, so a "thread owner only" rule would
-- reject the second person to open a DM). direct_key is the two user ids
-- joined by ':'.
CREATE OR REPLACE FUNCTION app_may_add_participant(tid uuid, added uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_owns_thread(tid)
        OR EXISTS (SELECT 1 FROM chat_threads t
                   WHERE t.id = tid AND t.type = 'direct' AND t.direct_key IS NOT NULL
                     AND app_uid()::text = ANY (string_to_array(t.direct_key, ':'))
                     AND added::text = ANY (string_to_array(t.direct_key, ':'))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_message(mid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = mid AND app_in_thread(m.thread_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_teaches_evaluation(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM evaluations WHERE id = eid AND teacher_id = app_uid()) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_evaluation(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_teaches_evaluation(eid)
        OR EXISTS (SELECT 1 FROM attempts a WHERE a.evaluation_id = eid AND app_linked_to_student(a.student_id))
        OR EXISTS (SELECT 1 FROM evaluation_assignments ea
                   WHERE ea.evaluation_id = eid
                     AND ((ea.student_id IS NOT NULL AND app_linked_to_student(ea.student_id))
                          OR (ea.class_group_id IS NOT NULL AND app_in_class(ea.class_group_id))))
        OR EXISTS (SELECT 1 FROM evaluations e
                   WHERE e.id = eid AND e.class_group_id IS NOT NULL AND app_in_class(e.class_group_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sees_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a
                       WHERE a.id = aid
                         AND (app_teaches_evaluation(a.evaluation_id) OR app_linked_to_student(a.student_id))) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_teaches_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a WHERE a.id = aid AND app_teaches_evaluation(a.evaluation_id)) $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_writes_attempt(aid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT EXISTS (SELECT 1 FROM attempts a
                       WHERE a.id = aid
                         AND (app_teaches_evaluation(a.evaluation_id) OR app_is_student_self(a.student_id))) $$;--> statement-breakpoint

-- ── Roster ────────────────────────────────────────────────────────────────
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "students_select" ON "students" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_linked_to_student(id));--> statement-breakpoint
CREATE POLICY "students_insert" ON "students" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "students_update" ON "students" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "students_delete" ON "students" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

ALTER TABLE "class_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_groups_select" ON "class_groups" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_in_class(id));--> statement-breakpoint
CREATE POLICY "class_groups_insert" ON "class_groups" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "class_groups_update" ON "class_groups" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "class_groups_delete" ON "class_groups" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

ALTER TABLE "class_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_memberships_select" ON "class_memberships" FOR SELECT TO iqraa_app
  USING (app_owns_class(class_group_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "class_memberships_insert" ON "class_memberships" FOR INSERT TO iqraa_app
  WITH CHECK (app_owns_class(class_group_id) AND app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "class_memberships_delete" ON "class_memberships" FOR DELETE TO iqraa_app
  USING (app_owns_class(class_group_id));--> statement-breakpoint

ALTER TABLE "roster_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "roster_links_select" ON "roster_links" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint
-- Under a user's own identity only the student's teacher may create a link. A user claiming
-- a student goes through systemDb (/auth/claim, /auth/redeem); letting any user insert a link
-- for themselves would let them link to any student id and then read it — and, as 'self',
-- write its attempts.
CREATE POLICY "roster_links_insert" ON "roster_links" FOR INSERT TO iqraa_app
  WITH CHECK (app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "roster_links_delete" ON "roster_links" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint

ALTER TABLE "parent_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "parent_contacts_all" ON "parent_contacts" FOR ALL TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint

-- ── Chat ──────────────────────────────────────────────────────────────────
-- created_by is tested on the row itself, not through app_owns_thread(): a
-- STABLE function reads the statement's snapshot, which cannot see the row an
-- INSERT ... RETURNING has just written.
ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_threads_select" ON "chat_threads" FOR SELECT TO iqraa_app
  USING (created_by = app_uid() OR app_in_thread(id));--> statement-breakpoint
CREATE POLICY "chat_threads_insert" ON "chat_threads" FOR INSERT TO iqraa_app
  WITH CHECK (created_by = app_uid()
              OR (type = 'class_group' AND class_group_id IS NOT NULL AND app_owns_class(class_group_id)));--> statement-breakpoint
CREATE POLICY "chat_threads_update" ON "chat_threads" FOR UPDATE TO iqraa_app
  USING (created_by = app_uid() OR app_owns_thread(id))
  WITH CHECK (created_by = app_uid() OR app_owns_thread(id));--> statement-breakpoint
CREATE POLICY "chat_threads_delete" ON "chat_threads" FOR DELETE TO iqraa_app
  USING (created_by = app_uid() OR app_owns_thread(id));--> statement-breakpoint

ALTER TABLE "chat_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_participants_select" ON "chat_participants" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_participants_insert" ON "chat_participants" FOR INSERT TO iqraa_app
  WITH CHECK (app_may_add_participant(thread_id, user_id));--> statement-breakpoint
CREATE POLICY "chat_participants_update" ON "chat_participants" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_participants_delete" ON "chat_participants" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_messages_select" ON "chat_messages" FOR SELECT TO iqraa_app
  USING (app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_insert" ON "chat_messages" FOR INSERT TO iqraa_app
  WITH CHECK (sender_id = app_uid() AND app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_update" ON "chat_messages" FOR UPDATE TO iqraa_app
  USING (sender_id = app_uid() OR app_owns_thread(thread_id))
  WITH CHECK (sender_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_messages_delete" ON "chat_messages" FOR DELETE TO iqraa_app
  USING (sender_id = app_uid() OR app_owns_thread(thread_id));--> statement-breakpoint

ALTER TABLE "chat_message_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_message_reads_select" ON "chat_message_reads" FOR SELECT TO iqraa_app
  USING (app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reads_insert" ON "chat_message_reads" FOR INSERT TO iqraa_app
  WITH CHECK (user_id = app_uid() AND app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reads_update" ON "chat_message_reads" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_message_reads_delete" ON "chat_message_reads" FOR DELETE TO iqraa_app
  USING (user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_message_reactions_select" ON "chat_message_reactions" FOR SELECT TO iqraa_app
  USING (app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reactions_insert" ON "chat_message_reactions" FOR INSERT TO iqraa_app
  WITH CHECK (user_id = app_uid() AND app_sees_message(message_id));--> statement-breakpoint
CREATE POLICY "chat_message_reactions_update" ON "chat_message_reactions" FOR UPDATE TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint
CREATE POLICY "chat_message_reactions_delete" ON "chat_message_reactions" FOR DELETE TO iqraa_app
  USING (user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_blocks_all" ON "chat_blocks" FOR ALL TO iqraa_app
  USING (blocker_user_id = app_uid()) WITH CHECK (blocker_user_id = app_uid());--> statement-breakpoint

ALTER TABLE "chat_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_reports_select" ON "chat_reports" FOR SELECT TO iqraa_app
  USING (reporter_user_id = app_uid() OR app_role() IN ('school_admin', 'system_admin'));--> statement-breakpoint
CREATE POLICY "chat_reports_insert" ON "chat_reports" FOR INSERT TO iqraa_app
  WITH CHECK (reporter_user_id = app_uid() AND app_in_thread(thread_id));--> statement-breakpoint
CREATE POLICY "chat_reports_update" ON "chat_reports" FOR UPDATE TO iqraa_app
  USING (app_role() IN ('school_admin', 'system_admin'))
  WITH CHECK (app_role() IN ('school_admin', 'system_admin'));--> statement-breakpoint

ALTER TABLE "device_push_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "device_push_tokens_all" ON "device_push_tokens" FOR ALL TO iqraa_app
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());--> statement-breakpoint

-- ── Evaluations and attempts ──────────────────────────────────────────────
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluations_select" ON "evaluations" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_sees_evaluation(id));--> statement-breakpoint
CREATE POLICY "evaluations_insert" ON "evaluations" FOR INSERT TO iqraa_app
  WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "evaluations_update" ON "evaluations" FOR UPDATE TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint
CREATE POLICY "evaluations_delete" ON "evaluations" FOR DELETE TO iqraa_app
  USING (teacher_id = app_uid());--> statement-breakpoint

-- Questions carry the answer key: teacher-only. Students read their paper from
-- attempts.question_snapshot.
ALTER TABLE "evaluation_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluation_questions_all" ON "evaluation_questions" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)) WITH CHECK (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "evaluation_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evaluation_assignments_select" ON "evaluation_assignments" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)
         OR (student_id IS NOT NULL AND app_linked_to_student(student_id))
         OR (class_group_id IS NOT NULL AND app_in_class(class_group_id)));--> statement-breakpoint
CREATE POLICY "evaluation_assignments_write" ON "evaluation_assignments" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id)) WITH CHECK (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempts_select" ON "attempts" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "attempts_insert" ON "attempts" FOR INSERT TO iqraa_app
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "attempts_update" ON "attempts" FOR UPDATE TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id))
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint
CREATE POLICY "attempts_delete" ON "attempts" FOR DELETE TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id));--> statement-breakpoint

ALTER TABLE "attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_answers_select" ON "attempt_answers" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_answers_write" ON "attempt_answers" FOR ALL TO iqraa_app
  USING (app_writes_attempt(attempt_id)) WITH CHECK (app_writes_attempt(attempt_id));--> statement-breakpoint

-- Grades are written by the teacher, or by server-side grading (systemDb).
ALTER TABLE "attempt_question_grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_question_grades_select" ON "attempt_question_grades" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_question_grades_write" ON "attempt_question_grades" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "attempt_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_results_select" ON "attempt_results" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "attempt_results_write" ON "attempt_results" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "recommendations_select" ON "recommendations" FOR SELECT TO iqraa_app
  USING (app_sees_attempt(attempt_id));--> statement-breakpoint
CREATE POLICY "recommendations_write" ON "recommendations" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "grade_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grade_overrides_all" ON "grade_overrides" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "grading_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grading_jobs_all" ON "grading_jobs" FOR ALL TO iqraa_app
  USING (app_teaches_attempt(attempt_id)) WITH CHECK (app_teaches_attempt(attempt_id));--> statement-breakpoint

ALTER TABLE "attempt_retakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "attempt_retakes_select" ON "attempt_retakes" FOR SELECT TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "attempt_retakes_write" ON "attempt_retakes" FOR ALL TO iqraa_app
  USING (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id))
  WITH CHECK (app_teaches_evaluation(evaluation_id) OR app_is_student_self(student_id));--> statement-breakpoint

ALTER TABLE "mastery_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mastery_overrides_select" ON "mastery_overrides" FOR SELECT TO iqraa_app
  USING (teacher_id = app_uid() OR app_linked_to_student(student_id));--> statement-breakpoint
CREATE POLICY "mastery_overrides_write" ON "mastery_overrides" FOR ALL TO iqraa_app
  USING (teacher_id = app_uid()) WITH CHECK (teacher_id = app_uid());--> statement-breakpoint

-- ── Auth tokens: no policy, and no grant above — systemDb only. ───────────
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
