/**
 * `lessonPlanPromptAr`/`lessonPlanPromptEn` — the prior-knowledge review block.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/prompts.test.ts
 *
 * A teacher can ask for a warm-up review of prior material two ways: ticking
 * "include prior-knowledge review" (grounded `priorKnowledge` concepts from
 * the unit's own curriculum data) and/or typing free-text notes on topics to
 * re-explain (`priorTopicsNotes`, which may reach across grades). Either one
 * must turn the block on; neither must silently invent content the request
 * did not send, and the `"priorReview"` line in the requested JSON shape must
 * track whether the block is actually active — a plan whose block is absent
 * has nowhere honest to put a review.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lessonPlanPromptAr, lessonPlanPromptEn } from "../prompts.ts";

const BASE = { subject: "الرياضيات", grade: "العاشر", topic: "المعادلات التربيعية", duration: 45 };

describe("lessonPlanPromptAr — prior-knowledge review", () => {
  it("adds no review block or JSON line when nothing was asked for", () => {
    const prompt = lessonPlanPromptAr(BASE);
    assert.ok(!prompt.includes("priorReview"));
    assert.ok(!/مراجعة/.test(prompt));
  });

  it("omits the block when includePriorReview is set but priorKnowledge is empty", () => {
    const prompt = lessonPlanPromptAr({ ...BASE, includePriorReview: true, priorKnowledge: [] });
    assert.ok(!prompt.includes("priorReview"));
  });

  it("lists grounded concepts verbatim with the 'do not invent others' constraint", () => {
    const prompt = lessonPlanPromptAr({
      ...BASE,
      includePriorReview: true,
      priorKnowledge: ["حل معادلات تربيعية بالتحليل", "حل أنظمة معادلات خطية"],
    });
    assert.match(prompt, /حل معادلات تربيعية بالتحليل/);
    assert.match(prompt, /حل أنظمة معادلات خطية/);
    assert.match(prompt, /لا تختلق غيرها/);
    assert.ok(prompt.includes('"priorReview"'), 'JSON shape should request a priorReview field');
  });

  it("carries free-text teacher notes verbatim, even without curriculum concepts", () => {
    const notes = "بعض الطلاب لم يستوعبوا حل المعادلات من الصف التاسع";
    const prompt = lessonPlanPromptAr({ ...BASE, priorTopicsNotes: notes });
    assert.match(prompt, new RegExp(notes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(prompt.includes('"priorReview"'));
  });

  it("does not fold review content into the objectives instruction", () => {
    const prompt = lessonPlanPromptAr({ ...BASE, priorTopicsNotes: "راجع الصف التاسع" });
    assert.match(prompt, /لا تُدرجها ضمن "objectives"/);
  });

  it("ignores whitespace-only notes", () => {
    const prompt = lessonPlanPromptAr({ ...BASE, priorTopicsNotes: "   " });
    assert.ok(!prompt.includes("priorReview"));
  });
});

describe("lessonPlanPromptEn — prior-knowledge review", () => {
  it("adds no review block or JSON line when nothing was asked for", () => {
    const prompt = lessonPlanPromptEn(BASE);
    assert.ok(!prompt.includes("priorReview"));
  });

  it("lists grounded concepts verbatim with the 'do not invent others' constraint", () => {
    const prompt = lessonPlanPromptEn({
      ...BASE,
      includePriorReview: true,
      priorKnowledge: ["Solving quadratics by factoring"],
    });
    assert.match(prompt, /Solving quadratics by factoring/);
    assert.match(prompt, /do not invent others/);
    assert.ok(prompt.includes('"priorReview"'));
  });

  it("carries free-text teacher notes verbatim", () => {
    const notes = "Some students never grasped solving equations from grade 9";
    const prompt = lessonPlanPromptEn({ ...BASE, priorTopicsNotes: notes });
    assert.ok(prompt.includes(notes));
    assert.ok(prompt.includes('"priorReview"'));
  });
});
