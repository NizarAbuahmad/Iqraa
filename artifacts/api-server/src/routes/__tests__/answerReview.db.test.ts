/**
 * What this guards: «راجع إجاباتك» hands out the answer key, so the leaks are
 * the whole risk — a key reaching a student while the exam is still open,
 * before results are released, after the teacher hid it, to another student,
 * or as the raw `expectedAnswer` instead of display text.
 *
 * Since 2026-11-25 a parent opens the same paper (`GET /parent/exams/:id/review`),
 * so the parent is held to the same rule: never earlier than the child, never
 * another family's child, and a sibling's paper only under that sibling's key.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
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
  const parentReview = (userId: string, child: string) =>
    call(on, "GET", `/parent/exams/${examId}/review?child=${encodeURIComponent(child)}`, userId);
  /** The parent's child key for one child, as «المدرسة» and the results screen read it. */
  const keyOf = async (userId: string, name: string): Promise<string> => {
    const r = await call(on, "GET", "/parent/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    const child = (r.json.children as { key: string; displayName: string }[]).find(c => c.displayName === name);
    assert.ok(child, `${name} is one of this parent's children`);
    return child.key;
  };
  const parentRow = async (userId: string, name: string) => {
    const r = await call(on, "GET", "/parent/exams", userId);
    const child = (r.json.children as { displayName: string; exams: { title: string; review: boolean }[] }[]).find(
      c => c.displayName === name && c.exams.some(e => e.title === EX_TITLES.exReleased),
    );
    return child?.exams.find(e => e.title === EX_TITLES.exReleased);
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
    assert.equal((await parentRow(w.users.parentA, CHILDREN.sara))?.review, false);
    assert.equal((await parentReview(w.users.parentA, await keyOf(w.users.parentA, CHILDREN.sara))).status, 404);
  });

  it("keeps «تغذية راجعة فورية» the student's: a parent gets the full review only", async () => {
    const instant = (enabled: boolean) => call(on, "POST", `/evaluations/${examId}/instant-feedback`, w.users.t1, { enabled });
    assert.equal((await instant(true)).status, 200, on.logs().slice(-1500));
    const mine = await reviewFor(w.users.studentA);
    assert.equal(mine.status, 200, on.logs().slice(-1500));
    assert.equal(mine.json.mode, "feedback");
    assert.equal(mine.json.items[0].correctAnswer, null, "feedback carries no key");
    assert.equal((await parentReview(w.users.parentA, await keyOf(w.users.parentA, CHILDREN.sara))).status, 404);
    assert.equal((await parentRow(w.users.parentA, CHILDREN.sara))?.review, false);
    assert.equal((await instant(false)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 404, "back to waiting for the answers");
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

  it("hands the child's parent the same paper, under the child's key", async () => {
    assert.equal((await parentRow(w.users.parentA, CHILDREN.sara))?.review, true);
    const mine = await reviewFor(w.users.studentA);
    const r = await parentReview(w.users.parentA, await keyOf(w.users.parentA, CHILDREN.sara));
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.deepEqual(r.json, mine.json, "exactly what the child sees");
    assert.deepEqual(r.json.items[0].steps, STEPS);
    assert.ok(!r.text.includes("optionIds"));
  });

  it("names what went well and what needs work on the released result, for the student and the parent alike", async () => {
    const STRONG = "o-nccd-chem-s1-u1_l1-0";
    const WEAK = "o-nccd-chem-s1-u1_l1-1";
    await db.pool.query(`UPDATE attempt_results SET objective_scores = $2::jsonb WHERE attempt_id = $1`, [
      x.attempts.saraReleased,
      JSON.stringify([
        { objectiveId: STRONG, earned: 4, total: 4, percent: 100, questionCount: 2, marksLost: 0, bloomsRank: 1 },
        { objectiveId: WEAK, earned: 1, total: 6, percent: 16.67, questionCount: 3, marksLost: 5, bloomsRank: 2 },
        { objectiveId: "o-one-question", earned: 0, total: 2, percent: 0, questionCount: 1, marksLost: 2, bloomsRank: 1 },
      ]),
    ]);
    const student = await call(on, "GET", "/student/exams", w.users.studentA);
    const parent = await call(on, "GET", "/parent/exams", w.users.parentA);
    const mine = (student.json.exams as { title: string; result: { topics: unknown } | null }[]).find(e => e.title === EX_TITLES.exReleased);
    const theirs = (parent.json.children as { displayName: string; exams: { title: string; result: { topics: unknown } | null }[] }[])
      .flatMap(c => (c.displayName === CHILDREN.sara ? c.exams : []))
      .find(e => e.title === EX_TITLES.exReleased);
    const expected = {
      strong: [{ objectiveId: STRONG, title: "أوضح المقصود بالطيف الكهرمغناطيسي.", titleAr: "أوضح المقصود بالطيف الكهرمغناطيسي." }],
      weak: [{ objectiveId: WEAK, title: "أوضح أهم فروض نظرية بور لذرة الهيدروجين.", titleAr: "أوضح أهم فروض نظرية بور لذرة الهيدروجين." }],
    };
    // The chemistry catalog's outcomes are Arabic only, so the English title falls back to it.
    const shape = (t: unknown) => JSON.parse(JSON.stringify(t)) as typeof expected;
    assert.deepEqual(shape(mine?.result?.topics).strong.map(s => s.objectiveId), [STRONG]);
    assert.deepEqual(shape(mine?.result?.topics).weak.map(s => s.objectiveId), [WEAK], "one question names nothing");
    assert.deepEqual(theirs?.result?.topics, mine?.result?.topics, "the parent reads the same summary");
    assert.equal(shape(mine?.result?.topics).strong[0]!.titleAr, expected.strong[0]!.titleAr);
    for (const r of [student, parent]) assert.ok(!r.text.includes("objectiveScores") && !r.text.includes("marksLost"), "the scores themselves never leave");
  });

  it("is never another child's paper", async () => {
    // Adam sat the same exam, but his paper still has a question to mark: his key opens nothing,
    // and above all not his sister's paper from the same class.
    assert.equal((await parentReview(w.users.parentA, await keyOf(w.users.parentA, CHILDREN.adam))).status, 404);
    // Another family's parent, with Sara's key in hand.
    const saraKey = await keyOf(w.users.parentA, CHILDREN.sara);
    assert.equal((await parentReview(w.users.parentB, saraKey)).status, 404);
    assert.equal((await parentReview(w.users.parentA, "")).status, 404, "a missing key");
    assert.equal((await parentReview(w.users.parentA, "not-a-child")).status, 404);
    // The route is the parent's: a student or a teacher is refused by role.
    assert.equal((await parentReview(w.users.studentA, saraKey)).status, 403);
    assert.equal((await parentReview(w.users.t1, saraKey)).status, 403);
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
    const saraKey = await keyOf(w.users.parentA, CHILDREN.sara);
    assert.equal((await parentReview(w.users.parentA, saraKey)).status, 404, "hidden from the parent too");
    assert.equal((await parentRow(w.users.parentA, CHILDREN.sara))?.review, false);

    assert.equal((await setShown(true)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 200);
    const pub = await call(on, "POST", `/evaluations/${examId}/publish`, w.users.t1);
    assert.equal(pub.status, 200, pub.text);
    assert.equal(pub.json.evaluation.showSolutionsToStudent, false);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
    assert.equal((await parentReview(w.users.parentA, saraKey)).status, 404);
  });
});
