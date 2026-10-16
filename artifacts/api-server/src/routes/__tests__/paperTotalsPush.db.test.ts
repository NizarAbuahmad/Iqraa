/**
 * What this guards: a paper mark typed AFTER the teacher released results is
 * visible to the family at once, so it is announced at once — and only then.
 * Not before the release (the release itself announces), not for a re-save
 * of the same mark, not for a cleared mark or a refused row, not to an
 * account that switched results off. Cases run in order on exPaper.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

describeDb("paper marks typed after the release, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const statuses = async (rows: Array<{ studentId: string; marks: number | null }>) => {
    const r = await call(server, "PUT", `/evaluations/${x.exams.exPaper}/paper-totals`, w.users.t1, { totals: rows });
    assert.equal(r.status, 200, `${r.text}\n${server.logs().slice(-1000)}`);
    return (r.json.results as Array<{ status: string }>).map(row => row.status);
  };

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("pushes nothing for a mark typed before the release", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.sA1, marks: 15 }]), ["saved"]);
    assert.deepEqual(await stub.settle(300), []);
  });

  it("(setup) releasing announces Sara's mark, as the release always did", async () => {
    const r = await call(server, "POST", `/evaluations/${x.exams.exPaper}/results-release`, w.users.t1, { released: true });
    assert.equal(r.status, 200);
    // The announcement runs after the response (fire-and-forget): wait for BOTH
    // of Sara's accounts, then let any straggler land, so none leaks into the
    // next case (beforeEach clears the stub, it cannot clear a late arrival).
    const both = (m: ReturnType<PushStub["messages"]>) => sentTo(m, "studentA").length > 0 && sentTo(m, "parentA").length > 0;
    await stub.waitFor(both, 5000);
    await stub.settle(300);
  });

  it("tells the family of a mark typed after the release, naming the child, before answering", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 12 }]), ["saved"]);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.equal(msgs.length, 2, "one child × two devices");
    for (const m of msgs) {
      assert.equal(m.title, `نتيجة ${CHILDREN.adam}`);
      assert.ok(m.body.includes(EX_TITLES.exPaper));
      assert.equal(m.channelId, "results");
      assert.deepEqual(m.data, { screen: "my-exams" });
    }
  });

  it("says nothing when the same mark is saved again", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 12 }]), ["unchanged"]);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("tells the child and the guardian again when a mark is corrected", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.sA1, marks: 16 }]), ["saved"]);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    assert.deepEqual([...new Set(sentTo(msgs, "parentA").map(m => m.title))], [`نتيجة ${CHILDREN.sara}`]);
  });

  it("says nothing for a cleared mark or a refused row", async () => {
    assert.deepEqual(
      await statuses([
        { studentId: w.students.aA, marks: null },
        { studentId: w.students.nB1, marks: 5 },
      ]),
      ["cleared", "error"],
    );
    assert.deepEqual(await stub.settle(200), []);
  });

  it("leaves out an account that switched results off", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { results: false });
    try {
      assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 11 }]), ["saved"]);
      assert.deepEqual(await stub.settle(200), []);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });
});
