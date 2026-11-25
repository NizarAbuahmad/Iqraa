/**
 * A Grade 4 request tells the model it is writing for nine-year-olds.
 *
 * Swept 2026-11-25: Grade 4 had only its difficulty wording (`earlyGrade.ts`); every other line
 * came from the grade-blind subject clauses, the same that gave the offline Grade 4 plan a
 * debate, a 10-sentence summary and a controlled experiment. The Grade 4 clause (`firstGrade.ts`,
 * `isFourthGrade`) now reaches every prompt the Grade 1–3 clauses reach, and no other grade.
 * Grade 3's clause said "two steps at most" while its difficulty wording said three; both now say
 * three.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  activityPromptAr, activityPromptEn, infographicPromptAr, lessonPlanPromptAr, lessonPlanPromptEn,
  quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn,
} from "../prompts.ts";
import { clauseGradeOf, isFirstGrade, isFourthGrade, isSecondGrade, isThirdGrade } from "../firstGrade.ts";
import { generationKeys } from "../generationKey.ts";
import { lessonTeachingPromptAr, lessonTeachingPromptEn } from "../lessonTeachingPrompt.ts";
import { promptSlidesPromptAr } from "../promptSlidesPrompt.ts";
import { classroomActivityPrompt } from "../classroomPrompts.ts";
import { buildGenerationPrompt } from "../../modules/assessment/llmGenerator.ts";

const G4_ARABIC = {
  grade: "الصف الرابع", subject: "اللغة العربية", subjectId: "arabic", topic: "أَقْرَأُ بِطَلاقَةٍ وَفَهْمٍ (لَوْحَةُ طارِقٍ)",
  lessonId: "kbl-g4-arabic-s1-nccd-u1_l3", numQuestions: 6, questionTypes: ["multiple_choice", "true_false"],
};
const G4_MATH_EN = { grade: "Grade 4", subject: "Mathematics", topic: "Dividing with a remainder", numQuestions: 6, questionTypes: ["multiple_choice"] };
const G5 = { ...G4_ARABIC, grade: "الصف الخامس", lessonId: "kbl-g5-arabic-s1-nccd-u1_l3" };
const G3_MATH_EN = { ...G4_MATH_EN, grade: "Grade 3" };

const MARK_AR = "هذا البند خاص بالصف الرابع";
const MARK_EN = "This section is for Grade 4";
const OTHER_MARKS = [
  "هذا البند خاص بالصف الأول", "هذا البند خاص بالصف الثاني", "هذا البند خاص بالصف الثالث",
  "This section is for Grade 1", "This section is for Grade 2", "This section is for Grade 3",
];

describe("recognising Grade 4", () => {
  it("by name, id or number — never Grade 14, never Grades 1 to 3", () => {
    for (const b of [{ grade: "الصف الرابع" }, { grade: "الصَّفُّ الرَّابِعُ" }, { grade: "Grade 4" }, { gradeId: "grade-4" },
      { lessonId: "kbl-g4-arabic-s1-nccd-u1_l1" }, { unitId: "kbu-g4-math-s1-nccd-u1" }, { grade: 4 }]) {
      assert.equal(isFourthGrade(b), true, JSON.stringify(b));
      assert.equal(isFirstGrade(b) || isSecondGrade(b) || isThirdGrade(b), false, JSON.stringify(b));
      assert.equal(clauseGradeOf(b), 4, JSON.stringify(b));
    }
    for (const b of [{ grade: "الصف الرابع عشر" }, { grade: "Grade 14" }, { lessonId: "kbl-g14-math" }, { grade: "الصف الثالث" }, { grade: "الصف الخامس" }, {}]) {
      assert.equal(isFourthGrade(b), false, JSON.stringify(b));
    }
  });
});

describe("the Grade 4 clause reaches every prompt the Grade 1–3 clauses reach", () => {
  const builders: Array<[string, (b: any) => string, string]> = [
    ["lesson plan ar", lessonPlanPromptAr, MARK_AR], ["lesson plan en", lessonPlanPromptEn, MARK_EN],
    ["worksheet ar", worksheetPromptAr, MARK_AR], ["worksheet en", worksheetPromptEn, MARK_EN],
    ["homework ar", b => worksheetPromptAr({ ...b, homework: true }), MARK_AR],
    ["quiz ar", quizPromptAr, MARK_AR], ["quiz en", quizPromptEn, MARK_EN],
    ["activity ar", b => activityPromptAr({ ...b, activityType: "group" }), MARK_AR],
    ["activity en", b => activityPromptEn({ ...b, activityType: "individual" }), MARK_EN],
    ["lesson teaching ar", lessonTeachingPromptAr, MARK_AR], ["lesson teaching en", lessonTeachingPromptEn, MARK_EN],
    ["classroom", b => classroomActivityPrompt({ ...b, language: "arabic", activityType: "quick-check", duration: 10, difficulty: "standard", groupType: "whole-class", teachingGoal: "assessment" } as never, true), MARK_AR],
    ["infographic ar", infographicPromptAr, MARK_AR],
  ];

  it("for Grade 4, in either language, and not another grade's clause", () => {
    for (const [name, build, mark] of builders) {
      const p = build(mark === MARK_AR ? G4_ARABIC : G4_MATH_EN);
      assert.ok(p.includes(mark), `${name}: no Grade 4 clause`);
      for (const other of OTHER_MARKS) assert.ok(!p.includes(other), `${name}: ${other}`);
    }
  });

  it("and for no other grade", () => {
    for (const [name, build] of builders) {
      const p = build(G5);
      assert.ok(!p.includes(MARK_AR) && !p.includes(MARK_EN), `${name}: Grade 5 got the Grade 4 clause`);
    }
  });

  it("allows a short paragraph and rules out essays, debates and betting; names the strands and the number range", () => {
    const plan = lessonPlanPromptAr(G4_ARABIC);
    assert.match(plan, /والكتابة فقرة قصيرة من ثلاث إلى خمس جمل من إنتاج الطفل/);
    assert.match(plan, /لا مناظرة رسمية ولا دفاع عن ادّعاء ولا تجربة مضبوطة بمتغيرات متعددة/);
    assert.match(plan, /درس «أقرأ» نص من الكتاب/);
    assert.match(activityPromptAr({ ...G4_ARABIC, activityType: "game" }), /ولا رهان على النقاط/);
    assert.match(quizPromptEn(G4_MATH_EN), /never above 999,999/);
    assert.match(quizPromptEn(G4_MATH_EN), /tenths and hundredths/);
    assert.ok(promptSlidesPromptAr({ grade: "الصف الرابع", subject: "الرياضيات", additionalContext: "عرض عن القسمة" }).includes(MARK_AR));
    const evaluation = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Divide by one digit", descriptionAr: "القسمة على عدد من منزلة", effectiveBloomsLevel: "Apply", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "standard", language: "ar",
    } as never).system;
    assert.ok(evaluation("grade-4").includes(MARK_EN));
    assert.ok(!evaluation("grade-4").includes("In this Grade 1 paper"), "the Grade 1 type notes stay Grade 1's");
    assert.ok(!evaluation("grade-5").includes(MARK_EN));
  });

  it("Grades 3 and 4 both say three steps, as their difficulty wording does", () => {
    assert.match(quizPromptEn(G3_MATH_EN), /three steps at most/);
    assert.doesNotMatch(quizPromptEn(G3_MATH_EN), /two steps at most/);
    assert.match(quizPromptEn(G4_MATH_EN), /three steps at most/);
    assert.match(quizPromptAr({ ...G4_ARABIC, subjectId: "mathematics", subject: "الرياضيات" }), /ثلاث خطوات على الأكثر/);
  });
});

describe("the shared pool", () => {
  // Keys computed 2026-11-25 from the code before this change: a Grade 4 request of a clause kind
  // moves (nothing pooled under the grade-blind prompt is served to it), Grade 3 moves too (its step
  // count changed), and Grades 2 and 5 keep theirs.
  const key = (kind: string, b: Record<string, unknown>) => generationKeys(kind, "gpt-4o-mini", b).strictKey;
  const body = (g: number, grade: string) => ({ grade, subject: "Arabic", lessonId: `kbl-g${g}-arabic-s1-nccd-u1_l3`, topic: "x", language: "arabic" });

  it("restarts Grade 4's and Grade 3's clause kinds and keeps every other grade's key", () => {
    assert.notEqual(key("lesson-plan", body(4, "الصف الرابع")), "ec321554d84be1cb");
    assert.notEqual(key("lesson-teaching", body(4, "الصف الرابع")), "f18d08a717ee1e23");
    assert.notEqual(key("lesson-plan", body(3, "الصف الثالث")), "01a691fec34d3aa1");
    assert.equal(key("lesson-plan", body(2, "الصف الثاني")), "bd3b0a7ebb0f1084");
    assert.equal(key("lesson-plan", body(5, "الصف الخامس")), "560786a6b59e39b8");
  });
});
