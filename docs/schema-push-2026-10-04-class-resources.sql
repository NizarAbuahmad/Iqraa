-- Class resources (piece 1: Library items on a class's Resources tab).
-- Additive only: one new table and two indexes; nothing existing is touched.
--
-- Run in the Neon SQL console against PRODUCTION, BEFORE merging the PR that
-- adds it. Until it exists the new endpoints answer 503 on write and an empty
-- list on read, so an early deploy cannot break the class screen — but nothing
-- can be added. Then confirm with
--   pnpm --filter @workspace/db run verify-schema
-- and put `schema-push: done` at the start of a line in the PR description.
CREATE TABLE IF NOT EXISTS class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  library_source text,
  library_native_id text,
  title text NOT NULL,
  media_kind text NOT NULL,
  url text,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_resources_class_idx
  ON class_resources (class_group_id);

-- One Library item per class. Partial: a pasted link or a file (later pieces)
-- has no library source and must not collide on the NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS class_resources_library_unique
  ON class_resources (class_group_id, library_source, library_native_id)
  WHERE kind = 'library';
