/**
 * What this guards: the push a family gets when a teacher releases results.
 * First characterised on the code as it was before Part 4 (who hears it, what
 * it says, that a second press says nothing, that hide → release announces
 * again, that a dead device is forgotten), then tightened: a provisional
 * paper, a suspended guardian and an account that switched results off hear
 * nothing, and the push rings by day on the results channel.
 *
 * The release announcement is sent AFTER the response (fire-and-forget, as
 * before), so each case waits on the stub for what it expects, then settles
 * briefly before asserting what must be absent. Cases run in order: the
 * release flag is shared state.
 */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { PUSH_TOKENS, seedPushWorld, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

describeDb("results pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const release = (released: boolean) =>
    call(server, "POST", `/evaluations/${x.exams.exUnreleased}/results-release`, w.users.t1, { released });
  /** Hide, then release: a fresh announcement every time. */
  const announce = async () => {
    assert.equal((await release(false)).status, 200);
    stub.clear();
    const r = await release(true);
    assert.equal(r.status, 200, server.logs().slice(-1500));
  };
  const saraTitle = `نتيجة ${CHILDREN.sara}`;
  const waitForSarasParent = () => stub.waitFor(m => sentTo(m, "parentA").some(p => p.title === saraTitle));

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    // Adam handed this exam in too, but his paper is still being marked.
    const adam = await db.pool.query<{ id: string }>(
      `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, submitted_at)
       VALUES ($1, $2, 'student_link', 'needs_review', now(), now()) RETURNING id`,
      [x.exams.exUnreleased, w.students.aA],
    );
    await db.pool.query(
      `INSERT INTO attempt_results (attempt_id, earned_marks, total_marks, percent, level_key, is_provisional)
       VALUES ($1, '0.00', '10.00', '0.00', 'beginner', true)`,
      [adam.rows[0].id],
    );
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  describe("as it was before Part 4 (must pass on the old code)", () => {
    it("tells the child and each guardian, naming the child, on every device", async () => {
      assert.equal((await release(true)).status, 200);
      const msgs = await stub.waitFor(m => sentTo(m, "studentA").length > 0 && sentTo(m, "parentA").filter(p => p.title === saraTitle).length >= 2);
      const toStudent = sentTo(msgs, "studentA");
      assert.equal(toStudent.length, 1);
      assert.equal(toStudent[0].title, `نتيجة «${EX_TITLES.exUnreleased}»`);
      assert.equal(toStudent[0].body, "أعلن معلّمك النتيجة. افتحها من «اختباراتي».");
      const toParent = sentTo(msgs, "parentA").filter(m => m.title === saraTitle);
      assert.deepEqual(toParent.map(m => m.to).sort(), [...PUSH_TOKENS.parentA].sort());
      assert.equal(toParent[0].body, `أعلن المعلّم نتيجة «${EX_TITLES.exUnreleased}». افتحها من «نتائج أبنائي».`);
      for (const m of [...toStudent, ...toParent]) {
        assert.equal(m.channelId, "results");
        assert.deepEqual(m.data, { screen: "my-exams" });
      }
      for (const owner of ["parentB", "studentB", "t1", "t2", "studentUnlinked"] as const) {
        assert.equal(sentTo(await stub.settle(200), owner).length, 0, owner);
      }
    });

    it("says nothing when the results were already released", async () => {
      // Still released from the case above.
      assert.equal((await release(true)).status, 200);
      assert.deepEqual(await stub.settle(400), []);
    });

    it("announces again after the teacher hides and re-releases", async () => {
      await announce();
      await waitForSarasParent();
    });
  });

  describe("Part 4", () => {
    it("tells nobody about a paper still being marked", async () => {
      await announce();
      await waitForSarasParent();
      const msgs = await stub.settle(300);
      assert.equal(msgs.some(m => m.title === `نتيجة ${CHILDREN.adam}`), false, "Adam's paper is provisional");
    });

    it("skips a suspended guardian", async () => {
      await announce();
      await waitForSarasParent();
      assert.equal(sentTo(await stub.settle(300), "suspendedParent").length, 0);
    });

    it("honours the results switch, and only that switch", async () => {
      await setPushPrefs(db.pool, w.users.studentA, { results: false });
      try {
        await announce();
        await waitForSarasParent();
        assert.equal(sentTo(await stub.settle(300), "studentA").length, 0);
      } finally {
        await setPushPrefs(db.pool, w.users.studentA, {});
      }
      await setPushPrefs(db.pool, w.users.studentA, { homework: false, exams: false });
      try {
        await announce();
        await stub.waitFor(m => sentTo(m, "studentA").length > 0);
      } finally {
        await setPushPrefs(db.pool, w.users.studentA, {});
      }
    });

    it("rings by day (quiet hours are off in tests)", async () => {
      await announce();
      await waitForSarasParent();
      for (const m of await stub.settle(200)) assert.equal(m.sound, "default");
    });
  });

  describe("pruning (true before Part 4 too; last, because it removes a token)", () => {
    it("forgets a device Expo says is gone, and keeps the others", async () => {
      const [phone, tablet] = PUSH_TOKENS.parentA;
      stub.markDead(tablet);
      await announce();
      await waitForSarasParent();
      let tokens: string[] = [];
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        tokens = (
          await db.pool.query<{ t: string }>(`SELECT expo_push_token AS t FROM device_push_tokens WHERE user_id = $1`, [w.users.parentA])
        ).rows.map(r => r.t);
        if (!tokens.includes(tablet)) break;
        await new Promise(r => setTimeout(r, 100));
      }
      assert.deepEqual(tokens, [phone]);
    });
  });
});
