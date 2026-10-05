-- Schema push for the mastery-gate retake: one row per discarded failed sitting.
--
-- Run in the Neon SQL editor against PRODUCTION, BEFORE merging the retake PR.
-- `pnpm --filter @workspace/db run push` reads the repo-root .env, which points
-- at the dev database. Additive only — the running API does not notice a new
-- table, and the retake route answers 503 until it exists.

CREATE TABLE IF NOT EXISTS attempt_retakes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES evaluations (id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students (id)    ON DELETE CASCADE,
  failed_percent numeric(5, 2) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attempt_retakes_eval_student_idx
  ON attempt_retakes (evaluation_id, student_id);

-- Confirm: one table with five columns, and its index.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attempt_retakes'
ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes WHERE tablename = 'attempt_retakes';
