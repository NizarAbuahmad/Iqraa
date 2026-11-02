/**
 * What this guards: a second `POST /evaluations/:id/generate` for an exam whose
 * questions are already being generated is refused, not run.
 *
 * The app gives up on a generate request after 45 s, and the model can take longer,
 * so a teacher taps again while the first request is still writing. Both then call
 * the model (the second one costs the same as the first and replaces its paper). The
 * write is already serialised by the evaluation row lock; this stops the second
 * model call. The claim lives in the database (`evaluations.generating_since`)
 * because `iqraa-api` runs on up to 20 instances, so a second tap can land on another
 * one. It is released BEFORE the response is written: Cloud Run throttles the CPU once
 * a response is sent, and a release that waited for that could leave the exam
 * refusing a teacher's next regenerate until the claim expired.
 *
 * No model is used (live mode is off, so the mock writes the paper). The overlap uses
 * a trigger that slows the insert, so the first request is still running when the
 * second arrives.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("generating into an exam that is already being generated, against a real database", () => {
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

  // The generate route allows 10 calls a minute per teacher, refused ones included;
  // the tests spread their calls over two teachers.
  const makeDraft = async (teacher = w.users.t1): Promise<string> => {
    const r = await call(server, "POST", "/evaluations", teacher, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "generate-claim",
    });
    assert.equal(r.status, 201, r.text);
    return r.json.evaluation.id;
  };
  const generate = (id: string, teacher = w.users.t1) =>
    call(server, "POST", `/evaluations/${id}/generate`, teacher);
  const claim = async (id: string): Promise<Date | null> =>
    (await db.pool.query<{ g: Date | null }>(`SELECT generating_since AS g FROM evaluations WHERE id = $1`, [id])).rows[0]!.g;
  const liveCount = async (id: string): Promise<number> =>
    (
      await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM evaluation_questions WHERE evaluation_id = $1 AND deleted_at IS NULL`,
        [id],
      )
    ).rows[0]!.n;
  const waitUntil = async (check: () => Promise<boolean>, what: string, timeoutMs = 10_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.fail(`timed out waiting for ${what}`);
  };

  it("generates, and leaves no claim behind once it has answered (control)", async () => {
    const id = await makeDraft();
    const first = await generate(id);
    assert.equal(first.status, 200, first.text);
    // Released before the response was written, not some time after it.
    assert.equal(await claim(id), null, "claim released by the time the response arrived");
    const again = await generate(id);
    assert.equal(again.status, 200, again.text);
    assert.equal(await claim(id), null);
  });

  it("refuses a request while the exam is claimed, writes nothing, and leaves the other request's claim alone", async () => {
    const id = await makeDraft();
    const held = new Date();
    await db.pool.query(`UPDATE evaluations SET generating_since = $2 WHERE id = $1`, [id, held]);

    const res = await generate(id);
    assert.equal(res.status, 429, res.text);
    assert.equal(res.json.code, "generation_in_progress");
    assert.equal(await liveCount(id), 0, "nothing was written");
    assert.equal((await claim(id))?.getTime(), held.getTime(), "the refused request did not release someone else's claim");
  });

  it("ignores a claim old enough to be dead, so a crashed instance cannot lock an exam", async () => {
    const id = await makeDraft();
    await db.pool.query(`UPDATE evaluations SET generating_since = now() - interval '10 minutes' WHERE id = $1`, [id]);
    const res = await generate(id);
    assert.equal(res.status, 200, res.text);
    assert.ok((await liveCount(id)) > 0);
    assert.equal(await claim(id), null);
  });

  it("refuses the second of two overlapping requests, lets the first finish, and frees the exam after", async () => {
    const id = await makeDraft(w.users.t2);
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION slow_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(1.5); RETURN NULL; END $$`);
    await db.pool.query(`
      CREATE TRIGGER slow_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION slow_question_insert()`);
    let first: ReturnType<typeof generate> | undefined;
    let second: Awaited<ReturnType<typeof generate>>;
    try {
      first = generate(id, w.users.t2);
      // The first request is really running (it holds the claim), not merely started.
      await waitUntil(async () => (await claim(id)) !== null, "the first request to claim the exam");
      second = await generate(id, w.users.t2);
      assert.equal((await first).status, 200, "the first request still finishes");
    } finally {
      await first?.catch(() => undefined);
      await db.pool.query(`DROP TRIGGER slow_question_insert ON evaluation_questions`);
    }
    assert.equal(second.status, 429, second.text);
    assert.equal(second.json.code, "generation_in_progress");
    assert.equal(await claim(id), null, "the exam is free again");
    const third = await generate(id, w.users.t2);
    assert.equal(third.status, 200, third.text);
  });

  it("frees the exam when generation fails", async () => {
    const id = await makeDraft(w.users.t2);
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION refuse_question_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated insert failure'; END $$`);
    await db.pool.query(`
      CREATE TRIGGER refuse_question_insert BEFORE INSERT ON evaluation_questions
      FOR EACH STATEMENT EXECUTE FUNCTION refuse_question_insert()`);
    try {
      const res = await generate(id, w.users.t2);
      assert.equal(res.status, 502, res.text);
      assert.equal(await claim(id), null, "a failed generation does not leave the exam claimed");
    } finally {
      await db.pool.query(`DROP TRIGGER refuse_question_insert ON evaluation_questions`);
    }
    const retry = await generate(id, w.users.t2);
    assert.equal(retry.status, 200, retry.text);
  });
});
