import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";
import { physicsVisualClauseAr, physicsVisualClauseEn } from "../paperVisuals.ts";

const base = { grade: "Grade 10", topic: "المقذوفات", numQuestions: 8, questionTypes: ["multiple_choice", "short_answer"], additionalContext: "ctx" };

describe("physics drawing clause in the paper prompts", () => {
  const physics = { ...base, subject: "Physics" };
  const cases: [string, (b: any) => string, (b: any) => string][] = [
    ["quizAr", quizPromptAr, physicsVisualClauseAr],
    ["quizEn", quizPromptEn, physicsVisualClauseEn],
    ["worksheetAr", worksheetPromptAr, physicsVisualClauseAr],
    ["worksheetEn", worksheetPromptEn, physicsVisualClauseEn],
    ["homeworkAr", (b) => worksheetPromptAr({ ...b, homework: true }), physicsVisualClauseAr],
  ];
  for (const [name, prompt, clause] of cases) {
    it(`${name}: a physics prompt carries the clause once, before the JSON shape`, () => {
      const text = prompt(physics);
      const at = text.indexOf(clause(physics));
      assert.ok(at > 0, "clause present");
      assert.equal(text.indexOf(clause(physics), at + 1), -1, "only once");
      const shape = Math.max(text.indexOf("أعد JSON"), text.indexOf("Return JSON"));
      assert.ok(at < shape, "before the output shape");
    });
    it(`${name}: no other subject mentions "visual"`, () => {
      for (const subject of ["Mathematics", "Chemistry", "Biology", "الرياضيات"]) {
        assert.ok(!prompt({ ...base, subject }).includes('"visual"'), subject);
      }
    });
  }
});
