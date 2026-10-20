/**
 * What this guards: the push a family gets when a teacher posts homework. The
 * ways it goes wrong are all about WHO: another family, a teacher, a suspended
 * guardian, an archived roster row, an account that switched homework off —
 * and a push that fails or stalls taking the teacher's post down with it. Also
 * WHEN: homework already past its due day is a back-dated record, not news.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs, shownDay } from "../../test-support/seedPush.ts";

const DUE = ammanDay(3);

describeDb("homework pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let off: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;

  const post = (on: TestServer, teacher: string, classGroupId: string, title: string, dueDate: string = DUE) =>
    call(on, "POST", "/homework", teacher, { classGroupId, title, dueDate });

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
    off = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await server?.stop();
    await off?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("tells the class's student and each child's guardian, on every device, before answering", async () => {
    const r = await post(server, w.users.t1, w.classes.c1, "hw-push-c1");
    assert.equal(r.status, 201, server.logs().slice(-1500));
    // Awaited before the response: already here, no waiting.
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    const toStudent = sentTo(msgs, "studentA");
    assert.equal(toStudent.length, 1);
    assert.equal(toStudent[0].title, "واجب جديد: hw-push-c1");
    assert.ok(toStudent[0].body.includes("10A maths"));
    assert.ok(toStudent[0].body.includes(shownDay(DUE)));
    const toParent = sentTo(msgs, "parentA");
    assert.equal(toParent.length, 4, "two children × two devices");
    assert.deepEqual([...new Set(toParent.map(m => m.title))].sort(), [`${CHILDREN.adam}: واجب جديد`, `${CHILDREN.sara}: واجب جديد`].sort());
    for (const m of msgs) {
      assert.equal(m.channelId, "homework");
      assert.deepEqual(m.data, { screen: "school" });
      assert.equal(m.sound, "default");
    }
  });

  it("waits for the push before answering (Cloud Run throttles CPU after the response)", async () => {
    stub.delayNext(800);
    const started = Date.now();
    assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-slow")).status, 201);
    assert.ok(Date.now() - started >= 750, `answered after ${Date.now() - started}ms`);
  });

  it("leaves out a guardian who switched homework off — and only homework", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { homework: false });
    try {
      assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-pref")).status, 201);
      assert.deepEqual(ownersReached(stub.messages()), ["studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
    stub.clear();
    await setPushPrefs(db.pool, w.users.parentA, { exams: false, results: false });
    try {
      assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-pref-2")).status, 201);
      assert.deepEqual(ownersReached(stub.messages()), ["parentA", "studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });

  it("never reaches an archived roster row, nor a student linked to another row", async () => {
    // c2 (t2): Sara's second row (no student account) and Adam's ARCHIVED row.
    assert.equal((await post(server, w.users.t2, w.classes.c2, "hw-push-c2")).status, 201);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.deepEqual([...new Set(msgs.map(m => m.title))], [`${CHILDREN.sara}: واجب جديد`]);
  });

  it("keeps each family to its own classes", async () => {
    assert.equal((await post(server, w.users.t1, w.classes.c3, "hw-push-c3")).status, 201);
    assert.deepEqual(ownersReached(stub.messages()), ["parentB", "studentB"]);
  });

  it("still posts when Expo is down", async () => {
    stub.failNext(500);
    const r = await post(server, w.users.t1, w.classes.c1, "hw-push-expo-down");
    assert.equal(r.status, 201);
    const row = await db.pool.query(`SELECT 1 FROM homework WHERE title = 'hw-push-expo-down'`);
    assert.equal(row.rowCount, 1);
  });

  it("pushes nothing for a refused post, an edited due date, or while student accounts are off", async () => {
    assert.equal((await post(server, w.users.t2, w.classes.c1, "hw-push-refused")).status, 404);
    const created = await post(server, w.users.t1, w.classes.c1, "hw-push-edit");
    stub.clear();
    const patched = await call(server, "PATCH", `/homework/${created.json.homework.id}`, w.users.t1, { dueDate: ammanDay(5) });
    assert.equal(patched.status, 200);
    assert.equal((await post(off, w.users.t1, w.classes.c1, "hw-push-flag-off")).status, 201);
    assert.deepEqual(await stub.settle(300), []);
  });

  it("refuses homework due before today (nothing saved, nothing pushed), and pushes for one due today", async () => {
    // A due date before today is refused outright — it used to be allowed up to
    // 30 days back and saved as a record that pushed nothing.
    const yesterday = await post(server, w.users.t1, w.classes.c1, "hw-push-yesterday", ammanDay(-1));
    assert.equal(yesterday.status, 400, yesterday.text);
    assert.equal(yesterday.json.code, "due_date_out_of_range");
    const earlier = await post(server, w.users.t1, w.classes.c1, "hw-push-30-back", ammanDay(-30));
    assert.equal(earlier.status, 400);
    assert.deepEqual(await stub.settle(300), []);
    const rows = await db.pool.query(`SELECT 1 FROM homework WHERE title IN ('hw-push-yesterday', 'hw-push-30-back')`);
    assert.equal(rows.rowCount, 0, "neither is saved");

    // Due today is still ahead of the child: that day is still the day to do it.
    const today = await post(server, w.users.t1, w.classes.c1, "hw-push-today", ammanDay(0));
    assert.equal(today.status, 201);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    assert.ok(sentTo(msgs, "studentA")[0].body.includes(shownDay(ammanDay(0))));
  });
});
