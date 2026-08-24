/**
 * Class-level aggregation.
 *
 * The case that decides whether this is worth having is the one where a mean
 * of percentages and a marks-weighted total disagree — because that is exactly
 * the situation where the wrong one sends a teacher to reteach the wrong thing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateClass } from "../classInsights.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(
  objectiveId: string,
  earned: number,
  total: number,
  over: Partial<ObjectiveScore> = {},
): ObjectiveScore {
  return {
    objectiveId,
    earned,
    total,
    percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: over.questionCount ?? 1,
    marksLost: total - earned,
    bloomsRank: over.bloomsRank ?? 2,
  };
}

describe("aggregateClass", () => {
  it("sums marks across students rather than averaging their percentages", () => {
    // 'cheap': three students each lose 1 of 2 → 50% class, 3 marks lost.
    // 'costly': three students each lose 6 of 10 → 40% class, 18 marks lost.
    const attempts = [
      { objectiveScores: [o("cheap", 1, 2), o("costly", 4, 10)] },
      { objectiveScores: [o("cheap", 1, 2), o("costly", 4, 10)] },
      { objectiveScores: [o("cheap", 1, 2), o("costly", 4, 10)] },
    ];
    const res = aggregateClass(attempts);
    const costly = res.objectiveScores.find(x => x.objectiveId === "costly")!;
    const cheap = res.objectiveScores.find(x => x.objectiveId === "cheap")!;
    assert.equal(costly.earned, 12);
    assert.equal(costly.total, 30);
    assert.equal(costly.marksLost, 18);
    assert.equal(cheap.marksLost, 3);
    assert.equal(res.gaps[0]!.objectiveId, "costly", "the costliest gap must lead");
  });

  it("ranks by cost even when the percentage ordering disagrees", () => {
    // 'pricey' is the better percentage (55%) but loses 12 marks across the
    // class. 'tiny' looks far worse at 20% and loses 2. Ordering by percentage
    // would send the teacher to reteach the cheaper one.
    const attempts = [
      { objectiveScores: [o("pricey", 11, 20), o("tiny", 0.5, 2)] },
      { objectiveScores: [o("pricey", 11, 20), o("tiny", 0.3, 2)] },
    ];
    const res = aggregateClass(attempts);
    const pricey = res.objectiveScores.find(x => x.objectiveId === "pricey")!;
    const tiny = res.objectiveScores.find(x => x.objectiveId === "tiny")!;
    assert.equal(pricey.percent, 55, "pricey reads better as a percentage");
    assert.ok(tiny.percent < 25, "tiny reads far worse as a percentage");
    assert.ok(pricey.marksLost > tiny.marksLost, "but pricey cost the class more");
    assert.equal(res.gaps[0]!.objectiveId, "pricey", "the costlier gap must lead");
  });

  it("counts how many students were below the line, not just the class percent", () => {
    // 65% as a class, but two of three students are under water on it.
    const attempts = [
      { objectiveScores: [o("split", 10, 10)] },
      { objectiveScores: [o("split", 5, 10)] },
      { objectiveScores: [o("split", 5, 10)] },
    ];
    const res = aggregateClass(attempts);
    const split = res.objectiveScores[0]!;
    assert.equal(split.percent, 66.67);
    assert.equal(split.studentCount, 3);
    assert.equal(split.studentsBelowGap, 2);
  });

  it("handles an objective only some students were asked about", () => {
    const attempts = [
      { objectiveScores: [o("shared", 2, 4), o("only-one", 0, 6)] },
      { objectiveScores: [o("shared", 4, 4)] },
    ];
    const res = aggregateClass(attempts);
    const onlyOne = res.objectiveScores.find(x => x.objectiveId === "only-one")!;
    assert.equal(onlyOne.studentCount, 1);
    assert.equal(onlyOne.total, 6);
    const shared = res.objectiveScores.find(x => x.objectiveId === "shared")!;
    assert.equal(shared.studentCount, 2);
    assert.equal(shared.percent, 75);
  });

  it("is empty, not zero, for a class nobody has marked", () => {
    const res = aggregateClass([]);
    assert.equal(res.studentCount, 0);
    assert.equal(res.totalMarks, 0);
    assert.equal(res.percent, 0);
    assert.deepEqual(res.objectiveScores, []);
    assert.deepEqual(res.gaps, []);
  });

  it("keeps the most foundational Bloom's rank seen, for gap tie-breaks", () => {
    const attempts = [
      { objectiveScores: [o("x", 1, 10, { bloomsRank: 3 })] },
      { objectiveScores: [o("x", 1, 10, { bloomsRank: 1 })] },
    ];
    assert.equal(aggregateClass(attempts).objectiveScores[0]!.bloomsRank, 1);
  });
});
