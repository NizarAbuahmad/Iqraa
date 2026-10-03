-- Terms-of-use / privacy acceptance on each new account. Additive only.
-- Run in the Neon SQL console BEFORE merging the PR that adds it: both
-- sign-up routes write these columns, so without them every new account
-- fails to insert. Then confirm with `pnpm --filter @workspace/db run verify-schema`.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT '';
