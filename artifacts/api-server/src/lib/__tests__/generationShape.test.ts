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
  missingFields,
  REQUIRED_FIELDS,
  UnusableGenerationError,
} from "../generationShape.ts";

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

const explainer = () => ({
  title: "تبسيط الشرح",
  bigIdea: "الفكرة في جملة",
  explanation: ["خطوة", "خطوة أخرى", "خطوة ثالثة"],
  workedExample: { text: "مسألة", steps: ["خطوة"], answer: "٣" },
  misconception: { claim: "الخطأ الشائع", correction: "التصحيح" },
  checks: [{ text: "سؤال" }],
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

  it("passes a complete simplified explanation", () => {
    assert.deepEqual(missingFields("simplified-explanation", explainer()), []);
  });

  it("looks INSIDE workedExample and misconception", () => {
    // The whole reason the dotted paths exist. A model that gets cut off after
    // opening the object leaves `{}` behind, which a bare key check reads as
    // present — and this artifact is pooled, so one empty worked example is
    // served to every teacher who asks for that lesson, not just the one who
    // triggered it.
    assert.deepEqual(
      missingFields("simplified-explanation", { ...explainer(), workedExample: {} }),
      ["workedExample.text", "workedExample.answer"],
    );
    assert.deepEqual(
      missingFields("simplified-explanation", {
        ...explainer(),
        workedExample: { text: "مسألة", steps: [], answer: "  " },
      }),
      ["workedExample.answer"],
    );
    assert.deepEqual(
      missingFields("simplified-explanation", {
        ...explainer(),
        misconception: { claim: "الخطأ" },
      }),
      ["misconception.correction"],
    );
  });

  it("reports a dotted path as missing when its parent is not an object", () => {
    for (const bad of [null, "نص", 42, ["a"]]) {
      assert.deepEqual(
        missingFields("simplified-explanation", { ...explainer(), workedExample: bad }),
        ["workedExample.text", "workedExample.answer"],
        `workedExample: ${JSON.stringify(bad)} should report both leaves`,
      );
    }
  });

  it("does not require keyWords — several lessons print no terms box", () => {
    // An invented definition is worse than none, so the generator omits the
    // field rather than sending []. Requiring it would 502 those lessons.
    assert.ok(!REQUIRED_FIELDS["simplified-explanation"].includes("keyWords"));
    assert.deepEqual(missingFields("simplified-explanation", explainer()), []);
  });

  it("never requires a `verified` field on a self-check", () => {
    // Nothing in this path runs the verifier. Requiring the flag would invite
    // the model to supply one, which is how an unearned claim gets stored.
    assert.ok(
      !REQUIRED_FIELDS["simplified-explanation"].some((f) => f.includes("verified")),
    );
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
