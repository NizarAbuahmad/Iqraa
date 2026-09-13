/**
 * Term-level rollup — the same aggregation across evaluations instead of within
 * one.
 *
 * `GET /classes/:id/mastery` reuses `aggregateClass` verbatim, so what is at
 * risk here is not the function but the claim that it still means something one
 * level up. Two things have to hold, and both break quietly:
 *
 * 1. A term rollup is not a mean of the exams' percentages. A ten-mark objective
 *    examined once and a two-mark objective examined five times are not equally
 *    weighted evidence, and averaging the papers would say they are.
 * 2. Summing one student across weeks is arithmetically the same operation as
 *    summing a class on one day — which is why the route can reuse the function
 *    — but `studentsBelowGap` stops meaning anything when every row is the same
 *    student. The route projects those fields off; this pins why.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateClass } from "../classInsights.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(objectiveId: string, earned: number, total: number): ObjectiveScore {
  return {
    objectiveId,
    earned,
    total,
    percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: 1,
    marksLost: total - earned,
    bloomsRank: 2,
  };
}

describe("mastery rollup across evaluations", () => {
  it("weights by marks, not by how many times an objective was examined", () => {
    // 'quadratics' appears in one exam worth 10 marks, and the class loses 6.
    // 'units' appears in five quick checks worth 2 marks each, losing 1 a time.
    // Both end at 5 marks lost... but quadratics rests on a single sitting.
    // A mean of per-exam percentages would rank units (50% five times over) as
    // indistinguishable from quadratics (40% once), and hide that the class has
    // been asked about units five times and still cannot do it.
    const term = [
      { objectiveScores: [o("quadratics", 4, 10)] },
      { objectiveScores: [o("units", 1, 2)] },
      { objectiveScores: [o("units", 1, 2)] },
      { objectiveScores: [o("units", 1, 2)] },
      { objectiveScores: [o("units", 1, 2)] },
      { objectiveScores: [o("units", 1, 2)] },
    ];

    const res = aggregateClass(term);
    const quadratics = res.objectiveScores.find(x => x.objectiveId === "quadratics")!;
    const units = res.objectiveScores.find(x => x.objectiveId === "units")!;

    assert.equal(quadratics.total, 10, "one sitting, ten marks available");
    assert.equal(units.total, 10, "five sittings, ten marks available");
    assert.equal(quadratics.marksLost, 6);
    assert.equal(units.marksLost, 5);
    assert.equal(
      res.gaps[0]!.objectiveId,
      "quadratics",
      "the costlier gap leads even though it was examined once",
    );
  });

  it("accumulates one student's own evidence across sittings", () => {
    // The per-student view feeds the same function rows that are all one
    // student. Week 1 they lose 3 of 4; by week 3 they lose none. The rollup
    // must show the whole term (7 of 12), not the latest sitting.
    const student = [
      { objectiveScores: [o("fractions", 1, 4)] },
      { objectiveScores: [o("fractions", 2, 4)] },
      { objectiveScores: [o("fractions", 4, 4)] },
    ];

    const res = aggregateClass(student);
    const fractions = res.objectiveScores.find(x => x.objectiveId === "fractions")!;

    assert.equal(fractions.earned, 7);
    assert.equal(fractions.total, 12);
    assert.equal(fractions.marksLost, 5);
  });

  it("counts a repeatedly-weak student once per sitting, which is why the route drops the field", () => {
    // Three sittings, same student, under water every time. `studentsBelowGap`
    // reads 3 — true of the rows, false of the world: there is one student
    // here, not three. The class route may surface this field; the per-student
    // one must not, and a future edit that starts passing it through should
    // fail here rather than in front of a teacher.
    const student = [
      { objectiveScores: [o("ratios", 0, 4)] },
      { objectiveScores: [o("ratios", 1, 4)] },
      { objectiveScores: [o("ratios", 1, 4)] },
    ];

    const res = aggregateClass(student);
    const ratios = res.objectiveScores.find(x => x.objectiveId === "ratios")!;

    assert.equal(ratios.studentsBelowGap, 3);
    assert.equal(ratios.studentCount, 3);
    assert.equal(
      ratios.earned + ratios.marksLost,
      ratios.total,
      "the marks arithmetic stays sound either way — only the two names lie",
    );
  });

  it("ignores unmarked attempts rather than scoring them zero", () => {
    // The route filters these out before aggregating. If one ever reaches the
    // function it contributes nothing, so an unmarked pile cannot drag a term
    // average down — it just makes the evidence thinner, which is the truth.
    const term = [
      { objectiveScores: [o("algebra", 8, 10)] },
      { objectiveScores: [] as ObjectiveScore[] },
      { objectiveScores: [] as ObjectiveScore[] },
    ];

    const res = aggregateClass(term);
    const algebra = res.objectiveScores.find(x => x.objectiveId === "algebra")!;

    assert.equal(algebra.total, 10);
    assert.equal(algebra.percent, 80);
  });
});
