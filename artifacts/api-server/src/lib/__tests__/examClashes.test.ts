/**
 * What this guards: the clash warning tells a teacher "another exam sits on this
 * day for this grade". Students belong to one teacher each, so the system cannot
 * know that two classes share children — same school + same grade + same day is
 * the whole signal. The two failure modes are a false calm (a closed exam
 * hiding a real clash, or an archived one raising a false alarm) and a false
 * alarm across grades, which would make teachers stop trusting the badge.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countsOnCalendar, findClashes, type CalendarExam } from "../examClashes.ts";

function exam(over: Partial<CalendarExam> & { id: string }): CalendarExam {
  return {
    examDate: "2026-10-12",
    gradeId: "grade-10",
    status: "published",
    archivedAt: null,
    ...over,
  };
}

describe("countsOnCalendar", () => {
  it("counts a published exam with a date", () => {
    assert.equal(countsOnCalendar(exam({ id: "a" })), true);
  });

  it("counts a draft that has been given a date", () => {
    assert.equal(countsOnCalendar(exam({ id: "a", status: "draft" })), true);
  });

  it("ignores an exam with no date", () => {
    assert.equal(countsOnCalendar(exam({ id: "a", examDate: null })), false);
  });

  it("ignores a closed exam — it has already been sat", () => {
    assert.equal(countsOnCalendar(exam({ id: "a", status: "closed" })), false);
  });

  it("ignores an archived exam", () => {
    assert.equal(countsOnCalendar(exam({ id: "a", archivedAt: new Date("2026-09-01") })), false);
  });
});

describe("findClashes", () => {
  it("finds nothing when every exam is on its own day", () => {
    const clashes = findClashes([
      exam({ id: "a", examDate: "2026-10-12" }),
      exam({ id: "b", examDate: "2026-10-13" }),
    ]);
    assert.deepEqual(clashes, []);
  });

  it("flags two exams for the same grade on the same day", () => {
    const clashes = findClashes([exam({ id: "a" }), exam({ id: "b" })]);
    assert.deepEqual(clashes, [{ examDate: "2026-10-12", gradeId: "grade-10", examIds: ["a", "b"] }]);
  });

  it("does not flag different grades on the same day", () => {
    const clashes = findClashes([exam({ id: "a" }), exam({ id: "b", gradeId: "grade-9" })]);
    assert.deepEqual(clashes, []);
  });

  it("does not flag the same grade on different days", () => {
    const clashes = findClashes([exam({ id: "a" }), exam({ id: "b", examDate: "2026-10-14" })]);
    assert.deepEqual(clashes, []);
  });

  it("groups three exams into one clash", () => {
    const clashes = findClashes([exam({ id: "a" }), exam({ id: "b" }), exam({ id: "c" })]);
    assert.equal(clashes.length, 1);
    assert.deepEqual(clashes[0]!.examIds, ["a", "b", "c"]);
  });

  it("reports each clashing day separately, ordered by date", () => {
    const clashes = findClashes([
      exam({ id: "a", examDate: "2026-10-14" }),
      exam({ id: "b", examDate: "2026-10-14" }),
      exam({ id: "c", examDate: "2026-10-12" }),
      exam({ id: "d", examDate: "2026-10-12" }),
    ]);
    assert.deepEqual(
      clashes.map(c => c.examDate),
      ["2026-10-12", "2026-10-14"],
    );
  });

  it("is not tipped into a clash by a closed or archived exam", () => {
    const clashes = findClashes([
      exam({ id: "a" }),
      exam({ id: "b", status: "closed" }),
      exam({ id: "c", archivedAt: new Date("2026-09-01") }),
      exam({ id: "d", examDate: null }),
    ]);
    assert.deepEqual(clashes, []);
  });

  it("returns nothing for an empty calendar", () => {
    assert.deepEqual(findClashes([]), []);
  });
});
