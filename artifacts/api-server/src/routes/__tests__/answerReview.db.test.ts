/**
 * What this guards: «راجع إجاباتك» hands out the answer key, so the leaks are
 * the whole risk — a key reaching a student while the exam is still open,
 * before results are released, after the teacher hid it, to another student,
 * or as the raw `expectedAnswer` instead of display text.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

const BODY = {
  stem: "ما حل المعادلة 2x + 1 = 7؟",
  options: [{ id: "a", text: "x = 2" }, { id: "b", text: "x = 3" }, { id: "c", text: "x = 4" }],
};
const KEY = { optionIds: ["b"] };
const STEPS = ["اطرح 1 من الطرفين: 2x = 6", "اقسم على 2: x = 3"];

describeDb("answer review over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let examId: string;

  const reviewFor = (userId: string) => call(on, "GET", `/student/exams/${examId}/review`, userId);
  const rowFor = async (userId: string) => {
    const r = await call(on, "GET", "/student/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return (r.json.exams as { title: string; review: boolean }[]).find(e => e.title === EX_TITLES.exReleased);
  };
  const setShown = (shown: boolean) => call(on, "POST", `/evaluations/${examId}/solutions`, w.users.t1, { shown });

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    examId = x.exams.exReleased;
    const qid = x.questions.exReleased;
    // The seed's question is a bare stub; give it a real body, key and steps,
    // and Sara's sitting the snapshot, answer and grade a real paper has.
    await db.pool.query(
      `UPDATE evaluation_questions SET body = $2::jsonb, expected_answer = $3::jsonb, worked_steps = $4::jsonb WHERE id = $1`,
      [qid, JSON.stringify(BODY), JSON.stringify(KEY), JSON.stringify(STEPS)],
    );
    const snapshot = [{ id: qid, type: "multiple_choice", marks: "10.00", body: BODY, expectedAnswer: KEY }];
    await db.pool.query(`UPDATE attempts SET question_snapshot = $2::jsonb WHERE id = $1`, [
      x.attempts.saraReleased,
      JSON.stringify(snapshot),
    ]);
    await db.pool.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, response, is_final) VALUES ($1, $2, $3::jsonb, true)`,
      [x.attempts.saraReleased, qid, JSON.stringify({ optionIds: ["a"] })],
    );
    await db.pool.query(
      `INSERT INTO attempt_question_grades (attempt_id, question_id, awarded_marks, max_marks, verdict, grader)
       VALUES ($1, $2, 0, 10, 'incorrect', 'deterministic')`,
      [x.attempts.saraReleased, qid],
    );
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("refuses to show answers while the exam is still open", async () => {
    const r = await setShown(true);
    assert.equal(r.status, 409);
    assert.equal(r.json.code, "not_closed");
    assert.equal((await rowFor(w.users.studentA))?.review, false);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
  });

  it("hands the student their paper as text once the closed exam's answers are shown", async () => {
    assert.equal((await call(on, "POST", `/evaluations/${examId}/close`, w.users.t1)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 404, "closed alone is not enough");
    assert.equal((await setShown(true)).status, 200);

    assert.equal((await rowFor(w.users.studentA))?.review, true);
    const r = await reviewFor(w.users.studentA);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    const [item] = r.json.items;
    assert.equal(item.yourAnswer, "x = 2");
    assert.equal(item.correctAnswer, "x = 3");
    assert.equal(item.verdict, "incorrect");
    assert.equal(item.awardedMarks, 0);
    assert.deepEqual(item.steps, STEPS);
    assert.ok(!r.text.includes("optionIds"), "neither the raw key nor the raw response leaves");
  });

  it("is the student's own paper only", async () => {
    assert.equal((await reviewFor(w.users.studentB)).status, 404);
    assert.equal((await reviewFor(w.users.parentA)).status, 403);
    // Teacher-only: a student cannot turn the review on.
    assert.equal((await call(on, "POST", `/evaluations/${examId}/solutions`, w.users.studentA, { shown: true })).status, 403);
  });

  it("prepares no steps where every question already has them, so no model is called", async () => {
    const r = await call(on, "POST", `/evaluations/${examId}/worked-steps`, w.users.t1);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.equal(r.json.missed, 0);
  });

  it("goes dark when the teacher hides it, and when the exam is re-published", async () => {
    assert.equal((await setShown(false)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);

    assert.equal((await setShown(true)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 200);
    const pub = await call(on, "POST", `/evaluations/${examId}/publish`, w.users.t1);
    assert.equal(pub.status, 200, pub.text);
    assert.equal(pub.json.evaluation.showSolutionsToStudent, false);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
  });
});
