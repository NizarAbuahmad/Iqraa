/**
 * What this guards: the push a family gets when an exam's date is set,
 * changed or cleared. Every way it goes wrong is a leak or noise: a dated
 * draft or an exam with no class announced (no family can see either), a
 * group check announced to the whole class, a save that changed nothing
 * announced, an archived exam announced, a back-dated entry announced as news,
 * and another family told. Cases run in order: exDated's schedule is shared.
 *
 * Not covered here: two saves racing each other. The conditional write in
 * PATCH /evaluations/:id (`stillHolds`) makes only one of them announce, but
 * a race test could not catch its removal: with the guard deleted, 2- and
 * 8-way concurrent identical PATCHes still announced once in 3/3 runs each
 * (requests serialise too tightly to interleave the read and the write).
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call, type CallResult } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay, EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs, shownDay } from "../../test-support/seedPush.ts";

describeDb("exam date pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const patch = (examId: string, body: Record<string, unknown>, teacher?: string) =>
    call(server, "PATCH", `/evaluations/${examId}`, teacher ?? w.users.t1, body);
  const ok = async (p: Promise<CallResult>) => {
    const r = await p;
    assert.equal(r.status, 200, `${r.status} ${r.text}\n${server.logs().slice(-1000)}`);
    return r;
  };
  const titlesTo = (owner: "parentA" | "parentB", msgs = stub.messages()) => [...new Set(sentTo(msgs, owner).map(m => m.title))].sort();

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

  it("tells the class's students and guardians that a time changed", async () => {
    await ok(patch(x.exams.exDated, { examTime: "10:15" }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    const [toStudent] = sentTo(msgs, "studentA");
    assert.equal(toStudent.title, `تغيّر موعد امتحان: ${EX_TITLES.exDated}`);
    assert.ok(toStudent.body.includes(shownDay(x.dates.exDated)));
    assert.ok(toStudent.body.includes("⁦10:15⁩"));
    assert.equal(sentTo(msgs, "parentA").length, 4, "two children × two devices");
    assert.deepEqual(titlesTo("parentA", msgs), [`${CHILDREN.adam}: تغيّر موعد امتحان`, `${CHILDREN.sara}: تغيّر موعد امتحان`].sort());
    for (const m of msgs) {
      assert.equal(m.channelId, "exams");
      assert.deepEqual(m.data, { screen: "school" });
    }
  });

  it("says nothing when a save does not move the date or time", async () => {
    await ok(patch(x.exams.exDated, { examDate: x.dates.exDated, examTime: "10:15" }));
    await ok(patch(x.exams.exDated, { classGroupId: w.classes.c1 }));
    assert.deepEqual(await stub.settle(200), []);
  });

  it("tells a cleared date, then a date set again", async () => {
    await ok(patch(x.exams.exDated, { examDate: null }));
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `أُزيل موعد امتحان: ${EX_TITLES.exDated}`);
    stub.clear();
    await ok(patch(x.exams.exDated, { examDate: ammanDay(8), examTime: "09:00" }));
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `موعد امتحان: ${EX_TITLES.exDated}`);
  });

  it("leaves out a guardian who switched exam dates off", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { exams: false });
    try {
      await ok(patch(x.exams.exDated, { examTime: "12:00" }));
      assert.deepEqual(ownersReached(stub.messages()), ["studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });

  it("never announces a dated draft, an archived exam, or an exam with no class", async () => {
    await ok(patch(x.exams.exDraftDated, { examDate: ammanDay(9) }));
    await ok(patch(x.exams.exPaperArchived, { examDate: ammanDay(9) }));
    await ok(patch(x.exams.exNoClass, { examTime: "13:00" }));
    assert.deepEqual(await stub.settle(300), []);
  });

  it("tells only the class a dated exam is attached to", async () => {
    await ok(patch(x.exams.exNoClass, { classGroupId: w.classes.c3 }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentB", "studentB"]);
    assert.deepEqual(titlesTo("parentB", msgs), [`${CHILDREN.noor}: موعد امتحان`]);
  });

  it("tells a group check's students only", async () => {
    // exGroup is for Adam alone (support groups).
    await ok(patch(x.exams.exGroup, { examDate: ammanDay(10) }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.deepEqual(titlesTo("parentA", msgs), [`${CHILDREN.adam}: موعد امتحان`]);
  });

  it("announces a dated draft when it is published, and not again on a re-publish", async () => {
    await ok(patch(x.exams.exPaperDraft, { examDate: ammanDay(11) }));
    assert.deepEqual(await stub.settle(200), [], "still a draft");
    const published = await call(server, "POST", `/evaluations/${x.exams.exPaperDraft}/publish`, w.users.t1);
    assert.equal(published.status, 200, published.text);
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `موعد امتحان: ${EX_TITLES.exPaperDraft}`);
    stub.clear();
    assert.equal((await call(server, "POST", `/evaluations/${x.exams.exPaperDraft}/publish`, w.users.t1)).status, 200);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("pushes nothing for another teacher's refused save", async () => {
    assert.equal((await patch(x.exams.exDated, { examTime: "14:00" }, w.users.t2)).status, 404);
    assert.deepEqual(await stub.settle(200), []);
  });

  // A day before today is refused (it used to be saved as a record, quietly).
  // exC3 (class c3, family B) is untouched by every case above.
  it("refuses a date in the past: a 400, nothing saved, nothing pushed", async () => {
    const stored = async () =>
      (await db.pool.query(`SELECT exam_date FROM evaluations WHERE id = $1`, [x.exams.exC3])).rows[0].exam_date;
    const before = await stored();
    const r = await patch(x.exams.exC3, { examDate: ammanDay(-1) });
    assert.equal(r.status, 400, r.text);
    assert.match(String(r.json.error), /today or later/);
    assert.equal(await stored(), before, "the stored date is untouched");
    assert.deepEqual(await stub.settle(300), []);
  });

  it("still pushes a date that is today", async () => {
    await ok(patch(x.exams.exC3, { examDate: ammanDay(0) }));
    assert.equal(sentTo(stub.messages(), "studentB")[0]?.title, `تغيّر موعد امتحان: ${EX_TITLES.exC3}`);
    assert.ok(sentTo(stub.messages(), "studentB")[0]?.body.includes(shownDay(ammanDay(0))));
  });

  it("still tells a cleared date that had been back-dated", async () => {
    // The API no longer accepts a past date, so an old one is planted directly
    // (as any exam dated before this rule would hold).
    await db.pool.query(`UPDATE evaluations SET exam_date = $1 WHERE id = $2`, [ammanDay(-2), x.exams.exC3]);
    await ok(patch(x.exams.exC3, { examDate: null }));
    assert.equal(sentTo(stub.messages(), "studentB")[0]?.title, `أُزيل موعد امتحان: ${EX_TITLES.exC3}`);
  });
});
