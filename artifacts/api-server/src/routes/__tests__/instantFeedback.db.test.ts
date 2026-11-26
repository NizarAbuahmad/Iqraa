/**
 * What this guards: «تغذية راجعة فورية» shows a student right and wrong on an
 * exam that is still being sat, so the risk is the answer key riding along —
 * through the review route, the «اختباراتي» row or the hand-in screen's
 * `/take/attempt/result` — or the feedback outliving the release it depends on.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { hashAccessToken } from "../../modules/assessment/studentView.ts";

const BODY = {
  stem: "ما حل المعادلة 2x + 1 = 7؟",
  options: [{ id: "a", text: "x = 2" }, { id: "b", text: "x = 3" }, { id: "c", text: "x = 4" }],
};
const KEY = { optionIds: ["b"] };
const STEPS = ["اطرح 1 من الطرفين: 2x = 6", "اقسم على 2: x = 3"];
const SITTING_TOKEN = "instant-feedback-test-sitting-token";

describeDb("instant feedback over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let examId: string;

  const reviewFor = (userId: string) => call(on, "GET", `/student/exams/${examId}/review`, userId);
  const rowFor = async (userId: string) => {
    const r = await call(on, "GET", "/student/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return (r.json.exams as { title: string; review: boolean; reviewMode: string | null }[]).find(
      e => e.title === EX_TITLES.exReleased,
    );
  };
  const setInstant = (enabled: boolean, as = w.users.t1) =>
    call(on, "POST", `/evaluations/${examId}/instant-feedback`, as, { enabled });
  const setReleased = (released: boolean) =>
    call(on, "POST", `/evaluations/${examId}/results-release`, w.users.t1, { released });
  /** The hand-in screen's own call, with the sitting's token rather than an account. */
  const sittingResult = async () => {
    const res = await fetch(`${on.base}/take/attempt/result`, { headers: { Authorization: `Bearer ${SITTING_TOKEN}` } });
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text) as Record<string, unknown> };
  };

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    examId = x.exams.exReleased;
    const qid = x.questions.exReleased;
    // As answerReview.db.test.ts: a real body, key and steps, and Sara's sitting
    // the snapshot, wrong answer and grade a real paper has — plus a token, so
    // the hand-in screen's route can be asked as Sara's browser would.
    await db.pool.query(
      `UPDATE evaluation_questions SET body = $2::jsonb, expected_answer = $3::jsonb, worked_steps = $4::jsonb WHERE id = $1`,
      [qid, JSON.stringify(BODY), JSON.stringify(KEY), JSON.stringify(STEPS)],
    );
    const snapshot = [{ id: qid, type: "multiple_choice", marks: "10.00", body: BODY, expectedAnswer: KEY }];
    await db.pool.query(
      `UPDATE attempts SET question_snapshot = $2::jsonb, access_token_hash = $3, token_expires_at = now() + interval '1 hour' WHERE id = $1`,
      [x.attempts.saraReleased, JSON.stringify(snapshot), hashAccessToken(SITTING_TOKEN)],
    );
    await db.pool.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, response, is_final) VALUES ($1, $2, $3::jsonb, true)`,
      [x.attempts.saraReleased, qid, JSON.stringify({ optionIds: ["a"] })],
    );
    await db.pool.query(
      `INSERT INTO attempt_question_grades (attempt_id, question_id, awarded_marks, max_marks, verdict, grader)
       VALUES ($1, $2, 0, 10, 'incorrect', 'deterministic')`,
      [x.attempts.saraReleased, qid],
    );
    // Production runs the mastery gate (STATUS.md), and retakes are listed only with it on.
    on = await startServer({ databaseUrl: db.url, env: { MASTERY_GATE: "true" } });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("is off by default: an open exam shows no right and wrong anywhere", async () => {
    const row = await rowFor(w.users.studentA);
    assert.equal(row?.review, false);
    assert.equal(row?.reviewMode, null);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
    const r = await sittingResult();
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.equal(r.json.feedback, undefined);
  });

  it("is the teacher's switch, refused to a student and to a malformed body", async () => {
    assert.equal((await setInstant(true, w.users.studentA)).status, 403);
    const bad = await call(on, "POST", `/evaluations/${examId}/instant-feedback`, w.users.t1, { enabled: "yes" });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, "invalid_input");
  });

  it("on an open exam whose results were hidden, turning it on releases them too", async () => {
    assert.equal((await setReleased(false)).status, 200);
    const r = await setInstant(true);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.evaluation.instantFeedback, true);
    assert.equal(r.json.evaluation.releaseResultsToStudent, true);
    assert.equal(r.json.evaluation.status, "published", "still being sat");
  });

  it("shows the student right and wrong, their answer and the marks — never the key or the steps", async () => {
    const row = await rowFor(w.users.studentA);
    assert.equal(row?.review, true);
    assert.equal(row?.reviewMode, "feedback");

    const r = await reviewFor(w.users.studentA);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.equal(r.json.mode, "feedback");
    const [item] = r.json.items;
    assert.equal(item.verdict, "incorrect");
    assert.equal(item.yourAnswer, "x = 2");
    assert.equal(item.awardedMarks, 0);
    assert.equal(item.correctAnswer, null);
    assert.equal(item.steps, null);
    assert.ok(!r.text.includes("optionIds"), "neither the raw key nor the raw response leaves");
    assert.ok(!r.text.includes("اقسم"), "the worked steps stay on the server");
  });

  it("sends the same feedback, and the released mark, to the hand-in screen", async () => {
    const r = await sittingResult();
    assert.equal(r.status, 200, on.logs().slice(-1500));
    assert.equal(r.json.ready, true);
    const feedback = r.json.feedback as { verdict: string; correctAnswer: unknown; steps: unknown }[];
    assert.equal(feedback.length, 1);
    assert.equal(feedback[0]!.verdict, "incorrect");
    assert.equal(feedback[0]!.correctAnswer, null);
    assert.equal(feedback[0]!.steps, null);
    assert.ok(!r.text.includes("optionIds") && !r.text.includes("اقسم"));
  });

  it("is each student's own paper only", async () => {
    assert.equal((await reviewFor(w.users.studentB)).status, 404);
    assert.equal((await reviewFor(w.users.parentA)).status, 403);
  });

  it("goes dark when the teacher hides the results, and comes back with them", async () => {
    assert.equal((await setReleased(false)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
    assert.equal((await sittingResult()).json.feedback, undefined);
    assert.equal((await setReleased(true)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).status, 200);
  });

  it("gives way to the full review once the exam is closed and the answers are shown", async () => {
    assert.equal((await call(on, "POST", `/evaluations/${examId}/close`, w.users.t1)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).json.mode, "feedback", "closed alone shows no key");
    assert.equal((await call(on, "POST", `/evaluations/${examId}/solutions`, w.users.t1, { shown: true })).status, 200);
    const r = await reviewFor(w.users.studentA);
    assert.equal(r.json.mode, "full");
    assert.equal(r.json.items[0].correctAnswer, "x = 3");
    assert.equal((await rowFor(w.users.studentA))?.reviewMode, "full");
  });

  it("survives a re-publish without bringing back results the teacher hid, and stops when turned off", async () => {
    assert.equal((await setReleased(false)).status, 200);
    const pub = await call(on, "POST", `/evaluations/${examId}/publish`, w.users.t1);
    assert.equal(pub.status, 200, pub.text);
    assert.equal(pub.json.evaluation.instantFeedback, true);
    assert.equal(pub.json.evaluation.releaseResultsToStudent, false, "a re-publish keeps the teacher's hide");
    assert.equal(pub.json.evaluation.showSolutionsToStudent, false);
    assert.equal((await reviewFor(w.users.studentA)).status, 404, "hidden results, no feedback");
    assert.equal((await setReleased(true)).status, 200);
    assert.equal((await reviewFor(w.users.studentA)).json.mode, "feedback");

    const off = await setInstant(false);
    assert.equal(off.status, 200);
    assert.equal(off.json.evaluation.instantFeedback, false);
    assert.equal(off.json.evaluation.releaseResultsToStudent, true, "turning it off leaves the release alone");
    assert.equal((await reviewFor(w.users.studentA)).status, 404);
  });

  it("offers a failed lesson quiz for a retake only while instant feedback is off", async () => {
    // Make it a lesson quiz Sara failed: one lesson's objective, 40%, final.
    await db.pool.query(`UPDATE evaluations SET objective_ids = $2::jsonb WHERE id = $1`, [
      examId,
      JSON.stringify(["o-nccd-s1-u1_l1-0"]),
    ]);
    await db.pool.query(
      `UPDATE attempt_results SET percent = 40, earned_marks = 4, is_provisional = false WHERE attempt_id = $1`,
      [x.attempts.saraReleased],
    );
    const retakeable = async () => {
      const r = await call(on, "GET", "/student/progress", w.users.studentA);
      assert.equal(r.status, 200, on.logs().slice(-1500));
      return (r.json.retakeEvaluationIds as string[]).includes(examId);
    };
    assert.equal(await retakeable(), true, "feedback off: an ordinary failed quiz may be retaken");
    assert.equal((await setInstant(true)).status, 200);
    assert.equal(await retakeable(), false, "feedback on: right/wrong plus retakes would hand over the key");
    const refused = await call(on, "POST", `/student/exams/${examId}/retake`, w.users.studentA);
    assert.equal(refused.json.code, "instant_feedback", refused.text);
  });
});
