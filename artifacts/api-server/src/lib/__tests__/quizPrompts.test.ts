/**
 * The quiz prompt has to say what the teacher ticked, what each ticked type
 * looks like, and how a ministry paper orders them.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/quizPrompts.test.ts
 *
 * It used to send the type tokens raw beside one MCQ example, so a صح/خطأ
 * request came back as four-option items or not at all, in the model's own
 * order. `normalizeQuiz` catches a model that still ignores this; these pin
 * the prompt's half of that contract.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { quizPromptAr, quizPromptEn, quizTypes, worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";
import { QUIZ_TYPE_ORDER } from "../generationShape.ts";

const base = { subject: "الكيمياء", grade: "العاشر", topic: "الروابط الأيونية", numQuestions: 8, totalMarks: 20 };

describe("quiz prompt honours the requested types", () => {
  for (const [name, build] of [["ar", quizPromptAr], ["en", quizPromptEn]] as const) {
    it(`${name}: describes only the ticked types, and forbids others`, () => {
      const tf = build({ ...base, questionTypes: ["true_false"] });
      assert.match(tf, name === "ar" ? /\["صح", "خطأ"\]/ : /\["True", "False"\]/);
      assert.ok(!/"multiple_choice":/.test(tf), `${name}: an unrequested type's contract is in the prompt`);
      assert.match(tf, name === "ar" ? /لا تستعمل غيرها/ : /use no others/);
      // The JSON example opens with the first requested type, not MCQ.
      assert.match(tf, /"type": "true_false"/);
    });

    it(`${name}: lists the blocks in ministry order whatever order the teacher ticked`, () => {
      const p = build({ ...base, questionTypes: ["short_answer", "multiple_choice", "true_false"] });
      const mc = p.indexOf("multiple_choice");
      const tf = p.indexOf("true_false");
      const sa = p.indexOf("short_answer");
      assert.ok(mc < tf && tf < sa, `${name}: types are not in ministry order`);
      assert.match(p, name === "ar" ? /السؤال الأول/ : /Question 1:/);
    });

    it(`${name}: asks for a spread of levels and stems`, () => {
      const p = build({ ...base, questionTypes: ["multiple_choice"] });
      assert.match(p, name === "ar" ? /نوّع المستويات/ : /Vary the cognitive demand/);
      assert.match(p, name === "ar" ? /جميع ما سبق/ : /all of the above/);
    });

    it(`${name}: ties the marks to the teacher's total`, () => {
      assert.match(build({ ...base, totalMarks: 30, questionTypes: ["multiple_choice"] }), /30/);
    });
  }

  it("quizTypes drops unknown tokens and falls back to MCQ + true/false", () => {
    assert.deepEqual(quizTypes({ questionTypes: ["essay", "true_false", "multiple_choice"] }), ["multiple_choice", "true_false"]);
    assert.deepEqual(quizTypes({ questionTypes: ["essay"] }), ["multiple_choice", "true_false"]);
    assert.deepEqual(quizTypes({}), ["multiple_choice", "true_false"]);
    assert.deepEqual(quizTypes({ questionTypes: [...QUIZ_TYPE_ORDER].reverse() }), [...QUIZ_TYPE_ORDER]);
  });
});

describe("worksheet prompt shows the shape of each requested type", () => {
  for (const [name, build] of [["ar", worksheetPromptAr], ["en", worksheetPromptEn]] as const) {
    it(`${name}: a multiple-choice worksheet is told where its options go`, () => {
      const p = build({ ...base, questionTypes: ["multiple_choice", "fill_blank"] });
      assert.match(p, /"options"/);
      assert.match(p, /__________/);
      assert.ok(!/true_false:/.test(p), `${name}: described a type that was not requested`);
    });
  }
});
