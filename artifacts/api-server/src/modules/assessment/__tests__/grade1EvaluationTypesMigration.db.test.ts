/**
 * Migration 0025 narrows the stored types of older Grade 1 draft evaluations to
 * the ones a six-year-old can answer, and touches nothing else.
 *
 * The test database is migrated (0025 included) while empty, so the rows are
 * inserted afterwards and the migration's SQL is run on them again, as it runs
 * on production's rows. Foreign keys are off for the insert (superuser
 * `session_replication_role`), since only `evaluations` matters here.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeDb } from "../../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../../test-support/testDb.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(path.resolve(here, "../../../../../../lib/db/migrations/0025_grade1_evaluation_types.sql"), "utf8");
const TEACHER = "00000000-0000-0000-0000-000000000001";

const ROWS: Array<[string, string, string, string[]]> = [
  ["g1 draft mixed", "grade-1", "draft", ["short_answer", "multiple_choice", "open_ended", "fill_blank"]],
  ["g1 draft written only", "grade-1", "draft", ["short_answer", "problem_solving"]],
  ["g1 draft already allowed", "grade-1", "draft", ["matching", "true_false"]],
  ["g1 published", "grade-1", "published", ["multiple_choice", "short_answer"]],
  ["g1 closed", "grade-1", "closed", ["open_ended"]],
  ["g2 draft", "grade-2", "draft", ["multiple_choice", "short_answer"]],
];

describeDb("migration 0025: Grade 1 evaluation types", () => {
  let db: TestDb;
  before(async () => {
    db = await setupTestDb();
    const c = await db.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL session_replication_role = replica");
      for (const [title, grade, status, types] of ROWS) {
        await c.query(
          `INSERT INTO evaluations (teacher_id, grade_id, subject_id, book_id, title, status, assessment_types)
           VALUES ($1, $2, 'mathematics', 'b', $3, $4, $5::jsonb)`,
          [TEACHER, grade, title, status, JSON.stringify(types)],
        );
      }
      await c.query("COMMIT");
    } finally {
      c.release();
    }
  });
  after(async () => { await db?.drop(); });

  it("narrows Grade 1 drafts in order, gives an all-written draft choice and true/false, and leaves the rest", async () => {
    await db.pool.query(SQL);
    const { rows } = await db.pool.query<{ title: string; assessment_types: string[] }>("SELECT title, assessment_types FROM evaluations");
    const got = Object.fromEntries(rows.map(r => [r.title, r.assessment_types]));
    assert.deepEqual(got, {
      "g1 draft mixed": ["multiple_choice", "fill_blank"],
      "g1 draft written only": ["multiple_choice", "true_false"],
      "g1 draft already allowed": ["matching", "true_false"],
      "g1 published": ["multiple_choice", "short_answer"],
      "g1 closed": ["open_ended"],
      "g2 draft": ["multiple_choice", "short_answer"],
    });
    const again = await db.pool.query(SQL);
    assert.equal(again.rowCount, 0, "running it again changes nothing");
  });
});
