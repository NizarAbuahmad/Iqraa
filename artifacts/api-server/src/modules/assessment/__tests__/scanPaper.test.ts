/**
 * Reading an exam paper to fill the grid.
 *
 * Same question as scanMarks.test.ts, asked of a different number: when the
 * reading is uncertain, does the result under-claim? Here the number is a
 * question's ceiling, so a confident wrong one skews every student's score.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SCANNED_QUESTIONS,
  buildPaperScanPrompt,
  parsePaperScanResponse,
} from "../scanPaper.ts";

const IDS = ["obj-a", "obj-b"];

const q = (over: Record<string, unknown> = {}) => ({
  number: 1,
  marks: 5,
  readAs: "5",
  objectiveId: "obj-a",
  competency: "knowledge",
  ...over,
});

describe("buildPaperScanPrompt", () => {
  it("says it is reading, not setting, a paper", () => {
    const { system } = buildPaperScanPrompt([{ id: "obj-a", label: "x" }]);
    assert.match(system, /reading, not setting, a paper/);
    assert.match(system, /Never invent a question/);
  });

  it("says null beats a guessed mark", () => {
    assert.match(buildPaperScanPrompt([]).system, /Null is always better than a guess/);
  });

  it("lists every objective with its id so the model can only choose from them", () => {
    const { user } = buildPaperScanPrompt([
      { id: "obj-a", label: "يحلّ معادلة" },
      { id: "obj-b", label: "يرسم دالة" },
    ]);
    assert.match(user, /obj-a — يحلّ معادلة/);
    assert.match(user, /obj-b — يرسم دالة/);
  });
});

describe("parsePaperScanResponse", () => {
  it("accepts a clean reading", () => {
    const res = parsePaperScanResponse(
      { printedTotal: 15, questions: [q(), q({ number: 2, marks: 10, readAs: "١٠", objectiveId: "obj-b", competency: "application" })] },
      IDS,
    );
    assert.equal(res.rows.length, 2);
    assert.deepEqual(res.rows[1], {
      number: 2, marks: 10, objectiveId: "obj-b", competencyKey: "application", readAs: "١٠",
    });
    assert.equal(res.printedTotal, 15);
    assert.deepEqual(res.skipped, []);
  });

  it("never turns an unreadable mark into a number", () => {
    for (const marks of [null, undefined, "مطموس", "", {}]) {
      const res = parsePaperScanResponse({ questions: [q({ marks })] }, IDS);
      assert.equal(res.rows[0]!.marks, null, JSON.stringify(marks));
      assert.match(res.skipped[0]!.reason, /could not read/);
    }
  });

  it("drops marks the grid would refuse instead of clamping them", () => {
    for (const marks of [0, -2, 101, 5000]) {
      const res = parsePaperScanResponse({ questions: [q({ marks })] }, IDS);
      assert.equal(res.rows[0]!.marks, null, String(marks));
      assert.match(res.skipped[0]!.reason, /not a usable mark/);
    }
  });

  it("reads Arabic-Indic digits and half marks", () => {
    const res = parsePaperScanResponse(
      { questions: [q({ marks: "٢٫٥", readAs: "٢٫٥" }), q({ number: "٢", marks: "1½" })] },
      IDS,
    );
    assert.equal(res.rows[0]!.marks, 2.5);
    assert.equal(res.rows[1]!.marks, 1.5);
  });

  it("nulls an objective that was not in the list it was given", () => {
    const res = parsePaperScanResponse({ questions: [q({ objectiveId: "obj-elsewhere" })] }, IDS);
    assert.equal(res.rows[0]!.objectiveId, null);
  });

  it("nulls a competency that is not one of the four", () => {
    for (const competency of ["recall", "", null, 3, "Knowledge"]) {
      const res = parsePaperScanResponse({ questions: [q({ competency })] }, IDS);
      assert.equal(res.rows[0]!.competencyKey, null, JSON.stringify(competency));
    }
  });

  it("keeps row N as question N when the pages skip a number", () => {
    const res = parsePaperScanResponse(
      { questions: [q(), q({ number: 2 }), q({ number: 4 })] },
      IDS,
    );
    assert.deepEqual(res.rows.map(r => r.number), [1, 2, 3, 4]);
    assert.deepEqual(
      { marks: res.rows[2]!.marks, objectiveId: res.rows[2]!.objectiveId, competencyKey: res.rows[2]!.competencyKey },
      { marks: null, objectiveId: null, competencyKey: null },
    );
    assert.deepEqual(res.skipped.map(s => s.number), [3]);
  });

  it("takes only the first reading when a question appears twice", () => {
    const res = parsePaperScanResponse({ questions: [q({ marks: 4 }), q({ marks: 9 })] }, IDS);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0]!.marks, 4);
  });

  it("ignores non-questions: bad numbers, non-objects", () => {
    const res = parsePaperScanResponse(
      { questions: [q({ number: 0 }), q({ number: -1 }), q({ number: 1.5 }), q({ number: "x" }), "text", null, q({ number: 1 })] },
      IDS,
    );
    assert.deepEqual(res.rows.map(r => r.number), [1]);
  });

  it("cuts a paper at the grid's ceiling and says so", () => {
    const many = Array.from({ length: MAX_SCANNED_QUESTIONS + 3 }, (_, i) => q({ number: i + 1 }));
    const res = parsePaperScanResponse({ questions: many }, IDS);
    assert.equal(res.rows.length, MAX_SCANNED_QUESTIONS);
    assert.ok(res.skipped.some(s => s.number === MAX_SCANNED_QUESTIONS + 1));
  });

  it("reports no total unless it is a positive number", () => {
    for (const printedTotal of [null, undefined, 0, -3, "غير واضح"]) {
      assert.equal(parsePaperScanResponse({ questions: [q()], printedTotal }, IDS).printedTotal, null);
    }
    assert.equal(parsePaperScanResponse({ questions: [q()], printedTotal: "٤٠" }, IDS).printedTotal, 40);
  });

  it("returns nothing for an unusable response", () => {
    for (const raw of [null, undefined, {}, { questions: "no" }, [], "text"]) {
      const res = parsePaperScanResponse(raw, IDS);
      assert.deepEqual(res.rows, [], JSON.stringify(raw));
    }
  });
});
