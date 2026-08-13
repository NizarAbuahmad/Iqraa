/**
 * Attempt grading — wiring `grade()` and `scoreAttempt` together the way the
 * submit route does, without a database. What matters here is the seam: a
 * question type without `grade()` must never reach `scoreAttempt` as a zero.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gradeAttempt, type AttemptQuestionInput } from "../gradeAttempt.ts";
import type { LevelBandInput } from "../scoring.ts";

const BANDS: LevelBandInput[] = [
  { key: "beginner", minPercent: 0, maxPercent: 49 },
  { key: "developing", minPercent: 50, maxPercent: 69 },
  { key: "proficient", minPercent: 70, maxPercent: 84 },
  { key: "advanced", minPercent: 85, maxPercent: 100 },
];

let seq = 0;
function mcq(over: Partial<AttemptQuestionInput> = {}): AttemptQuestionInput {
  return {
    questionId: over.questionId ?? `q${seq++}`,
    type: "multiple_choice",
    body: { stem: "؟", options: [{ id: "a", text: "أ" }, { id: "b", text: "ب" }, { id: "c", text: "ج" }] },
    expectedAnswer: { optionIds: ["b"] },
    competencyKey: over.competencyKey ?? "knowledge",
    objectiveId: over.objectiveId ?? "obj-1",
    marks: over.marks ?? 1,
    difficulty: over.difficulty ?? "standard",
  };
}

describe("gradeAttempt — deterministic questions", () => {
  it("grades a correct answer with the question's full marks", () => {
    const q = mcq({ marks: 4 });
    const res = gradeAttempt([q], new Map([[q.questionId, { optionIds: ["b"] }]]), BANDS);
    assert.equal(res.graded.length, 1);
    assert.equal(res.graded[0]!.awardedMarks, 4);
    assert.equal(res.graded[0]!.verdict, "correct");
    assert.equal(res.ungradedQuestionIds.length, 0);
  });

  it("grades an unanswered question as unanswered, not incorrect", () => {
    const q = mcq();
    const res = gradeAttempt([q], new Map(), BANDS);
    assert.equal(res.graded[0]!.verdict, "unanswered");
    assert.equal(res.graded[0]!.awardedMarks, 0);
  });

  it("rounds fractional partial credit to two decimal places", () => {
    // Matching: one of three pairs right → 1/3 of 10 marks.
    const q: AttemptQuestionInput = {
      questionId: "m1",
      type: "matching",
      body: { left: [{ id: "l1" }, { id: "l2" }, { id: "l3" }], right: [{ id: "r1" }, { id: "r2" }, { id: "r3" }] },
      expectedAnswer: {
        pairs: [{ left: "l1", right: "r1" }, { left: "l2", right: "r2" }, { left: "l3", right: "r3" }],
      },
      competencyKey: "understanding",
      objectiveId: "obj-1",
      marks: 10,
      difficulty: "standard",
    };
    const res = gradeAttempt(
      [q],
      new Map([["m1", { pairs: [{ left: "l1", right: "r1" }] }]]),
      BANDS,
    );
    assert.equal(res.graded[0]!.awardedMarks, 3.33);
  });

  it("feeds graded questions into scoreAttempt for a level", () => {
    const qs = Array.from({ length: 8 }, (_, i) => mcq({ competencyKey: "knowledge", marks: 1 }));
    const answers = new Map(qs.map(q => [q.questionId, { optionIds: ["b"] }]));
    const res = gradeAttempt(qs, answers, BANDS);
    assert.equal(res.score.percent, 100);
  });
});

describe("gradeAttempt — questions with no deterministic grader", () => {
  it("routes open-ended questions to ungraded rather than scoring them zero", () => {
    const open: AttemptQuestionInput = {
      questionId: "o1",
      type: "open_ended",
      body: { prompt: "اشرح" },
      expectedAnswer: { modelAnswer: "...", keyConcepts: ["a"] },
      competencyKey: "critical_thinking",
      objectiveId: "obj-2",
      marks: 5,
      difficulty: "advanced",
    };
    const res = gradeAttempt([open], new Map([["o1", { text: "إجابة الطالب" }]]), BANDS);
    assert.equal(res.graded.length, 0);
    assert.deepEqual(res.ungradedQuestionIds, ["o1"]);
    // Nothing to score yet: the ungraded question must not appear as 0 marks.
    assert.equal(res.score.totalMarks, 0);
  });

  it("still scores the deterministic questions in a mixed set", () => {
    const graded = mcq({ marks: 2 });
    const open: AttemptQuestionInput = {
      questionId: "o2",
      type: "practical_task",
      body: { prompt: "نفّذ" },
      expectedAnswer: { successCriteria: ["a"] },
      competencyKey: "application",
      objectiveId: "obj-3",
      marks: 3,
      difficulty: "standard",
    };
    const res = gradeAttempt(
      [graded, open],
      new Map([[graded.questionId, { optionIds: ["b"] }]]),
      BANDS,
    );
    assert.equal(res.graded.length, 1);
    assert.deepEqual(res.ungradedQuestionIds, ["o2"]);
    assert.equal(res.score.totalMarks, 2, "the ungraded question's marks are not counted yet");
  });
});
