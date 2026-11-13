/**
 * What this guards: closing an exam hands in every sitting a student started
 * through the link and never handed in — a phone that died after time was up,
 * a tab closed mid-paper. Before this, close only flipped the status: those
 * sittings stayed `in_progress` and ungraded for good, the family saw «قيد
 * الحل», the mastery gate never counted them, and the teacher had to hand
 * each one in by hand.
 *
 * What it must not touch: a paper the teacher is typing in for a student
 * (`teacher_entry`), and open sittings of any other exam.
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
const CODE = "CSEXAM";

describeDb("closing an exam hands in the sittings left open", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let adamAttempt: string;
  let zainTeacherEntry: string;
  let closed: Awaited<ReturnType<typeof call>>;

  const attempt = async (id: string) =>
    (
      await db.pool.query<{ status: string; submitted_at: Date | null }>(
        `SELECT status, submitted_at FROM attempts WHERE id = $1`,
        [id],
      )
    ).rows[0]!;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await db.pool.query(`UPDATE evaluations SET share_code = $2 WHERE id = $1`, [x.exams.exDated, CODE]);
    on = await startServer({ databaseUrl: db.url });

    // Adam starts through the link, answers, and never hands in.
    const claim = await call(on, "POST", `/take/${CODE}/claim`, undefined, { studentId: w.students.aA });
    assert.equal(claim.status, 201, claim.text);
    const token = claim.json.token as string;
    const save = await fetch(`${on.base}/take/attempt/answers/${x.questions.exDated}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ response: { optionIds: ["1"] } }),
    });
    assert.equal(save.status, 200, await save.text());
    adamAttempt = (
      await db.pool.query<{ id: string }>(`SELECT id FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [
        x.exams.exDated,
        w.students.aA,
      ])
    ).rows[0]!.id;

    // The teacher is typing Zain's paper in by hand; it is theirs to finish.
    zainTeacherEntry = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at)
         VALUES ($1, $2, 'teacher_entry', 'in_progress', now()) RETURNING id`,
        [x.exams.exDated, x.zain],
      )
    ).rows[0]!.id;

    closed = await call(on, "POST", `/evaluations/${x.exams.exDated}/close`, w.users.t1);
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("closes, and says how many papers it handed in", () => {
    assert.equal(closed.status, 200, closed.text);
    assert.equal(closed.json.evaluation.status, "closed");
    assert.equal(closed.json.handedIn, 1);
  });

  it("hands in the student's open sitting, with its answers final and a result built", async () => {
    const a = await attempt(adamAttempt);
    assert.notEqual(a.submitted_at, null);
    assert.notEqual(a.status, "in_progress");
    const answers = await db.pool.query<{ is_final: boolean }>(
      `SELECT is_final FROM attempt_answers WHERE attempt_id = $1`,
      [adamAttempt],
    );
    assert.equal(answers.rowCount, 1);
    assert.equal(answers.rows[0]!.is_final, true);
    const result = await db.pool.query(`SELECT 1 FROM attempt_results WHERE attempt_id = $1`, [adamAttempt]);
    assert.equal(result.rowCount, 1);
  });

  it("leaves a paper the teacher is typing in untouched", async () => {
    const a = await attempt(zainTeacherEntry);
    assert.equal(a.submitted_at, null);
    assert.equal(a.status, "in_progress");
  });

  it("leaves another exam's open sitting untouched", async () => {
    const a = await attempt(x.attempts.zainPaper);
    assert.equal(a.submitted_at, null);
    assert.equal(a.status, "in_progress");
  });
});
