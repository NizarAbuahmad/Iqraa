/**
 * An Arabic prompt names the grade once and the subject in Arabic.
 *
 * The screens send «الصف السابع» and «Mathematics», and every Arabic prompt
 * read «لمادة Mathematics للصف الصف السابع» (found 2026-11-13, Grade 7 audit).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { gradeAr, subjectAr } from "../promptLabels.ts";
import { lessonPlanPromptAr, quizPromptAr, worksheetPromptAr } from "../prompts.ts";
import { classroomPromptAr } from "../classroomPrompts.ts";

describe("gradeAr / subjectAr", () => {
  it("drops the repeated «الصف» and leaves anything else as sent", () => {
    assert.equal(gradeAr("الصف السابع"), "السابع");
    assert.equal(gradeAr("العاشر"), "العاشر");
    assert.equal(gradeAr("10"), "10");
    assert.equal(gradeAr(undefined), "");
  });

  it("names a catalog subject in Arabic by its English name or id, else as sent", () => {
    assert.equal(subjectAr("Mathematics"), "الرياضيات");
    assert.equal(subjectAr("social"), "الدراسات الاجتماعية");
    assert.equal(subjectAr("الكيمياء"), "الكيمياء");
    assert.equal(subjectAr("Something Unlisted"), "Something Unlisted");
  });
});

describe("the Arabic prompts", () => {
  const b = { grade: "الصف السابع", subject: "Mathematics", topic: "المتتاليات", numQuestions: 5, questionTypes: ["short_answer"] };
  const prompts = [
    lessonPlanPromptAr(b), quizPromptAr(b), worksheetPromptAr(b),
    ...["quick-check", "bingo", "relay", "gallery-walk", "exit-ticket", "escape-challenge"]
      .map(activityType => classroomPromptAr({ ...b, activityType, duration: 15 })),
  ];
  for (const p of prompts) {
    it(`reads «الرياضيات» and «السابع» once: ${p.slice(0, 40)}`, () => {
      assert.doesNotMatch(p, /الصف الصف/);
      assert.doesNotMatch(p, /لمادة Mathematics/);
      assert.match(p, /لمادة الرياضيات/);
    });
  }
});
