/**
 * Teacher marking — the arithmetic, without a database.
 *
 * The two cases that matter are the ones a teacher would never report as a
 * bug: a typo that awards more marks than the question carries, and a zero
 * that gets recorded as "didn't answer" when the student did answer.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveVerdict, isVerdict, normalizeManualMarks } from "../manualGrade.ts";
import { scorePersistedGrades, type AttemptQuestionInput } from "../gradeAttempt.ts";
import type { LevelBandInput } from "../scoring.ts";

const BANDS: LevelBandInput[] = [
  { key: "beginner", minPercent: 0, maxPercent: 49 },
  { key: "developing", minPercent: 50, maxPercent: 69 },
  { key: "proficient", minPercent: 70, maxPercent: 84 },
  { key: "advanced", minPercent: 85, maxPercent: 100 },
];

function question(id: string, marks: number): AttemptQuestionInput {
  return {
    questionId: id,
    type: "open_ended",
    body: {},
    expectedAnswer: {},
    competencyKey: "understanding",
    objectiveId: "obj-1",
    marks,
    difficulty: "standard",
  };
}

describe("normalizeManualMarks", () => {
  it("accepts a number inside the question's range", () => {
    assert.equal(normalizeManualMarks(3, 5), 3);
    assert.equal(normalizeManualMarks(0, 5), 0);
    assert.equal(normalizeManualMarks(5, 5), 5);
  });

  it("accepts a numeric string, because a form sends text", () => {
    assert.equal(normalizeManualMarks("2.5", 5), 2.5);
    assert.equal(normalizeManualMarks(" 4 ", 5), 4);
  });

  it("rejects rather than clamps a mark above the question's max", () => {
    assert.equal(normalizeManualMarks(50, 5), null);
  });

  it("rejects a negative mark and anything that isn't a number", () => {
    assert.equal(normalizeManualMarks(-1, 5), null);
    assert.equal(normalizeManualMarks("", 5), null);
    assert.equal(normalizeManualMarks("   ", 5), null);
    assert.equal(normalizeManualMarks("جيد", 5), null);
    assert.equal(normalizeManualMarks(null, 5), null);
    assert.equal(normalizeManualMarks(undefined, 5), null);
  });

  it("rounds to two decimals", () => {
    assert.equal(normalizeManualMarks(2.567, 5), 2.57);
  });
});

describe("deriveVerdict", () => {
  it("reads full marks as correct and nothing as incorrect", () => {
    assert.equal(deriveVerdict(5, 5), "correct");
    assert.equal(deriveVerdict(0, 5), "incorrect");
  });

  it("reads anything between as partial", () => {
    assert.equal(deriveVerdict(2, 5), "partial");
  });

  it("never derives 'unanswered' — a zero is not a claim about the student", () => {
    for (const marks of [0, 1, 5]) {
      assert.notEqual(deriveVerdict(marks, 5), "unanswered");
    }
  });

  it("accepts an explicit verdict from the teacher", () => {
    assert.equal(isVerdict("unanswered"), true);
    assert.equal(isVerdict("nearly"), false);
  });
});

describe("scorePersistedGrades", () => {
  const questions = [question("q1", 5), question("q2", 5)];

  it("leaves an unmarked question out of the total instead of scoring it zero", () => {
    const { score, ungradedQuestionIds } = scorePersistedGrades(
      questions,
      [{ questionId: "q1", awardedMarks: 4, maxMarks: 5, verdict: "partial" }],
      BANDS,
    );
    assert.deepEqual(ungradedQuestionIds, ["q2"]);
    assert.equal(score.totalMarks, 5);
    assert.equal(score.earnedMarks, 4);
    assert.equal(score.percent, 80);
  });

  it("counts a teacher's mark on the last question — the result stops being provisional", () => {
    const { score, ungradedQuestionIds } = scorePersistedGrades(
      questions,
      [
        { questionId: "q1", awardedMarks: 4, maxMarks: 5, verdict: "partial" },
        { questionId: "q2", awardedMarks: 5, maxMarks: 5, verdict: "correct" },
      ],
      BANDS,
    );
    assert.deepEqual(ungradedQuestionIds, []);
    assert.equal(score.totalMarks, 10);
    assert.equal(score.earnedMarks, 9);
    assert.equal(score.percent, 90);
  });

  it("ignores a grade for a question that is not in the snapshot", () => {
    const { score } = scorePersistedGrades(
      questions,
      [{ questionId: "ghost", awardedMarks: 5, maxMarks: 5, verdict: "correct" }],
      BANDS,
    );
    assert.equal(score.totalMarks, 0);
  });
});
