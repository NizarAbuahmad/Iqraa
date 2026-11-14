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
import { generationKeys } from "../generationKey.ts";
import { lessonTeachingPromptAr, lessonTeachingPromptEn } from "../lessonTeachingPrompt.ts";
import { promptSlidesPromptAr, promptSlidesPromptEn } from "../promptSlidesPrompt.ts";
import { classroomActivityPrompt } from "../classroomPrompts.ts";
import { infographicPromptAr, infographicPromptEn } from "../prompts.ts";
import { buildGenerationPrompt } from "../../modules/assessment/llmGenerator.ts";

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

describe("review fixes (2026-11-13)", () => {
  it("an activity's Grade 1 clause asks for small groups only in a group format", () => {
    const g = (activityType: string) => activityPromptAr({ ...G1_ARABIC, activityType });
    for (const t of ["group", "hands-on", "game"]) assert.match(g(t), /مجموعات صغيرة \(2-4\)/, t);
    for (const t of ["individual", "discussion"]) assert.doesNotMatch(g(t), /مجموعات صغيرة \(2-4\)/, t);
    assert.doesNotMatch(activityPromptAr({ ...G1_ARABIC, activityVariant: "warmup" }), /مجموعات صغيرة \(2-4\)/);
    assert.doesNotMatch(activityPromptEn({ ...G1_MATH_EN, activityType: "individual" }), /Small groups \(2–4\)/);
  });

  it("a Grade 1 maths worksheet asks for no worked example; Grade 10 still does", () => {
    const g1 = { ...G1_MATH_EN, subject: "الرياضيات", grade: "الصف الأول", questionTypes: ["short_answer"] };
    assert.doesNotMatch(worksheetPromptAr(g1), /workedExample/);
    assert.doesNotMatch(worksheetPromptEn({ ...g1, grade: "Grade 1" }), /workedExample/);
    assert.match(worksheetPromptAr({ ...g1, grade: "الصف العاشر" }), /workedExample/);
  });

  it("recognises a grade sent as the number 1", () => {
    assert.equal(isFirstGrade({ grade: 1 }), true);
    assert.equal(isFirstGrade({ grade: 10 }), false);
  });

  it("keys a Grade 1 artifact apart from what was pooled before the clause, and leaves every other key alone", () => {
    const g10 = { grade: "الصف العاشر", subject: "اللغة العربية", topic: "النص الأدبي", lessonId: "kbl-arabic-s1-nccd-u1_l1", language: "arabic", contextSource: "curriculum" };
    const g1 = { grade: "الصف الأول", subject: "اللغة العربية", topic: "حرف الباء (ب)", lessonId: "kbl-g1-arabic-s1-nccd-u1_l6", language: "arabic", contextSource: "curriculum" };
    // Computed with the key code as it was before the Grade 1 field existed.
    assert.equal(generationKeys("lesson-plan", "m", g10).strictKey, "4be98b498ea453a4", "a Grade 10 key moved");
    // a kind without the clause (the Prompt Slides clarifying questions, which go to the teacher) keeps its key
    const questions = generationKeys("prompt-slides-questions", "m", g1).strictKey;
    assert.equal(questions, generationKeys("prompt-slides-questions", "m", { ...g1, grade: "الصف الأول " }).strictKey);
    // lesson-teaching gained the clause the same day, so its Grade 1 key moved too
    assert.notEqual(generationKeys("lesson-teaching", "m", g1).strictKey, "d1cb7cad59b3844d", "a Grade 1 explanation still reads the old pool");
    assert.equal(generationKeys("lesson-teaching", "m", g10).strictKey, generationKeys("lesson-teaching", "m", { ...g10 }).strictKey);
    assert.notEqual(generationKeys("lesson-plan", "m", g1).strictKey, "e3da440e90702faf", "a Grade 1 plan still reads the old pool");
    assert.notEqual(generationKeys("lesson-plan", "m", g1).coarseKey, "0e7f0548453934bc");
  });
});

describe("the Grade 1 clause in the remaining live prompts", () => {
  it("the lesson explanation (deck and student) is written for six-year-olds", () => {
    assert.match(lessonTeachingPromptAr(G1_ARABIC), /خمس كلمات أو أقل/);
    assert.match(lessonTeachingPromptEn({ ...G1_MATH_EN }), /five words or fewer/);
    assert.ok(!lessonTeachingPromptAr(G10).includes(MARK_AR));
  });

  it("Prompt Slides applies it only if the deck is a lesson for the teacher's Grade 1 class", () => {
    const p = promptSlidesPromptAr({ grade: "الصف الأول", subject: "الرياضيات", additionalContext: "عرض عن الجمع" });
    assert.match(p, /إن كان العرض درسًا أو مراجعة لطلبة هذا الصف/);
    assert.ok(p.includes(MARK_AR));
    assert.ok(!promptSlidesPromptAr({ grade: "الصف العاشر", subject: "الرياضيات", additionalContext: "x" }).includes(MARK_AR));
    assert.match(promptSlidesPromptEn({ grade: "Grade 1", subject: "Mathematics", additionalContext: "addition" }), /If the deck is a lesson or a review for this class/);
  });

  it("classroom games and the deck's quick check are answered together, not written", () => {
    const q = classroomActivityPrompt({ ...G1_ARABIC, activityType: "quick-check", groupType: "whole-class", teachingGoal: "assessment", duration: 10 }, true);
    assert.match(q, /يجيب الأطفال معًا بالإشارة/);
    assert.ok(!classroomActivityPrompt({ ...G10, activityType: "quick-check", groupType: "whole-class", teachingGoal: "assessment", duration: 10 }, true).includes(MARK_AR));
    assert.doesNotMatch(q, /مجموعات صغيرة \(2-4\)/, "a whole-class quick check is not group work");
  });

  it("the infographic has few words a line", () => {
    assert.match(infographicPromptAr(G1_ARABIC), /خمس كلمات أو أقل في السطر/);
    assert.ok(!infographicPromptEn(G10).includes(MARK_EN));
  });

  it("an evaluation for Grade 1 carries the paper clause; another grade does not", () => {
    const req = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Numbers 1, 2, 3", descriptionAr: "قراءة الأعداد", effectiveBloomsLevel: "Remember", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "standard", language: "ar",
    } as never).system;
    assert.ok(req("grade-1").includes(MARK_EN));
    assert.match(req("grade-1"), /Grade 1 mathematics: numbers only within the lesson's range/);
    for (const g of ["grade-2", "grade-10", undefined]) assert.ok(!req(g as never).includes(MARK_EN), String(g));
  });

  it("a difficulty level stays one step within the lesson for Grade 1; other grades keep theirs", () => {
    const hardQuiz = quizPromptAr({ ...G1_ARABIC, difficulty: "hard" });
    assert.match(hardQuiz, /دون تبرير أو تحليل أو خطوات متعددة/);
    assert.doesNotMatch(hardQuiz, /موقف غير مألوف يتطلب اختيار الأسلوب/);
    const mediumSheet = worksheetPromptEn({ ...G1_MATH_EN, difficulty: "medium" });
    assert.match(mediumSheet, /One step over the lesson's whole range/);
    assert.doesNotMatch(mediumSheet, /two or three steps/);
    assert.match(quizPromptAr({ ...G10, difficulty: "hard" }), /موقف غير مألوف يتطلب اختيار الأسلوب/);
    const evaluation = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Numbers 1, 2, 3", descriptionAr: "قراءة الأعداد", effectiveBloomsLevel: "Remember", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "advanced", language: "ar",
    } as never).user;
    assert.match(evaluation("grade-1"), /a short one-step story/);
    assert.doesNotMatch(evaluation("grade-1"), /Weight towards application and analysis/);
    assert.match(evaluation("grade-10"), /Weight towards application and analysis/);
  });
});
