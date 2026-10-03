/**
 * Structural checks on generated multiple-choice and matching questions.
 *
 * Both types are graded by id, so an id the validator never looked at is a
 * question that marks a correct student wrong, or a wrong one right, with no
 * error anywhere.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { QUESTION_TYPES, type QuestionDraft } from "../questionTypes.ts";
import { buildGenerationPrompt, gradeClause } from "../llmGenerator.ts";

const mcq = QUESTION_TYPES.multiple_choice;
const matching = QUESTION_TYPES.matching;

const mc = (options: unknown[], optionIds: unknown[]): QuestionDraft => ({
  type: "multiple_choice",
  body: { stem: "س", options },
  expectedAnswer: { optionIds },
});
const opt = (id: string, text: string) => ({ id, text });

describe("multiple choice validation", () => {
  it("accepts a well-formed question", () => {
    assert.deepEqual(mcq.validate(mc([opt("a", "١"), opt("b", "٢"), opt("c", "٣")], ["b"])), []);
  });

  it("rejects options that share an id — picking the wrong one would be marked right", () => {
    const errors = mcq.validate(mc([opt("a", "١"), opt("a", "٢"), opt("b", "٣")], ["a"]));
    assert.ok(errors.includes("Duplicate option ids"), errors.join(" | "));
  });

  it("rejects an option with no id", () => {
    const errors = mcq.validate(mc([opt("", "١"), opt("b", "٢"), opt("c", "٣")], ["b"]));
    assert.ok(errors.includes("An option has no id"), errors.join(" | "));
  });

  it("rejects the same correct option listed twice", () => {
    const errors = mcq.validate({ ...mc([opt("a", "١"), opt("b", "٢"), opt("c", "٣")], ["b", "b"]), body: { stem: "س", multiSelect: true, options: [opt("a", "١"), opt("b", "٢"), opt("c", "٣")] } });
    assert.ok(errors.includes("Correct option is listed twice"), errors.join(" | "));
  });
});

const match = (left: unknown[], right: unknown[], pairs: unknown[]): QuestionDraft => ({
  type: "matching",
  body: { left, right },
  expectedAnswer: { pairs },
});

describe("matching validation", () => {
  const left = [opt("l1", "أ"), opt("l2", "ب")];
  const right = [opt("r1", "١"), opt("r2", "٢")];

  it("accepts a well-formed question", () => {
    assert.deepEqual(matching.validate(match(left, right, [{ left: "l1", right: "r1" }, { left: "l2", right: "r2" }])), []);
  });

  it("rejects pairs written with ids the items do not have — every correct answer would score zero", () => {
    const errors = matching.validate(match(left, right, [{ left: "1", right: "1" }, { left: "2", right: "2" }]));
    assert.ok(errors.includes("A pair refers to an item that is not in the question"), errors.join(" | "));
  });

  it("rejects an item used in two pairs", () => {
    const errors = matching.validate(match(left, right, [{ left: "l1", right: "r1" }, { left: "l1", right: "r2" }]));
    assert.ok(errors.includes("An item appears in more than one pair"), errors.join(" | "));
  });

  it("rejects duplicate or missing item ids", () => {
    assert.ok(matching.validate(match([opt("l1", "أ"), opt("l1", "ب")], right, [{ left: "l1", right: "r1" }, { left: "l1", right: "r2" }])).includes("Duplicate matching item ids"));
    assert.ok(matching.validate(match([opt("", "أ"), opt("l2", "ب")], right, [{ left: "", right: "r1" }, { left: "l2", right: "r2" }])).includes("A matching item has no id"));
  });

  it("allows spare right-hand items, which are distractors", () => {
    const spare = [...right, opt("r3", "٣")];
    assert.deepEqual(matching.validate(match(left, spare, [{ left: "l1", right: "r1" }, { left: "l2", right: "r2" }])), []);
  });
});

describe("the grade in the generation prompt", () => {
  const REQ = {
    objectives: [], assessmentTypes: ["multiple_choice" as const], count: 5,
    difficulty: "medium" as const, language: "ar",
  };

  it("names the evaluation's grade, not Grade 10", () => {
    assert.match(buildGenerationPrompt({ ...REQ, gradeId: "grade-4" }).system, /curriculum, Grade 4\./);
    assert.doesNotMatch(buildGenerationPrompt({ ...REQ, gradeId: "grade-4" }).system, /Grade 10/);
  });

  it("states no grade rather than a wrong one when the id is unknown", () => {
    assert.equal(gradeClause(undefined), "");
    assert.equal(gradeClause("secondary"), "");
    assert.doesNotMatch(buildGenerationPrompt(REQ).system, /Grade \d/);
  });
});
