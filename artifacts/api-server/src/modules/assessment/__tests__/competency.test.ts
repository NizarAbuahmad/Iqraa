/**
 * Question allocation across competencies.
 *
 * The rule these guard: allocation is done in **marks**, not question counts.
 * They are different once questions carry different weights, and the level is
 * computed marks-weighted — so a count-based split silently under-serves the
 * cheap competencies. That is not hypothetical: allocating by count put
 * knowledge at 3 questions and 9% of marks, under the 10% floor, which the
 * scoring rules then drop from the result as insufficient evidence. The teacher
 * sees a blank bar and no explanation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateQuestions,
  COMPETENCY_KEYS,
  COMPETENCY_TARGETS,
  MARKS_BY_COMPETENCY,
  type Difficulty,
} from "../competency.ts";

const DIFFICULTIES: Difficulty[] = ["basic", "standard", "advanced"];

function marksOf(counts: Record<string, number>): number {
  return COMPETENCY_KEYS.reduce(
    (sum, k) => sum + counts[k]! * MARKS_BY_COMPETENCY[k],
    0,
  );
}

describe("allocateQuestions", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`assigns exactly the requested number of questions (${difficulty})`, () => {
      for (const total of [1, 3, 8, 10, 15, 20, 33]) {
        const counts = allocateQuestions(total, difficulty);
        const sum = COMPETENCY_KEYS.reduce((s, k) => s + counts[k]!, 0);
        assert.equal(sum, total, `${difficulty}/${total} produced ${sum}`);
      }
    });

    it(`gives every competency enough to be scoreable (${difficulty})`, () => {
      // Two questions AND 10% of marks is what the scoring rules require before
      // a competency is reported at all.
      const counts = allocateQuestions(15, difficulty);
      const total = marksOf(counts);
      for (const key of COMPETENCY_KEYS) {
        assert.ok(counts[key]! >= 2, `${key} got ${counts[key]} questions`);
        const share = (counts[key]! * MARKS_BY_COMPETENCY[key]) / total;
        assert.ok(
          share >= 0.1,
          `${key} holds ${(share * 100).toFixed(1)}% of marks, under the 10% floor`,
        );
      }
    });

    it(`lands near the target marks share once the floor stops binding (${difficulty})`, () => {
      // At 20 questions a 10% target cannot be met alongside two seeded
      // 4-mark critical-thinking questions, and the floor deliberately wins.
      // By 40 the constraint is slack and the greedy split should track the
      // targets closely.
      const counts = allocateQuestions(40, difficulty);
      const total = marksOf(counts);
      for (const key of COMPETENCY_KEYS) {
        const share = (counts[key]! * MARKS_BY_COMPETENCY[key]) / total;
        const target = COMPETENCY_TARGETS[difficulty][key];
        assert.ok(
          Math.abs(share - target) <= 0.05,
          `${key}: ${(share * 100).toFixed(0)}% vs target ${(target * 100).toFixed(0)}%`,
        );
      }
    });

    it(`keeps the minimum-evidence floor even where it overshoots (${difficulty})`, () => {
      // The floor is the non-negotiable part: under two questions, scoring
      // reports no value for the competency at all.
      const counts = allocateQuestions(20, difficulty);
      for (const key of COMPETENCY_KEYS) {
        assert.ok(counts[key]! >= 2, `${key} got ${counts[key]}`);
      }
    });
  }

  it("shifts weight upward as difficulty rises", () => {
    // Measured at a size where the seeding floor is not the binding constraint;
    // below that, the floor lifts critical thinking on every difficulty alike.
    const share = (d: Difficulty) => {
      const c = allocateQuestions(40, d);
      return (c.critical_thinking * MARKS_BY_COMPETENCY.critical_thinking) / marksOf(c);
    };
    assert.ok(share("advanced") > share("standard"), "advanced should out-weigh standard");
    assert.ok(share("standard") > share("basic"), "standard should out-weigh basic");
  });

  it("handles counts too small to seed every competency", () => {
    // Below the seeding threshold it must still return exactly `total`, even
    // though a spread is impossible — the caller reports the shortfall.
    for (const total of [1, 2, 5, 7]) {
      const counts = allocateQuestions(total, "standard");
      assert.equal(COMPETENCY_KEYS.reduce((s, k) => s + counts[k]!, 0), total);
    }
  });

  it("returns all zeros for a zero request rather than throwing", () => {
    const counts = allocateQuestions(0, "standard");
    assert.equal(marksOf(counts), 0);
  });
});
