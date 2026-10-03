/**
 * What a signed-in student's «اختباراتي» list says about each exam.
 *
 * Before this list existed the only door to an exam was the share link the
 * teacher posted, and the only place to see a result was the hand-in screen
 * of that sitting — gone the moment the tab closed. Every state below is one
 * a student will actually be in; the release rule is the one that matters
 * most, because getting it wrong shows a mark the teacher has not released.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sortStudentExams,
  studentExamRow,
  type ExamForStudent,
} from "../studentExams.ts";

const NOW = new Date("2026-10-03T10:00:00Z");

/** A row that must exist; fails the test rather than the type check. */
function rowOf(...args: Parameters<typeof studentExamRow>) {
  const r = studentExamRow(...args);
  assert.ok(r, "expected the exam to be listed");
  return r;
}

function exam(over: Partial<ExamForStudent> = {}): ExamForStudent {
  return {
    id: "e1",
    title: "Quiz",
    titleAr: "اختبار قصير",
    subjectId: "mathematics",
    gradeId: "grade-10",
    status: "published",
    shareCode: "ABC234",
    shareCodeExpiresAt: new Date("2026-10-08T00:00:00Z"),
    timeLimitMin: null,
    totalMarks: "10.00",
    releaseResultsToStudent: false,
    publishedAt: new Date("2026-10-01T08:00:00Z"),
    closedAt: null,
    ...over,
  };
}

const RESULT = {
  levelKey: "proficient",
  percent: "80.00",
  earnedMarks: "8.00",
  totalMarks: "10.00",
  competencyScores: {},
  isProvisional: false,
};

describe("studentExamRow", () => {
  it("offers an open exam the student has not started", () => {
    const row = rowOf(exam(), null, null, NOW);
    assert.equal(row.state, "available");
    assert.equal(row.shareCode, "ABC234");
    assert.equal(row.result, null);
  });

  it("lets a started sitting be continued", () => {
    const row = rowOf(exam(), { status: "in_progress", startedAt: NOW, submittedAt: null }, null, NOW);
    assert.equal(row.state, "in_progress");
    assert.equal(row.shareCode, "ABC234");
  });

  it("says when a timed sitting will run out", () => {
    const started = new Date("2026-10-03T09:50:00Z");
    const row = rowOf(exam({ timeLimitMin: 20 }), { status: "in_progress", startedAt: started, submittedAt: null }, null, NOW);
    assert.equal(row.deadlineAt, "2026-10-03T10:10:00.000Z");
  });

  it("marks a handed-in paper as waiting while the result is not released", () => {
    const row = rowOf(
      exam({ releaseResultsToStudent: false }),
      { status: "graded", startedAt: NOW, submittedAt: NOW },
      RESULT,
      NOW,
    );
    assert.equal(row.state, "submitted");
    assert.equal(row.result, null, "a mark the teacher has not released never leaves the server");
  });

  it("waits on a released exam whose paper is still provisional", () => {
    const row = rowOf(
      exam({ releaseResultsToStudent: true }),
      { status: "needs_review", startedAt: NOW, submittedAt: NOW },
      { ...RESULT, isProvisional: true },
      NOW,
    );
    assert.equal(row.state, "submitted");
    assert.equal(row.result, null);
  });

  it("shows the result once released and fully marked", () => {
    const row = rowOf(
      exam({ releaseResultsToStudent: true }),
      { status: "graded", startedAt: NOW, submittedAt: NOW },
      RESULT,
      NOW,
    );
    assert.equal(row.state, "result");
    assert.deepEqual(row.result, {
      levelKey: "proficient",
      percent: 80,
      earnedMarks: 8,
      totalMarks: 10,
      competencyScores: {},
    });
  });

  it("never hands out the link of a closed exam", () => {
    const row = rowOf(exam({ status: "closed", closedAt: NOW }), null, null, NOW);
    assert.equal(row.state, "closed");
    assert.equal(row.shareCode, null);
  });

  it("treats an expired link like a closed exam", () => {
    const row = rowOf(exam({ shareCodeExpiresAt: new Date("2026-10-02T00:00:00Z") }), null, null, NOW);
    assert.equal(row.state, "closed");
    assert.equal(row.shareCode, null);
  });

  it("closes an unfinished sitting whose exam is closed", () => {
    const row = rowOf(exam({ status: "closed" }), { status: "in_progress", startedAt: NOW, submittedAt: null }, null, NOW);
    assert.equal(row.state, "closed");
    assert.equal(row.shareCode, null);
  });

  it("still shows a released result after the exam is closed", () => {
    const row = rowOf(
      exam({ status: "closed", releaseResultsToStudent: true }),
      { status: "graded", startedAt: NOW, submittedAt: NOW },
      RESULT,
      NOW,
    );
    assert.equal(row.state, "result");
    assert.equal(row.shareCode, null);
  });

  it("never lists a draft", () => {
    assert.equal(studentExamRow(exam({ status: "draft" }), null, null, NOW), null);
  });

  it("lists a paper the teacher typed in for the student, without a link", () => {
    const row = rowOf(
      exam({ status: "draft", shareCode: null, releaseResultsToStudent: true }),
      { status: "graded", startedAt: NOW, submittedAt: NOW },
      RESULT,
      NOW,
    );
    assert.equal(row.state, "result");
    assert.equal(row.shareCode, null);
  });
});

describe("a paper the teacher is typing in", () => {
  it("is not offered to the student to continue — /take would refuse it", () => {
    const row = rowOf(exam(), { status: "in_progress", startedAt: NOW, submittedAt: null, source: "teacher_entry" }, null, NOW);
    assert.equal(row.state, "in_progress");
    assert.equal(row.shareCode, null);
  });

  it("is not listed at all while unfinished on an exam that was never published", () => {
    assert.equal(
      studentExamRow(exam({ status: "draft", shareCode: null }), { status: "in_progress", startedAt: NOW, submittedAt: null, source: "teacher_entry" }, null, NOW),
      null,
    );
  });
});

describe("sortStudentExams", () => {
  it("puts what the student can act on first, then newest", () => {
    const at = (iso: string) => new Date(iso);
    const rows = [
      rowOf(exam({ id: "old-result", releaseResultsToStudent: true, publishedAt: at("2026-09-01T00:00:00Z") }), { status: "graded", startedAt: NOW, submittedAt: NOW }, RESULT, NOW),
      rowOf(exam({ id: "new-closed", status: "closed", publishedAt: at("2026-10-02T00:00:00Z") }), null, null, NOW),
      rowOf(exam({ id: "available", publishedAt: at("2026-09-20T00:00:00Z") }), null, null, NOW),
      rowOf(exam({ id: "continuing", publishedAt: at("2026-09-10T00:00:00Z") }), { status: "in_progress", startedAt: NOW, submittedAt: null }, null, NOW),
    ];
    assert.deepEqual(sortStudentExams(rows).map(r => r.evaluationId), ["continuing", "available", "new-closed", "old-result"]);
  });
});
