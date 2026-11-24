/**
 * A teacher can ask for a paper out of a round total (20, 40, 100…), and the
 * generated questions' marks are scaled to it.
 *
 * Before, the total was whatever the questions happened to add up to — on a
 * live paper, whatever marks the model chose — and a teacher who sets papers
 * out of 20 retyped every mark by hand.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fitToTotal, scaleMarks, scaleRubric } from "../marksTotal.ts";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("scaleMarks", () => {
  it("lands exactly on the total, in whole marks", () => {
    for (const [weights, total] of [
      [[1, 1, 2, 2, 3, 3, 4, 4], 20],
      [[1, 2, 3, 4, 1, 2, 3], 40],
      [[1, 1, 1], 10],
      [[4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 100],
      [[3, 3, 3], 3],
    ] as const) {
      const out = scaleMarks(weights, total)!;
      assert.equal(sum(out), total, `${weights.join(",")} → ${out.join(",")}`);
      assert.ok(out.every(m => Number.isInteger(m) && m >= 1), out.join(","));
    }
  });

  it("keeps a harder question worth at least as much as an easier one", () => {
    const weights = [1, 2, 3, 4, 1, 2, 3, 4, 2, 3];
    const out = scaleMarks(weights, 30)!;
    for (let i = 0; i < weights.length; i += 1) {
      for (let j = 0; j < weights.length; j += 1) {
        if (weights[i]! > weights[j]!) assert.ok(out[i]! >= out[j]!, `${weights.join(",")} → ${out.join(",")}`);
      }
    }
  });

  it("gives equal questions equal marks when the total divides", () => {
    assert.deepEqual(scaleMarks([2, 2, 2, 2], 20), [5, 5, 5, 5]);
  });

  it("refuses a total smaller than the number of questions, or not a whole number", () => {
    assert.equal(scaleMarks([1, 1, 1], 2), null);
    assert.equal(scaleMarks([1, 1], 7.5), null);
    assert.equal(scaleMarks([], 10), null);
  });
});

describe("scaleRubric", () => {
  const rubric = {
    criteria: [
      {
        id: "c1",
        label_ar: "صحة الحل",
        marks: 3,
        levels: [
          { marks: 3, descriptor_ar: "كاملة" },
          { marks: 2, descriptor_ar: "جزئية" },
          { marks: 0, descriptor_ar: "خطأ" },
        ],
      },
    ],
  };

  it("moves a one-criterion rubric to the question's new marks, levels included", () => {
    const out = scaleRubric(rubric, 3, 6) as typeof rubric;
    assert.equal(out.criteria[0]!.marks, 6);
    assert.deepEqual(out.criteria[0]!.levels.map(l => l.marks), [6, 4, 0]);
    assert.equal(out.criteria[0]!.label_ar, "صحة الحل");
  });

  it("keeps several criteria adding up to the question's marks", () => {
    const two = { criteria: [{ label: "أ", marks: 1 }, { label: "ب", marks: 2 }] };
    const out = scaleRubric(two, 3, 5) as typeof two;
    assert.equal(sum(out.criteria.map(c => c.marks)), 5);
    assert.ok(out.criteria[1]!.marks >= out.criteria[0]!.marks);
  });

  it("leaves no rubric, or unchanged marks, as they were", () => {
    assert.equal(scaleRubric(null, 3, 6), null);
    assert.equal(scaleRubric(rubric, 3, 3), rubric);
  });
});

describe("fitToTotal", () => {
  it("does nothing without a target", () => {
    assert.deepEqual(fitToTotal([1, 2, 3], 0, null), { marks: [1, 2, 3] });
  });

  it("scales the generated questions to what the teacher's own questions leave", () => {
    const out = fitToTotal([1, 2, 3, 4], 10, 30);
    assert.equal(sum(out.marks), 20);
    assert.equal(out.note, undefined);
  });

  it("keeps the generated marks and says why when the target cannot be met", () => {
    const out = fitToTotal([1, 2, 3, 4], 18, 20);
    assert.deepEqual(out.marks, [1, 2, 3, 4]);
    assert.match(out.note ?? "", /20/);
  });
});
