import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkGrounding, claimText } from "../groundingCheck.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";

const BOOK = "الروابط التساهمية تنشأ عندما تتشارك الذرات زوجا من الإلكترونات، والرابطة الأيونية تنشأ بانتقال الإلكترونات";

function mc(correctText: string): GeneratedQuestion {
  return {
    type: "multiple_choice",
    body: {
      stem: "كيف تنشأ الرابطة؟",
      options: [
        { id: "a", text: correctText },
        { id: "b", text: "بتبخر المادة" },
        { id: "c", text: "بذوبان الملح" },
      ],
    },
    expectedAnswer: { optionIds: ["a"] },
    rubric: null,
    objectiveId: "o-1",
    competencyKey: "application",
    difficulty: "standard",
    marks: 1,
    skill: null,
    gradingMode: "deterministic",
    aiMetadata: {},
  };
}

describe("grounding check", () => {
  it("reads the correct option's text, not the distractors", () => {
    assert.equal(claimText(mc("بانتقال الإلكترونات")), "بانتقال الإلكترونات");
  });

  it("supports an answer the book says", () => {
    const [v] = checkGrounding([mc("تتشارك الذرات زوجا من الإلكترونات")], BOOK);
    assert.equal(v!.status, "supported");
  });

  it("flags an answer whose vocabulary is absent from the book", () => {
    const [v] = checkGrounding([mc("تتحول الطاقة الحرارية إلى طاقة حركية")], BOOK);
    assert.equal(v!.status, "weak");
  });

  it("never judges a computed answer — too few words to say anything", () => {
    const [v] = checkGrounding([mc("3x^2")], BOOK);
    assert.equal(v!.status, "uncheckable");
  });

  it("says uncheckable, not weak, when there is no source text", () => {
    const [v] = checkGrounding([mc("تتشارك الذرات زوجا من الإلكترونات")], "");
    assert.equal(v!.status, "uncheckable");
  });
});
