/**
 * What this guards: the anonymous tap-a-name claim on `/take/:code/claim`
 * must not let anyone holding the link sit an exam under the name of a
 * classmate who has their own student account. That student proves who they
 * are by signing in (`claim-self`); before this guard a classmate could claim
 * and hand in a blank paper under their name, and their own sign-in then
 * resumed the stranger's paper.
 *
 * A name with no account — the common case, and the whole point of a shared
 * link — still claims anonymously, and a parent's `guardian` link does not
 * count as the child having an account.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

// The seed's codes end in "1", which is not in SHARE_CODE_ALPHABET and so
// can never be typed in; this file gives its exam one that can.
const CODE = "TAKEXM";

describeDb("anonymous exam claim of a name that has its own account", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  const sittings = async (studentId: string) =>
    (
      await db.pool.query(`SELECT id FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [
        x.exams.exDated,
        studentId,
      ])
    ).rowCount;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await db.pool.query(`UPDATE evaluations SET share_code = $2 WHERE id = $1`, [x.exams.exDated, CODE]);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("refuses an anonymous claim of a student who has a linked account, and starts nothing", async () => {
    // Sara's row in c1 (sA1) is `self`-linked to the account studentA.
    const r = await call(on, "POST", `/take/${CODE}/claim`, undefined, { studentId: w.students.sA1 });
    assert.equal(r.status, 403, r.text);
    assert.equal(r.json.code, "sign_in_required");
    assert.equal(r.json.token, undefined);
    assert.equal(await sittings(w.students.sA1), 0);
  });

  it("still lets that student start by signing in", async () => {
    const r = await call(on, "POST", `/take/${CODE}/claim-self`, w.users.studentA);
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.student.id, w.students.sA1);
  });

  it("still lets a name with only a parent's link be claimed anonymously", async () => {
    // Adam (aA) has a guardian link to parentA and no account of his own.
    const r = await call(on, "POST", `/take/${CODE}/claim`, undefined, { studentId: w.students.aA });
    assert.equal(r.status, 201, r.text);
    assert.ok(r.json.token);
  });

  it("still lets a name with no link at all be claimed anonymously", async () => {
    const r = await call(on, "POST", `/take/${CODE}/claim`, undefined, { studentId: x.zain });
    assert.equal(r.status, 201, r.text);
  });
});
