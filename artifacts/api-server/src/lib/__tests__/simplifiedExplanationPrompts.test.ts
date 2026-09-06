/**
 * «تبسيط الشرح» must be a student's handout on BOTH paths.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/simplifiedExplanationPrompts.test.ts
 *
 * This tool had no server implementation at all: the screen posted to
 * `/generate/lesson-plan` with «تبسيط الشرح» glued onto the topic and a
 * `mode:simplify` line no prompt clause read. Offline it produced a shorter
 * lesson plan; live it produced an ordinary one. Nothing failed, because
 * DEMO_MODE ships `true` and the offline branch was all anyone ever saw.
 *
 * The offline twin is `artifacts/mobile/services/ai/explainerBlueprint.ts`
 * (`EXPLAINER_SHAPE`, `buildExplainer`), pinned from that side by
 * `artifacts/mobile/services/__tests__/simplifiedExplanation.test.ts`. The two
 * cannot import each other, so the shared numbers are pinned by hand on each
 * side — if you change one, change the other.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EXPLAINER_SHAPE,
  simplifiedExplanationPromptAr,
  simplifiedExplanationPromptEn,
} from "../prompts.ts";
import { REQUIRED_FIELDS } from "../generationShape.ts";

const base = { subject: "الرياضيات", grade: "العاشر", topic: "المعادلات التربيعية" };
const BUILDERS = [
  ["ar", simplifiedExplanationPromptAr],
  ["en", simplifiedExplanationPromptEn],
] as const;

describe("the shape both paths promise", () => {
  it("matches EXPLAINER_SHAPE in explainerBlueprint.ts", () => {
    // Hand-pinned from this side. The mobile blueprint declares the same
    // literals; a change here that is not mirrored there gives a teacher a
    // different handout depending on whether live generation was on.
    assert.deepEqual({ ...EXPLAINER_SHAPE }, { minSteps: 3, maxSteps: 5, checks: 3 });
  });

  for (const [lang, build] of BUILDERS) {
    it(`${lang}: states the step band and the check count`, () => {
      const p = build(base);
      assert.ok(p.includes(String(EXPLAINER_SHAPE.minSteps)), `${lang}: minSteps missing`);
      assert.ok(p.includes(String(EXPLAINER_SHAPE.maxSteps)), `${lang}: maxSteps missing`);
      assert.ok(p.includes(String(EXPLAINER_SHAPE.checks)), `${lang}: check count missing`);
    });
  }
});

describe("the prompt asks for every field the gate requires", () => {
  for (const [lang, build] of BUILDERS) {
    it(`${lang}: names each required field as a JSON key`, () => {
      const p = build(base);
      // Imported, not copied: adding a required field without a prompt clause
      // for it would otherwise 502 every live generation with no clue why.
      for (const path of REQUIRED_FIELDS["simplified-explanation"]) {
        for (const segment of path.split(".")) {
          assert.ok(p.includes(`"${segment}"`), `${lang}: prompt never mentions "${segment}"`);
        }
      }
    });
  }
});

describe("it is a handout, not a lesson plan", () => {
  it("ar: bans the lesson-plan sections by name", () => {
    const p = simplifiedExplanationPromptAr(base);
    assert.match(p, /ممنوع/);
    for (const banned of ["أهداف", "تقييم", "واجب", "تمايز"]) {
      assert.ok(p.includes(banned), `ar: does not ban «${banned}»`);
    }
  });

  it("en: bans the lesson-plan sections by name", () => {
    const p = simplifiedExplanationPromptEn(base);
    assert.match(p, /Forbidden/);
    for (const banned of ["objectives", "assessment", "homework", "differentiation"]) {
      assert.ok(p.includes(banned), `en: does not ban "${banned}"`);
    }
  });

  for (const [lang, build] of BUILDERS) {
    it(`${lang}: forbids addressing the teacher`, () => {
      const p = build(base);
      assert.match(p, lang === "ar" ? /اطلب من الطلاب/ : /ask students to/);
    });

    it(`${lang}: never asks the model for a verification flag`, () => {
      // Nothing in this path runs the verifier. Asking for the field is how an
      // unearned claim gets written, stored, and re-served from the pool.
      assert.doesNotMatch(build(base), /verified|verifiedBy|computedAnswer/);
    });

    it(`${lang}: keeps equations in latin letters`, () => {
      // SymPy multiplies Arabic letters rather than rejecting them, and
      // extractGraphCommands matches [a-z] — see CLAUDE.md.
      assert.match(build(base), lang === "ar" ? /اللاتينية/ : /latin letters/);
    });

    it(`${lang}: tells the model to omit keyWords rather than invent them`, () => {
      assert.match(build(base), lang === "ar" ? /احذف "keyWords"/ : /omit "keyWords"/);
    });

    it(`${lang}: carries the book context when there is some`, () => {
      const withCtx = build({ ...base, additionalContext: "فقرة من الكتاب" });
      assert.ok(withCtx.includes("فقرة من الكتاب"));
      assert.ok(!build(base).includes("فقرة من الكتاب"));
    });
  }
});
