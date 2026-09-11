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

  it("marks the answer the exam screen actually sends", () => {
    // The student screen appends each new link and drops the superseded one
    // (`setMatchPair` in the mobile app), so a student who revisits their first
    // row hands in the same links in a different order. Order must not matter,
    // and only a test says so — the two halves are in different packages and
    // agree by nothing else.
    const asSaved = [
      { left: "2", right: "b" },
      { left: "3", right: "c" },
      { left: "4", right: "d" },
      { left: "1", right: "a" },
    ];
    assert.equal(matching.grade!(q, { pairs: asSaved }).fraction, 1);
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

  it("marks a partly-filled answer against the blank it was written in", () => {
    // The student screen pads to the placeholder count (`setBlankAt`), so
    // answering only the second blank sends ['', 'سم']. Sending ['سم'] instead
    // would be graded against {{1}} and scored zero for a correct answer —
    // which is what the screen did while it saved `{text}` and no blanks at all.
    assert.equal(fillBlank.grade!(q, { blanks: ["", "سم"] }).fraction, 0.5);
    assert.equal(fillBlank.grade!(q, { blanks: ["سم"] }).fraction, 0);
  });
});

describe("read-aloud grading", () => {
  const PASSAGE = "The power of appearance is greater than most people think today.";
  const q: QuestionDraft = {
    type: "read_aloud",
    body: { passage: PASSAGE, maxSeconds: 60 },
    expectedAnswer: {},
  };
  const readAloud = QUESTION_TYPES.read_aloud;

  it("marks a faithful reading correct", () => {
    const r = readAloud.grade!(q, { audioKey: "k", transcript: PASSAGE });
    assert.equal(r.status, "correct");
    assert.equal(r.fraction, 1);
  });

  it("separates no recording from a recording of silence", () => {
    // Different diagnoses: one is a student who did not attempt the question,
    // the other is usually a broken microphone. A teacher needs to tell them
    // apart, so silence is an attempt that earned nothing, not "unanswered".
    assert.equal(readAloud.grade!(q, {}).status, "unanswered");
    assert.equal(readAloud.grade!(q, { audioKey: "k", transcript: "" }).status, "incorrect");
  });

  it("says how it marked, in words a teacher can check", () => {
    const r = readAloud.grade!(q, { audioKey: "k", transcript: "The power of appearance is smaller than most people think today." });
    assert.match(r.detail ?? "", /\d+% of 11 words matched \(1 error\)/);
  });

  it("does not hand marks to a recording of the wrong thing", () => {
    const r = readAloud.grade!(q, { audioKey: "k", transcript: "bananas and other unrelated words entirely" });
    assert.ok(r.fraction < 0.2, `expected a low score, got ${r.fraction}`);
  });

  it("shows the student the passage and nothing else", () => {
    const shown = readAloud.sanitizeForStudent(q);
    assert.equal(shown["passage"], PASSAGE);
    assert.deepEqual(Object.keys(shown).sort(), ["maxSeconds", "passage"]);
  });

  it("rejects a question whose passage is missing or unreadably short", () => {
    assert.match(readAloud.validate({ ...q, body: {} }).join("\n"), /Passage is empty/);
    assert.match(readAloud.validate({ ...q, body: { passage: "Too short." } }).join("\n"), /minimum/);
  });

  it("refuses an answer key, because the passage is the key", () => {
    // Anything parked in expectedAnswer either duplicates the passage and
    // drifts from what the student was shown, or is a key that has no business
    // existing for this type.
    const errors = readAloud.validate({ ...q, expectedAnswer: { modelAnswer: PASSAGE } });
    assert.match(errors.join("\n"), /expectedAnswer must be empty/);
  });
});

describe("what may be auto-marked at all", () => {
  /**
   * Types that mark themselves, because the answer is knowable without a
   * judgement. `read_aloud` belongs here despite being an open response: the
   * passage is printed on the student's screen, so word accuracy against it is
   * a measurement.
   */
  const SELF_MARKING = [
    "multiple_choice",
    "true_false",
    "matching",
    "fill_blank",
    "read_aloud",
  ] as const;

  /**
   * Types that need a rubric grader or a teacher. The absence of `grade()` is
   * the signal; a caller that defaulted them to zero would report a level
   * built on questions nobody marked.
   */
  const NEEDS_JUDGEMENT = [
    "short_answer",
    "open_ended",
    "problem_solving",
    "practical_task",
  ] as const;

  it("classifies every registered type as one or the other", () => {
    // The lists used to be two hardcoded sets that did not have to add up to
    // the registry, so a new type was covered by neither and this suite went
    // quietly incomplete — which is what happened when `read_aloud` landed.
    assert.deepEqual(
      [...SELF_MARKING, ...NEEDS_JUDGEMENT].sort(),
      Object.keys(QUESTION_TYPES).sort(),
      "a new question type must be classified here as self-marking or not",
    );
  });

  it("exposes grade() only where marking is not a judgement call", () => {
    for (const type of SELF_MARKING) {
      assert.ok(QUESTION_TYPES[type].grade, `${type} must be auto-markable`);
    }
    for (const type of NEEDS_JUDGEMENT) {
      assert.equal(QUESTION_TYPES[type].grade, undefined, `${type} must not self-mark`);
    }
  });
});
