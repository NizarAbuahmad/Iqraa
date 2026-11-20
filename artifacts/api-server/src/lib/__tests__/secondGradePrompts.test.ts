/**
 * A Grade 2 request tells the model it is writing for seven-year-olds.
 *
 * Swept 2026-11-15: Grade 2 had only its difficulty wording (`earlyGrade.ts`); every
 * other line came from the grade-blind subject clauses — an Arabic plan ending in «a
 * paragraph of their own», a quiz that must hold «an item that requires analysis». The
 * Grade 2 clause (`firstGrade.ts`, `isSecondGrade`) now reaches every prompt the Grade 1
 * clause reaches, and no other grade.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  activityPromptAr, activityPromptEn, infographicPromptAr, lessonPlanPromptAr, lessonPlanPromptEn,
  quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn,
} from "../prompts.ts";
import { isFirstGrade, isSecondGrade } from "../firstGrade.ts";
import { generationKeys } from "../generationKey.ts";
import { lessonTeachingPromptAr, lessonTeachingPromptEn } from "../lessonTeachingPrompt.ts";
import { promptSlidesPromptAr } from "../promptSlidesPrompt.ts";
import { classroomActivityPrompt } from "../classroomPrompts.ts";
import { buildGenerationPrompt } from "../../modules/assessment/llmGenerator.ts";

const G2_ARABIC = {
  grade: "الصف الثاني", subject: "اللغة العربية", subjectId: "arabic", topic: "أَقْرَأُ بِطَلاقَةٍ وَفَهْمٍ (الْغُرَابُ وَإِنَاءُ الْمَاءِ)",
  lessonId: "kbl-g2-arabic-s1-nccd-u3_l3", numQuestions: 6, questionTypes: ["multiple_choice", "true_false"],
};
const G2_MATH_EN = { grade: "Grade 2", subject: "Mathematics", topic: "Equal groups", numQuestions: 6, questionTypes: ["multiple_choice"] };
const G3 = { ...G2_ARABIC, grade: "الصف الثالث", lessonId: "kbl-g3-arabic-s1-nccd-u1_l3" };

const MARK_AR = "هذا البند خاص بالصف الثاني";
const MARK_EN = "This section is for Grade 2";
const G1_MARK_AR = "هذا البند خاص بالصف الأول";

describe("recognising Grade 2", () => {
  it("by name, id or number — never Grade 12, never Grade 1", () => {
    for (const b of [{ grade: "الصف الثاني" }, { grade: "الصَّفُّ الثَّانِي" }, { grade: "Grade 2" }, { gradeId: "grade-2" },
      { lessonId: "kbl-g2-arabic-s1-nccd-u1_l1" }, { unitId: "kbu-g2-math-s1-nccd-u1" }, { grade: 2 }]) {
      assert.equal(isSecondGrade(b), true, JSON.stringify(b));
      assert.equal(isFirstGrade(b), false, JSON.stringify(b));
    }
    for (const b of [{ grade: "الصف الثاني عشر" }, { grade: "Grade 12" }, { lessonId: "kbl-g12-math" }, { grade: "الصف الأول" }, { grade: "الصف الثالث" }, {}]) {
      assert.equal(isSecondGrade(b), false, JSON.stringify(b));
    }
  });
});

describe("the Grade 2 clause reaches every prompt the Grade 1 clause reaches", () => {
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

  it("for Grade 2, in either language, and not the Grade 1 clause", () => {
    for (const [name, build, mark] of builders) {
      const p = build(mark === MARK_AR ? G2_ARABIC : G2_MATH_EN);
      assert.ok(p.includes(mark), `${name}: no Grade 2 clause`);
      assert.ok(!p.includes(G1_MARK_AR), `${name}: the Grade 1 clause`);
    }
  });

  it("and for no other grade", () => {
    for (const [name, build] of builders) {
      const p = build(G3);
      assert.ok(!p.includes(MARK_AR) && !p.includes(MARK_EN), `${name}: Grade 3 got the Grade 2 clause`);
    }
  });

  it("an Arabic lesson names the book's strands; Prompt Slides and an evaluation carry it too", () => {
    assert.match(lessonPlanPromptAr(G2_ARABIC), /درس «أقرأ» نص قصير من الكتاب/);
    assert.match(quizPromptEn(G2_MATH_EN), /never above 999/);
    assert.ok(promptSlidesPromptAr({ grade: "الصف الثاني", subject: "الرياضيات", additionalContext: "عرض عن الجمع" }).includes(MARK_AR));
    const evaluation = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Add within 100", descriptionAr: "الجمع ضمن 100", effectiveBloomsLevel: "Apply", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "standard", language: "ar",
    } as never).system;
    assert.ok(evaluation("grade-2").includes(MARK_EN));
    assert.ok(!evaluation("grade-2").includes("In this Grade 1 paper"), "the Grade 1 type notes stay Grade 1's");
    assert.ok(!evaluation("grade-3").includes(MARK_EN));
  });
});

describe("the shared pool", () => {
  // Keys computed 2026-11-15 from the code before this change: a Grade 2 request of a
  // clause kind moves, so nothing pooled under the grade-blind prompt is served; Grades 4
  // and 12 keep their keys (Grade 3 has moved since, for its own clause — `thirdGradePrompts.test.ts`).
  const key = (kind: string, b: Record<string, unknown>) => generationKeys(kind, "gpt-4o-mini", b).strictKey;
  const body = (g: number, grade: string) => ({ grade, subject: "Arabic", lessonId: `kbl-g${g}-arabic-s1-nccd-u1_l3`, topic: "x", language: "arabic" });

  it("restarts Grade 2's clause kinds and keeps every other grade's key", () => {
    assert.notEqual(key("lesson-plan", body(2, "الصف الثاني")), "94e3f6b0e21a2dc2");
    assert.notEqual(key("lesson-teaching", body(2, "الصف الثاني")), "a10ffec69164de30");
    assert.equal(key("lesson-plan", body(4, "الصف الرابع")), "ec321554d84be1cb");
    assert.equal(key("lesson-plan", body(12, "الصف الثاني عشر")), "8df24d9a9b2eb587");
  });
});
