-- Admin dashboard v2 (manual_metrics, site_signups, ai_generations.duration_ms).
-- Additive only. Run in the Neon SQL console BEFORE merging the PR, then
-- `pnpm --filter @workspace/db run verify-schema`.
CREATE TABLE IF NOT EXISTS manual_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value integer NOT NULL,
  recorded_on date NOT NULL,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_metrics_key_day_unique UNIQUE (key, recorded_on)
);

CREATE TABLE IF NOT EXISTS site_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_signups_created_at_idx ON site_signups (created_at);

ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS duration_ms integer;
