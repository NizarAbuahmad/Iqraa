/**
 * One student's record for one class — the per-student view the class screen
 * lacked. What must hold: the rollup is the same marks-weighted sum the class
 * view uses (not a mean of papers), provisional papers count but are reported,
 * a paper nobody marked does not drag the rollup, and an exam the student never
 * sat carries no attempt (the paper screen would create one on open).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { examStatus, studentRecord, type ObjectiveInfo, type RecordExamRow } from "../studentRecord.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(objectiveId: string, earned: number, total: number): ObjectiveScore {
  return { objectiveId, earned, total, percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: 1, marksLost: total - earned, bloomsRank: 2 };
}

function row(over: Partial<RecordExamRow>): RecordExamRow {
  return {
    evaluationId: "e1", title: "Quiz", titleAr: "", createdAt: new Date("2026-09-01T08:00:00Z"), archived: false,
    attemptId: "a1", attemptStatus: "graded", teacherComment: "", submittedAt: new Date("2026-09-01T09:00:00Z"),
    earned: "1.00", total: "2.00", percent: "50.00", isProvisional: false, objectiveScores: [],
    ...over,
  };
}

const describeKnown = (id: string): ObjectiveInfo | null =>
  id === "o-known" ? { titleAr: "هدف معروف", lessonId: "kbl-x", lessonTitleAr: "درس" } : null;

describe("examStatus", () => {
  it("maps attempt states to what the teacher reads", () => {
    assert.equal(examStatus(null), "not_sat");
    assert.equal(examStatus("not_started"), "not_sat");
    assert.equal(examStatus("abandoned"), "not_sat");
    assert.equal(examStatus("in_progress"), "in_progress");
    for (const s of ["submitted", "grading"] as const) assert.equal(examStatus(s), "submitted");
    for (const s of ["graded", "needs_review"] as const) assert.equal(examStatus(s), "marked");
  });
});

describe("studentRecord", () => {
  it("sums marks across papers instead of averaging their percentages", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", objectiveScores: [o("o-known", 1, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", objectiveScores: [o("o-known", 9, 10)] }),
    ], describeKnown);
    assert.equal(r.objectives.length, 1);
    assert.equal(r.objectives[0]!.earned, 10);
    assert.equal(r.objectives[0]!.total, 12);
    assert.equal(r.objectives[0]!.percent, 83.33); // 10/12, not (50 + 90) / 2 = 70
  });

  it("counts sittings and the latest paper per objective", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", submittedAt: new Date("2026-09-01T09:00:00Z"), objectiveScores: [o("o-known", 1, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", submittedAt: new Date("2026-09-20T09:00:00Z"), objectiveScores: [o("o-known", 1, 2)] }),
    ], describeKnown);
    assert.equal(r.objectives[0]!.sittings, 2);
    assert.equal(r.objectives[0]!.lastSeenAt, "2026-09-20T09:00:00.000Z");
  });

  it("counts provisional papers and says how many there were", () => {
    const r = studentRecord([
      row({ evaluationId: "e1", isProvisional: true, objectiveScores: [o("o-known", 0, 2)] }),
      row({ evaluationId: "e2", attemptId: "a2", objectiveScores: [o("o-known", 2, 2)] }),
    ], describeKnown);
    assert.equal(r.objectives[0]!.total, 4);
    assert.equal(r.provisionalCount, 1);
    assert.equal(r.exams.find(e => e.evaluationId === "e1")!.provisional, true);
  });

  it("lists an exam the student never sat, with no attempt and no score", () => {
    const r = studentRecord([
      row({ evaluationId: "e9", attemptId: null, attemptStatus: null, submittedAt: null,
        earned: null, total: null, percent: null, isProvisional: null, objectiveScores: null }),
    ], describeKnown);
    assert.deepEqual(r.exams[0], {
      evaluationId: "e9", title: "Quiz", createdAt: "2026-09-01T08:00:00.000Z", status: "not_sat",
      attemptId: null, earned: null, total: null, percent: null, provisional: false,
      teacherComment: null, submittedAt: null,
    });
    assert.equal(r.objectives.length, 0);
  });

  it("shows a provisionally marked paper as marked, with its score and the provisional flag", () => {
    const r = studentRecord([row({ attemptStatus: "needs_review", isProvisional: true,
      earned: "1.00", total: "2.00", percent: "50.00", objectiveScores: [o("o-known", 1, 2)] })], describeKnown);
    assert.equal(r.exams[0]!.status, "marked");
    assert.equal(r.exams[0]!.provisional, true);
    assert.equal(r.exams[0]!.percent, 50);
    assert.equal(r.provisionalCount, 1);
  });

  it("gives a paper the student never started no attempt, even if one row exists", () => {
    const r = studentRecord([row({ attemptId: "a-stale", attemptStatus: "not_started", submittedAt: null,
      earned: null, total: null, percent: null, isProvisional: null, objectiveScores: null })], describeKnown);
    assert.equal(r.exams[0]!.status, "not_sat");
    assert.equal(r.exams[0]!.attemptId, null);
  });

  it("keeps an unmarked paper out of the rollup but in the exam list", () => {
    const r = studentRecord([row({ attemptStatus: "submitted", objectiveScores: [] })], describeKnown);
    assert.equal(r.exams[0]!.status, "submitted");
    assert.equal(r.objectives.length, 0);
    assert.equal(r.provisionalCount, 0);
  });

  it("orders exams newest first and objectives weakest first", () => {
    const r = studentRecord([
      row({ evaluationId: "old", createdAt: new Date("2026-09-01T00:00:00Z"), objectiveScores: [o("o-strong", 9, 10)] }),
      row({ evaluationId: "new", attemptId: "a2", createdAt: new Date("2026-09-30T00:00:00Z"), objectiveScores: [o("o-weak", 1, 10)] }),
    ], describeKnown);
    assert.deepEqual(r.exams.map(e => e.evaluationId), ["new", "old"]);
    assert.deepEqual(r.objectives.map(x => x.objectiveId), ["o-weak", "o-strong"]);
  });

  it("names the lesson behind each objective, and keeps an unknown one honest", () => {
    const r = studentRecord([
      row({ objectiveScores: [o("o-known", 1, 2), o("o-gone", 1, 2)] }),
    ], describeKnown);
    const known = r.objectives.find(x => x.objectiveId === "o-known")!;
    const gone = r.objectives.find(x => x.objectiveId === "o-gone")!;
    assert.equal(known.lessonId, "kbl-x");
    assert.equal(known.titleAr, "هدف معروف");
    assert.equal(gone.lessonId, null);
    assert.equal(gone.titleAr, "");
  });

  it("prefers the Arabic exam title, reads numeric strings, and drops an empty comment", () => {
    const r = studentRecord([row({ titleAr: "اختبار قصير", earned: "1.50", total: "2.00", percent: "75.00",
      teacherComment: "", objectiveScores: [o("o-known", 1.5, 2)] })], describeKnown);
    assert.equal(r.exams[0]!.title, "اختبار قصير");
    assert.equal(r.exams[0]!.earned, 1.5);
    assert.equal(r.exams[0]!.percent, 75);
    assert.equal(r.exams[0]!.teacherComment, null);
  });

  it("counts an archived exam's marks in the objectives but does not list it", () => {
    const r = studentRecord([
      row({ evaluationId: "live", objectiveScores: [o("o-known", 1, 2)] }),
      row({ evaluationId: "old", attemptId: "a2", archived: true, submittedAt: new Date("2026-09-20T09:00:00Z"),
        objectiveScores: [o("o-known", 1, 2)] }),
    ], describeKnown);
    assert.deepEqual(r.exams.map(e => e.evaluationId), ["live"]);
    assert.equal(r.objectives[0]!.sittings, 2);
    assert.equal(r.objectives[0]!.total, 4);
    assert.equal(r.objectives[0]!.lastSeenAt, "2026-09-20T09:00:00.000Z");
  });

  it("counts an archived provisional paper in provisionalCount", () => {
    const r = studentRecord([
      row({ archived: true, isProvisional: true, objectiveScores: [o("o-known", 1, 2)] }),
    ], describeKnown);
    assert.equal(r.exams.length, 0);
    assert.equal(r.provisionalCount, 1);
  });
});
