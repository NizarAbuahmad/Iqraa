/**
 * Level calculation — the arithmetic behind what a teacher tells a parent.
 *
 * Two behaviours carry most of the weight here, and both are refusals:
 * a competency with too little evidence refuses to show a percentage, and a
 * headline average refuses to claim a level its parts do not support. Tests for
 * the happy path are cheap; these are the ones that stop the dashboard being
 * confidently wrong.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_QUESTIONS_PER_COMPETENCY,
  resolveLevel,
  scoreAttempt,
  type GradedQuestion,
  type LevelBandInput,
} from "../scoring.ts";

const BANDS: LevelBandInput[] = [
  { key: "beginner", minPercent: 0, maxPercent: 49 },
  { key: "developing", minPercent: 50, maxPercent: 69 },
  { key: "proficient", minPercent: 70, maxPercent: 84 },
  { key: "advanced", minPercent: 85, maxPercent: 100 },
];

let seq = 0;
function q(over: Partial<GradedQuestion> = {}): GradedQuestion {
  const awarded = over.awardedMarks ?? 1;
  const max = over.maxMarks ?? 1;
  return {
    questionId: `q${seq++}`,
    competency: over.competency ?? "knowledge",
    objectiveId: over.objectiveId ?? null,
    awardedMarks: awarded,
    maxMarks: max,
    verdict: over.verdict ?? (awarded >= max ? "correct" : awarded > 0 ? "partial" : "incorrect"),
    ...(over.excluded !== undefined ? { excluded: over.excluded } : {}),
    ...(over.bloomsRank !== undefined ? { bloomsRank: over.bloomsRank } : {}),
  };
}

/** Enough spread that no demotion rule fires unless a test wants it to. */
function balanced(correctPerCompetency: number): GradedQuestion[] {
  const out: GradedQuestion[] = [];
  for (const c of ["knowledge", "understanding", "application", "critical_thinking"] as const) {
    for (let i = 0; i < 3; i++) {
      out.push(q({ competency: c, awardedMarks: i < correctPerCompetency ? 1 : 0, maxMarks: 1 }));
    }
  }
  return out;
}

describe("band resolution", () => {
  it("maps a percentage to its band", () => {
    assert.equal(resolveLevel(0, BANDS), "beginner");
    assert.equal(resolveLevel(49, BANDS), "beginner");
    assert.equal(resolveLevel(50, BANDS), "developing");
    assert.equal(resolveLevel(84, BANDS), "proficient");
    assert.equal(resolveLevel(85, BANDS), "advanced");
    assert.equal(resolveLevel(100, BANDS), "advanced");
  });
});

describe("overall scoring", () => {
  it("weights by marks, not by question count", () => {
    // One 10-mark question wrong outweighs three 1-mark questions right.
    const res = scoreAttempt(
      [
        q({ awardedMarks: 0, maxMarks: 10 }),
        q({ awardedMarks: 1, maxMarks: 1 }),
        q({ awardedMarks: 1, maxMarks: 1 }),
        q({ awardedMarks: 1, maxMarks: 1 }),
      ],
      BANDS,
    );
    assert.equal(res.totalMarks, 13);
    assert.equal(res.earnedMarks, 3);
    assert.equal(res.percent, 23.08);
  });

  it("counts unanswered in the denominator but reports it separately", () => {
    const res = scoreAttempt(
      [
        q({ awardedMarks: 1, maxMarks: 1 }),
        q({ awardedMarks: 0, maxMarks: 1, verdict: "unanswered" }),
        q({ awardedMarks: 0, maxMarks: 1, verdict: "incorrect" }),
      ],
      BANDS,
    );
    assert.equal(res.totalMarks, 3, "unanswered still counts against the total");
    assert.equal(res.unansweredCount, 1, "but is distinguishable from wrong");
  });

  it("drops excluded questions from both sides of the fraction", () => {
    const res = scoreAttempt(
      [q({ awardedMarks: 1, maxMarks: 1 }), q({ awardedMarks: 0, maxMarks: 5, excluded: true })],
      BANDS,
    );
    assert.equal(res.totalMarks, 1);
    assert.equal(res.percent, 100);
  });
});

describe("sufficiency — refusing to report a number built on one question", () => {
  it("reports null rather than a percentage below the question threshold", () => {
    const res = scoreAttempt(
      [
        ...Array.from({ length: 9 }, () => q({ competency: "knowledge", maxMarks: 1 })),
        q({ competency: "application", awardedMarks: 0, maxMarks: 1 }),
      ],
      BANDS,
    );
    const app = res.competencyScores["application"];
    assert.ok(app.questionCount < MIN_QUESTIONS_PER_COMPETENCY);
    assert.equal(app.sufficient, false);
    assert.equal(app.percent, null, "one question must not produce a percentage");
  });

  it("also refuses when the competency is under a tenth of the marks", () => {
    // Two questions, but worth 2 of 102 marks: present, not measured.
    const res = scoreAttempt(
      [
        q({ competency: "knowledge", awardedMarks: 100, maxMarks: 100 }),
        q({ competency: "application", awardedMarks: 1, maxMarks: 1 }),
        q({ competency: "application", awardedMarks: 1, maxMarks: 1 }),
      ],
      BANDS,
    );
    const app = res.competencyScores["application"];
    assert.equal(app.questionCount, 2);
    assert.equal(app.sufficient, false);
    assert.equal(app.percent, null);
  });

  it("reports a percentage once there is enough evidence", () => {
    const res = scoreAttempt(balanced(3), BANDS);
    const k = res.competencyScores["knowledge"];
    assert.equal(k.sufficient, true);
    assert.equal(k.percent, 100);
  });
});

describe("demotion — an average must not outrank its parts", () => {
  it("caps at developing when the basic facts are missing", () => {
    // 75% overall, but knowledge at 33%: not proficient in the topic.
    const res = scoreAttempt(
      [
        ...Array.from({ length: 3 }, (_, i) =>
          q({ competency: "knowledge", awardedMarks: i === 0 ? 1 : 0, maxMarks: 1 })),
        ...Array.from({ length: 9 }, () =>
          q({ competency: "understanding", awardedMarks: 1, maxMarks: 1 })),
        ...Array.from({ length: 3 }, () =>
          q({ competency: "critical_thinking", awardedMarks: 1, maxMarks: 1 })),
      ],
      BANDS,
    );
    assert.ok(res.percent >= 70, "raw score would have been proficient");
    assert.equal(res.levelKey, "developing");
    assert.equal(res.demotionReason, "knowledge_below_floor");
  });

  it("caps at proficient when there is no evidence of reasoning", () => {
    // 100% on everything measured, but critical thinking never asked about.
    const res = scoreAttempt(
      [
        ...Array.from({ length: 4 }, () => q({ competency: "knowledge", maxMarks: 1 })),
        ...Array.from({ length: 4 }, () => q({ competency: "understanding", maxMarks: 1 })),
        ...Array.from({ length: 4 }, () => q({ competency: "application", maxMarks: 1 })),
      ],
      BANDS,
    );
    assert.equal(res.percent, 100);
    assert.equal(res.levelKey, "proficient", "advanced is a claim the marks cannot support");
    assert.equal(res.demotionReason, "critical_thinking_insufficient");
  });

  it("leaves a level alone when every part supports it", () => {
    const res = scoreAttempt(balanced(3), BANDS);
    assert.equal(res.percent, 100);
    assert.equal(res.levelKey, "advanced");
    assert.equal(res.demotionReason, null);
  });
});

describe("strengths and gaps", () => {
  it("orders gaps by marks actually lost, not by lowest percentage", () => {
    const res = scoreAttempt(
      [
        // 50% of a 12-mark objective: 6 marks lost.
        q({ objectiveId: "big", awardedMarks: 6, maxMarks: 12 }),
        // 20% of a 5-mark objective: 4 marks lost, but a worse percentage.
        q({ objectiveId: "small", awardedMarks: 1, maxMarks: 5 }),
      ],
      BANDS,
    );
    assert.deepEqual(res.gaps.map(g => g.objectiveId), ["big", "small"]);
  });

  it("breaks ties toward foundational objectives", () => {
    const res = scoreAttempt(
      [
        q({ objectiveId: "higher", awardedMarks: 0, maxMarks: 4, bloomsRank: 4 }),
        q({ objectiveId: "foundational", awardedMarks: 0, maxMarks: 4, bloomsRank: 1 }),
      ],
      BANDS,
    );
    assert.deepEqual(res.gaps.map(g => g.objectiveId), ["foundational", "higher"]);
  });

  it("needs two questions before calling an objective a strength", () => {
    const res = scoreAttempt(
      [
        q({ objectiveId: "lucky", awardedMarks: 1, maxMarks: 1 }),
        q({ objectiveId: "solid", awardedMarks: 1, maxMarks: 1 }),
        q({ objectiveId: "solid", awardedMarks: 1, maxMarks: 1 }),
      ],
      BANDS,
    );
    assert.deepEqual(res.strengths.map(s => s.objectiveId), ["solid"]);
  });
});
