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
