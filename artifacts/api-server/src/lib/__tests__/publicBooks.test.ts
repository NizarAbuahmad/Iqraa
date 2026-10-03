import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getBooksForSubjectGrade } from "@workspace/curriculum";
import { publicBook } from "../publicBooks.ts";

describe("public book list", () => {
  const books = getBooksForSubjectGrade("mathematics", "grade-10", "student").map(publicBook);

  it("lists the grade-10 maths books a student sees", () => {
    assert.ok(books.length > 0);
  });

  it("never lists a teacher-only book", () => {
    assert.deepEqual(books.filter(b => b.audience === "teacher").map(b => b.id), []);
  });

  it("never carries a teacher-guide link", () => {
    assert.deepEqual(books.filter(b => "guidePdfUrl" in b).map(b => b.id), []);
  });

  it("is narrower than the teacher view it replaced", () => {
    const teacher = getBooksForSubjectGrade("mathematics", "grade-10", "teacher");
    // Guide *books* are already filtered out by the MVP book list; the leak
    // this closes is the guide link carried on the ordinary student books.
    assert.ok(teacher.some(b => b.guidePdfUrl), "fixture: the teacher view has guide links");
  });
});
