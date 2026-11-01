/**
 * What this guards: the routes that edit a draft's questions one at a time
 * (`POST /evaluations/:id/questions`, `PATCH` and `DELETE …/questions/:qid`) and
 * the paper-grid save (`PUT /evaluations/:id/questions/paper`) hold the
 * evaluation row while they check "is it still a draft" and write.
 *
 * They used to check the status once, from a read made at the top, and then write
 * with no lock and recompute the total as a separate statement. That left:
 *   - an edit that lands after a publish: a question added to, changed in or
 *     removed from an exam students are already sitting, under a total publish
 *     had fixed (publish locks the row and reads the questions under that lock,
 *     so a write it did not wait for is simply outside what it checked);
 *   - two adds for one draft both reading the same highest `order_index`, so two
 *     questions share a position;
 *   - the paper grid saved twice at once (a retry after the app's timeout), each
 *     soft-deleting before the other had inserted, so the paper holds the grid
 *     twice;
 *   - a total recomputed outside the write, so the last of two overlapping edits
 *     could store the other's stale sum.
 * The tests use no model (live mode is off, so the mock writes the first paper)
 * and make the races deterministic with a lock the test holds itself and, for the
 * overlaps, a trigger that slows the insert.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("editing a draft evaluation's questions, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  let bookId: string;
  let objectiveIds: string[];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await db.pool.query(`INSERT INTO level_scales (name, is_default) VALUES ('test scale', true)`);
    server = await startServer({ databaseUrl: db.url, env: { AI_LIVE_MODE: undefined } });

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

  /** A draft with a generated paper (the mock writes it; no model). */
  const draftWithPaper = async (teacher = w.users.t1): Promise<string> => {
    const made = await call(server, "POST", "/evaluations", teacher, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "question-edit-race",
    });
    assert.equal(made.status, 201, made.text);
    const id: string = made.json.evaluation.id;
    const gen = await call(server, "POST", `/evaluations/${id}/generate`, teacher);
    assert.equal(gen.status, 200, gen.text);
    return id;
  };

  const live = async (id: string) =>
    (
      await db.pool.query<{ id: string; order_index: number; marks: string; competency_key: string; objective_id: string }>(
        `SELECT id, order_index, marks, competency_key, objective_id FROM evaluation_questions
          WHERE evaluation_id = $1 AND deleted_at IS NULL ORDER BY order_index, created_at`,
        [id],
      )
    ).rows;
  const storedTotal = async (id: string): Promise<number> =>
    Number((await db.pool.query<{ t: string }>(`SELECT total_marks AS t FROM evaluations WHERE id = $1`, [id])).rows[0].t);
  const liveMarks = async (id: string): Promise<number> => (await live(id)).reduce((s, q) => s + Number(q.marks), 0);

  /** A question the endpoint accepts, aimed at an objective and competency the draft already uses. */
  const newQuestion = async (id: string, marks = 2) => {
    const [first] = await live(id);
    return {
      type: "short_answer",
      objectiveId: first!.objective_id,
      competencyKey: first!.competency_key,
      marks,
      body: { prompt: "ما ناتج ٢ + ٢ ؟" },
      expectedAnswer: { modelAnswer: "٤", keyConcepts: ["الجمع"] },
    };
  };
  const paperGrid = async (id: string, n: number) => {
    const [first] = await live(id);
    return {
      questions: Array.from({ length: n }, () => ({
        marks: 1,
        objectiveId: first!.objective_id,
        competencyKey: first!.competency_key,
      })),
    };
  };

  const add = (id: string, body: unknown, teacher = w.users.t1) =>
    call(server, "POST", `/evaluations/${id}/questions`, teacher, body);
  const edit = (id: string, qid: string, body: unknown, teacher = w.users.t1) =>
    call(server, "PATCH", `/evaluations/${id}/questions/${qid}`, teacher, body);
  const remove = (id: string, qid: string, teacher = w.users.t1) =>
    call(server, "DELETE", `/evaluations/${id}/questions/${qid}`, teacher);
  const savePaper = (id: string, body: unknown, teacher = w.users.t1) =>
    call(server, "PUT", `/evaluations/${id}/questions/paper`, teacher, body);

  const waitUntilQueued = async (timeoutMs = 10_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const r = await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND query ILIKE '%from "evaluations"%for update%'`,
      );
      if (r.rows[0].n > 0) return;
      await new Promise(res => setTimeout(res, 50));
    }
    assert.fail("timed out waiting for the request to queue behind the evaluation row lock");
  };

  /**
   * Hold the evaluation row the way an in-flight publish would, start `request`, wait
   * until it is queued behind that lock (not for a fixed time: the early draft check
   * also answers 409 and would let a test pass without reaching the lock at all), run
   * `change` as the committed writer, and let go.
   */
  const whileHeld = async <T extends { status: number }>(
    id: string,
    request: () => Promise<T>,
    change: (c: pg.Client) => Promise<void>,
  ): Promise<T> => {
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    let pending: Promise<T> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM evaluations WHERE id = $1 FOR UPDATE`, [id]);
      pending = request();
      await waitUntilQueued();
      await change(holder);
      await holder.query("COMMIT");
      return await pending;
    } finally {
      // Let go BEFORE waiting on the request, or a failure above hangs until the fetch times out.
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await pending?.catch(() => undefined);
    }
  };
  const publishMeanwhile = (c: pg.Client, id: string) =>
    c.query(`UPDATE evaluations SET status = 'published' WHERE id = $1`, [id]).then(() => undefined);

  it("adds, edits and removes a question and keeps the total right (control)", async () => {
    const id = await draftWithPaper();
    const n = (await live(id)).length;

    const added = await add(id, await newQuestion(id, 2));
    assert.equal(added.status, 201, added.text);
    assert.equal((await live(id)).length, n + 1);
    assert.equal(added.json.totalMarks, await liveMarks(id));

    const qid: string = added.json.question.id;
    const edited = await edit(id, qid, { marks: 5 });
    assert.equal(edited.status, 200, edited.text);
    assert.equal(edited.json.totalMarks, await liveMarks(id));

    const removed = await remove(id, qid);
    assert.equal(removed.status, 200, removed.text);
    assert.equal(removed.json.totalMarks, await liveMarks(id));
    assert.equal(await storedTotal(id), await liveMarks(id));

    const saved = await savePaper(id, await paperGrid(id, 3));
    assert.equal(saved.status, 200, saved.text);
    assert.equal((await live(id)).length, 3);
    assert.equal(await storedTotal(id), 3);
  });

  it("does not add a question to a draft that was published while the request waited", async () => {
    const id = await draftWithPaper();
    const before = await live(id);
    const body = await newQuestion(id);
    const res = await whileHeld(id, () => add(id, body), c => publishMeanwhile(c, id));
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "no_longer_draft", "refused by the lock check, not the early one");
    assert.deepEqual((await live(id)).map(q => q.id), before.map(q => q.id), "the published paper is untouched");
  });

  it("does not change a question of a draft that was published while the request waited", async () => {
    const id = await draftWithPaper();
    const [q] = await live(id);
    const res = await whileHeld(id, () => edit(id, q!.id, { marks: 9 }), c => publishMeanwhile(c, id));
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "no_longer_draft");
    assert.equal(Number((await live(id)).find(x => x.id === q!.id)!.marks), Number(q!.marks), "marks unchanged");
  });

  it("does not remove a question of a draft that was published while the request waited", async () => {
    const id = await draftWithPaper();
    const before = await live(id);
    const res = await whileHeld(id, () => remove(id, before[0]!.id), c => publishMeanwhile(c, id));
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "no_longer_draft");
    assert.deepEqual((await live(id)).map(q => q.id), before.map(q => q.id));
  });

  it("does not replace the paper of a draft that was published while the request waited", async () => {
    const id = await draftWithPaper(w.users.t2);
    const before = await live(id);
    const grid = await paperGrid(id, 3);
    const res = await whileHeld(id, () => savePaper(id, grid, w.users.t2), c => publishMeanwhile(c, id));
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "no_longer_draft");
    assert.deepEqual((await live(id)).map(q => q.id), before.map(q => q.id), "the published paper is untouched");
  });

  it("refuses edits to a draft that was removed from the teacher's list", async () => {
    // «Delete» archives an evaluation and leaves status = 'draft'.
    const id = await draftWithPaper(w.users.t2);
    const before = await live(id);
    await db.pool.query(`UPDATE evaluations SET archived_at = now() WHERE id = $1`, [id]);
    const res = await add(id, await newQuestion(id), w.users.t2);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "no_longer_draft");
    assert.equal((await live(id)).length, before.length);
  });

  it("gives two questions added at once different positions and stores the right total", async () => {
    const id = await draftWithPaper();
    // Slow the insert so both requests have read the highest position before either has written.
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION slow_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.6); RETURN NULL; END $$`);
    await db.pool.query(`
      CREATE TRIGGER slow_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION slow_question_insert()`);
    const n = (await live(id)).length;
    try {
      const body = await newQuestion(id, 3);
      const [a, b] = await Promise.all([add(id, body), add(id, body)]);
      assert.equal(a.status, 201, a.text);
      assert.equal(b.status, 201, b.text);
    } finally {
      await db.pool.query(`DROP TRIGGER slow_question_insert ON evaluation_questions`);
    }
    const rows = await live(id);
    assert.equal(rows.length, n + 2);
    assert.equal(new Set(rows.map(q => q.order_index)).size, rows.length, "no two questions share a position");
    assert.equal(await storedTotal(id), await liveMarks(id), "the stored total is the live sum");
  });

  it("does not store the paper grid twice when it is saved twice at once", async () => {
    const id = await draftWithPaper(w.users.t2);
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION slow_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.6); RETURN NULL; END $$`);
    await db.pool.query(`
      CREATE TRIGGER slow_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION slow_question_insert()`);
    try {
      const grid = await paperGrid(id, 3);
      const [a, b] = await Promise.all([savePaper(id, grid, w.users.t2), savePaper(id, grid, w.users.t2)]);
      assert.equal(a.status, 200, a.text);
      assert.equal(b.status, 200, b.text);
    } finally {
      await db.pool.query(`DROP TRIGGER slow_question_insert ON evaluation_questions`);
    }
    assert.equal((await live(id)).length, 3, "one grid, not two");
    assert.equal(await storedTotal(id), 3);
  });

  it("keeps the previous paper when the new grid cannot be written", async () => {
    const id = await draftWithPaper(w.users.t2);
    const before = await live(id);
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION refuse_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated insert failure'; END $$`);
    await db.pool.query(`
      CREATE TRIGGER refuse_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION refuse_question_insert()`);
    try {
      const res = await savePaper(id, await paperGrid(id, 3), w.users.t2);
      assert.equal(res.status, 500, res.text);
    } finally {
      await db.pool.query(`DROP TRIGGER refuse_question_insert ON evaluation_questions`);
    }
    assert.deepEqual((await live(id)).map(q => q.id), before.map(q => q.id), "the old paper is still live");
    assert.equal(await storedTotal(id), await liveMarks(id));
  });
});
