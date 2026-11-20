/**
 * What this guards: `POST /evaluations/from-worksheet` stores a Grade 1 paper with
 * only the question types a six-year-old can answer, and leaves other grades as
 * they were (Grade 1 sweep, 2026-11-14).
 *
 * The converter's own tests (`fromWorksheet.test.ts`) prove the conversion; this
 * proves the route passes the book's grade to it and that what lands in
 * `evaluations` and `evaluation_questions` is what a Grade 1 class may be given:
 * a teacher-marked question stored as a practical task, marked by hand
 * (`grading_mode = manual`), with its key as success criteria and never shown to
 * the student.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { FIRST_GRADE_EVALUATION_TYPES } from "@workspace/exam-paper";
import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedLevelScale } from "../../test-support/seedExams.ts";

const WORKSHEET = {
  title: "ورقة عمل",
  sections: [{
    questions: [
      { text: "ما العدد الذي يأتي بعد 7؟", points: 1 },
      { text: "ما اليوم الذي يأتي بعد الثلاثاء؟", points: 1 },
      { text: "العدد 5 أكبر من 3", options: ["صح", "خطأ"], points: 1 },
      { text: "كم ضلعًا للمثلث؟", options: ["2", "3", "4"], points: 1 },
      { text: "اشرح كيف عددت النجوم", points: 2 },
    ],
  }],
  answerKey: [
    { num: 1, answer: "8" },
    { num: 2, answer: "الأربعاء" },
    { num: 3, answer: "صح" },
    { num: 4, answer: "3" },
    { num: 5, answer: "عددتها واحدة واحدة", solution: ["خمس نجوم"] },
  ],
};

describeDb("a worksheet sent as an evaluation, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  const objectiveOf: Record<string, string> = {};

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedLevelScale(db.pool);
    server = await startServer({ databaseUrl: db.url, env: { AI_LIVE_MODE: undefined } });

    const meta = await call(server, "GET", "/evaluations/meta/evaluable", w.users.t1);
    assert.equal(meta.status, 200, meta.text);
    const books = meta.json.books as { bookId: string }[];
    for (const [grade, pattern] of [["1", /^book-math-1-s1$/], ["2", /^book-math-2-s1$/]] as const) {
      const book = books.find(b => pattern.test(b.bookId));
      assert.ok(book, `grade ${grade} maths takes evaluations: ${books.map(b => b.bookId).join(", ")}`);
      const objectives = await call(server, "GET", `/curriculum/objectives?bookId=${encodeURIComponent(book.bookId)}`, w.users.t1);
      assert.equal(objectives.status, 200, objectives.text);
      objectiveOf[grade] = objectives.json.objectives[0].id;
    }
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  const send = (grade: "1" | "2") =>
    call(server, "POST", "/evaluations/from-worksheet", w.users.t1, {
      worksheet: WORKSHEET,
      objectiveId: objectiveOf[grade],
      classGroupId: w.classes.c1,
      language: "ar",
    });
  const stored = async (evaluationId: string) => {
    const e = await db.pool.query<{ grade_id: string; assessment_types: string[] }>(
      `SELECT grade_id, assessment_types FROM evaluations WHERE id = $1`, [evaluationId]);
    const q = await db.pool.query<{ type: string; grading_mode: string; body: Record<string, unknown>; expected_answer: Record<string, unknown> }>(
      `SELECT type, grading_mode, body, expected_answer FROM evaluation_questions
        WHERE evaluation_id = $1 AND deleted_at IS NULL ORDER BY order_index`, [evaluationId]);
    return { evaluation: e.rows[0]!, questions: q.rows };
  };

  it("a Grade 1 book's paper holds only Grade 1 types; what the teacher marks is a practical task", async () => {
    const r = await send("1");
    assert.equal(r.status, 201, r.text);
    assert.deepEqual([r.json.autoMarked, r.json.teacherMarked], [3, 2]);

    const { evaluation, questions } = await stored(r.json.evaluation.id);
    assert.equal(evaluation.grade_id, "grade-1");
    assert.deepEqual(questions.map(q => q.type), ["fill_blank", "practical_task", "true_false", "multiple_choice", "practical_task"]);
    const allowed: readonly string[] = FIRST_GRADE_EVALUATION_TYPES;
    for (const t of [...evaluation.assessment_types, ...questions.map(q => q.type)]) assert.ok(allowed.includes(t), t);
    assert.deepEqual([...evaluation.assessment_types].sort(), ["fill_blank", "multiple_choice", "practical_task", "true_false"]);

    const [, day, , , explain] = questions;
    assert.equal(day!.grading_mode, "manual");
    assert.equal(day!.body["prompt"], "ما اليوم الذي يأتي بعد الثلاثاء؟");
    assert.deepEqual(day!.expected_answer, { successCriteria: ["الأربعاء"] });
    assert.deepEqual(explain!.expected_answer, { successCriteria: ["عددتها واحدة واحدة", "خمس نجوم"] });
  });

  it("a child taking it sees each question and an answer box, never the key", async () => {
    const r = await send("1");
    assert.equal(r.status, 201, r.text);
    const published = await call(server, "POST", `/evaluations/${r.json.evaluation.id}/publish`, w.users.t1);
    assert.equal(published.status, 200, published.text);
    const code = published.json.evaluation.shareCode as string;
    assert.ok(code, published.text);
    // Sara (sA1) is on class c1's roster; a claim starts her sitting and hands her the paper.
    const sitting = await call(server, "POST", `/take/${code}/claim`, undefined, { studentId: w.students.sA1 });
    assert.equal(sitting.status, 201, sitting.text);
    const questions = sitting.json.questions as { type: string; body: Record<string, unknown> }[];
    const day = questions.find(q => q.body["prompt"] === "ما اليوم الذي يأتي بعد الثلاثاء؟");
    assert.ok(day, "the practical task is on the paper");
    assert.equal(day.type, "practical_task");
    assert.equal(day.body["submission"], "text", "she gets an answer box");
    assert.doesNotMatch(JSON.stringify(questions), /الأربعاء|عددتها واحدة واحدة|خمس نجوم|successCriteria/);
  });

  it("a Grade 2 book's paper is converted as before", async () => {
    const r = await send("2");
    assert.equal(r.status, 201, r.text);
    const { evaluation, questions } = await stored(r.json.evaluation.id);
    assert.equal(evaluation.grade_id, "grade-2");
    assert.deepEqual(questions.map(q => q.type), ["fill_blank", "short_answer", "true_false", "multiple_choice", "short_answer"]);
    assert.ok(evaluation.assessment_types.includes("short_answer"));
  });
});
