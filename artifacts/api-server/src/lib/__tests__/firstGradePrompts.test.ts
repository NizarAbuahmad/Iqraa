/**
 * A Grade 1 request must tell the model it is writing for six-year-olds.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/firstGradePrompts.test.ts
 *
 * The subject clauses are grade-blind: an Arabic plan «starts from a text» and
 * ends in «a paragraph of their own», and every quiz must hold an analysis
 * item. For a Grade 1 letter lesson («حرف الباء») that is the wrong lesson, so
 * `firstGrade.ts` adds a clause that overrides it — and only for Grade 1.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  activityPromptAr, activityPromptEn, lessonPlanPromptAr, lessonPlanPromptEn,
  quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn,
} from "../prompts.ts";
import { firstGradeClauseAr, isFirstGrade } from "../firstGrade.ts";

const G1_ARABIC = {
  grade: "الصف الأول", subject: "اللغة العربية", subjectId: "arabic", topic: "حَرْفُ الْبَاءِ (ب)",
  lessonId: "kbl-g1-arabic-s1-nccd-u1_l6", numQuestions: 6, questionTypes: ["multiple_choice", "true_false"],
};
const G1_MATH_EN = {
  grade: "Grade 1", subject: "Mathematics", topic: "Numbers 1, 2, 3", numQuestions: 6, questionTypes: ["multiple_choice"],
};
const G10 = { ...G1_ARABIC, grade: "الصف العاشر", lessonId: "kbl-arabic-s1-nccd-u1_l1", topic: "النص الأدبي" };

const MARK_AR = "هذا البند خاص بالصف الأول";
const MARK_EN = "This section is for Grade 1";

describe("recognising Grade 1", () => {
  it("from the grade name, in either language and with harakat", () => {
    for (const grade of ["الصف الأول", "الأول", "الصَّفُّ الأَوَّلُ", "Grade 1", "grade 1", " First grade "]) {
      assert.equal(isFirstGrade({ grade }), true, grade);
    }
  });

  it("from any id the request carries", () => {
    assert.equal(isFirstGrade({ lessonId: "kbl-g1-math-s1-nccd-u0_l2" }), true);
    assert.equal(isFirstGrade({ unitId: "kbu-g1-math-s1-nccd-u0" }), true);
    assert.equal(isFirstGrade({ gradeId: "grade-1" }), true);
  });

  it("and nothing else — not Grade 10, 11 or 12, nor «الأول الثانوي»", () => {
    for (const b of [
      { grade: "الصف العاشر" }, { grade: "Grade 10" }, { grade: "Grade 11" }, { grade: "الصف الأول الثانوي" },
      { gradeId: "grade-10" }, { lessonId: "kbl-g10-x" }, { lessonId: "kbl-math-s1-nccd-u1_l1" }, { unitId: "kbu-g12-x" }, {},
    ]) {
      assert.equal(isFirstGrade(b), false, JSON.stringify(b));
    }
  });
});

describe("the Grade 1 clause in every live prompt", () => {
  const builders: Array<[string, (b: any) => string, string]> = [
    ["plan ar", lessonPlanPromptAr, MARK_AR], ["plan en", lessonPlanPromptEn, MARK_EN],
    ["worksheet ar", worksheetPromptAr, MARK_AR], ["worksheet en", worksheetPromptEn, MARK_EN],
    ["homework ar", b => worksheetPromptAr({ ...b, homework: true }), MARK_AR],
    ["homework en", b => worksheetPromptEn({ ...b, homework: true }), MARK_EN],
    ["quiz ar", quizPromptAr, MARK_AR], ["quiz en", quizPromptEn, MARK_EN],
    ["activity ar", activityPromptAr, MARK_AR], ["activity en", activityPromptEn, MARK_EN],
  ];

  it("is present for Grade 1", () => {
    for (const [name, build, mark] of builders) {
      assert.ok(build(G1_ARABIC).includes(mark), `${name}: no Grade 1 clause`);
      assert.ok(build(G1_MATH_EN).includes(mark), `${name}: no Grade 1 clause from «Grade 1»`);
    }
  });

  it("is absent for any other grade, which keeps the prompt it had", () => {
    for (const [name, build, mark] of builders) {
      assert.ok(!build(G10).includes(mark), `${name}: Grade 1 clause leaked into Grade 10`);
    }
  });

  it("comes after the grade-blind subject clause it overrides", () => {
    const plan = lessonPlanPromptAr(G1_ARABIC);
    const subject = plan.indexOf("طبيعة المادة");
    assert.ok(subject >= 0, "the Arabic subject clause is gone — this test is stale");
    assert.ok(plan.indexOf(MARK_AR) > subject, "the Grade 1 clause must follow the clause it overrides");
  });
});

describe("what the clause says", () => {
  it("teaches an Arabic letter lesson as a primer, not a text", () => {
    const c = firstGradeClauseAr(G1_ARABIC, "plan");
    assert.match(c, /كتاب تهجٍّ/);
    assert.match(c, /أشكاله في أول الكلمة ووسطها وآخرها/);
    assert.match(c, /لا تطلب من الطلبة كتابة فقرة/);
  });

  it("keeps each subject's own line to its subject", () => {
    assert.doesNotMatch(firstGradeClauseAr({ ...G1_ARABIC, subject: "العلوم", subjectId: "science" }, "paper"), /كتاب تهجٍّ|الإنجليزية|ضمن مدى الدرس/);
    assert.match(firstGradeClauseAr({ grade: "الصف الأول", subject: "الرياضيات" }, "paper"), /ضمن مدى الدرس/);
    assert.match(firstGradeClauseAr({ grade: "الصف الأول", subject: "اللغة الإنجليزية" }, "paper"), /يعرف الطلبة كلمات قليلة/);
  });

  it("forbids the quiz's analysis items for a six-year-old", () => {
    const q = quizPromptAr(G1_ARABIC);
    assert.match(q, /لا أسئلة «علّل» أو «قارن» أو «حلّل»/);
  });
});
