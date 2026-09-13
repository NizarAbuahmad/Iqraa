/**
 * The four types a quick evaluation is built from must still mark themselves.
 *
 * `artifacts/mobile/services/miniEval.ts` hardcodes this list, and it cannot
 * see the grader registry — the mobile bundle has the type names from
 * `@workspace/db` but the `grade()` implementations live only here. So the
 * mobile test pins *which* types the preset uses, and this one pins that those
 * types are still gradeable without a teacher.
 *
 * What this catches: someone changes `fill_blank` to `defaultGradingMode:
 * "ai_rubric"` (reasonable-looking — blanks can need judgement), and every exit
 * ticket silently starts requiring hand-marking. No error, no failing build,
 * and the teacher finds out at 9pm.
 *
 * Keep the literal list. Importing it from the mobile package would make the two
 * agree by construction and test nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QUESTION_TYPES } from "../questionTypes.ts";
import type { QuestionType } from "@workspace/db";

const MINI_EVAL_TYPES: QuestionType[] = [
  "multiple_choice",
  "true_false",
  "fill_blank",
  "matching",
];

describe("mini-evaluation question types", () => {
  for (const type of MINI_EVAL_TYPES) {
    it(`${type} grades deterministically with no teacher`, () => {
      const module = QUESTION_TYPES[type];
      assert.ok(module, `${type} is missing from the registry`);
      assert.equal(
        typeof module.grade,
        "function",
        `${type} has no grade() — a quick evaluation built from it would need hand-marking`,
      );
      assert.equal(
        module.defaultGradingMode,
        "deterministic",
        `${type} no longer defaults to deterministic grading`,
      );
    });
  }

  it("the hand-marked types are still the ones with no grader", () => {
    // The other half of the same claim: if one of these grew a grade(), the
    // preset could safely widen, and this failing is the prompt to reconsider.
    for (const type of ["short_answer", "open_ended", "practical_task"] as QuestionType[]) {
      assert.equal(
        typeof QUESTION_TYPES[type].grade,
        "undefined",
        `${type} now has a grader — quick evaluations could include it`,
      );
    }
  });
});
