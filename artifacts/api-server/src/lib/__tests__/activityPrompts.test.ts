/**
 * Activity prompt builders — one prompt per format.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/activityPrompts.test.ts
 *
 * `activityPromptAr`/`activityPromptEn` used to inject the type name into the
 * opening sentence and then ask for the same fixed JSON shape for all five
 * formats. The model had nothing to differentiate on, so live generation had
 * the same defect the offline generator did: a "game" was four cooperative
 * steps with the word game in the title. These tests pin that each format
 * carries its own structure clause, in both languages — the same regression
 * `classroomPrompts.test.ts` exists to prevent on the classroom side.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { activityPromptAr, activityPromptEn } from "../prompts.ts";

const FORMATS = ["individual", "group", "discussion", "hands-on", "game"] as const;

const baseBody = {
  subject: "الرياضيات",
  grade: "العاشر",
  topic: "قانون الجيوب",
  duration: 30,
};

describe("activity prompts differ per format", () => {
  for (const build of [
    { name: "ar", fn: activityPromptAr },
    { name: "en", fn: activityPromptEn },
  ]) {
    it(`${build.name}: all five formats produce different prompts`, () => {
      const prompts = FORMATS.map(activityType => build.fn({ ...baseBody, activityType }));
      assert.equal(
        new Set(prompts).size,
        FORMATS.length,
        `${build.name}: only ${new Set(prompts).size} distinct prompts for ${FORMATS.length} formats`,
      );
    });

    it(`${build.name}: the warm-up variant overrides the activity type`, () => {
      const warm = build.fn({ ...baseBody, activityType: "game", activityVariant: "warmup" });
      const game = build.fn({ ...baseBody, activityType: "game" });
      assert.notEqual(warm, game);
      assert.match(warm, /"activityType": "warmup"/);
    });

    it(`${build.name}: an unknown format still gets a structure clause`, () => {
      const prompt = build.fn({ ...baseBody, activityType: "station-rotation" });
      assert.ok(prompt.length > 400, "fell through to a bare prompt");
      assert.match(prompt, /station-rotation/);
    });

    it(`${build.name}: every prompt states the duration the steps must sum to`, () => {
      for (const activityType of FORMATS) {
        const prompt = build.fn({ ...baseBody, activityType });
        assert.match(prompt, /30/, `${activityType}: no duration constraint`);
      }
    });
  }
});

describe("each format's clause names what that format requires", () => {
  it("individual forbids group work outright", () => {
    const ar = activityPromptAr({ ...baseBody, activityType: "individual" });
    const en = activityPromptEn({ ...baseBody, activityType: "individual" });
    assert.match(ar, /قسّم الطلبة/, "must name the phrase it is forbidding");
    assert.match(ar, /ممنوع/);
    assert.match(en, /forbidden/i);
    assert.match(en, /divide students into/i);
  });

  it("group demands a jigsaw with different parts per member", () => {
    assert.match(activityPromptAr({ ...baseBody, activityType: "group" }), /جيقسو/);
    assert.match(activityPromptEn({ ...baseBody, activityType: "group" }), /JIGSAW/);
  });

  it("discussion demands a contestable claim and two votes", () => {
    assert.match(activityPromptAr({ ...baseBody, activityType: "discussion" }), /ادعاء/);
    assert.match(activityPromptAr({ ...baseBody, activityType: "discussion" }), /تصويت/);
    assert.match(activityPromptEn({ ...baseBody, activityType: "discussion" }), /contestable claim/i);
    assert.match(activityPromptEn({ ...baseBody, activityType: "discussion" }), /second vote/i);
  });

  it("hands-on demands physical materials, not worksheets", () => {
    assert.match(activityPromptAr({ ...baseBody, activityType: "hands-on" }), /مسطرة/);
    assert.match(activityPromptEn({ ...baseBody, activityType: "hands-on" }), /card stock/i);
  });

  // The rule was maths-shaped: «compare the value you MEASURED with the value
  // the rule gives», with a ruler and protractor as the example kit. A
  // chemistry or English lesson cannot do that, so the model either forced it
  // or wrote a paper activity. The offline blueprints were fixed alongside
  // (services/__tests__/handsOnActivity.test.ts in the mobile app).
  it("hands-on is subject-neutral: it says what to build for each kind of lesson, and when NOT to measure", () => {
    const ar = activityPromptAr({ ...baseBody, activityType: "hands-on" });
    const en = activityPromptEn({ ...baseBody, activityType: "hands-on" });
    assert.match(ar, /لا تشترط المسطرة أو المنقلة إلا إذا كان الدرس يتضمن قياسًا/);
    assert.match(en, /Do not require a ruler or protractor unless the lesson involves measuring/);
    // A kit and a product for each of the other kinds of lesson.
    assert.match(ar, /كرات وعيدان/);
    assert.match(ar, /بطاقات/);
    assert.match(en, /balls and sticks/i);
    assert.match(en, /cards/i);
    // The constant part of the format: check the product against the rule or
    // the book, and explain any mismatch.
    assert.match(ar, /الكتاب/);
    assert.match(en, /textbook/i);
    // And the old maths-only phrasing is gone.
    assert.doesNotMatch(ar, /القيمة التي قاسها/);
    assert.doesNotMatch(en, /the value they measured/);
  });

  it("game demands rules, rounds, scoring and a win condition", () => {
    const ar = activityPromptAr({ ...baseBody, activityType: "game" });
    const en = activityPromptEn({ ...baseBody, activityType: "game" });
    for (const re of [/قواعد/, /جولتين/, /لوحة نتائج/, /شرط فوز/]) assert.match(ar, re);
    for (const re of [/rules/i, /two rounds/i, /scoreboard/i, /win condition/i]) assert.match(en, re);
  });

  it("warm-up forbids teaching the new content", () => {
    assert.match(activityPromptAr({ ...baseBody, activityVariant: "warmup" }), /ممنوع: شرح المحتوى الجديد/);
    assert.match(activityPromptEn({ ...baseBody, activityVariant: "warmup" }), /Forbidden: teaching the new content/);
  });
});
