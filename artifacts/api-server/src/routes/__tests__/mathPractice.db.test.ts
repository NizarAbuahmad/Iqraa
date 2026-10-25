/**
 * What this guards: a student's Math Corner score lands on that student's own
 * roster rows and nowhere else, the best is kept, and a teacher reads it only
 * for a live class they own, through class membership.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

const MATHS = "kbl-g5-math-s1-nccd-u2_l3";
const MATHS_2 = "kbl-math-s1-nccd-u1_lab";

interface Row { studentId: string; displayName: string; lessonId: string; correct: number; total: number; attempts: number; practicedAt: string }

async function call(server: TestServer, method: string, path: string, userId?: string, body?: unknown) {
  const headers: Record<string, string> = userId ? { Authorization: `Bearer ${accessToken(userId)}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
}

describeDb("Math Corner practice over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let w: FamilyWorld;

  const save = (userId: string, body: unknown, server = on) => call(server, "PUT", "/student/math-practice", userId, body);
  const classView = async (classId: string, teacher: string) => {
    const r = await call(on, "GET", `/classes/${classId}/math-practice`, teacher);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return r.json.results as Row[];
  };
  const rowsFor = async (studentId: string) =>
    (await db.pool.query(`SELECT lesson_id, correct, total, attempts FROM math_practice_results WHERE student_id = $1 ORDER BY lesson_id`, [studentId])).rows;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    on = await startServer({ databaseUrl: db.url });
    off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await off?.stop();
    await on?.stop();
    await db?.drop();
  });

  it("refuses the wrong role on each route", async () => {
    for (const userId of [w.users.t1, w.users.parentA]) {
      assert.equal((await save(userId, { lessonId: MATHS, correct: 1, total: 2 })).status, 403);
    }
    for (const userId of [w.users.studentA, w.users.parentA]) {
      assert.equal((await call(on, "GET", `/classes/${w.classes.c1}/math-practice`, userId)).status, 403);
    }
  });

  it("is closed while student accounts are off, and refuses a bad body", async () => {
    assert.equal((await save(w.users.studentA, { lessonId: MATHS, correct: 1, total: 2 }, off)).status, 403);
    for (const body of [{ lessonId: "no-such-lesson", correct: 1, total: 2 }, { lessonId: MATHS, correct: 3, total: 2 }, {}]) {
      assert.equal((await save(w.users.studentA, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await db.pool.query(`SELECT count(*)::int AS n FROM math_practice_results`)).rows[0].n, 0);
  });

  it("an account with no roster row saves nothing, without an error", async () => {
    const r = await save(w.users.studentUnlinked, { lessonId: MATHS, correct: 5, total: 10 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { saved: false });
    assert.equal((await db.pool.query(`SELECT count(*)::int AS n FROM math_practice_results`)).rows[0].n, 0);
  });

  it("writes only the account's own self-linked row and keeps the best ratio", async () => {
    assert.deepEqual((await save(w.users.studentA, { lessonId: MATHS, correct: 7, total: 10 })).json, { saved: true });
    await save(w.users.studentA, { lessonId: MATHS, correct: 5, total: 10 });
    assert.deepEqual(await rowsFor(w.students.sA1), [{ lesson_id: MATHS, correct: 7, total: 10, attempts: 2 }], "a worse set only counts as an attempt");
    await save(w.users.studentA, { lessonId: MATHS, correct: 4, total: 5 });
    assert.deepEqual(await rowsFor(w.students.sA1), [{ lesson_id: MATHS, correct: 4, total: 5, attempts: 3 }], "4/5 beats 7/10");
    // Sara's row under t2 is guardian-linked only, and Adam shares her class: neither gets a row.
    assert.deepEqual(await rowsFor(w.students.sA2), []);
    assert.deepEqual(await rowsFor(w.students.aA), []);
  });

  it("shows the teacher their own live class's practice, and nobody else's", async () => {
    await save(w.users.studentB, { lessonId: MATHS_2, correct: 3, total: 8 });

    const c1 = await classView(w.classes.c1, w.users.t1);
    assert.deepEqual(
      c1.map(r => [r.displayName, r.lessonId, r.correct, r.total, r.attempts]),
      [[CHILDREN.sara, MATHS, 4, 5, 3]],
      "c1 holds Sara and Adam; only Sara practised, and Noor is in c3",
    );
    assert.equal(c1[0]!.studentId, w.students.sA1);
    assert.ok(!Number.isNaN(Date.parse(c1[0]!.practicedAt)));

    const c3 = await classView(w.classes.c3, w.users.t1);
    assert.deepEqual(c3.map(r => [r.displayName, r.lessonId]), [[CHILDREN.noor, MATHS_2]]);

    // Another teacher's class, and an archived class, are one answer: not found.
    assert.equal((await call(on, "GET", `/classes/${w.classes.c1}/math-practice`, w.users.t2)).status, 404);
    assert.equal((await call(on, "GET", `/classes/${w.classes.c4}/math-practice`, w.users.t1)).status, 404);
    assert.deepEqual(await classView(w.classes.c2, w.users.t2), [], "Sara's t2 row never received her practice");
  });
});
