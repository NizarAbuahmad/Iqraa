-- Schema push for per-school bell schedules in جدول الحصص.
--
-- Run in the Neon SQL editor against PRODUCTION. `pnpm --filter @workspace/db
-- run push` reads the repo-root .env, which points at the dev database.
--
-- Two steps, at two different times, because the API that is live right now
-- upserts with `ON CONFLICT (teacher_id, period_number)` and Postgres needs a
-- unique index matching that exact column list:
--
--   STEP 1 — before merging. Additive only; the running API does not notice.
--   STEP 2 — after the new API revision is serving. Until then a teacher's
--            second school cannot reuse a period number the first one has
--            (the old two-column index still refuses it), which is the only
--            thing that is broken in between.

-- ── STEP 1 ───────────────────────────────────────────────────────────────────
--
-- "" is the unnamed default school, so every existing row keeps meaning exactly
-- what it meant: that teacher's one school.
ALTER TABLE schedule_periods ADD COLUMN IF NOT EXISTS school_name text NOT NULL DEFAULT '';
ALTER TABLE schedule_slots   ADD COLUMN IF NOT EXISTS school_name text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS schedule_periods_teacher_school_period_idx
  ON schedule_periods (teacher_id, school_name, period_number);
CREATE UNIQUE INDEX IF NOT EXISTS schedule_slots_teacher_school_day_period_idx
  ON schedule_slots (teacher_id, school_name, day_of_week, period_number);

-- Confirm: two new columns, and four unique indexes (old + new) on the two tables.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('schedule_periods', 'schedule_slots') AND column_name = 'school_name';

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('schedule_periods', 'schedule_slots')
ORDER BY tablename, indexname;

-- ── STEP 2 — only once the new API is live ───────────────────────────────────
--
-- The table was created by hand on 2026-09-21, so check the old index names in
-- the pg_indexes output above before running these; they are the two unique
-- indexes WITHOUT school_name in their definition.
--
-- DROP INDEX IF EXISTS schedule_periods_teacher_period_idx;
-- DROP INDEX IF EXISTS schedule_slots_teacher_day_period_idx;
