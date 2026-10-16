import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { PAPER_TOTALS_MAX_ROWS, clearDecision, parsePaperTotals } from "../paperTotals.ts";

// Hex LETTERS in the ids on purpose: all-digit ids are their own upper case, so a case test would pass without `.toLowerCase()`.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("parsePaperTotals", () => {
  it("accepts numbers, numeric strings and null, and lower-cases ids", () => {
    const r = parsePaperTotals({ totals: [{ studentId: A.toUpperCase(), marks: 15 }, { studentId: B, marks: "12.5" }, { studentId: "33333333-3333-4333-8333-333333333333", marks: null }] });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.rows[0]!.studentId, A);
      assert.deepEqual(r.rows.map(x => x.marks), [15, "12.5", null]);
    }
  });

  it("refuses a body that is not { totals: [...] } with at least one row", () => {
    for (const body of [null, [], "x", {}, { totals: "x" }, { totals: [] }]) {
      const r = parsePaperTotals(body);
      assert.equal(r.ok, false, JSON.stringify(body));
      if (!r.ok) assert.equal(r.code, "invalid_paper_totals");
    }
  });

  it("caps the rows per request", () => {
    const rows = Array.from({ length: PAPER_TOTALS_MAX_ROWS + 1 }, (_, i) => ({
      studentId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      marks: 1,
    }));
    const r = parsePaperTotals({ totals: rows });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "too_many_rows");
    assert.equal(parsePaperTotals({ totals: rows.slice(0, PAPER_TOTALS_MAX_ROWS) }).ok, true);
  });

  it("names the first malformed row", () => {
    const cases: unknown[] = [
      { studentId: "nope", marks: 1 },
      { studentId: A },
      { studentId: A, marks: "" },
      { studentId: A, marks: "  " },
      { studentId: A, marks: true },
      { studentId: A, marks: Number.NaN },
      { studentId: A, marks: Infinity },
      { studentId: A, marks: {} },
      "row",
    ];
    for (const bad of cases) {
      const r = parsePaperTotals({ totals: [{ studentId: B, marks: 1 }, bad] });
      assert.equal(r.ok, false, JSON.stringify(bad));
      if (!r.ok) {
        assert.equal(r.code, "invalid_paper_totals");
        assert.equal(r.index, 1);
      }
    }
  });

  it("refuses the same student twice, whatever the case of the id", () => {
    const r = parsePaperTotals({ totals: [{ studentId: A, marks: 1 }, { studentId: A.toUpperCase(), marks: 2 }] });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "duplicate_student");
      assert.equal(r.index, 1);
    }
  });
});

describe("clearDecision", () => {
  it("has nothing to do without a sitting", () => {
    assert.equal(clearDecision(null), "nothing");
  });
  it("deletes only a teacher-typed sitting with no recorded answers", () => {
    assert.equal(clearDecision({ source: "teacher_entry", hasAnswers: false }), "delete");
    assert.equal(clearDecision({ source: "teacher_entry", hasAnswers: true }), "keep");
    assert.equal(clearDecision({ source: "student_link", hasAnswers: false }), "keep");
    assert.equal(clearDecision({ source: "student_link", hasAnswers: true }), "keep");
  });
});
