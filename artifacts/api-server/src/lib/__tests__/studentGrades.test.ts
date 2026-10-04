import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { studentGradeIds } from "../studentGrades.ts";

describe("studentGradeIds", () => {
  it("prefers the student's own grade over the class's", () => {
    assert.deepEqual(studentGradeIds([{ studentGradeId: "grade-9", classGradeId: "grade-10" }]), ["grade-9"]);
  });

  it("falls back to the class grade, and drops rows with neither", () => {
    assert.deepEqual(
      studentGradeIds([
        { studentGradeId: "", classGradeId: "grade-8" },
        { studentGradeId: " ", classGradeId: null },
        { studentGradeId: "", classGradeId: "" },
      ]),
      ["grade-8"],
    );
  });

  it("keeps first-seen order and collapses duplicates", () => {
    assert.deepEqual(
      studentGradeIds([
        { studentGradeId: "", classGradeId: "grade-7" },
        { studentGradeId: "grade-7", classGradeId: "grade-7" },
        { studentGradeId: "", classGradeId: "grade-6" },
      ]),
      ["grade-7", "grade-6"],
    );
  });
});
