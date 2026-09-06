/**
 * Difficulty has to reach the prompt, and mean something once it gets there.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/difficultyPrompts.test.ts
 *
 * The worksheet prompt used to interpolate the level name and stop
 * («المستوى: صعب»), and the quiz prompt never mentioned `difficulty` at all —
 * so the live path ignored the picker exactly as the offline generator did.
 * These clauses mirror the tiering in
 * `artifacts/mobile/services/ai/generators.ts` (`pickTiered`, and the
 * worksheet's `BANDS`); if you change one, change the other.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  worksheetPromptAr, worksheetPromptEn,
  quizPromptAr, quizPromptEn,
  difficultyClauseAr, difficultyClauseEn,
} from "../prompts.ts";

const base = { subject: "الكيمياء", grade: "العاشر", topic: "الروابط الأيونية", numQuestions: 8, totalMarks: 20 };
const TIERS = ["easy", "medium", "hard"] as const;

describe("worksheet difficulty reaches the prompt", () => {
  for (const [name, build] of [["ar", worksheetPromptAr], ["en", worksheetPromptEn]] as const) {
    it(`${name}: the three tiers produce three different prompts`, () => {
      const prompts = TIERS.map(difficulty => build({ ...base, difficulty }));
      assert.equal(new Set(prompts).size, 3, `${name}: only ${new Set(prompts).size} distinct prompts`);
    });

    it(`${name}: states what the tier means, not just its name`, () => {
      const hard = build({ ...base, difficulty: "hard" });
      // A bare level name is what this replaced.
      assert.ok(hard.length > build({ ...base }).length - 200, `${name}: clause missing`);
      assert.match(hard, name === "ar" ? /مقارنة أو تحليل/ : /Comparison, analysis/);
    });

    it(`${name}: the band shifts rather than flattening`, () => {
      const hard = build({ ...base, difficulty: "hard" });
      assert.match(hard, name === "ar" ? /لا تجعل الأقسام الثلاثة بالمستوى نفسه/ : /Do not make all three sections the same level/);
    });
  }

  it("the band matches the offline generator's BANDS table", () => {
    // easy → easy/easy/medium, medium → easy/medium/hard, hard → medium/hard/hard
    assert.match(difficultyClauseEn({ difficulty: "easy" }), /section 1 easy, section 2 easy, section 3 medium/);
    assert.match(difficultyClauseEn({ difficulty: "medium" }), /section 1 easy, section 2 medium, section 3 hard/);
    assert.match(difficultyClauseEn({ difficulty: "hard" }), /section 1 medium, section 2 hard, section 3 hard/);
    assert.match(difficultyClauseAr({ difficulty: "hard" }), /القسم الأول متوسط، الثاني صعب، الثالث صعب/);
  });

  it("an unknown or absent difficulty falls back to medium, not to nothing", () => {
    const missing = difficultyClauseEn({});
    assert.match(missing, /medium/);
    assert.equal(difficultyClauseEn({ difficulty: "nonsense" }), missing);
  });

  it("mixed asks for a spread instead of collapsing to medium", () => {
    assert.match(difficultyClauseEn({ difficulty: "mixed" }), /Spread the questions across all three levels/);
    assert.match(difficultyClauseAr({ difficulty: "mixed" }), /وزّع الأسئلة على المستويات الثلاثة/);
  });
});

describe("quiz difficulty reaches the prompt at all", () => {
  for (const [name, build] of [["ar", quizPromptAr], ["en", quizPromptEn]] as const) {
    it(`${name}: the three tiers produce three different prompts`, () => {
      const prompts = TIERS.map(difficulty => build({ ...base, difficulty }));
      assert.equal(new Set(prompts).size, 3, `${name}: quiz prompt ignores difficulty`);
    });

    it(`${name}: names the tier and what it means`, () => {
      const easy = build({ ...base, difficulty: "easy" });
      assert.match(easy, name === "ar" ? /مستوى الأسئلة: سهل/ : /Question difficulty: easy/);
      assert.match(easy, name === "ar" ? /استرجاع وتعريف مباشر/ : /Direct recall or definition/);
    });

    it(`${name}: a quiz gets no worksheet progression clause`, () => {
      // A quiz is a flat assessment; the three-section band belongs to the
      // worksheet only.
      const q = build({ ...base, difficulty: "hard" });
      assert.ok(!/section 1|القسم الأول/.test(q), `${name}: quiz prompt carries the worksheet band`);
    });
  }
});

/**
 * The same failure this file documents for `difficulty`, found in production
 * on 2026-09-06 for `duration`: a teacher picked a 20-minute quiz and got a
 * paper headed «45 دقيقة». Both quiz prompts carried a literal
 * `"duration": 45` in their JSON template while every neighbouring field
 * interpolated the request — so the picker worked, the value reached the
 * server, and the prompt threw it away. The lesson-plan prompts in the same
 * file had it right, which is what makes this look like a copy that lost its
 * `${...}`.
 *
 * Per-language because the two templates are separate strings, and a fix that
 * touched only the Arabic one would otherwise pass.
 */
describe("quiz duration reaches the prompt", () => {
  for (const [name, build] of [["ar", quizPromptAr], ["en", quizPromptEn]] as const) {
    it(`${name}: the teacher's duration is what the prompt asks for`, () => {
      assert.match(build({ ...base, duration: 20 }), /"duration": 20/, `${name}: quiz prompt ignores duration`);
      assert.match(build({ ...base, duration: 30 }), /"duration": 30/);
    });

    it(`${name}: two durations are two different prompts`, () => {
      // The assertion above would still pass if 20 and 30 appeared somewhere
      // unrelated in the template. This one cannot.
      assert.notEqual(
        build({ ...base, duration: 20 }),
        build({ ...base, duration: 45 }),
        `${name}: duration does not change the quiz prompt`,
      );
    });

    it(`${name}: falls back to 45 when the caller sends none`, () => {
      // Matches the lesson-plan prompts' `?? 45`. A quiz built by a path that
      // never asks for a duration should still name one.
      assert.match(build({ ...base }), /"duration": 45/);
    });
  }
});
