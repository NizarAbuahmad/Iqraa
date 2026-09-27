/**
 * The Slides Maker explanation prompt, and the shape the route accepts.
 *
 * The prompt rules pinned here each answer a real deck: checks that taught
 * the next lesson, an example projected with its own answer, and a warm-up
 * that was stage directions. See lib/lessonTeachingPrompt.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lessonTeachingPromptAr, lessonTeachingPromptEn } from "../lessonTeachingPrompt.ts";
import { assertUsableGeneration, missingFields, UnusableGenerationError } from "../generationShape.ts";

const BODY = {
  topic: "المول والكتلة المولية",
  subject: "Chemistry",
  grade: "الصف العاشر",
  additionalContext: "نتاجات الدرس: أوضح مفهوم المول.",
};

describe("lesson-teaching prompt", () => {
  for (const [lang, build] of [["ar", lessonTeachingPromptAr], ["en", lessonTeachingPromptEn]] as const) {
    it(`${lang}: carries the lesson and its book context`, () => {
      const p = build(BODY);
      assert.ok(p.includes(BODY.topic));
      assert.ok(p.includes(BODY.additionalContext));
    });

    it(`${lang}: asks for every field the deck places`, () => {
      const p = build(BODY);
      for (const field of ['"hook"', '"concepts"', '"workedExample"', '"practice"', '"steps"', '"misconception"']) {
        assert.ok(p.includes(field), `missing ${field}`);
      }
    });

    it(`${lang}: omits the context block when there is no book context`, () => {
      const p = build({ ...BODY, additionalContext: "" });
      assert.equal(p.includes("undefined"), false);
    });
  }

  it("ar: pins the rules each earlier deck broke", () => {
    const p = lessonTeachingPromptAr(BODY);
    assert.match(p, /التزم بهذا الدرس وحده/);
    assert.match(p, /لا يتضمّن الإجابة/);
    assert.match(p, /لا تعليمات إخراج/);
    assert.match(p, /لا تسمية/);
  });

  it("en: pins the rules each earlier deck broke", () => {
    const p = lessonTeachingPromptEn(BODY);
    assert.match(p, /Stay inside this lesson/);
    assert.match(p, /never contains the answer/);
    assert.match(p, /No stage directions/);
    assert.match(p, /never a label/);
  });
});

describe("lesson-teaching shape", () => {
  it("accepts an explanation with nothing else", () => {
    assert.deepEqual(missingFields("lesson-teaching", { concepts: [{ title: "x", points: ["y"] }] }), []);
  });

  it("refuses a reply with no explanation — that is the whole call", () => {
    assert.throws(
      () => assertUsableGeneration("lesson-teaching", { hook: { question: "؟" }, concepts: [] }),
      UnusableGenerationError,
    );
  });
});
