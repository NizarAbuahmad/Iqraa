/**
 * What this guards: the write half of `POST /evaluations/:id/generate`.
 *
 * Generation reads the draft's questions, soft-deletes the generated ones and
 * inserts the new paper as separate statements, with the "is it still a draft"
 * check made once at the start, before a model call that can take a minute.
 * That left three ways to end with the wrong paper:
 *   - two requests for one draft (the app gives up at 45 s and the teacher taps
 *     again; the first request is still running) can both read an empty paper
 *     and both insert, so the draft holds the questions twice;
 *   - a draft published while the model was still writing had its questions
 *     replaced under the students who might already be sitting it;
 *   - an insert that failed after the old questions were soft-deleted left no
 *     paper at all, under an error that said "Nothing was changed".
 * The write is now one transaction behind a row lock on the evaluation, which
 * re-checks the status under the lock. The tests use no model (live mode is off,
 * so the mock writes the paper) and make the races deterministic with a lock the
 * test holds itself and, for the doubling, a trigger that slows the insert.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("generating into a draft evaluation, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  let bookId: string;
  let objectiveIds: string[];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await db.pool.query(`INSERT INTO level_scales (name, is_default) VALUES ('test scale', true)`);
    server = await startServer({ databaseUrl: db.url });

    // A real book and objectives from the curriculum, asked of the app itself.
    const meta = await call(server, "GET", "/evaluations/meta/evaluable", w.users.t1);
    assert.equal(meta.status, 200, meta.text);
    const book = meta.json.books.find((b: { bookId: string }) => /math/i.test(b.bookId)) ?? meta.json.books[0];
    bookId = book.bookId;
    const objectives = await call(server, "GET", `/curriculum/objectives?bookId=${encodeURIComponent(bookId)}`, w.users.t1);
    assert.equal(objectives.status, 200, objectives.text);
    objectiveIds = objectives.json.objectives.slice(0, 2).map((o: { id: string }) => o.id);
    assert.ok(objectiveIds.length > 0, "the book has objectives");
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  const makeDraft = async (): Promise<string> => {
    const r = await call(server, "POST", "/evaluations", w.users.t1, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "generate-write",
    });
    assert.equal(r.status, 201, r.text);
    return r.json.evaluation.id;
  };
  const generate = (id: string) => call(server, "POST", `/evaluations/${id}/generate`, w.users.t1);
  const live = async (id: string): Promise<string[]> =>
    (
      await db.pool.query<{ id: string }>(
        `SELECT id FROM evaluation_questions WHERE evaluation_id = $1 AND deleted_at IS NULL ORDER BY order_index`,
        [id],
      )
    ).rows.map(r => r.id);

  it("replaces a generated paper instead of adding to it (control)", async () => {
    const id = await makeDraft();
    const first = await generate(id);
    assert.equal(first.status, 200, first.text);
    const n = (await live(id)).length;
    assert.ok(n > 0, "the mock wrote a paper");
    const again = await generate(id);
    assert.equal(again.status, 200, again.text);
    assert.equal((await live(id)).length, n, "same length, not double");
  });

  it("does not double the paper when two requests for the same draft overlap", async () => {
    const id = await makeDraft();
    const [{ n: perPaper }] = (
      await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM evaluation_questions WHERE evaluation_id = $1`, [id])
    ).rows;
    assert.equal(perPaper, 0);
    // Slow the insert so the two requests' read-then-write sections overlap: both
    // would read an empty paper before either has written.
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION slow_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.6); RETURN NULL; END $$`);
    await db.pool.query(`
      CREATE TRIGGER slow_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION slow_question_insert()`);
    try {
      const [a, b] = await Promise.all([generate(id), generate(id)]);
      assert.equal(a.status, 200, a.text);
      assert.equal(b.status, 200, b.text);
    } finally {
      await db.pool.query(`DROP TRIGGER slow_question_insert ON evaluation_questions`);
    }
    // One paper's worth. The reference length comes from a lone generation.
    const lone = await makeDraft();
    assert.equal((await generate(lone)).status, 200);
    assert.equal((await live(id)).length, (await live(lone)).length, "one paper, not two");
  });

  it("does not replace the questions of a draft that was published while it was generating", async () => {
    const id = await makeDraft();
    assert.equal((await generate(id)).status, 200);
    const before = await live(id);
    assert.ok(before.length > 0);

    // Hold the evaluation row the way an in-flight publish would. A generate request
    // that has to wait for the row is, by the time it gets it, looking at a published exam.
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM evaluations WHERE id = $1 FOR UPDATE`, [id]);
      const pending = generate(id);
      await new Promise(r => setTimeout(r, 700));
      await holder.query(`UPDATE evaluations SET status = 'published' WHERE id = $1`, [id]);
      await holder.query("COMMIT");
      const res = await pending;
      assert.equal(res.status, 409, res.text);
    } finally {
      await holder.end();
    }
    assert.deepEqual(await live(id), before, "the published paper is untouched");
  });

  it("leaves the previous paper in place when the new one cannot be written", async () => {
    const id = await makeDraft();
    assert.equal((await generate(id)).status, 200);
    const before = await live(id);
    assert.ok(before.length > 0);

    await db.pool.query(`
      CREATE OR REPLACE FUNCTION refuse_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated insert failure'; END $$`);
    await db.pool.query(`
      CREATE TRIGGER refuse_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION refuse_question_insert()`);
    try {
      const res = await generate(id);
      assert.equal(res.status, 502, res.text);
      assert.equal(res.json.code, "generator_unavailable");
    } finally {
      await db.pool.query(`DROP TRIGGER refuse_question_insert ON evaluation_questions`);
    }
    assert.deepEqual(await live(id), before, "\"Nothing was changed\" is true: the same questions, still live");
  });
});
