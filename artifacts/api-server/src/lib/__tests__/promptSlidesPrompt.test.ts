/**
 * Prompt-slides prompt builders.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/promptSlidesPrompt.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PROMPT_SLIDES,
  MAX_PROMPT_SLIDE_IMAGES,
  promptSlidesPromptAr,
  promptSlidesPromptEn,
} from "../promptSlidesPrompt.ts";

const baseBody = {
  subject: "Science",
  grade: "6",
  language: "english",
  additionalContext: "Make a 6-slide intro to photosynthesis, fun tone, 2 quiz questions",
};

describe("promptSlidesPromptAr / promptSlidesPromptEn — carries the teacher's prompt", () => {
  it("Arabic prompt interpolates the teacher's free text verbatim", () => {
    const prompt = promptSlidesPromptAr(baseBody);
    assert.ok(prompt.includes(baseBody.additionalContext));
  });

  it("English prompt interpolates the teacher's free text verbatim", () => {
    const prompt = promptSlidesPromptEn(baseBody);
    assert.ok(prompt.includes(baseBody.additionalContext));
  });

  it("both languages interpolate grade and subject", () => {
    const ar = promptSlidesPromptAr(baseBody);
    const en = promptSlidesPromptEn(baseBody);
    assert.ok(ar.includes(baseBody.subject) && ar.includes(baseBody.grade));
    assert.ok(en.includes(baseBody.subject) && en.includes(baseBody.grade));
  });
});

describe("promptSlidesPrompt — slide count", () => {
  it("states a sensible default range when no slideCount is given", () => {
    const ar = promptSlidesPromptAr(baseBody);
    const en = promptSlidesPromptEn(baseBody);
    assert.match(ar, /6.*10|بين 6 و10/);
    assert.match(en, /between 6 and 10/);
  });

  it("states the requested count, clamped to the hard cap", () => {
    const ar = promptSlidesPromptAr({ ...baseBody, slideCount: 8 });
    const en = promptSlidesPromptEn({ ...baseBody, slideCount: 8 });
    assert.match(ar, /أنشئ 8 شريحة بالضبط/);
    assert.match(en, /exactly 8 slides/);

    const arOver = promptSlidesPromptAr({ ...baseBody, slideCount: 999 });
    const enOver = promptSlidesPromptEn({ ...baseBody, slideCount: 999 });
    assert.match(arOver, new RegExp(`أنشئ ${MAX_PROMPT_SLIDES} شريحة بالضبط`));
    assert.match(enOver, new RegExp(`exactly ${MAX_PROMPT_SLIDES} slides`));
  });
});

describe("promptSlidesPrompt — required JSON-shape fields", () => {
  for (const [label, prompt] of [
    ["ar", promptSlidesPromptAr(baseBody)],
    ["en", promptSlidesPromptEn(baseBody)],
  ] as const) {
    it(`${label}: names activityName and slides`, () => {
      assert.match(prompt, /"activityName"/);
      assert.match(prompt, /"slides"/);
    });

    it(`${label}: restricts slide types to the ones this path can render`, () => {
      assert.match(prompt, /intro, divider, challenge, question, summary, media|intro,\s*divider,\s*challenge,\s*question,\s*summary,\s*media/);
    });

    it(`${label}: instructs 0-based correctIndex`, () => {
      assert.match(prompt, /0-based|فهرسه المُصفَّر/);
    });

    it(`${label}: caps media slides and forbids a model-invented mediaUrl`, () => {
      assert.match(prompt, new RegExp(String(MAX_PROMPT_SLIDE_IMAGES)));
      assert.match(prompt, /never write "mediaUrl"|لا تكتب "mediaUrl" أبدًا/);
    });
  }
});
