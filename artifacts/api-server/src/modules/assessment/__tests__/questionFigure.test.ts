/**
 * A teacher-attached book figure, as a student may receive it.
 *
 * A question body is stored as-is, so anything in `body.figure` would reach a
 * student's phone and be loaded. Only the book figures the app itself serves
 * are allowed through — the projection is the one place every student-facing
 * question passes, so it is checked there.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";
import { studentFigure } from "../questionFigure.ts";
import { sanitizeQuestionForStudent } from "../studentView.ts";

const ok = { uri: `${BOOK_FIGURE_BASE_URL}/g10-math-s1/p045-1.png`, caption: "كتاب الطالب · صفحة ٤٥" };

describe("studentFigure", () => {
  it("passes a book figure", () => assert.deepEqual(studentFigure({ figure: ok }), ok));

  it("refuses any other host, a lookalike prefix, and junk", () => {
    for (const uri of ["https://evil.example/x.png", `${BOOK_FIGURE_BASE_URL}evil/x.png`, "javascript:alert(1)", 7]) {
      assert.equal(studentFigure({ figure: { uri, caption: "x" } }), null, String(uri));
    }
    assert.equal(studentFigure({ figure: { uri: ok.uri, caption: "  " } }), null, "a figure needs its citation");
    assert.equal(studentFigure({}), null);
  });
});

describe("the student projection carries a checked figure", () => {
  const q = (figure: unknown) => ({
    id: "q1", orderIndex: 0, type: "true_false", marks: "1",
    body: { statement: "س", figure },
  });

  it("keeps a book figure", () => {
    assert.deepEqual(sanitizeQuestionForStudent(q(ok), "a1").body["figure"], ok);
  });

  it("drops a foreign one", () => {
    const body = sanitizeQuestionForStudent(q({ uri: "https://evil.example/x.png", caption: "x" }), "a1").body;
    assert.equal(body["figure"], undefined);
  });

  it("adds nothing to a question without one", () => {
    assert.ok(!("figure" in sanitizeQuestionForStudent(q(undefined), "a1").body));
  });
});
