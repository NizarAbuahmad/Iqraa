/**
 * What this guards: `POST /evaluations/:id/publish` publishes the paper as it is
 * when it holds the evaluation, not as it was a moment earlier.
 *
 * Publish used to read the questions and total with no lock, check them for
 * blockers, and then run a plain UPDATE. A generation (or any write that locks
 * the row) committing between the read and the UPDATE left the exam published
 * with the OLD total on questions that no longer exist: a total that does not add
 * up, or an exam with no questions that passed the "add at least one question"
 * check a moment before. Publish now locks the row first and reads the questions
 * under the lock, so it is either wholly before or wholly after such a write.
 *
 * The races are made deterministic the same way as evaluationGenerateWrite: the
 * test holds the row, waits until the request is queued behind it, then changes
 * the paper as a committed generation would and lets go.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("publishing an evaluation, against a real database", () => {
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
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  /** A draft with a generated paper (the mock writes it; no model). */
  const draftWithPaper = async (): Promise<string> => {
    const made = await call(server, "POST", "/evaluations", w.users.t1, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "publish-race",
    });
    assert.equal(made.status, 201, made.text);
    const id: string = made.json.evaluation.id;
    const gen = await call(server, "POST", `/evaluations/${id}/generate`, w.users.t1);
    assert.equal(gen.status, 200, gen.text);
    return id;
  };
  const publish = (id: string) => call(server, "POST", `/evaluations/${id}/publish`, w.users.t1);

  const evaluationRow = async (id: string) =>
    (
      await db.pool.query<{ status: string; total_marks: string; share_code: string | null }>(
        `SELECT status, total_marks, share_code FROM evaluations WHERE id = $1`,
        [id],
      )
    ).rows[0];
  const liveMarks = async (id: string): Promise<number> =>
    Number(
      (
        await db.pool.query<{ total: string }>(
          `SELECT coalesce(sum(marks), 0) AS total FROM evaluation_questions WHERE evaluation_id = $1 AND deleted_at IS NULL`,
          [id],
        )
      ).rows[0].total,
    );

  const waitUntilQueued = async (timeoutMs = 10_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const r = await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND query ILIKE '%"evaluations"%'`,
      );
      if (r.rows[0].n > 0) return;
      await new Promise(res => setTimeout(res, 50));
    }
    assert.fail("timed out waiting for the publish to queue behind the lock");
  };

  /**
   * Hold the evaluation row, start a publish, wait until it is queued behind us, run
   * `change` (standing in for a generation that commits meanwhile), and let go.
   */
  const publishWhileHeld = async (id: string, change: (c: pg.Client) => Promise<void>) => {
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM evaluations WHERE id = $1 FOR UPDATE`, [id]);
      const pending = publish(id);
      try {
        await waitUntilQueued();
        await change(holder);
        await holder.query("COMMIT");
        return await pending;
      } finally {
        await pending.catch(() => undefined);
      }
    } finally {
      await holder.end();
    }
  };

  it("publishes a draft with its paper's total and a share code (control)", async () => {
    const id = await draftWithPaper();
    const res = await publish(id);
    assert.equal(res.status, 200, res.text);
    const row = await evaluationRow(id);
    assert.equal(row.status, "published");
    assert.ok(row.share_code, "a share code was issued");
    assert.equal(Number(row.total_marks), await liveMarks(id));
  });

  it("publishes the total of the paper as it stands when it gets the row, not the one it read before waiting", async () => {
    const id = await draftWithPaper();
    const before = await liveMarks(id);
    const res = await publishWhileHeld(id, c =>
      c
        .query(
          `UPDATE evaluation_questions SET marks = marks + 10
            WHERE id = (SELECT id FROM evaluation_questions WHERE evaluation_id = $1 AND deleted_at IS NULL ORDER BY order_index LIMIT 1)`,
          [id],
        )
        .then(() => undefined),
    );
    assert.equal(res.status, 200, res.text);
    const row = await evaluationRow(id);
    assert.equal(row.status, "published");
    assert.equal(await liveMarks(id), before + 10);
    assert.equal(Number(row.total_marks), before + 10, "the stored total matches the questions that are live");
  });

  it("refuses to publish a draft whose questions all went away while it waited", async () => {
    const id = await draftWithPaper();
    const res = await publishWhileHeld(id, c =>
      c
        .query(`UPDATE evaluation_questions SET deleted_at = now() WHERE evaluation_id = $1 AND deleted_at IS NULL`, [id])
        .then(() => undefined),
    );
    assert.equal(res.status, 400, res.text);
    assert.ok(res.json.blockers.some((b: string) => /at least one question/i.test(b)), res.text);
    assert.equal((await evaluationRow(id)).status, "draft", "nothing was published");
  });

  it("still finds a free share code when the first one collides", async () => {
    // The share-code retry exists for the unique index. Inside the publish transaction a
    // unique violation aborts it unless the attempt runs in a savepoint, so a collision
    // must be simulated: the first attempt to publish raises a unique violation.
    const id = await draftWithPaper();
    await db.pool.query(`CREATE SEQUENCE collide_once_seq`);
    await db.pool.query(`
      CREATE OR REPLACE FUNCTION collide_once() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('collide_once_seq') = 1 THEN
          RAISE EXCEPTION 'simulated share code collision' USING ERRCODE = '23505';
        END IF;
        RETURN NEW;
      END $$`);
    await db.pool.query(`
      CREATE TRIGGER collide_once BEFORE UPDATE ON evaluations
      FOR EACH ROW WHEN (NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published')
      EXECUTE FUNCTION collide_once()`);
    try {
      const res = await publish(id);
      assert.equal(res.status, 200, res.text);
      const seq = await db.pool.query<{ last_value: string }>(`SELECT last_value FROM collide_once_seq`);
      assert.ok(Number(seq.rows[0].last_value) >= 2, "the update was attempted twice: the first collided, the retry went through");
    } finally {
      await db.pool.query(`DROP TRIGGER collide_once ON evaluations`);
      await db.pool.query(`DROP FUNCTION collide_once()`);
      await db.pool.query(`DROP SEQUENCE collide_once_seq`);
    }
    const row = await evaluationRow(id);
    assert.equal(row.status, "published");
    assert.ok(row.share_code);
  });
});
