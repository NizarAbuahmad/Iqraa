/**
 * Deterministic marking — Tier 1 of the grading design.
 *
 * The bar these hold: a student who wrote the right answer must never lose a
 * mark for writing it differently. In Arabic that is mostly orthography — hamza
 * carriers, taa marbuta, final yaa, harakat, Arabic-Indic digits — and comparing
 * raw strings gets it wrong. A wrong mark on a correct answer is the failure
 * that costs a teacher's trust in every number the module produces afterwards,
 * so the normalisation cases below are the point of the file, not an extra.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QUESTION_TYPES, type QuestionDraft } from "../questionTypes.ts";
import { answersMatch, normalizeArabic, numericValue } from "../normalize.ts";

const mcq = QUESTION_TYPES.multiple_choice;
const tf = QUESTION_TYPES.true_false;
const matching = QUESTION_TYPES.matching;
const fillBlank = QUESTION_TYPES.fill_blank;

describe("Arabic normalisation", () => {
  it("folds the orthographic variants a student may write", () => {
    // Same word, four ways a keyboard or a hand produces it.
    assert.equal(normalizeArabic("الإجابة"), normalizeArabic("الاجابه"));
    assert.equal(normalizeArabic("أحمد"), normalizeArabic("احمد"));
    assert.equal(normalizeArabic("مُسْتَقيم"), normalizeArabic("مستقيم"));
    assert.equal(normalizeArabic("مســـتقيم"), normalizeArabic("مستقيم"));
    assert.equal(normalizeArabic("على"), normalizeArabic("علي"));
    assert.equal(normalizeArabic("  الدالة   الأسية "), normalizeArabic("الداله الاسيه"));
  });

  it("converts Arabic-Indic digits and the decimal separator", () => {
    assert.equal(normalizeArabic("٧"), "7");
    assert.equal(normalizeArabic("١٢٣"), "123");
    assert.equal(normalizeArabic("٣٫٥"), "3.5");
  });

  it("keeps standalone hamza, which is a letter and changes the word", () => {
    assert.notEqual(normalizeArabic("جزء"), normalizeArabic("جز"));
  });

  it("reads numbers only when the whole string is one", () => {
    assert.equal(numericValue("7"), 7);
    assert.equal(numericValue("3.5"), 3.5);
    assert.equal(numericValue("7 سم"), null);
    assert.equal(numericValue(""), null);
  });

  it("matches numbers within tolerance and across scripts", () => {
    assert.ok(answersMatch("٧", "7"));
    assert.ok(answersMatch("7.0", "7"));
    assert.ok(answersMatch("0.3333", "0.333"));
    assert.ok(!answersMatch("8", "7"));
    // An empty answer is never a match, even against an empty key.
    assert.ok(!answersMatch("", ""));
  });
});

describe("multiple choice grading", () => {
  const single: QuestionDraft = {
    type: "multiple_choice",
    body: { stem: "س", options: [{ id: "a", text: "أ" }, { id: "b", text: "ب" }, { id: "c", text: "ج" }] },
    expectedAnswer: { optionIds: ["b"] },
  };

  it("marks the right option correct and a wrong one incorrect", () => {
    assert.deepEqual(mcq.grade!(single, { optionIds: ["b"] }), { fraction: 1, status: "correct" });
    assert.deepEqual(mcq.grade!(single, { optionIds: ["a"] }), { fraction: 0, status: "incorrect" });
  });

  it("separates unanswered from wrong", () => {
    assert.equal(mcq.grade!(single, {}).status, "unanswered");
    assert.equal(mcq.grade!(single, { optionIds: [] }).status, "unanswered");
  });

  it("does not let a multi-select be won by ticking everything", () => {
    const multi: QuestionDraft = {
      type: "multiple_choice",
      body: { stem: "س", multiSelect: true, options: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] },
      expectedAnswer: { optionIds: ["a", "b"] },
    };
    assert.equal(mcq.grade!(multi, { optionIds: ["a", "b"] }).fraction, 1);
    assert.equal(mcq.grade!(multi, { optionIds: ["a"] }).fraction, 0.5);
    // Two right, two wrong: nets to zero rather than full marks.
    assert.equal(mcq.grade!(multi, { optionIds: ["a", "b", "c", "d"] }).fraction, 0);
  });
});

describe("true/false grading", () => {
  const q: QuestionDraft = {
    type: "true_false",
    body: { statement: "س" },
    expectedAnswer: { value: true },
  };

  it("marks a boolean answer", () => {
    assert.equal(tf.grade!(q, { value: true }).status, "correct");
    assert.equal(tf.grade!(q, { value: false }).status, "incorrect");
  });

  it("treats a missing answer as unanswered, not as false", () => {
    assert.equal(tf.grade!(q, {}).status, "unanswered");
  });
});

describe("matching grading", () => {
  const q: QuestionDraft = {
    type: "matching",
    body: { left: ["1", "2", "3", "4"], right: ["a", "b", "c", "d"] },
    expectedAnswer: {
      pairs: [
        { left: "1", right: "a" },
        { left: "2", right: "b" },
        { left: "3", right: "c" },
        { left: "4", right: "d" },
      ],
    },
  };

  it("gives credit per link rather than all or nothing", () => {
    assert.equal(matching.grade!(q, { pairs: q.expectedAnswer["pairs"] as unknown[] }).fraction, 1);
    const three = [
      { left: "1", right: "a" },
      { left: "2", right: "b" },
      { left: "3", right: "c" },
      { left: "4", right: "a" },
    ];
    assert.equal(matching.grade!(q, { pairs: three }).fraction, 0.75);
  });

  it("separates unanswered from all-wrong", () => {
    assert.equal(matching.grade!(q, { pairs: [] }).status, "unanswered");
    assert.equal(
      matching.grade!(q, { pairs: [{ left: "1", right: "d" }] }).status,
      "incorrect",
    );
  });
});

describe("fill-in-the-blank grading", () => {
  const q: QuestionDraft = {
    type: "fill_blank",
    body: { template: "المحيط = {{1}} × نصف القطر، والوحدة {{2}}" },
    expectedAnswer: {
      blanks: [{ accept: ["٢π", "2π", "6.28"] }, { accept: ["سم", "سنتيمتر"] }],
    },
  };

  it("accepts any listed form, in either script", () => {
    assert.equal(fillBlank.grade!(q, { blanks: ["2π", "سم"] }).fraction, 1);
    assert.equal(fillBlank.grade!(q, { blanks: ["٢π", "سنتيمتر"] }).fraction, 1);
  });

  it("accepts an answer written with different orthography — rule 8", () => {
    // Same word, harakat and taa marbuta as a student would write them.
    const spelling: QuestionDraft = {
      type: "fill_blank",
      body: { template: "الشكل {{1}}" },
      expectedAnswer: { blanks: [{ accept: ["الدائرة"] }] },
    };
    for (const written of ["الدائره", "الدائرة", "الدَّائرة", "  الدائره  "]) {
      assert.equal(
        fillBlank.grade!(spelling, { blanks: [written] }).status,
        "correct",
        `"${written}" must be accepted`,
      );
    }
  });

  it("gives partial credit per blank", () => {
    assert.equal(fillBlank.grade!(q, { blanks: ["2π", "متر"] }).fraction, 0.5);
  });

  it("treats all-blank as unanswered", () => {
    assert.equal(fillBlank.grade!(q, { blanks: ["", "  "] }).status, "unanswered");
  });
});

describe("what may be auto-marked at all", () => {
  it("exposes grade() only where marking is not a judgement call", () => {
    for (const type of ["multiple_choice", "true_false", "matching", "fill_blank"] as const) {
      assert.ok(QUESTION_TYPES[type].grade, `${type} must be auto-markable`);
    }
    // These need a rubric grader or a teacher. Their absence is the signal;
    // a caller that defaulted them to zero would report a level built on
    // questions nobody marked.
    for (const type of ["short_answer", "open_ended", "problem_solving", "practical_task"] as const) {
      assert.equal(QUESTION_TYPES[type].grade, undefined, `${type} must not self-mark`);
    }
  });
});
