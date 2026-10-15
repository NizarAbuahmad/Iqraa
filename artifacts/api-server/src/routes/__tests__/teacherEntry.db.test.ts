/**
 * Teacher answer entry, as it behaves today: find-or-create a teacher_entry
 * sitting, mark one question by hand, hand the paper in. Written before the
 * code moved into lib/teacherEntry.ts so the move is proven to change nothing;
 * the class mark book (paper-totals) runs the same code.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

describeDb("teacher answer entry over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;
  let attemptId = "";

  const start = (userId: string, examId: string, studentId: string) =>
    call(on, "POST", `/evaluations/${examId}/attempts`, userId, { studentId });
  const one = async (sql: string, params: unknown[]) => (await db.pool.query(sql, params)).rows[0];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("starting a sitting", () => {
    it("creates a teacher-entry sitting once, then returns the same one", async () => {
      const first = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA1);
      assert.equal(first.status, 201, on.logs().slice(-1500));
      assert.equal(first.json.created, true);
      attemptId = first.json.attempt.id;
      const row = await one(
        `SELECT source, entered_by, status, started_at, jsonb_array_length(question_snapshot) AS q,
                jsonb_array_length(level_scale_snapshot->'bands') AS b
           FROM attempts WHERE id = $1`,
        [attemptId],
      );
      assert.equal(row.source, "teacher_entry");
      assert.equal(row.entered_by, w.users.t1);
      assert.equal(row.status, "in_progress");
      assert.ok(row.started_at);
      assert.equal(row.q, 2);
      assert.equal(row.b, 4);

      const again = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA1);
      assert.equal(again.status, 200);
      assert.equal(again.json.created, false);
      assert.equal(again.json.attempt.id, attemptId);
    });

    it("refuses an unpublished exam, a student who is not the teacher's, and an exam that is not theirs", async () => {
      const draft = await start(w.users.t1, x.exams.exPaperDraft, w.students.sA1);
      assert.equal(draft.status, 409);
      assert.equal(draft.json.error, "Publish this evaluation before entering answers");
      const notMine = await start(w.users.t1, x.exams.exPaperMulti, w.students.sA2);
      assert.equal(notMine.status, 404);
      assert.equal(notMine.json.error, "Student not found");
      const otherTeacher = await start(w.users.t2, x.exams.exPaperMulti, w.students.sA2);
      assert.equal(otherTeacher.status, 404);
      assert.equal(otherTeacher.json.error, "Evaluation not found");
    });

    it("keeps a group check to its group", async () => {
      const outside = await start(w.users.t1, x.exams.exGroup, w.students.sA1);
      assert.equal(outside.status, 403);
      assert.equal(outside.json.code, "not_in_group");
      const inside = await start(w.users.t1, x.exams.exGroup, w.students.aA);
      assert.equal(inside.status, 201);
      await db.pool.query(`DELETE FROM attempts WHERE id = $1`, [inside.json.attempt.id]);
    });

    it("refuses an exam with no level scale, and one with no questions", async () => {
      const noScale = await start(w.users.t1, x.exams.exNoScale, w.students.sA1);
      assert.equal(noScale.status, 409);
      assert.equal(noScale.json.error, "No level scale is configured for this evaluation");
      const empty = await start(w.users.t1, x.exams.exEmpty, w.students.sA1);
      assert.equal(empty.status, 409);
      assert.equal(empty.json.error, "This evaluation has no questions");
    });
  });

  describe("marking and handing in", () => {
    const [q1, q2] = [() => x.questions.exPaperMulti[0], () => x.questions.exPaperMulti[1]];
    const mark = (questionId: string, awardedMarks: unknown) =>
      call(on, "PUT", `/attempts/${attemptId}/grades/${questionId}`, w.users.t1, { awardedMarks });
    const overrides = async () => (await one(`SELECT count(*)::int AS n FROM grade_overrides WHERE attempt_id = $1`, [attemptId])).n as number;

    it("checks the range, and audits only a re-mark", async () => {
      const tooMany = await mark(q1(), 11);
      assert.equal(tooMany.status, 400);
      assert.equal(tooMany.json.code, "marks_out_of_range");
      const first = await mark(q1(), 7);
      assert.equal(first.status, 200);
      assert.equal(first.json.grade.grader, "teacher");
      assert.equal(first.json.grade.verdict, "partial");
      assert.equal(first.json.result.isProvisional, true, "the second question is still unmarked");
      assert.equal(first.json.attempt.status, "needs_review");
      assert.equal(await overrides(), 0, "a first mark overrides nothing");
      const again = await mark(q1(), "8");
      assert.equal(again.status, 200);
      assert.equal(await overrides(), 1);
      const audit = await one(`SELECT old_marks, new_marks FROM grade_overrides WHERE attempt_id = $1`, [attemptId]);
      assert.equal(audit.old_marks, "7.00");
      assert.equal(audit.new_marks, "8.00");
    });

    it("stamps the hand-in once, and finalises when every question is marked", async () => {
      const submitted = await call(on, "POST", `/attempts/${attemptId}/submit`, w.users.t1);
      assert.equal(submitted.status, 200);
      const stamped = (await one(`SELECT submitted_at FROM attempts WHERE id = $1`, [attemptId])).submitted_at as Date;
      assert.ok(stamped);
      assert.equal(submitted.json.result.isProvisional, true);
      const last = await mark(q2(), 10);
      assert.equal(last.json.result.isProvisional, false);
      assert.equal(last.json.attempt.status, "graded");
      await call(on, "POST", `/attempts/${attemptId}/submit`, w.users.t1);
      const after = (await one(`SELECT submitted_at FROM attempts WHERE id = $1`, [attemptId])).submitted_at as Date;
      assert.equal(after.getTime(), stamped.getTime(), "a re-submit keeps the first hand-in time");
      const hand = await one(`SELECT count(*)::int AS n FROM attempt_question_grades WHERE attempt_id = $1 AND grader = 'teacher'`, [attemptId]);
      assert.equal(hand.n, 2, "submitting kept both hand marks");
    });
  });
});
