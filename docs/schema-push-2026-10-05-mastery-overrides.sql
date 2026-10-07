-- Schema push for the mastery-gate teacher unlock: one row per (student, lesson)
-- a teacher has let through.
--
-- Run in the Neon SQL editor against PRODUCTION, BEFORE merging the override PR
-- (and alongside 2026-10-04-attempt-retakes.sql, which it is stacked on).
-- `pnpm --filter @workspace/db run push` reads the repo-root .env, which points
-- at the dev database. Additive only — the running API does not notice a new
-- table; until it exists the unlock routes answer 503 and no unlock is counted.

CREATE TABLE IF NOT EXISTS mastery_overrides (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  lesson_id  text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mastery_overrides_student_lesson_unique UNIQUE (student_id, lesson_id)
);

-- Confirm: one table with five columns, and its unique constraint.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mastery_overrides'
ORDER BY ordinal_position;

SELECT conname FROM pg_constraint WHERE conrelid = 'mastery_overrides'::regclass;
