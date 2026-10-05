/**
 * «Verified» has to be about the key the question is graded against.
 *
 * The verifier is sent `check.answer`, a Latin restatement the model wrote
 * separately from `expectedAnswer`. These pin when the two are the same answer,
 * and what happens to a question whose verdict outlives an edit.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { gradedKey, linkCheck, squashMath, toLatinMath } from "../keyLinking.ts";
import { verifyAnswerKeys, verificationAfterEdit, type RelateKeyFn } from "../keyVerification.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";

const base = {
  rubric: null, objectiveId: "o-1", competencyKey: "application" as const, difficulty: "standard" as const,
  marks: 3, skill: null, aiMetadata: { source: "llm" },
};

const shortAnswer = (modelAnswer: string, answer: string): GeneratedQuestion => ({
  ...base, type: "short_answer", gradingMode: "ai_rubric",
  body: { prompt: "أوجد مشتقة f(x) = x³ − 4x" },
  expectedAnswer: { modelAnswer, keyConcepts: ["المشتقة"] },
  check: { topic: "derivative_polynomial", question: "x^3 - 4x", answer },
});

const mcq = (options: string[], correct: number, answer: string, multiSelect = false): GeneratedQuestion => ({
  ...base, type: "multiple_choice", gradingMode: "deterministic",
  body: { stem: "حلّ المعادلة", multiSelect, options: options.map((text, i) => ({ id: `o${i}`, text })) },
  expectedAnswer: { optionIds: [`o${correct}`] },
  check: { topic: "equation_linear", question: "2x + 5 = 13", answer },
});

const blank = (accept: string[], answer: string, blanks = 1): GeneratedQuestion => ({
  ...base, type: "fill_blank", gradingMode: "deterministic",
  body: { template: "{{1}}" },
  expectedAnswer: { blanks: Array.from({ length: blanks }, () => ({ accept })) },
  check: { topic: "equation_linear", question: "2x + 5 = 13", answer },
});

describe("one notation for comparing a key", () => {
  it("reads Arabic digits, minus, the Arabic variable letter and superscripts", () => {
    assert.equal(squashMath("٣س² − ٤"), "3x^2-4");
    assert.equal(squashMath("3x^2 - 4"), "3x^2-4");
    assert.equal(squashMath("س¹⁰"), "x^10");
    assert.equal(squashMath("٢٫٥"), "2.5");
  });

  it("does not turn an exponent into a digit", () => {
    assert.notEqual(squashMath("x²"), squashMath("x2"));
  });

  it("treats «x = 4» and «4» as the same answer, but not 4 and 14", () => {
    assert.equal(squashMath("x = 4"), squashMath("٤"));
    assert.notEqual(squashMath("14"), squashMath("4"));
  });

  it("keeps spaces for display but not for comparison", () => {
    assert.equal(toLatinMath("٣س  +  ١"), "3x  +  1");
  });
});

describe("a model answer written as prose", () => {
  it("is linked when it states the checked answer, in Arabic notation", () => {
    assert.equal(linkCheck(shortAnswer("المشتقة هي ٣س² − ٤", "3x^2 - 4")).linked, true);
  });

  it("is not linked when it states a different answer — the exact failure this closes", () => {
    const link = linkCheck(shortAnswer("المشتقة هي ٣س² + ٤", "3x^2 - 4"));
    assert.equal(link.linked, false);
  });

  it("does not find «5» inside «15»", () => {
    assert.equal(linkCheck(shortAnswer("الناتج هو 15", "5")).linked, false);
    assert.equal(linkCheck(shortAnswer("الناتج هو 5", "5")).linked, true);
  });

  it("is not linked when there is no model answer to compare with", () => {
    assert.equal(linkCheck(shortAnswer("", "3x^2 - 4")).linked, false);
  });
});

describe("a short key (multiple choice, one blank)", () => {
  it("is linked when the correct option IS the checked answer", () => {
    assert.equal(linkCheck(mcq(["x = 3", "x = 4", "x = 5"], 1, "x = 4")).linked, true);
    assert.equal(linkCheck(mcq(["٣", "٤", "٥"], 1, "x = 4")).linked, true);
  });

  it("is not linked when the correct option is a different answer than the one checked", () => {
    // The check says x = 4 (right); the graded option says x = 5.
    assert.equal(linkCheck(mcq(["x = 3", "x = 4", "x = 5"], 2, "x = 4")).linked, false);
  });

  it("is not linked for a multi-select — one checked answer cannot cover several options", () => {
    assert.equal(linkCheck(mcq(["x = 3", "x = 4", "x = 5"], 1, "x = 4", true)).linked, false);
  });

  it("a blank is linked when one of its accepted answers is the checked answer", () => {
    assert.equal(linkCheck(blank(["x = 4", "٤"], "4")).linked, true);
    assert.equal(linkCheck(blank(["x = 5"], "4")).linked, false);
  });

  it("a blank paper with several blanks has no single key to compare", () => {
    assert.equal(linkCheck(blank(["4"], "4", 2)).linked, false);
  });
});

describe("types with no key a symbolic answer can be compared with", () => {
  it("true/false and matching are never linked", () => {
    const tf = { ...shortAnswer("", "x"), type: "true_false" as const, body: { statement: "x = 4" }, expectedAnswer: { value: true } };
    assert.equal(linkCheck(tf).linked, false);
    assert.equal(gradedKey(tf).kind, "none");
  });
});

describe("what verifyAnswerKeys does with a question that is not linked", () => {
  const calls: string[] = [];
  const relate: RelateKeyFn = async (_t, _q, answer) => {
    calls.push(answer);
    return { relation: "equivalent", computed_answer: "3*x**2 - 4", error: null };
  };

  it("keeps it, marks it unverified with its own code, and never asks the verifier", async () => {
    calls.length = 0;
    const out = await verifyAnswerKeys([shortAnswer("المشتقة هي ٣س² + ٤", "3x^2 - 4")], relate);
    assert.equal(out.kept.length, 1);
    assert.equal(out.kept[0]!.verification.verified, false);
    assert.equal(out.kept[0]!.verification.code, "key_unlinked");
    assert.equal(calls.length, 0, "the verifier was asked about an answer nobody is graded against");
    assert.equal(out.checked, 0);
    assert.ok(out.warnings.some(w => /not their own answer key/.test(w)));
  });

  it("still verifies a linked question, and only that one", async () => {
    calls.length = 0;
    const out = await verifyAnswerKeys([
      shortAnswer("المشتقة هي ٣س² − ٤", "3x^2 - 4"),
      shortAnswer("المشتقة هي ٣س² + ٤", "3x^2 - 4"),
    ], relate);
    assert.deepEqual(out.kept.map(k => k.verification.code), ["verified", "key_unlinked"]);
    assert.equal(out.verified, 1);
    assert.equal(calls.length, 1);
  });

  it("a contradicted linked key is still dropped", async () => {
    const distinct: RelateKeyFn = async () => ({ relation: "distinct", computed_answer: "3*x**2 - 4", error: null });
    const out = await verifyAnswerKeys([shortAnswer("المشتقة هي ٣س² − ٤", "3x^2 - 4")], distinct);
    assert.equal(out.kept.length, 0);
    assert.equal(out.dropped.length, 1);
  });
});

describe("a verdict does not survive an edit", () => {
  const verified = { verified: true, source: "sympy", code: "verified", computedAnswer: "3x^2-4", checkedAt: "2026-10-05T00:00:00.000Z" };

  it("a verified question becomes unverified, with the reason", () => {
    const after = verificationAfterEdit(verified, new Date("2026-10-06T00:00:00.000Z"));
    assert.equal(after!.verified, false);
    assert.equal(after!.code, "edited");
    assert.equal(after!.source, "unchecked");
  });

  it("leaves a question that was never verified, and one with no record, as it was", () => {
    const unchecked = { verified: false, source: "unchecked", code: "no_key", checkedAt: "x" };
    assert.deepEqual(verificationAfterEdit(unchecked), unchecked);
    assert.equal(verificationAfterEdit(null), null);
  });
});
