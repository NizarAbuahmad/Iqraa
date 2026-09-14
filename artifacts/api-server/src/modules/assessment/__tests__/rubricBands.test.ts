/**
 * What a printed rubric is allowed to promise.
 *
 * These bands are advisory — no grader reads them, a teacher does, while
 * marking by hand. That makes a wrong band quieter than a wrong grader and no
 * less costly: it moves real marks on a real paper, and nothing contradicts it.
 *
 * The band that has to hold is the middle one. "Partially correct" must be
 * worth less than "complete and correct", or the rubric tells a teacher to
 * award full marks for an answer the same rubric calls incomplete. On a
 * 1-mark question there is no integer between 0 and 1, so the honest rubric
 * has no partial band at all rather than one that ties the top.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getObjectivesForUnit } from "@workspace/curriculum";
import { generateMockEvaluation, type GenerationRequest } from "../mockGenerator.ts";

const UNIT = "kbu-math-s1-nccd-u2";

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    objectives: getObjectivesForUnit(UNIT).slice(0, 3),
    assessmentTypes: ["short_answer", "open_ended", "problem_solving"],
    count: 12,
    difficulty: "standard",
    seed: 7,
    ...overrides,
  };
}

type Level = { marks: number; descriptor_ar: string };

/** Every rubric level on a generated paper, paired with its question's marks. */
function rubricLevels(req: GenerationRequest = request()) {
  return generateMockEvaluation(req)
    .questions.filter(q => q.rubric !== null)
    .map(q => {
      const criteria = (q.rubric as { criteria: { levels: Level[] }[] }).criteria;
      return { marks: q.marks, levels: criteria[0]!.levels };
    });
}

describe("mock rubric bands", () => {
  it("never lets a partial band award the full mark", () => {
    const all = rubricLevels();
    assert.ok(all.length > 0, "the paper must contain rubric-graded questions");
    for (const { marks, levels } of all) {
      const partials = levels.filter(l => l.marks > 0 && l.marks < marks);
      const ties = levels.filter(l => l.marks === marks);
      assert.equal(
        ties.length,
        1,
        `a ${marks}-mark question has ${ties.length} bands worth full marks: ${JSON.stringify(levels)}`,
      );
      for (const p of partials) assert.ok(p.marks < marks && p.marks > 0);
    }
  });

  it("gives a one-mark question no partial band, rather than one worth the lot", () => {
    const ones = rubricLevels().filter(r => r.marks === 1);
    assert.ok(ones.length > 0, "knowledge questions are 1 mark — the paper must have one");
    for (const { levels } of ones) {
      assert.deepEqual(
        levels.map(l => l.marks),
        [1, 0],
        "a 1-mark rubric is complete-or-not; there is no integer in between",
      );
    }
  });

  it("keeps the partial band wherever one can honestly exist", () => {
    const many = rubricLevels().filter(r => r.marks >= 2);
    assert.ok(many.length > 0, "the paper must have questions worth 2 marks or more");
    for (const { marks, levels } of many) {
      assert.equal(levels.length, 3, `a ${marks}-mark question should keep all three bands`);
      const middle = levels[1]!;
      assert.ok(
        middle.marks > 0 && middle.marks < marks,
        `a ${marks}-mark partial band must sit strictly between 0 and ${marks}, got ${middle.marks}`,
      );
    }
  });

  it("still descends: every band is worth less than the one above it", () => {
    for (const { levels } of rubricLevels()) {
      for (let i = 1; i < levels.length; i++) {
        assert.ok(levels[i]!.marks < levels[i - 1]!.marks, JSON.stringify(levels));
      }
    }
  });
});
