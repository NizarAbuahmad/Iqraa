/**
 * What this guards: closing an exam hands in the sittings still open on it.
 *
 * A student who started, saved an answer and closed the tab stayed
 * `in_progress` for ever: the close only flipped the exam's status, so the
 * saved answers were never marked and never reached the teacher or the family.
 * Closing now collects them through the same `gradeSubmission` a real hand-in
 * uses — and must leave alone everything that is not an abandoned student
 * sitting: a sitting with nothing saved, a paper the teacher is typing in, a
 * paper already in. It must also survive a student handing in at the very
 * moment the teacher closes.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { hashAccessToken } from "../../modules/assessment/studentView.ts";

const BODY = {
  stem: "ما حل المعادلة 2x + 1 = 7؟",
  options: [{ id: "a", text: "x = 2" }, { id: "b", text: "x = 3" }, { id: "c", text: "x = 4" }],
};
const KEY = { optionIds: ["b"] };
const TOKEN_OPEN = "close-collect-open-sitting-token";
const TOKEN_RACE = "close-collect-race-sitting-token";

describeDb("closing an exam collects unfinished sittings, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let examId: string;
  let qid: string;
  let scaleId: string;
  const attempt: Record<string, string> = {};

  const bands = [
    { key: "beginner", minPercent: 0, maxPercent: 49.99 },
    { key: "developing", minPercent: 50, maxPercent: 69.99 },
    { key: "proficient", minPercent: 70, maxPercent: 84.99 },
    { key: "advanced", minPercent: 85, maxPercent: 100 },
  ];

  /** A sitting on `evaluationId`'s one question, with the snapshot a real start freezes. */
  async function sitting(
    evaluationId: string,
    questionId: string,
    studentId: string,
    source: "student_link" | "teacher_entry",
    opts: { answer?: unknown; token?: string } = {},
  ): Promise<string> {
    const snapshot = [
      { id: questionId, type: "multiple_choice", marks: "10.00", body: BODY, expectedAnswer: KEY, competencyKey: "understanding", objectiveId: "obj-test" },
    ];
    const r = await db.pool.query<{ id: string }>(
      `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, question_snapshot, level_scale_snapshot, access_token_hash, token_expires_at)
       VALUES ($1, $2, $3, 'in_progress', now(), $4::jsonb, $5::jsonb, $6, CASE WHEN $6::text IS NULL THEN NULL ELSE now() + interval '1 hour' END)
       RETURNING id`,
      [
        evaluationId,
        studentId,
        source,
        JSON.stringify(snapshot),
        JSON.stringify({ scaleId, bands }),
        opts.token ? hashAccessToken(opts.token) : null,
      ],
    );
    const id = r.rows[0]!.id;
    if (opts.answer !== undefined) {
      await db.pool.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, response, is_final) VALUES ($1, $2, $3::jsonb, false)`,
        [id, questionId, JSON.stringify(opts.answer)],
      );
    }
    return id;
  }
  const row = async (id: string) =>
    (await db.pool.query(`SELECT status, submitted_at, graded_at FROM attempts WHERE id = $1`, [id])).rows[0] as {
      status: string;
      submitted_at: Date | null;
      graded_at: Date | null;
    };
  const resultsOf = async (id: string) =>
    (await db.pool.query(`SELECT earned_marks, total_marks FROM attempt_results WHERE attempt_id = $1`, [id])).rows;
  const close = (id: string, as = w.users.t1) => call(on, "POST", `/evaluations/${id}/close`, as);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    scaleId = x.scaleId;
    examId = x.exams.exDated;
    qid = x.questions.exDated;

    attempt.withAnswer = await sitting(examId, qid, w.students.sA1, "student_link", { answer: { optionIds: ["b"] }, token: TOKEN_OPEN });
    attempt.noAnswer = await sitting(examId, qid, w.students.sA2, "student_link");
    attempt.teacherTyping = await sitting(examId, qid, w.students.aA, "teacher_entry", { answer: { optionIds: ["b"] } });
    // Already handed in and marked, long ago: close must neither count nor touch it.
    await db.pool.query(
      `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, submitted_at, graded_at, question_snapshot, level_scale_snapshot)
       VALUES ($1, $2, 'student_link', 'graded', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days', '[]'::jsonb, '{}'::jsonb)`,
      [examId, w.students.nB1],
    );
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("another teacher cannot close it, and nothing is collected", async () => {
    const r = await close(examId, w.users.t2);
    assert.equal(r.status, 404);
    assert.equal((await row(attempt.withAnswer!)).status, "in_progress");
  });

  it("hands in and marks a sitting with a saved answer, and says how many", async () => {
    const r = await close(examId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.equal(r.json.evaluation.status, "closed");
    assert.equal(r.json.collected, 1, "only the sitting with a saved answer");

    const a = await row(attempt.withAnswer!);
    assert.equal(a.status, "graded");
    assert.ok(a.submitted_at, "stamped as handed in");
    const [res] = await resultsOf(attempt.withAnswer!);
    assert.equal(Number(res.earned_marks), 10, "the saved answer was marked, as a real hand-in is");
    const answers = await db.pool.query(`SELECT is_final FROM attempt_answers WHERE attempt_id = $1`, [attempt.withAnswer]);
    assert.ok(answers.rows.every(r => r.is_final === true));
    const grades = await db.pool.query(`SELECT 1 FROM attempt_question_grades WHERE attempt_id = $1`, [attempt.withAnswer]);
    assert.equal(grades.rowCount, 1);
  });

  it("the student's own screen then sees a handed-in paper, not an unfinished one", async () => {
    const res = await fetch(`${on.base}/take/attempt/result`, { headers: { Authorization: `Bearer ${TOKEN_OPEN}` } });
    assert.equal(res.status, 200);
  });

  it("leaves alone a sitting with nothing saved, a paper the teacher is typing, and one already in", async () => {
    const none = await row(attempt.noAnswer!);
    assert.equal(none.status, "in_progress");
    assert.equal(none.submitted_at, null);
    assert.equal((await resultsOf(attempt.noAnswer!)).length, 0);

    const typed = await row(attempt.teacherTyping!);
    assert.equal(typed.status, "in_progress");
    assert.equal(typed.submitted_at, null);

    const done = await db.pool.query(
      `SELECT submitted_at < now() - interval '1 day' AS old FROM attempts WHERE evaluation_id = $1 AND student_id = $2`,
      [examId, w.students.nB1],
    );
    assert.equal(done.rows[0].old, true, "a hand-in from before the close keeps its time");
  });

  it("closing again is refused and collects nothing twice", async () => {
    const r = await close(examId);
    assert.equal(r.status, 409);
    assert.equal(r.json.code, "not_published");
    assert.equal((await resultsOf(attempt.withAnswer!)).length, 1);
  });

  it("a student handing in at the moment the teacher closes is marked exactly once", async () => {
    const exam2 = x.exams.exNoClass;
    const q2 = (await db.pool.query<{ id: string }>(`SELECT id FROM evaluation_questions WHERE evaluation_id = $1 LIMIT 1`, [exam2])).rows[0]!.id;
    const raced = await sitting(exam2, q2, w.students.sA2, "student_link", { answer: { optionIds: ["b"] }, token: TOKEN_RACE });

    const [closed, submitted] = await Promise.all([
      close(exam2),
      fetch(`${on.base}/take/attempt/submit`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN_RACE}` } }),
    ]);
    assert.equal(closed.status, 200, on.logs().slice(-1500));
    assert.equal(submitted.status, 200, on.logs().slice(-1500));
    // Whoever won the row lock, the paper is in once, marked once, and the count never over-reports.
    assert.ok([0, 1].includes(closed.json.collected as number));
    const a = await row(raced);
    assert.equal(a.status, "graded");
    assert.equal((await resultsOf(raced)).length, 1);
    const grades = await db.pool.query(`SELECT 1 FROM attempt_question_grades WHERE attempt_id = $1`, [raced]);
    assert.equal(grades.rowCount, 1, "no duplicated grade rows");
  });
});
