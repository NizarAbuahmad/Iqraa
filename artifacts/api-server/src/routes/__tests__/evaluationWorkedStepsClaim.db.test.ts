/**
 * What this guards: a second `POST /evaluations/:id/worked-steps` for an exam whose
 * worked steps (or questions) are already being prepared is refused, not run.
 *
 * The route reads the questions that still have no steps and asks the model about
 * each, five at a time, so on a paper of twenty it can run for minutes. The app gives
 * up after 45 s and the teacher taps again; the second request re-read the same list
 * (nothing was saved yet) and asked the model about the same questions again. It uses
 * the exam's generation claim (`evaluations.generating_since`, lib/generationClaim.ts)
 * — one model-backed request per exam at a time — taken BEFORE the list is read, so a
 * request that arrives just after another finished sees what it saved instead of a stale
 * list, and released before the response is written (Cloud Run throttles the CPU after).
 *
 * No model is used (live mode is off). Whatever a request does after taking the claim
 * is therefore a refusal (503) or an empty paper (200); the claim is what is under test.
 * The overlap is made deterministic with a trigger that sleeps while the claim is being
 * taken, so the second request's conditional UPDATE waits on the first one's row lock.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("preparing worked steps for an exam that is already being prepared, against a real database", () => {
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

  // Both limiters count refused calls too, and /generate and /worked-steps share one
  // bucket per teacher (10 a minute): the tests spread their calls over two teachers.
  /** A maths draft with no questions, so there is nothing for the model to do (live mode is off). */
  const makeExam = async (teacher = w.users.t1): Promise<string> => {
    const r = await call(server, "POST", "/evaluations", teacher, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "worked-steps-claim",
    });
    assert.equal(r.status, 201, r.text);
    const id: string = r.json.evaluation.id;
    const subject = (await db.pool.query<{ s: string | null }>(`SELECT subject_id AS s FROM evaluations WHERE id = $1`, [id])).rows[0]!.s;
    assert.equal(subject, "mathematics", "the book is a maths book, so worked steps apply");
    return id;
  };
  const steps = (id: string, teacher = w.users.t1) => call(server, "POST", `/evaluations/${id}/worked-steps`, teacher);
  const claim = async (id: string): Promise<Date | null> =>
    (await db.pool.query<{ g: Date | null }>(`SELECT generating_since AS g FROM evaluations WHERE id = $1`, [id])).rows[0]!.g;

  it("answers, and leaves no claim behind, for an exam with nothing to prepare (control)", async () => {
    const id = await makeExam();
    const res = await steps(id);
    assert.equal(res.status, 200, res.text);
    assert.equal(await claim(id), null, "claim released by the time the response arrived");
    const again = await steps(id);
    assert.equal(again.status, 200, again.text);
    assert.equal(await claim(id), null);
  });

  it("refuses a request while the exam is claimed, and leaves the other request's claim alone", async () => {
    const id = await makeExam();
    const held = new Date();
    await db.pool.query(`UPDATE evaluations SET generating_since = $2 WHERE id = $1`, [id, held]);

    const res = await steps(id);
    assert.equal(res.status, 429, res.text);
    assert.equal(res.json.code, "worked_steps_in_progress");
    assert.equal((await claim(id))?.getTime(), held.getTime(), "the refused request did not release someone else's claim");
  });

  it("ignores a claim old enough to be dead, so a crashed instance cannot lock an exam", async () => {
    const id = await makeExam();
    await db.pool.query(`UPDATE evaluations SET generating_since = now() - interval '10 minutes' WHERE id = $1`, [id]);
    const res = await steps(id);
    assert.equal(res.status, 200, res.text);
    assert.equal(await claim(id), null);
  });

  it("refuses the second of two overlapping requests and frees the exam after", async () => {
    const id = await makeExam(w.users.t2);
    // Sleep while the claim is being taken (not when it is released): the first request's
    // UPDATE holds the row for a second, the second's conditional UPDATE waits on it and,
    // once it has the row, finds the claim set.
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION slow_claim() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.generating_since IS NOT NULL THEN PERFORM pg_sleep(1); END IF; RETURN NEW; END $$`);
    await db.pool.query(`
      CREATE TRIGGER slow_claim BEFORE UPDATE ON evaluations
      FOR EACH ROW EXECUTE FUNCTION slow_claim()`);
    let results: Awaited<ReturnType<typeof steps>>[];
    try {
      results = await Promise.all([steps(id, w.users.t2), steps(id, w.users.t2)]);
    } finally {
      await db.pool.query(`DROP TRIGGER slow_claim ON evaluations`);
    }
    assert.deepEqual(results.map(r => r.status).sort(), [200, 429], results.map(r => r.text).join(" / "));
    assert.equal(results.find(r => r.status === 429)!.json.code, "worked_steps_in_progress");
    assert.equal(await claim(id), null, "the exam is free again");
    assert.equal((await steps(id, w.users.t2)).status, 200);
  });

  it("frees the exam when the request fails after taking the claim", async () => {
    // A question the model would be asked about, with live mode off: the route refuses
    // with 503 after it has the claim.
    const id = await makeExam(w.users.t2);
    const [first] = (
      await db.pool.query<{ objective_id: string }>(`SELECT objective_id FROM evaluation_questions WHERE evaluation_id = $1 LIMIT 1`, [id])
    ).rows;
    const added = await call(server, "POST", `/evaluations/${id}/questions`, w.users.t2, {
      type: "short_answer",
      objectiveId: first?.objective_id ?? objectiveIds[0],
      competencyKey: "knowledge",
      marks: 2,
      body: { prompt: "ما ناتج ٢ + ٢ ؟" },
      expectedAnswer: { modelAnswer: "٤", keyConcepts: ["الجمع"] },
    });
    assert.equal(added.status, 201, added.text);
    const res = await steps(id, w.users.t2);
    assert.equal(res.status, 503, res.text);
    assert.equal(res.json.code, "live_mode_off");
    assert.equal(await claim(id), null, "a failed request does not leave the exam claimed");
  });

  it("takes no claim for an exam that is not a maths exam", async () => {
    const id = await makeExam(w.users.t2);
    await db.pool.query(`UPDATE evaluations SET subject_id = 'chemistry' WHERE id = $1`, [id]);
    const res = await steps(id, w.users.t2);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "not_math");
    assert.equal(await claim(id), null);
  });
});
