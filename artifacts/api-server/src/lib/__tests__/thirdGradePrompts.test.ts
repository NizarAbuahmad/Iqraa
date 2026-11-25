/**
 * A Grade 3 request tells the model it is writing for eight-year-olds.
 *
 * Swept 2026-11-20: Grade 3 had only its difficulty wording (`earlyGrade.ts`); every other
 * line came from the grade-blind subject clauses, the same that gave the offline Grade 3 plan
 * a debate, a written summary and a controlled experiment. The Grade 3 clause (`firstGrade.ts`,
 * `isThirdGrade`) now reaches every prompt the Grade 1 and 2 clauses reach, and no other grade.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  activityPromptAr, activityPromptEn, infographicPromptAr, lessonPlanPromptAr, lessonPlanPromptEn,
  quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn,
} from "../prompts.ts";
import { clauseGradeOf, isFirstGrade, isSecondGrade, isThirdGrade } from "../firstGrade.ts";
import { generationKeys } from "../generationKey.ts";
import { lessonTeachingPromptAr, lessonTeachingPromptEn } from "../lessonTeachingPrompt.ts";
import { promptSlidesPromptAr } from "../promptSlidesPrompt.ts";
import { classroomActivityPrompt } from "../classroomPrompts.ts";
import { buildGenerationPrompt } from "../../modules/assessment/llmGenerator.ts";

const G3_ARABIC = {
  grade: "الصف الثالث", subject: "اللغة العربية", subjectId: "arabic", topic: "أَقْرَأُ بِطَلاقَةٍ وَفَهْمٍ (حوتُ يونُسَ)",
  lessonId: "kbl-g3-arabic-s1-nccd-u1_l3", numQuestions: 6, questionTypes: ["multiple_choice", "true_false"],
};
const G3_MATH_EN = { grade: "Grade 3", subject: "Mathematics", topic: "Multiplying by 4", numQuestions: 6, questionTypes: ["multiple_choice"] };
const G5 = { ...G3_ARABIC, grade: "الصف الخامس", lessonId: "kbl-g5-arabic-s1-nccd-u1_l3" };

const MARK_AR = "هذا البند خاص بالصف الثالث";
const MARK_EN = "This section is for Grade 3";
const OTHER_MARKS = ["هذا البند خاص بالصف الأول", "هذا البند خاص بالصف الثاني", "This section is for Grade 1", "This section is for Grade 2"];

describe("recognising Grade 3", () => {
  it("by name, id or number — never Grade 13 or «الثالث الثانوي», never Grades 1 or 2", () => {
    for (const b of [{ grade: "الصف الثالث" }, { grade: "الصَّفُّ الثَّالِثُ" }, { grade: "Grade 3" }, { gradeId: "grade-3" },
      { lessonId: "kbl-g3-arabic-s1-nccd-u1_l1" }, { unitId: "kbu-g3-math-s1-nccd-u1" }, { grade: 3 }]) {
      assert.equal(isThirdGrade(b), true, JSON.stringify(b));
      assert.equal(isFirstGrade(b) || isSecondGrade(b), false, JSON.stringify(b));
      assert.equal(clauseGradeOf(b), 3, JSON.stringify(b));
    }
    for (const b of [{ grade: "الصف الثالث الثانوي" }, { grade: "Grade 13" }, { lessonId: "kbl-g13-math" }, { grade: "الصف الثاني" }, { grade: "الصف الرابع" }, {}]) {
      assert.equal(isThirdGrade(b), false, JSON.stringify(b));
    }
  });
});

describe("the Grade 3 clause reaches every prompt the Grade 1 and 2 clauses reach", () => {
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

  it("for Grade 3, in either language, and not another grade's clause", () => {
    for (const [name, build, mark] of builders) {
      const p = build(mark === MARK_AR ? G3_ARABIC : G3_MATH_EN);
      assert.ok(p.includes(mark), `${name}: no Grade 3 clause`);
      for (const other of OTHER_MARKS) assert.ok(!p.includes(other), `${name}: ${other}`);
    }
  });

  it("and for no other grade", () => {
    for (const [name, build] of builders) {
      const p = build(G5);
      assert.ok(!p.includes(MARK_AR) && !p.includes(MARK_EN), `${name}: Grade 5 got the Grade 3 clause`);
    }
  });

  it("says what an eight-year-old writes, names the strands and the number range; Prompt Slides and an evaluation carry it", () => {
    const plan = lessonPlanPromptAr(G3_ARABIC);
    assert.match(plan, /والكتابة جملتان أو ثلاث جمل من إنتاج الطفل/);
    assert.match(plan, /لا مناظرة ولا دفاع عن ادّعاء ولا تجربة مضبوطة بمتغيرات/);
    assert.match(plan, /درس «أقرأ» نص قصير من الكتاب/);
    assert.match(quizPromptEn(G3_MATH_EN), /never above 9999/);
    assert.ok(promptSlidesPromptAr({ grade: "الصف الثالث", subject: "الرياضيات", additionalContext: "عرض عن الضرب" }).includes(MARK_AR));
    const evaluation = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Multiply by 4", descriptionAr: "الضرب في 4", effectiveBloomsLevel: "Apply", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "standard", language: "ar",
    } as never).system;
    assert.ok(evaluation("grade-3").includes(MARK_EN));
    assert.ok(!evaluation("grade-3").includes("In this Grade 1 paper"), "the Grade 1 type notes stay Grade 1's");
    assert.ok(!evaluation("grade-5").includes(MARK_EN));
  });
});

describe("the shared pool", () => {
  // Keys computed 2026-11-20 from the code before this change: a Grade 3 request of a clause
  // kind moves, so nothing pooled under the grade-blind prompt is served to it; Grades 2 and 5
  // keep their keys (Grade 3 moved again on 2026-11-25 with its step count, Grade 4 for its own clause).
  const key = (kind: string, b: Record<string, unknown>) => generationKeys(kind, "gpt-4o-mini", b).strictKey;
  const body = (g: number, grade: string) => ({ grade, subject: "Arabic", lessonId: `kbl-g${g}-arabic-s1-nccd-u1_l3`, topic: "x", language: "arabic" });

  it("restarts Grade 3's clause kinds and keeps every other grade's key", () => {
    assert.notEqual(key("lesson-plan", body(3, "الصف الثالث")), "2f13e6fc41b7d901");
    assert.notEqual(key("lesson-teaching", body(3, "الصف الثالث")), "d42d6db1f67d66d4");
    assert.equal(key("lesson-plan", body(2, "الصف الثاني")), "bd3b0a7ebb0f1084");
    assert.equal(key("lesson-plan", body(5, "الصف الخامس")), "560786a6b59e39b8");
  });
});
