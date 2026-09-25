/**
 * The gate between "valid JSON" and "an artifact the app can render".
 *
 * What these guard: `/generate/*` used to answer 200 with whatever
 * `extractJSON` recovered. A truncated response yields a partial object or
 * `{}`, and the screen drew a blank lesson plan with no error anywhere — not
 * in the logs, not in the UI, and not in the provenance badge, which said
 * «ذكاء اصطناعي مباشر» because the call had genuinely succeeded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertUsableGeneration,
  deckShortfalls,
  missingFields,
  REQUIRED_FIELDS,
  UnusableGenerationError,
} from "../generationShape.ts";

/** A deck that clears the structural floor, for mutating in the cases below. */
const deck = (slides: unknown[]) => ({ activityName: "عرض", slides });
const slide = (over: Record<string, unknown> = {}) => ({
  slideNumber: 1, type: "intro", title: "عنوان", content: "• سطر\n• سطر آخر",
  teacher: { teachingTips: "نصيحة" }, ...over,
});
const fiveSlides = () => [slide(), slide(), slide(), slide(), slide()];

const lessonPlan = () => ({
  title: "خطة درس",
  objectives: ["هدف"],
  materials: ["الكتاب"],
  introduction: "تمهيد",
  mainActivity: "نشاط",
  guidedPractice: "تدريب موجه",
  independentPractice: "تدريب مستقل",
  closure: "ختام",
  assessment: "تقييم",
  differentiation: "تمايز",
  homework: "واجب",
});

describe("missingFields", () => {
  it("passes a complete artifact", () => {
    assert.deepEqual(missingFields("lesson-plan", lessonPlan()), []);
  });

  it("reports everything for the truncation signatures", () => {
    // These are what extractJSON actually recovers from a cut-off response.
    for (const bad of [{}, null, undefined, [], "خطة درس", 42]) {
      assert.deepEqual(
        missingFields("lesson-plan", bad),
        [...REQUIRED_FIELDS["lesson-plan"]],
        `${JSON.stringify(bad)} should be entirely missing`,
      );
    }
  });

  it("treats an empty string or empty array as absent, not present", () => {
    // A key that exists with a whitespace value is the truncation signature,
    // not a value — `"closure": ""` renders as an empty section either way.
    assert.deepEqual(missingFields("lesson-plan", { ...lessonPlan(), closure: "   " }), ["closure"]);
    assert.deepEqual(missingFields("lesson-plan", { ...lessonPlan(), objectives: [] }), ["objectives"]);
  });

  it("names every missing field, not just the first", () => {
    const partial = { title: "خطة درس", objectives: ["هدف"] };
    const missing = missingFields("lesson-plan", partial);
    assert.equal(missing.length, REQUIRED_FIELDS["lesson-plan"].length - 2);
    assert.ok(missing.includes("closure"));
    assert.ok(!missing.includes("title"));
  });

  it("does not require priorReview — most plans never asked for one", () => {
    // priorReview only appears when the teacher asked for a warm-up review of
    // prior material (see prompts.ts). Requiring it here would 502 every
    // ordinary plan the moment the model — correctly — leaves it out.
    assert.ok(!REQUIRED_FIELDS["lesson-plan"].includes("priorReview"));
    assert.deepEqual(missingFields("lesson-plan", lessonPlan()), []);
    assert.deepEqual(
      missingFields("lesson-plan", { ...lessonPlan(), priorReview: "مراجعة قصيرة" }),
      [],
    );
  });

  it("does not require cosmetic echoes of the request", () => {
    // A quiz missing `duration` is still a quiz. Discarding it would turn a
    // usable artifact into mock content, which is the opposite of the point.
    const quiz = { title: "اختبار", questions: [{ id: "q1", text: "س" }] };
    assert.deepEqual(missingFields("quiz", quiz), []);
  });

  it("holds homework to the worksheet contract it is rendered by", () => {
    assert.deepEqual(REQUIRED_FIELDS.homework, REQUIRED_FIELDS.worksheet);
  });
});

describe("assertUsableGeneration", () => {
  it("does not throw for a complete artifact", () => {
    assert.doesNotThrow(() => assertUsableGeneration("lesson-plan", lessonPlan()));
  });

  it("throws and carries the field list", () => {
    try {
      assertUsableGeneration("worksheet", { title: "ورقة عمل" });
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof UnusableGenerationError);
      assert.equal(err.kind, "worksheet");
      assert.deepEqual(err.missing, ["instructions", "sections", "answerKey"]);
      // The message has to name the fields — a bare "generation failed" is
      // how the original bug stayed invisible.
      assert.match(err.message, /instructions, sections, answerKey/);
    }
  });

  it("covers every kind the routes can pass", () => {
    // A route added without a field list would silently validate nothing.
    for (const kind of Object.keys(REQUIRED_FIELDS) as (keyof typeof REQUIRED_FIELDS)[]) {
      assert.ok(REQUIRED_FIELDS[kind].length > 0, `${kind} has no required fields`);
      assert.throws(() => assertUsableGeneration(kind, {}), UnusableGenerationError);
    }
  });
});

describe("prompt-slides — the structural floor", () => {
  it("accepts a deck that clears it", () => {
    assert.doesNotThrow(() => assertUsableGeneration("prompt-slides", deck(fiveSlides())));
  });

  it("refuses the deck that shipped as six blank cards", () => {
    // The exact artifact a teacher saw: valid JSON, required fields present,
    // rendering as near-empty slides behind a "live AI" badge.
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([{ title: "x" }])),
      UnusableGenerationError,
    );
  });

  it("refuses a deck shorter than five slides", () => {
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([slide(), slide()])),
      UnusableGenerationError,
    );
  });

  it("refuses a deck where any slide has an empty title or body", () => {
    for (const bad of [{ title: "" }, { content: "" }, { content: "   " }]) {
      const slides = fiveSlides();
      slides[2] = slide(bad);
      assert.throws(
        () => assertUsableGeneration("prompt-slides", deck(slides)),
        UnusableGenerationError,
        `${JSON.stringify(bad)} should be refused`,
      );
    }
  });

  it("names how many slides were blank, so the log says what was wrong", () => {
    try {
      assertUsableGeneration("prompt-slides", deck([...fiveSlides(), slide({ content: "" })]));
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof UnusableGenerationError);
      assert.match(err.message, /1 of 6 slides/);
    }
  });

  it("leaves every other kind alone", () => {
    // Only prompt-slides gets the per-slide pass; a quiz of one question is
    // still a quiz.
    assert.doesNotThrow(() =>
      assertUsableGeneration("quiz", { title: "اختبار", questions: [{ id: "q1", text: "س" }] }));
  });
});

describe("deckShortfalls — reported, never refused", () => {
  it("says nothing about a deck that meets the bars", () => {
    const slides = [
      slide({ type: "divider" }), slide(), slide(),
      slide({ type: "question" }), slide({ type: "summary" }),
    ];
    assert.deepEqual(deckShortfalls(deck(slides)), []);
  });

  it("counts slides with no teacher notes", () => {
    const slides = fiveSlides();
    slides[0] = slide({ teacher: undefined });
    assert.ok(deckShortfalls(deck(slides)).some(s => /teacher notes/.test(s)));
  });

  it("flags a deck with nothing to answer and no section break", () => {
    const out = deckShortfalls(deck(fiveSlides()));
    assert.ok(out.some(s => /no question or worked-example/.test(s)));
    assert.ok(out.some(s => /no divider/.test(s)));
  });

  it("flags single-line slides, which render as near-empty", () => {
    const slides = fiveSlides();
    slides[1] = slide({ content: "one flat sentence" });
    assert.ok(deckShortfalls(deck(slides)).some(s => /single unbroken line/.test(s)));
  });

  it("is silent on anything that is not a deck", () => {
    assert.deepEqual(deckShortfalls(null), []);
    assert.deepEqual(deckShortfalls({}), []);
  });
});

describe("infographic contract", () => {
  const infographic = () => ({
    title: "الاقترانات",
    keyFacts: [{ label: "المجال", value: "قيم x المسموح بها" }],
    sections: [{ heading: "التعريف", icon: "bulb-outline", points: ["نقطة"] }],
    takeaway: "كل مدخل له مخرج واحد",
  });

  it("accepts a complete infographic, with or without a subtitle", () => {
    assert.deepEqual(missingFields("infographic", infographic()), []);
  });

  it("rejects one with no sections — the card would be empty", () => {
    assert.deepEqual(missingFields("infographic", { ...infographic(), sections: [] }), ["sections"]);
    assert.throws(
      () => assertUsableGeneration("infographic", { ...infographic(), sections: [] }),
      UnusableGenerationError,
    );
  });
});
