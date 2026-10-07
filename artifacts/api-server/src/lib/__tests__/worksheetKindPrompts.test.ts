/**
 * The live worksheet prompt asks for a worked example, a half-solved question
 * and a `solution` on every answer-key row only where there is a calculation to
 * model.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/worksheetKindPrompts.test.ts
 *
 * Before this the structure was asked of every subject, with one vague escape
 * for "no multi-step procedure" that did not cover the answer key's `solution`
 * field. A Quran, PE or art worksheet was told to model a solved problem. The
 * offline worksheet only does it for maths and chemistry; the live prompt now
 * does it for maths, physics, chemistry and a subject it cannot place.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";
import { usesWorkedExample, worksheetKindRuleAr, worksheetKindRuleEn } from "../lessonKinds.ts";

const base = { grade: "العاشر", topic: "موضوع الاختبار", numQuestions: 8, questionTypes: ["short_answer"] };

const WITH = [
  ["الرياضيات", "Mathematics"], ["الفيزياء", "Physics"], ["الكيمياء", "Chemistry"], ["موضوع حر", "Something Unlisted"],
];
const WITHOUT: Array<[string, string, RegExp, RegExp]> = [
  ["التربية الإسلامية", "Islamic Studies", /قراءةً وفهمًا/, /reading, understanding and applying/],
  ["العلوم", "Science", /ملاحظةً وتفسيرًا/, /observing, explaining and predicting/],
  ["اللغة العربية", "Arabic", /نص قصير يرد داخل السؤال/, /short text that appears inside the question/],
  ["اللغة الإنجليزية", "English", /بالإنجليزية/, /in English/],
  ["الدراسات الاجتماعية", "Social Studies", /مصدر قصير/, /short source/],
  ["التربية الرياضية", "Physical Education", /مكمّلة للأداء/, /supports the performance/],
  ["التربية الفنية والموسيقية والمسرحية", "Art, Music and Drama Education", /معايير جودة/, /quality criteria/],
];

describe("who gets the worked-example structure", () => {
  it("maths, physics, chemistry and an unplaceable subject do", () => {
    for (const [ar, en] of WITH) {
      assert.equal(usesWorkedExample({ subject: ar }), true, ar);
      assert.equal(usesWorkedExample({ subject: en }), true, en);
    }
    assert.equal(usesWorkedExample({}), true);
    // a subject in the catalog the kind table does not list (computer) keeps the structure, like the offline default
    assert.equal(usesWorkedExample({ subject: "الحاسوب" }), true);
  });

  it("every other subject does not", () => {
    for (const [ar, en] of WITHOUT) {
      assert.equal(usesWorkedExample({ subject: ar }), false, ar);
      assert.equal(usesWorkedExample({ subject: en }), false, en);
    }
    assert.equal(usesWorkedExample({ subject: "الرياضيات", subjectId: "islamic" }), false, "an explicit id wins");
  });
});

describe("the live worksheet prompt", () => {
  it("keeps the whole structure for maths, physics, chemistry and a free topic", () => {
    for (const [ar, en] of WITH) {
      const a = worksheetPromptAr({ ...base, subject: ar });
      const e = worksheetPromptEn({ ...base, subject: en });
      for (const p of [a, e]) {
        assert.match(p, /"workedExample"/);
        assert.match(p, /"solution"/);
      }
      assert.match(a, /البنية المطلوبة/);
      assert.match(e, /Required structure/);
      assert.doesNotMatch(a, /طبيعة المادة/);
      assert.doesNotMatch(e, /Nature of the subject/);
    }
  });

  for (const [ar, en, arRe, enRe] of WITHOUT) {
    it(`${en}: no worked example, no half-solved question, no solution rows; its own rule instead`, () => {
      const a = worksheetPromptAr({ ...base, subject: ar });
      const e = worksheetPromptEn({ ...base, subject: en });
      assert.doesNotMatch(a, /البنية المطلوبة/);
      assert.doesNotMatch(e, /Required structure/);
      // the JSON shape must not offer the fields either, or the model fills them in
      assert.doesNotMatch(a, /"workedExample": \{/);
      assert.doesNotMatch(a, /"solution": \[/);
      assert.doesNotMatch(e, /"workedExample": \{/);
      assert.doesNotMatch(e, /"solution": \[/);
      assert.match(a, arRe);
      assert.match(e, enRe);
      assert.match(a, /طبيعة المادة/);
      assert.match(e, /Nature of the subject/);
      // the question count is not reduced for a worked example that is not there
      assert.match(a, /أعطِ 8 سؤالًا/);
      assert.match(e, /Give 8 questions/);
      // the answer key and the instructions are still asked for
      assert.match(a, /"answerKey"/);
      assert.match(a, /كل سؤال يجب أن يقابله عنصر في answerKey/);
    });
  }

  it("the Quran rule keeps the no-quoting-from-memory guard", () => {
    assert.match(worksheetPromptAr({ ...base, subject: "التربية الإسلامية" }), /لا تكتب نصّ آية أو حديث من ذاكرتك/);
    assert.match(worksheetPromptEn({ ...base, subject: "Islamic Studies" }), /Do not write out a verse or hadith from memory/);
  });

  it("homework is unchanged for every subject", () => {
    for (const subject of ["الرياضيات", "التربية الإسلامية"]) {
      const p = worksheetPromptAr({ ...base, subject, homework: true });
      assert.doesNotMatch(p, /"workedExample"/);
      assert.doesNotMatch(p, /"solution"/);
      assert.doesNotMatch(p, /طبيعة المادة/);
      assert.match(p, /واجبًا منزليًا/);
    }
  });

  it("each non-calculating kind has its own rule, and maths has none", () => {
    const ids = ["islamic", "science", "arabic", "english", "social", "physical-education", "creative-arts"];
    const ar = ids.map(subjectId => worksheetKindRuleAr({ subjectId }, 8));
    const en = ids.map(subjectId => worksheetKindRuleEn({ subjectId }, 8));
    assert.equal(new Set(ar).size, 7);
    assert.equal(new Set(en).size, 7);
    assert.equal(worksheetKindRuleAr({ subjectId: "mathematics" }, 8), "");
    assert.equal(worksheetKindRuleEn({ subjectId: "physics" }, 8), "");
  });

  it("composes with a prior-knowledge review and the question count the teacher picked", () => {
    const p = worksheetPromptAr({
      ...base, subject: "التربية الرياضية", numQuestions: 10, includePriorReview: true, priorKnowledge: ["الإحماء"],
    });
    assert.match(p, /مراجعة سابقة/);
    assert.match(p, /أعطِ 10 سؤالًا/);
    assert.match(p, /عدد الأسئلة: 10/);
  });
});
