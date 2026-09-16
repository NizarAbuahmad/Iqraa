-- Schema push for the refresh-token families and share-code expiry change.
--
-- Run this against PRODUCTION in the Neon SQL editor BEFORE merging the PR that
-- adds it. `pnpm --filter @workspace/db run push` reads the repo-root .env,
-- which points at the dev database, so it will not reach production — and
-- `drizzle-kit push` resolves drift by dropping columns, which is why this repo
-- keeps the production push manual and out of the build.
--
-- Order matters, and this way round is the safe one. Every column here is
-- additive: one nullable, one with a default. The API currently running selects
-- an explicit column list generated from its own copy of the schema, so it
-- neither sees nor touches these until the new build is serving. Adding them
-- first therefore changes nothing; merging first would leave the new build
-- querying columns that do not exist yet.

-- ── 1. Refresh-token families ────────────────────────────────────────────────
--
-- `family_id` groups one sign-in's whole chain of rotated tokens, so a replayed
-- token can be answered by ending the chain rather than by a 401 that looks
-- exactly like an expired one. The default is volatile, so Postgres evaluates it
-- per row and every token alive today becomes its own family — which is the
-- correct reading of a row whose history nobody recorded.
--
-- `rotated_at` marks a token as spent. Rows are kept past rotation instead of
-- deleted; that is the whole detection mechanism, and a deleted row cannot
-- report having been used twice.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rotated_at timestamptz;

-- ── 2. Share-code expiry ─────────────────────────────────────────────────────
--
-- Nullable, and the API reads null as "never expires". That is deliberate: every
-- exam published before this column existed keeps working exactly as it did, so
-- deploying this cannot shut a sitting that is happening right now.
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS share_code_expires_at timestamptz;

-- ── 3. Backfill (optional, and a decision about live classrooms) ─────────────
--
-- Until this runs, every exam published before today keeps a link that never
-- expires — which is the finding the column exists to close, still open for
-- existing rows.
--
-- `now() + 7 days`, NOT the original publish date: dating it from publish would
-- retroactively close links teachers are using this week, with no warning and no
-- way to tell them. This gives every existing exam one more normal week and then
-- behaves like everything else.
--
-- Run it once, after step 2.
UPDATE evaluations
SET share_code_expires_at = now() + interval '7 days'
WHERE status = 'published'
  AND share_code IS NOT NULL
  AND share_code_expires_at IS NULL;

-- ── 4. Confirm ───────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name = 'refresh_tokens' AND column_name IN ('family_id', 'rotated_at'))
   OR (table_name = 'evaluations' AND column_name = 'share_code_expires_at')
ORDER BY table_name, column_name;
