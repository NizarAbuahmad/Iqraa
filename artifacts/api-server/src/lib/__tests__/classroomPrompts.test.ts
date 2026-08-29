/**
 * Classroom-activity prompt builders.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/classroomPrompts.test.ts
 *
 * Before this file, `classroomPromptAr`/`classroomPromptEn` lived inline in
 * `routes/generate.ts`, which imports the OpenAI client at module scope and
 * throws without a key — so they could not be unit-tested at all. That let
 * the Arabic branch silently fall behind the English one: on the live server
 * an Arabic teacher picking «المحقق الرياضي», «جولة المعارض», «بطاقة الخروج»
 * or «تحقق سريع» got an escape-challenge deck instead, because the Arabic
 * builder only recognised bingo and relay. The tests below pin every id in
 * both languages so that regression can't happen silently again.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CLASSROOM_ACTIVITY_TYPES,
  classroomPromptAr,
  classroomPromptEn,
  stripUnearnedVerification,
} from "../classroomPrompts.ts";

const baseBody = {
  subject: "الرياضيات",
  grade: "العاشر",
  topic: "المعادلات التربيعية",
  duration: 20,
  difficulty: "standard",
  groupType: "groups",
  teachingGoal: "practice",
};

describe("CLASSROOM_ACTIVITY_TYPES", () => {
  it("pins the exact set of ids (keep in sync with the mobile ACTIVITY_CARDS test)", () => {
    assert.deepEqual([...CLASSROOM_ACTIVITY_TYPES].sort(), [
      "bingo", "error-detective", "escape-challenge", "exit-ticket",
      "gallery-walk", "quick-check", "relay",
    ]);
  });
});

describe("classroomPromptAr / classroomPromptEn — format coverage", () => {
  for (const activityType of CLASSROOM_ACTIVITY_TYPES) {
    it(`${activityType}: the Arabic prompt names its own activityType, not the escape-challenge fallback`, () => {
      const prompt = classroomPromptAr({ ...baseBody, activityType });
      assert.match(
        prompt,
        new RegExp(`"activityType":\\s*"${activityType}"`),
        `Arabic prompt for "${activityType}" did not declare its own activityType — it likely fell back to escape-challenge`,
      );
    });

    it(`${activityType}: the English prompt names its own activityType`, () => {
      const prompt = classroomPromptEn({ ...baseBody, activityType });
      assert.match(
        prompt,
        new RegExp(`"activityType":\\s*"${activityType}"`),
        `English prompt for "${activityType}" did not declare its own activityType`,
      );
    });
  }

  it("an unrecognized activityType documents the escape-challenge fallback (both languages)", () => {
    const ar = classroomPromptAr({ ...baseBody, activityType: "not-a-real-type" });
    const en = classroomPromptEn({ ...baseBody, activityType: "not-a-real-type" });
    assert.match(ar, /"activityType":\s*"escape-challenge"/);
    assert.match(en, /"activityType":\s*"escape-challenge"/);
  });
});

describe("classroom prompts — quick-check", () => {
  it("clamps numQuestions into 1–8 and defaults to 4", () => {
    const noCount = classroomPromptAr({ ...baseBody, activityType: "quick-check" });
    assert.match(noCount, /أنشئ 4 شريحة/);

    const tooMany = classroomPromptEn({ ...baseBody, activityType: "quick-check", numQuestions: 99 });
    assert.match(tooMany, /exactly 8 slides/);

    const tooFew = classroomPromptEn({ ...baseBody, activityType: "quick-check", numQuestions: 0 });
    assert.match(tooFew, /exactly 4 slides/);

    const inRange = classroomPromptEn({ ...baseBody, activityType: "quick-check", numQuestions: 6 });
    assert.match(inRange, /exactly 6 slides/);
  });

  it("instructs a 0-based correctIndex explicitly, in both languages", () => {
    const ar = classroomPromptAr({ ...baseBody, activityType: "quick-check" });
    const en = classroomPromptEn({ ...baseBody, activityType: "quick-check" });
    assert.match(ar, /يبدأ العدّ من الصفر/);
    assert.match(en, /0-based/);
  });

  it("explicitly forbids the model from emitting a verified field, and never shows it as an example value", () => {
    const ar = classroomPromptAr({ ...baseBody, activityType: "quick-check" });
    const en = classroomPromptEn({ ...baseBody, activityType: "quick-check" });
    // The word "verified" only appears in the prohibition sentence, never as
    // a `"verified": true`-shaped example the model could copy.
    assert.doesNotMatch(ar, /"verified":\s*true/);
    assert.doesNotMatch(en, /"verified":\s*true/);
    assert.match(ar, /لا تُضِف حقل "verified"/);
    assert.match(en, /Do not add a "verified"/);
  });
});

describe("classroom prompts — Arabic format parity", () => {
  it("error-detective, gallery-walk and exit-ticket use the card's own Arabic name", () => {
    const errorDetective = classroomPromptAr({ ...baseBody, activityType: "error-detective" });
    const galleryWalk = classroomPromptAr({ ...baseBody, activityType: "gallery-walk" });
    const exitTicket = classroomPromptAr({ ...baseBody, activityType: "exit-ticket" });
    assert.match(errorDetective, /المحقق الرياضي/);
    assert.match(galleryWalk, /جولة المعارض/);
    assert.match(exitTicket, /بطاقة الخروج/);
  });
});

describe("stripUnearnedVerification", () => {
  const deck = (...slides: Record<string, unknown>[]) => ({ activityName: "تحقق سريع", slides });

  it("removes verified, verifiedBy and computedAnswer from every slide", () => {
    const out = stripUnearnedVerification(
      deck(
        { slideNumber: 1, type: "question", content: "?", verified: true, verifiedBy: "symbolic", computedAnswer: "5" },
        { slideNumber: 2, type: "question", content: "?", verified: true },
      ),
    ) as { slides: Record<string, unknown>[] };
    for (const slide of out.slides) {
      assert.ok(!("verified" in slide), "verified must be stripped");
      assert.ok(!("verifiedBy" in slide), "verifiedBy must be stripped");
      assert.ok(!("computedAnswer" in slide), "computedAnswer must be stripped");
    }
  });

  it("leaves every other field untouched", () => {
    const out = stripUnearnedVerification(
      deck({ slideNumber: 1, type: "question", content: "text", options: ["a", "b"], correctIndex: 1, verified: true }),
    ) as { slides: Record<string, unknown>[] };
    assert.equal(out.slides[0]!.content, "text");
    assert.deepEqual(out.slides[0]!.options, ["a", "b"]);
    assert.equal(out.slides[0]!.correctIndex, 1);
  });

  it("is a no-op on activities with no slides array, and does not mutate the input", () => {
    const notADeck = { activityName: "x" };
    assert.deepEqual(stripUnearnedVerification(notADeck), notADeck);

    const input = deck({ slideNumber: 1, type: "question", verified: true });
    const inputSlideBefore = { ...input.slides[0] };
    stripUnearnedVerification(input);
    assert.deepEqual(input.slides[0], inputSlideBefore, "input must not be mutated");
  });
});
