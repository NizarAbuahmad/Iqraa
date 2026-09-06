/**
 * A live model may not claim an answer came from the reviewed bank.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/explainerAnswers.test.ts
 *
 * `answerSource` says how an answer was established. The offline generator can
 * say 'bank' or 'curriculum' because it draws from those sources. A live model
 * cannot, but will write `"answerSource": "bank"` because the JSON shape invites
 * it — and the artifact is pooled, so the claim would be re-served to every
 * teacher on that lesson.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { stampGeneratedAnswerSource } from "../explainerAnswers.ts";

const explainer = (checks: unknown[]) => ({
  title: "تبسيط الشرح",
  bigIdea: "الفكرة",
  checks,
});

describe("stampGeneratedAnswerSource", () => {
  it("overwrites a provenance the model could not have had", () => {
    const out = stampGeneratedAnswerSource(
      explainer([{ text: "س", answer: "٣", answerSource: "bank" }]),
    ) as { checks: Array<Record<string, unknown>> };
    assert.equal(out.checks[0]!.answerSource, "generated");
  });

  it("labels an unlabelled answer rather than leaving it bare", () => {
    const out = stampGeneratedAnswerSource(
      explainer([{ text: "س", answer: "٣" }]),
    ) as { checks: Array<Record<string, unknown>> };
    assert.equal(out.checks[0]!.answerSource, "generated");
  });

  it("leaves an open question unlabelled — nothing generated an answer", () => {
    const out = stampGeneratedAnswerSource(
      explainer([{ text: "اشرح بكلماتك" }, { text: "س", answer: "   " }]),
    ) as { checks: Array<Record<string, unknown>> };
    assert.ok(!("answerSource" in out.checks[0]!));
    assert.ok(!("answerSource" in out.checks[1]!));
  });

  it("strips any verification fields the model invented", () => {
    const out = stampGeneratedAnswerSource(
      explainer([
        { text: "س", answer: "٣", verified: true, verifiedBy: "symbolic", computedAnswer: "٣" },
      ]),
    ) as { checks: Array<Record<string, unknown>> };
    assert.doesNotMatch(JSON.stringify(out), /"verified"|"verifiedBy"|"computedAnswer"/);
  });

  it("leaves everything else byte-identical", () => {
    const input = {
      ...explainer([{ text: "س", answer: "٣", answerSource: "generated" }]),
      workedExample: { text: "مسألة", steps: ["خطوة"], answer: "٥" },
      keyWords: [{ term: "حد", meaning: "تعريف" }],
    };
    assert.deepEqual(stampGeneratedAnswerSource(input), input);
  });

  it("passes through anything that is not an explainer", () => {
    for (const bad of [null, undefined, 42, "نص", [], {}, { checks: "nope" }]) {
      assert.deepEqual(stampGeneratedAnswerSource(bad), bad);
    }
  });
});
