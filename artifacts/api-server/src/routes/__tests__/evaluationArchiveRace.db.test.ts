/**
 * What this guards: `DELETE /evaluations/:id` (remove an exam from the teacher's
 * lists) decides "is it published?" under the evaluation row lock.
 *
 * Only a draft or a closed exam may be removed (lib/evaluationArchive.ts): a
 * published exam has a live student link, and hiding it from its teacher while
 * students can still sit it leaves an exam nobody can close. The route made that
 * decision from a read taken before it wrote, with no lock, while publish locks
 * the row and flips the status. A publish that committed between the two left a
 * published exam with `archived_at` set — gone from the teacher's lists, link live.
 * The decision is now made on the row as it is when the request gets the lock.
 * The tests hold the row themselves, so the order is deterministic.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("removing an evaluation from the list, against a real database", () => {
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

  const makeExam = async (status: "draft" | "closed"): Promise<string> => {
    const made = await call(server, "POST", "/evaluations", w.users.t1, {
      bookId,
      objectiveIds,
      assessmentTypes: ["open_ended"],
      targetQuestionCount: 4,
      title: "archive-race",
    });
    assert.equal(made.status, 201, made.text);
    const id: string = made.json.evaluation.id;
    if (status === "closed") await db.pool.query(`UPDATE evaluations SET status = 'closed' WHERE id = $1`, [id]);
    return id;
  };
  const archive = (id: string) => call(server, "DELETE", `/evaluations/${id}`, w.users.t1);
  const row = async (id: string) =>
    (
      await db.pool.query<{ status: string; archived_at: Date | null }>(
        `SELECT status, archived_at FROM evaluations WHERE id = $1`,
        [id],
      )
    ).rows[0];

  const waitUntilQueued = async (timeoutMs = 10_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // Only this file's database: pg_stat_activity lists the whole server, where other
      // test files run the same query in parallel.
      const r = await db.pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%from "evaluations"%for update%'`,
      );
      if (r.rows[0].n > 0) return;
      await new Promise(res => setTimeout(res, 50));
    }
    assert.fail("timed out waiting for the request to queue behind the evaluation row lock");
  };

  /** Hold the row as an in-flight publish would, start the removal, publish as a committed writer, let go. */
  const archiveWhilePublishing = async (id: string) => {
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    let pending: ReturnType<typeof archive> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM evaluations WHERE id = $1 FOR UPDATE`, [id]);
      pending = archive(id);
      // Queued behind our lock, not merely started: the early read also lets a request through.
      await waitUntilQueued();
      await holder.query(`UPDATE evaluations SET status = 'published' WHERE id = $1`, [id]);
      await holder.query("COMMIT");
      return await pending;
    } finally {
      // Let go BEFORE waiting on the request, or a failure above hangs until the fetch times out.
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await pending?.catch(() => undefined);
    }
  };

  it("removes a draft and a closed exam, and removing twice is not an error (control)", async () => {
    for (const status of ["draft", "closed"] as const) {
      const id = await makeExam(status);
      const first = await archive(id);
      assert.equal(first.status, 200, first.text);
      assert.equal(first.json.archived, id);
      assert.ok((await row(id)).archived_at, `${status} exam is archived`);
      const again = await archive(id);
      assert.equal(again.status, 200, again.text);
    }
  });

  it("refuses to remove a published exam (control)", async () => {
    const id = await makeExam("draft");
    await db.pool.query(`UPDATE evaluations SET status = 'published' WHERE id = $1`, [id]);
    const res = await archive(id);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "still_published");
    assert.equal((await row(id)).archived_at, null);
  });

  it("does not hide a draft that was published while the removal waited", async () => {
    const id = await makeExam("draft");
    const res = await archiveWhilePublishing(id);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "still_published");
    const after = await row(id);
    assert.equal(after.status, "published");
    assert.equal(after.archived_at, null, "a published exam stays in the teacher's list");
  });

  it("does not hide a closed exam that was re-published while the removal waited", async () => {
    const id = await makeExam("closed");
    const res = await archiveWhilePublishing(id);
    assert.equal(res.status, 409, res.text);
    assert.equal(res.json.code, "still_published");
    assert.equal((await row(id)).archived_at, null);
  });
});
