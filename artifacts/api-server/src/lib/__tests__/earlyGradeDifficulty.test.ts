/**
 * Grades 2–4 get difficulty levels for children of seven to nine (`earlyGrade.ts`).
 *
 * Swept 2026-11-14: a Grade 2 quiz at «صعب» asked for «مقارنة أو تحليل أو موقف غير
 * مألوف يتطلب اختيار الأسلوب المناسب أولًا», and a medium worksheet for "two or
 * three steps" — the meanings written for the secondary classes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { earlyGradeOf } from "../earlyGrade.ts";
import { quizPromptAr, worksheetPromptEn } from "../prompts.ts";
import { generationKeys } from "../generationKey.ts";
import { buildGenerationPrompt } from "../../modules/assessment/llmGenerator.ts";

const lesson = (g: number, grade: string) => ({
  grade, subject: "الرياضيات", subjectId: "mathematics", lessonId: `kbl-g${g}-math-s1-nccd-u1_l1`,
  topic: "الجمع", language: "arabic", numQuestions: 5, questionTypes: ["multiple_choice"],
});
const OLD_HARD_AR = /موقف غير مألوف يتطلب اختيار الأسلوب/;

describe("which requests are grades 2–4", () => {
  it("by lesson id, unit id, grade id, number or name; never Grade 1 or grade 5 and up", () => {
    assert.equal(earlyGradeOf({ lessonId: "kbl-g2-arabic-s1-nccd-u1_l1" }), 2);
    assert.equal(earlyGradeOf({ unitId: "kbu-g4-math-s1-nccd-u1" }), 4);
    assert.equal(earlyGradeOf({ gradeId: "grade-3" }), 3);
    assert.equal(earlyGradeOf({ grade: 4 }), 4);
    assert.equal(earlyGradeOf({ grade: "الصفّ الثالث" }), 3);
    assert.equal(earlyGradeOf({ grade: "Grade 2" }), 2);
    for (const b of [{ grade: "الصف الأول" }, { gradeId: "grade-1" }, { grade: "الصف الخامس" }, { gradeId: "grade-10" },
      { grade: "الصف الثاني عشر" }, { lessonId: "kbl-g12-math-s1" }, { grade: 12 }, {}]) {
      assert.equal(earlyGradeOf(b), null, JSON.stringify(b));
    }
  });
});

describe("the level wording for grades 2–4", () => {
  it("hard stays a short task: two steps in Grade 2, three in Grades 3–4, no abstract analysis", () => {
    const g2 = quizPromptAr({ ...lesson(2, "الصف الثاني"), difficulty: "hard" });
    assert.match(g2, /مسألة قصيرة من خطوتين على الأكثر/);
    assert.doesNotMatch(g2, OLD_HARD_AR);
    assert.match(quizPromptAr({ ...lesson(4, "الصف الرابع"), difficulty: "hard" }), /ثلاث خطوات على الأكثر/);
    const medium = worksheetPromptEn({ ...lesson(3, "Grade 3"), language: "english", difficulty: "medium" });
    assert.match(medium, /in one or two steps/);
    assert.doesNotMatch(medium, /two or three steps/);
  });

  it("Grade 1 keeps its own, grade 5 and up the all-grades wording", () => {
    assert.match(quizPromptAr({ ...lesson(1, "الصف الأول"), difficulty: "hard" }), /دون تبرير أو تحليل أو خطوات متعددة/);
    for (const [g, name] of [[5, "الصف الخامس"], [10, "الصف العاشر"]] as const) {
      const q = quizPromptAr({ ...lesson(g, name), lessonId: g === 10 ? "kbl-math-s1-nccd-u1_l1" : `kbl-g${g}-math-s1-nccd-u1_l1`, difficulty: "hard" });
      assert.match(q, OLD_HARD_AR, name);
      assert.doesNotMatch(q, /على الأكثر/, name);
    }
  });

  it("an evaluation for grades 2–4 says the same; grade 5 keeps its note", () => {
    const user = (gradeId: string) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Add within 100", descriptionAr: "الجمع ضمن 100", effectiveBloomsLevel: "Apply", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes: ["multiple_choice"], count: 4, difficulty: "advanced", language: "ar",
    } as never).user;
    assert.match(user("grade-2"), /a short problem of two steps at most/);
    assert.match(user("grade-3"), /a short problem of three steps at most/);
    assert.doesNotMatch(user("grade-4"), /Weight towards application and analysis/);
    assert.match(user("grade-5"), /Weight towards application and analysis/);
  });
});

describe("the shared pool", () => {
  // Keys computed 2026-11-14 from the code before this change: only a grade 2–4
  // worksheet, homework or quiz moves, so no paper made under the old wording is
  // served to one, and no other pool restarts.
  const key = (kind: string, b: Record<string, unknown>) => generationKeys(kind, "gpt-4o-mini", b).strictKey;
  const body = (g: number, grade: string, lessonId = `kbl-g${g}-math-s1-nccd-u1_l1`) =>
    ({ grade, subject: "Mathematics", lessonId, topic: "x", language: "arabic", difficulty: "hard" });

  it("restarts a grade 2–4 quiz and keeps every other key", () => {
    assert.notEqual(key("quiz", body(3, "الصف الثالث")), "a22afc1f5d84c4ae");
    assert.equal(key("quiz", body(10, "الصف العاشر", "kbl-math-s1-nccd-u1_l1")), "eec87dd251620286");
    assert.equal(key("worksheet", body(5, "الصف الخامس")), "66af46ac22a81d38");
    const plan = { ...body(3, "الصف الثالث") } as Record<string, unknown>;
    delete plan.difficulty;
    assert.equal(key("lesson-plan", plan), "3926e3de905693bb", "a kind with no level wording keeps its key");
  });
});
