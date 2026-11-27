/**
 * A Grade 1 evaluation holds only the types a six-year-old can answer
 * (`evaluationTypesForGrade` in `@workspace/exam-paper`, decided 2026-11-13).
 *
 * Swept 2026-11-13: the picker offered every type for every grade with
 * `short_answer` ticked by default, and the routes took them all, so a Grade 1
 * paper asked children who are learning to read for written answers. The routes
 * are read as text because they are only reachable with a database; the prompt
 * is built for real.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FIRST_GRADE_DEFAULT_TYPES, FIRST_GRADE_EVALUATION_TYPES } from "@workspace/exam-paper";
import { buildGenerationPrompt } from "../llmGenerator.ts";
import { FIRST_GRADE_TYPE_NOTES_EN } from "../../../lib/firstGrade.ts";
import { TYPE_CONTRACTS } from "../llmGenerator.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../..");
const routes = readFileSync(path.join(repoRoot, "artifacts/api-server/src/routes/evaluations.ts"), "utf8");

describe("the question types of a Grade 1 evaluation", () => {
  it("are limited when an evaluation is created, and again when it is generated", () => {
    assert.match(routes, /const requestedTypes = evaluationTypesForGrade\(book\.gradeId, askedTypes\)/);
    assert.match(routes, /code: "grade1_types"/);
    assert.match(routes, /const gradeTypes = evaluationTypesForGrade\(stored\.gradeId, stored\.assessmentTypes\)/);
    // Everything after the narrowing reads the narrowed evaluation, not the stored row.
    const handler = routes.slice(routes.indexOf("const gradeTypes = evaluationTypesForGrade"));
    const end = handler.indexOf("\nrouter.");
    assert.doesNotMatch(handler.slice(0, end), /stored\.assessmentTypes\.(?!filter)/);
  });

  it("each allowed type has a generation contract and a Grade 1 line", () => {
    for (const t of FIRST_GRADE_EVALUATION_TYPES) {
      assert.ok(TYPE_CONTRACTS[t as keyof typeof TYPE_CONTRACTS], `${t}: no contract`);
      assert.ok(FIRST_GRADE_TYPE_NOTES_EN[t], `${t}: no Grade 1 line`);
    }
  });

  it("the prompt describes the paper's own types for a six-year-old, and only for Grade 1", () => {
    const system = (gradeId: string, assessmentTypes: string[]) => buildGenerationPrompt({
      objectives: [{ id: "o1", description: "Numbers 1, 2, 3", descriptionAr: "قراءة الأعداد", effectiveBloomsLevel: "Remember", subjectId: "mathematics" } as never],
      gradeId, assessmentTypes, count: 4, difficulty: "standard", language: "ar",
    } as never).system;
    const g1 = system("grade-1", ["fill_blank", "practical_task"]);
    assert.match(g1, /fill_blank: the blank takes one letter, one word or one number/);
    assert.match(g1, /practical_task: something the child does with objects while the teacher watches/);
    assert.doesNotMatch(g1, /matching: three or four pairs/, "a type the paper does not hold is not described");
    assert.doesNotMatch(system("grade-2", ["fill_blank"]), /In this Grade 1 paper/);
  });

  it("migration 0025 narrows stored drafts to the same list and default", () => {
    const sql = readFileSync(path.join(repoRoot, "lib/db/migrations/0025_grade1_evaluation_types.sql"), "utf8");
    const lists = [...sql.matchAll(/IN \(([^)]*)\)/g)].map(m => [...m[1]!.matchAll(/'([a-z_]+)'/g)].map(x => x[1]));
    assert.equal(lists.length, 2, "the allowed list appears twice (kept, and what is out)");
    for (const l of lists) assert.deepEqual(l, [...FIRST_GRADE_EVALUATION_TYPES]);
    assert.match(sql, new RegExp(`'${JSON.stringify([...FIRST_GRADE_DEFAULT_TYPES]).replace(/,/g, ", ").replace(/[[\]]/g, "\\$&")}'::jsonb`));
    assert.match(sql, /"status" = 'draft'/);
  });
});
