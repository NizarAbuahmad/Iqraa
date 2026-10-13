/**
 * The duplicate gate must tell two maths questions apart by their maths.
 *
 * `stemSimilarity` used to keep only tokens longer than two characters, which
 * throws away every symbol, number and single-letter variable. A paper of
 * «حل النظام: …» questions then compared as identical, and a teacher who asked
 * for 20 was left with 3 — the rest rejected as "near-duplicates" of questions
 * that asked something else.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { missingAfterValidation, stemSimilarity, validateGenerated } from "../validator.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";

const system = (eq1: string, eq2: string) => `حل النظام:\n${eq1}\n${eq2}`;

const mcq = (prompt: string, objectiveId = "o1"): GeneratedQuestion => ({
  type: "multiple_choice",
  body: {
    stem: prompt,
    options: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
      { id: "c", text: "3" },
    ],
  },
  expectedAnswer: { optionIds: ["a"] },
  rubric: null,
  objectiveId,
  competencyKey: "knowledge",
  difficulty: "standard",
  marks: 2,
  skill: null,
  gradingMode: "deterministic",
  aiMetadata: {},
} as unknown as GeneratedQuestion);

describe("stemSimilarity on maths stems", () => {
  it("does not call two different systems of equations the same question", () => {
    const a = system("x + y = 5", "y = x² − 1");
    const b = system("y = 2", "y = x² − 2");
    assert.ok(stemSimilarity(a, b) < 0.85, `got ${stemSimilarity(a, b)}`);
  });

  it("still calls the same question the same question", () => {
    const a = system("y = x² − 1", "y = 2x + 2");
    assert.equal(stemSimilarity(a, a), 1);
    assert.ok(stemSimilarity(a, `  ${a} `) > 0.85);
  });

  it("keeps all of a paper whose stems differ only in the maths", () => {
    const stems = [
      system("x + y = 5", "y = x² − 1"),
      system("y = 3x − 1", "y = x² + x − 1"),
      system("y = 2", "y = x² − 2"),
      system("x − y = 1", "y = x² − 3x + 3"),
    ];
    const result = validateGenerated(stems.map(s => mcq(s)), {
      allowedObjectiveIds: ["o1"],
      allowedTypes: ["multiple_choice"],
    });
    assert.equal(result.accepted.length, 4, JSON.stringify(result.rejected));
  });

  it("still rejects a question asked twice", () => {
    const s = system("y = x² − 1", "y = 2x + 2");
    const result = validateGenerated([mcq(s), mcq(s)], {
      allowedObjectiveIds: ["o1"],
      allowedTypes: ["multiple_choice"],
    });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.rejected.length, 1);
  });
});

describe("missingAfterValidation", () => {
  const options = { allowedObjectiveIds: ["o1"], allowedTypes: ["multiple_choice"] as const };

  it("counts what survives validation, not what the generator sent", () => {
    const s = system("y = x² − 1", "y = 2x + 2");
    // Three sent, but two are the same question and one is off-scope: one is usable.
    const sent = [mcq(s), mcq(s), mcq(system("y = 2", "y = x² − 2"), "other")];
    assert.equal(missingAfterValidation(sent, options, 5), 4);
  });

  it("is zero once the target is met, never negative", () => {
    const sent = [mcq(system("y = 2", "y = x² − 2")), mcq(system("y = 3", "y = x² − 3"))];
    assert.equal(missingAfterValidation(sent, options, 1), 0);
  });
});
