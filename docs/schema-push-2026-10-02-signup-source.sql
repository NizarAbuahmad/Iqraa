-- Where an account was created (admin dashboard "joined via"). Additive only.
-- Run in the Neon SQL console before merging, then verify-schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_platform text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_referrer text;
