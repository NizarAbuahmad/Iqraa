/**
 * Paper-exam rows — what the app accepts as "a question on a paper it can't see".
 *
 * The cases that matter are the ones that would otherwise produce a paper that
 * looks marked but measures nothing: a zero-mark question, an objective that
 * isn't in the evaluation's scope, and a missing competency.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPaperQuestion, parsePaperRows, MAX_MARKS_PER_QUESTION } from "../paperExam.ts";

const OPTS = { allowedObjectiveIds: ["obj-1", "obj-2"], maxQuestions: 50 };
const row = (over: Record<string, unknown> = {}) => ({
  marks: 2,
  objectiveId: "obj-1",
  competencyKey: "application",
  ...over,
});

describe("parsePaperRows", () => {
  it("accepts a grid and defaults difficulty", () => {
    const res = parsePaperRows([row(), row({ marks: "1.5", objectiveId: "obj-2" })], OPTS);
    assert.equal(res.ok, true);
    assert.equal(res.ok && res.rows.length, 2);
    assert.equal(res.ok && res.rows[0]!.difficulty, "standard");
    assert.equal(res.ok && res.rows[1]!.marks, 1.5);
  });

  it("rejects an empty grid", () => {
    assert.equal(parsePaperRows([], OPTS).ok, false);
    assert.equal(parsePaperRows(null, OPTS).ok, false);
  });

  it("rejects a zero-mark question — it could never move the score", () => {
    const res = parsePaperRows([row({ marks: 0 })], OPTS);
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.index, 0);
  });

  it("rejects negative marks and marks over the cap", () => {
    assert.equal(parsePaperRows([row({ marks: -1 })], OPTS).ok, false);
    assert.equal(parsePaperRows([row({ marks: MAX_MARKS_PER_QUESTION + 1 })], OPTS).ok, false);
    assert.equal(parsePaperRows([row({ marks: MAX_MARKS_PER_QUESTION })], OPTS).ok, true);
  });

  it("rejects an objective outside the evaluation's scope", () => {
    const res = parsePaperRows([row(), row({ objectiveId: "obj-elsewhere" })], OPTS);
    assert.equal(res.ok, false);
    assert.equal(!res.ok && res.index, 1);
  });

  it("rejects a missing or unknown competency rather than picking one", () => {
    assert.equal(parsePaperRows([row({ competencyKey: undefined })], OPTS).ok, false);
    assert.equal(parsePaperRows([row({ competencyKey: "recall" })], OPTS).ok, false);
  });

  it("refuses a grid longer than the cap", () => {
    const many = Array.from({ length: 51 }, () => row());
    assert.equal(parsePaperRows(many, OPTS).ok, false);
  });
});

describe("isPaperQuestion", () => {
  it("exempts a manual question with nothing in its body", () => {
    assert.equal(isPaperQuestion({ gradingMode: "manual", body: {} }), true);
    assert.equal(isPaperQuestion({ gradingMode: "manual", body: null }), true);
  });

  it("still validates a manual question that carries its own text", () => {
    assert.equal(isPaperQuestion({ gradingMode: "manual", body: { prompt: "اشرح" } }), false);
  });

  it("never exempts an automatically graded question", () => {
    assert.equal(isPaperQuestion({ gradingMode: "deterministic", body: {} }), false);
  });
});
