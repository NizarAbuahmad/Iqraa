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
  guardianExamRow,
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

  it("offers the answer review only on a closed, released exam the teacher opened it on", () => {
    const sat = { status: "graded", startedAt: NOW, submittedAt: NOW };
    const shown = { status: "closed", releaseResultsToStudent: true, showSolutionsToStudent: true } as const;
    assert.equal(rowOf(exam(shown), sat, RESULT, NOW).review, true);
    assert.equal(rowOf(exam({ ...shown, status: "published" }), sat, RESULT, NOW).review, false, "still being sat");
    assert.equal(rowOf(exam({ ...shown, releaseResultsToStudent: false }), sat, RESULT, NOW).review, false);
    assert.equal(rowOf(exam({ ...shown, showSolutionsToStudent: false }), sat, RESULT, NOW).review, false);
    assert.equal(rowOf(exam({ ...shown, paper: true }), sat, RESULT, NOW).review, false, "a paper exam has no questions");
    assert.equal(rowOf(exam(shown), sat, { ...RESULT, isProvisional: true }, NOW).review, false);
    assert.equal(rowOf(exam(shown), null, null, NOW).review, false, "never sat");
    assert.equal(guardianExamRow(rowOf(exam(shown), sat, RESULT, NOW)).review, false, "the review route is the student's");
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

  it("carries the teacher's planned date and time, and nothing when there is none", () => {
    const planned = rowOf(exam({ examDate: "2026-10-20", examTime: "09:30" }), null, null, NOW);
    assert.equal(planned.examDate, "2026-10-20");
    assert.equal(planned.examTime, "09:30");
    const unplanned = rowOf(exam(), null, null, NOW);
    assert.equal(unplanned.examDate, null);
    assert.equal(unplanned.examTime, null);
  });

  it("does not let a date decide whether the exam is open", () => {
    const row = rowOf(exam({ examDate: "2026-12-31" }), null, null, NOW);
    assert.equal(row.state, "available");
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

describe("guardianExamRow", () => {
  it("keeps the released result but never hands a parent the exam link", () => {
    const open = rowOf(exam(), null, null, NOW);
    assert.ok(open.shareCode, "the student's row carries the link");
    assert.equal(guardianExamRow(open).shareCode, null);
    assert.equal(guardianExamRow(open).state, "available");
  });

  it("shows a parent no result the student could not see", () => {
    const sitting = { status: "submitted", startedAt: NOW, submittedAt: NOW };
    const result = { levelKey: "proficient", percent: "80", earnedMarks: "8", totalMarks: "10", competencyScores: [], isProvisional: false };
    const hidden = guardianExamRow(rowOf(exam({ releaseResultsToStudent: false }), sitting, result, NOW));
    assert.equal(hidden.state, "submitted");
    assert.equal(hidden.result, null);
    const shown = guardianExamRow(rowOf(exam({ releaseResultsToStudent: true }), sitting, result, NOW));
    assert.equal(shown.state, "result");
    assert.ok(shown.result);
  });
});

describe("the planned day", () => {
  it("carries the exam's date and time onto the row", () => {
    const row = rowOf(exam({ examDate: "2026-10-20", examTime: "09:30" }), null, null, NOW);
    assert.equal(row.examDate, "2026-10-20");
    assert.equal(row.examTime, "09:30");
  });

  it("reads an exam that was never dated as null, not undefined", () => {
    const row = rowOf(exam(), null, null, NOW);
    assert.equal(row.examDate, null);
    assert.equal(row.examTime, null);
  });

  it("does not let a date list a draft", () => {
    assert.equal(studentExamRow(exam({ status: "draft", examDate: "2026-10-20" }), null, null, NOW), null);
  });
});

describe("a paper exam", () => {
  it("never offers a link once a student has handed one in", () => {
    // Pins the `!paper &&` in offerLink: without it a handed-in student_link sitting on a paper exam could re-open a link.
    const row = rowOf(exam({ paper: true }), { status: "graded", startedAt: NOW, submittedAt: NOW, source: "student_link" }, null, NOW);
    assert.equal(row.state, "submitted");
    assert.equal(row.shareCode, null);
  });

  it("is 'paper' with no link while nothing is marked", () => {
    const row = rowOf(exam({ paper: true }), null, null, NOW);
    assert.equal(row.state, "paper");
    assert.equal(row.shareCode, null);
    assert.equal(row.paper, true);
  });

  it("stays 'paper' while the teacher is typing it in, with no deadline", () => {
    const row = rowOf(
      exam({ paper: true, timeLimitMin: 20 }),
      { status: "in_progress", startedAt: NOW, submittedAt: null, source: "teacher_entry" },
      null,
      NOW,
    );
    assert.equal(row.state, "paper");
    assert.equal(row.deadlineAt, null);
    assert.equal(row.shareCode, null);
  });

  it("is 'paper', not 'closed', once its link has expired", () => {
    const row = rowOf(exam({ paper: true, shareCodeExpiresAt: new Date("2026-10-02T00:00:00Z") }), null, null, NOW);
    assert.equal(row.state, "paper");
  });

  it("waits for the release once marked, then shows the mark", () => {
    const sitting = { status: "graded", startedAt: NOW, submittedAt: NOW, source: "teacher_entry" };
    const waiting = rowOf(exam({ paper: true, releaseResultsToStudent: false }), sitting, RESULT, NOW);
    assert.equal(waiting.state, "submitted");
    assert.equal(waiting.result, null);
    const shown = rowOf(exam({ paper: true, releaseResultsToStudent: true }), sitting, RESULT, NOW);
    assert.equal(shown.state, "result");
    assert.equal(shown.result?.earnedMarks, 8);
  });

  it("is never paper unless the exam says so", () => {
    assert.equal(rowOf(exam(), null, null, NOW).paper, false);
  });

  it("sorts after what the student can open now", () => {
    const sorted = sortStudentExams([
      rowOf(exam({ id: "p", paper: true }), null, null, NOW),
      rowOf(exam({ id: "a" }), null, null, NOW),
    ]);
    assert.deepEqual(sorted.map(r => r.evaluationId), ["a", "p"]);
  });
});
