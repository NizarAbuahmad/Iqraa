/**
 * What this guards: the day-before reminder. Wrong in three ways: the wrong
 * people (a ticked-off child, another family, an archived row, a suspended or
 * switched-off account), the wrong words ("not done" about a child nobody can
 * tick for), and the wrong number of times (a second run must send nothing).
 * The trigger is a shared key: wrong, missing or UNSET is a 404.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { startPushStub, type PushStub, type StubMessage } from "../../test-support/pushStub.ts";
import { ammanDueAt, ownersReached, RM_TITLES, seedPushWorld, seedReminderHomework, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

const KEY = "test-cron-key-0123456789abcdef";
const PATH = "/internal/homework-reminders";

describeDb("homework reminders, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let keyless: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let hw: Record<keyof typeof RM_TITLES, string>;

  const trigger = (on: TestServer, key?: string) =>
    fetch(`${on.base}${PATH}`, { method: "POST", headers: key === undefined ? {} : { "x-internal-key": key } });
  const about = (msgs: StubMessage[], title: string) => msgs.filter(m => m.body.includes(`«${title}»`));
  const claims = async () => Number((await db.pool.query(`SELECT count(*) AS n FROM homework_reminders`)).rows[0].n);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    hw = await seedReminderHomework(db.pool, w);
    await setPushPrefs(db.pool, w.users.parentB, { homework: false });
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, INTERNAL_CRON_KEY: KEY } });
    keyless = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, INTERNAL_CRON_KEY: undefined } });
  });
  after(async () => {
    await server?.stop();
    await keyless?.stop();
    await stub?.close();
    await db?.drop();
  });

  it("is a 404 without the right key, and with no key configured at all", async () => {
    assert.equal((await trigger(server)).status, 404);
    assert.equal((await trigger(server, "wrong")).status, 404);
    assert.equal((await trigger(keyless, KEY)).status, 404);
    assert.equal((await trigger(keyless, "")).status, 404);
    assert.equal(await claims(), 0);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("reminds about homework due tomorrow, saying 'not marked done' only where someone can tick", async () => {
    const res = await trigger(server, KEY);
    assert.equal(res.status, 200, server.logs().slice(-1500));
    const body = (await res.json()) as { homework: number; pushed: number };
    const msgs = stub.messages();

    // rm-c1: Sara (account, not done) and Adam (no account).
    const c1 = about(msgs, RM_TITLES.c1);
    assert.deepEqual(ownersReached(c1), ["parentA", "studentA"]);
    assert.equal(sentTo(c1, "studentA")[0]?.title, "تذكير: واجب موعده غدًا");
    assert.ok(sentTo(c1, "studentA")[0]?.body.includes("لم يُعلَّم كمُنجَز بعد"));
    const saraPush = sentTo(c1, "parentA").filter(m => m.title === `${CHILDREN.sara}: واجب موعده غدًا`);
    const adamPush = sentTo(c1, "parentA").filter(m => m.title === `${CHILDREN.adam}: واجب موعده غدًا`);
    assert.equal(saraPush.length, 2);
    assert.equal(adamPush.length, 2);
    assert.ok(saraPush.every(m => m.body.includes("لم يُعلَّم كمُنجَز بعد")));
    assert.ok(adamPush.every(m => !m.body.includes("لم يُعلَّم")), "Adam has no account: never 'not done'");

    // rm-c1-done: Sara ticked it, so only Adam's softer reminder.
    const done = about(msgs, RM_TITLES.c1Done);
    assert.deepEqual(ownersReached(done), ["parentA"]);
    assert.deepEqual([...new Set(done.map(m => m.title))], [`${CHILDREN.adam}: واجب موعده غدًا`]);

    // rm-c3: Noor's own account; her guardian switched homework off.
    assert.deepEqual(ownersReached(about(msgs, RM_TITLES.c3)), ["studentB"]);

    // rm-c2: Sara's second row has no account (soft); Adam's row there is archived.
    const c2 = about(msgs, RM_TITLES.c2);
    assert.deepEqual(ownersReached(c2), ["parentA"]);
    assert.deepEqual([...new Set(c2.map(m => m.title))], [`${CHILDREN.sara}: واجب موعده غدًا`]);
    assert.ok(c2.every(m => !m.body.includes("لم يُعلَّم")));

    for (const quiet of [RM_TITLES.today, RM_TITLES.dayAfter, RM_TITLES.archived, RM_TITLES.archivedClass]) {
      assert.deepEqual(about(msgs, quiet), [], quiet);
    }
    for (const owner of ["suspendedParent", "parentB", "t1", "t2", "studentUnlinked"] as const) {
      assert.equal(sentTo(msgs, owner).length, 0, owner);
    }
    for (const m of msgs) {
      assert.equal(m.channelId, "homework");
      assert.deepEqual(m.data, { screen: "school" });
    }
    assert.deepEqual(body, { homework: 4, pushed: msgs.length });
    assert.equal(msgs.length, 10, "rm-c1 5 + rm-c1-done 2 + rm-c3 1 + rm-c2 2");
    assert.equal(await claims(), 4);
  });

  it("sends nothing twice: a second run the same day is empty", async () => {
    stub.clear();
    const res = await trigger(server, KEY);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { homework: 0, pushed: 0 });
    assert.deepEqual(await stub.settle(200), []);
  });

  it("reminds again for a homework whose due date moved to tomorrow", async () => {
    stub.clear();
    await db.pool.query(`UPDATE homework SET due_at = $2 WHERE id = $1`, [hw.dayAfter, ammanDueAt(1)]);
    const res = await trigger(server, KEY);
    assert.equal(((await res.json()) as { homework: number }).homework, 1);
    assert.ok(about(stub.messages(), RM_TITLES.dayAfter).length > 0);
  });

  // Added after the cases above on purpose: it creates one more homework and
  // claim, so the counts asserted there (4 homework, 4 claims, 10 messages)
  // stay as the seed alone produces them.
  it("treats a child whose only account is suspended as untracked: soft reminder, and the student gets nothing", async () => {
    // A suspended student cannot sign in or tick, so telling the guardian
    // "not marked done" would be false — nobody can mark it.
    const title = "rm-suspended-student";
    await db.pool.query(`INSERT INTO homework (teacher_id, class_group_id, title, due_at) VALUES ($1, $2, $3, $4)`, [
      w.users.t1,
      w.classes.c1,
      title,
      ammanDueAt(1),
    ]);
    await db.pool.query(`UPDATE users SET suspended_at = now() WHERE id = $1`, [w.users.studentA]);
    try {
      stub.clear();
      const res = await trigger(server, KEY);
      assert.equal(res.status, 200, server.logs().slice(-1500));
      assert.equal(((await res.json()) as { homework: number }).homework, 1);
      const msgs = about(stub.messages(), title);
      assert.deepEqual(ownersReached(msgs), ["parentA"], "the suspended student gets nothing");
      assert.deepEqual([...new Set(msgs.map(m => m.title))].sort(), [`${CHILDREN.adam}: واجب موعده غدًا`, `${CHILDREN.sara}: واجب موعده غدًا`].sort());
      assert.equal(msgs.length, 4, "Sara and Adam, two devices each");
      assert.ok(msgs.every(m => !m.body.includes("لم يُعلَّم")), "nobody can tick for a suspended student: never 'not done'");
    } finally {
      await db.pool.query(`UPDATE users SET suspended_at = NULL WHERE id = $1`, [w.users.studentA]);
    }
  });
});
