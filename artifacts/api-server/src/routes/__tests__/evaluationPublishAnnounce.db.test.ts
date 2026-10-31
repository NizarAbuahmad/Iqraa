/**
 * What this guards: publishing a dated draft tells the families once, however
 * many publish requests arrive.
 *
 * `publishNotice` decides from the exam's status before the publish ("a dated
 * draft leaving draft"). Publish used to read that status BEFORE its UPDATE with
 * no lock, so two publishes of one draft (a double tap on the button) both saw a
 * draft and both announced the date. The decision is now made from the row read
 * under the evaluation lock, after any publish ahead of this one has committed.
 *
 * examDatePush.db.test.ts notes that racing identical requests do not interleave
 * on their own, so the test makes them: it holds the row, waits until both
 * requests are queued behind it, and lets go.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo } from "../../test-support/seedPush.ts";

describeDb("publishing a dated draft, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
    // The seeded dated draft has no questions and could not be published. One paper
    // question (empty body, manual marking) is enough: nothing in it needs validating.
    await db.pool.query(
      `INSERT INTO evaluation_questions
         (evaluation_id, order_index, type, body, expected_answer, objective_id, competency_key, marks, grading_mode, source)
       VALUES ($1, 0, 'open_ended', '{}'::jsonb, '{}'::jsonb, 'obj-test', 'understanding', '5.00', 'manual', 'teacher')`,
      [x.exams.exDraftDated],
    );
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });

  it("announces the date once when two publishes of the same draft arrive together", async () => {
    stub.clear();
    const id = x.exams.exDraftDated;
    const publish = () => call(server, "POST", `/evaluations/${id}/publish`, w.users.t1);

    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    let first: Promise<Awaited<ReturnType<typeof publish>>> | undefined;
    let second: Promise<Awaited<ReturnType<typeof publish>>> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM evaluations WHERE id = $1 FOR UPDATE`, [id]);
      first = publish();
      second = publish();
      // Both queued behind the row we hold, so neither has decided anything yet.
      const deadline = Date.now() + 10_000;
      for (;;) {
        const r = await db.pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '%"evaluations"%'`,
        );
        if (r.rows[0].n >= 2) break;
        assert.ok(Date.now() < deadline, "timed out waiting for both publishes to queue behind the lock");
        await new Promise(res => setTimeout(res, 50));
      }
      await holder.query("COMMIT");
      const [a, b] = await Promise.all([first, second]);
      assert.equal(a.status, 200, a.text);
      assert.equal(b.status, 200, b.text);
    } finally {
      // Let go of the row BEFORE waiting on the requests: if an assertion above threw, they
      // are still queued behind our lock, and waiting on them first would hang the test
      // until the fetch timed out instead of showing the real failure.
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await first?.catch(() => undefined);
      await second?.catch(() => undefined);
    }

    const msgs = stub.messages();
    assert.ok(msgs.length > 0, "the families were told at all");
    assert.ok(ownersReached(msgs).includes("parentA"), "the class's guardian was reached");
    assert.ok(sentTo(msgs, "parentA").length > 0);
    const perDeviceAndTitle = msgs.map(m => `${m.to}|${m.title}`);
    assert.equal(
      new Set(perDeviceAndTitle).size,
      perDeviceAndTitle.length,
      `a device was told the same thing twice: ${JSON.stringify(perDeviceAndTitle)}`,
    );
  });
});
