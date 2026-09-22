/**
 * The spelling comparator, and the one assertion this whole feature rests on:
 * that it disagrees with `normalizeArabic`.
 *
 * Two Arabic normalisers in one codebase looks like a mistake and is not. The
 * shared one folds hamza carriers, the tied taa and the dotless yaa so that a
 * student who writes a maths answer «اجابه» is not marked wrong for spelling.
 * A dictation graded through it cannot detect a spelling error at all. The
 * `stays strict where normalizeArabic folds` block below fails the moment
 * someone helpfully merges them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeArabic } from "@workspace/curriculum";
import {
  dictationDetail,
  dictationWords,
  normalizeForDictation,
  scoreDictation,
  spellingDiff,
} from "../dictation.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";

describe("normalizeForDictation stays strict where normalizeArabic folds", () => {
  /** Pairs a spelling test must separate, and the rule each one belongs to. */
  const MUST_DIFFER: ReadonlyArray<[string, string, string]> = [
    ["مدرسة", "مدرسه", "tied taa for haa"],
    ["أنا", "انا", "hamza on the alif"],
    ["إملاء", "املاء", "hamza below"],
    ["آمن", "امن", "maddah"],
    ["على", "علي", "dotless yaa"],
    ["ذهبوا", "ذهبو", "the silent alif"],
    ["جزء", "جز", "standalone hamza is a letter"],
  ];

  for (const [correct, wrong, rule] of MUST_DIFFER) {
    it(`separates ${correct} from ${wrong} (${rule})`, () => {
      assert.notEqual(
        normalizeForDictation(correct),
        normalizeForDictation(wrong),
        `«${wrong}» must not pass as «${correct}»`,
      );
    });
  }

  it("disagrees with normalizeArabic on the folds that matter", () => {
    // The regression guard. If this ever passes, the two normalisers have been
    // merged and every dictation question in the product silently stopped
    // marking spelling.
    const folded = MUST_DIFFER.filter(([a, b]) => normalizeArabic(a) === normalizeArabic(b));
    assert.ok(
      folded.length >= 4,
      "normalizeArabic no longer folds these — check whether it was changed, not this test",
    );
    for (const [a, b] of folded) {
      assert.notEqual(normalizeForDictation(a), normalizeForDictation(b));
    }
  });
});

describe("normalizeForDictation folds what is not spelling", () => {
  it("treats a decomposed hamza as the same letter", () => {
    // Two keyboards, one letter: U+0623 versus ا + U+0654 combining hamza.
    assert.equal(normalizeForDictation("أكل"), normalizeForDictation("أكل"));
  });

  it("does not mistake a combining hamza for a haraka and strip it", () => {
    // The trap: U+0653-U+0655 look like diacritics and are half a letter.
    assert.notEqual(normalizeForDictation("أكل"), normalizeForDictation("اكل"));
  });

  it("ignores tatweel, invisible marks and a trailing full stop", () => {
    const plain = normalizeForDictation("مدرسة");
    assert.equal(normalizeForDictation("مدرســـة"), plain);
    assert.equal(normalizeForDictation("‏مدرسة‎"), plain);
    assert.equal(normalizeForDictation("مدرسة."), plain);
    assert.equal(normalizeForDictation("  مدرسة  "), plain);
  });

  it("ignores harakat by default and honours them when asked", () => {
    assert.equal(normalizeForDictation("مَدْرَسَة"), normalizeForDictation("مدرسة"));
    assert.notEqual(
      normalizeForDictation("مَدْرَسَة", { requireTashkeel: true }),
      normalizeForDictation("مدرسة", { requireTashkeel: true }),
    );
  });

  it("returns empty for anything that is not a string", () => {
    for (const v of [null, undefined, 42, {}, []]) {
      assert.equal(normalizeForDictation(v), "");
    }
  });
});

describe("scoreDictation", () => {
  it("is all or nothing within one word", () => {
    assert.equal(scoreDictation("مدرسة", "مدرسة").accuracy, 1);
    assert.equal(scoreDictation("مدرسة", "مدرسه").accuracy, 0);
  });

  it("credits whole words in a sentence", () => {
    const score = scoreDictation("ذهب الولد إلى المدرسة", "ذهب الولد الى المدرسة");
    assert.equal(score.expectedWords, 4);
    assert.equal(score.errors, 1);
    assert.equal(score.accuracy, 0.75);
  });

  it("charges a dropped word once, not once per word after it", () => {
    // What index-by-index comparison gets wrong: everything shifts.
    const score = scoreDictation("ذهب الولد إلى المدرسة", "ذهب إلى المدرسة");
    assert.equal(score.errors, 1);
  });

  it("scores an empty key at zero, never at one", () => {
    assert.equal(scoreDictation("", "أي شيء").accuracy, 0);
  });

  it("never returns a negative accuracy", () => {
    const score = scoreDictation("مدرسة", "واحد اثنان ثلاثة أربعة خمسة ستة");
    assert.ok(score.accuracy >= 0);
  });

  it("bounds the words it compares", () => {
    const long = Array.from({ length: 400 }, () => "كلمة").join(" ");
    assert.equal(dictationWords(long).length, 120);
  });
});

describe("spellingDiff names the rule a teacher should reteach", () => {
  it("finds the one letter that differs", () => {
    assert.deepEqual(spellingDiff("مدرسة", "مدرسه"), {
      expected: "ة",
      written: "ه",
      label: "التاء المربوطة والهاء",
    });
  });

  it("names the hamza", () => {
    assert.equal(spellingDiff("أنا", "انا")?.label, "الهمزة");
  });

  it("returns null when the spellings agree", () => {
    assert.equal(spellingDiff("مدرسة", "مدرسة"), null);
  });

  it("does not guess a rule for a whole different word", () => {
    // Naming a rule here would send the teacher after the wrong lesson.
    assert.equal(spellingDiff("مدرسة", "بيت")?.label, null);
  });

  it("writes the teacher's line in Arabic", () => {
    const detail = dictationDetail("مدرسة", "مدرسه", scoreDictation("مدرسة", "مدرسه"));
    assert.match(detail, /مدرسه/);
    assert.match(detail, /مدرسة/);
    assert.match(detail, /التاء المربوطة/);
  });

  it("counts words for a sentence instead of quoting it back", () => {
    const expected = "ذهب الولد إلى المدرسة";
    const written = "ذهب الولد الى المدرسة";
    assert.equal(dictationDetail(expected, written, scoreDictation(expected, written)), "3 من 4 كلمات صحيحة");
  });
});

describe("the dictation question type", () => {
  const mod = QUESTION_TYPES.dictation;

  const write = {
    type: "dictation" as const,
    body: { mode: "write", wordCount: 1 },
    expectedAnswer: { text: "مَدْرَسَة" },
  };
  const choice = {
    type: "dictation" as const,
    body: {
      mode: "choice",
      options: [
        { id: "a", text: "مدرسة" },
        { id: "b", text: "مدرسه" },
        { id: "c", text: "مدرصة" },
      ],
    },
    expectedAnswer: { optionIds: ["a"] },
  };

  it("accepts both well-formed modes", () => {
    assert.deepEqual(mod.validate(write), []);
    assert.deepEqual(mod.validate(choice), []);
  });

  it("rejects a missing or inferred mode", () => {
    // A dropped mode must fail loud, not default to write and hand a
    // six-year-old an Arabic keyboard.
    assert.ok(mod.validate({ ...choice, body: { options: choice.body.options } }).length > 0);
  });

  it("rejects an answer key parked in a choice question", () => {
    const errors = mod.validate({ ...choice, expectedAnswer: { optionIds: ["a"], text: "مدرسة" } });
    assert.ok(errors.some(e => e.includes("expectedAnswer.text")));
  });

  it("rejects a non-https audio url", () => {
    // It becomes an <audio src> on a student device.
    const errors = mod.validate({ ...write, body: { ...write.body, audioUrl: "http://evil.example/x.wav" } });
    assert.ok(errors.some(e => e.includes("https")));
  });

  it("accepts a question with no audio at all", () => {
    // Absent audio means the teacher reads it aloud — the normal case, and the
    // only one that works on a native device.
    assert.deepEqual(mod.validate(write), []);
  });

  it("catches a wordCount that disagrees with the text", () => {
    const errors = mod.validate({ ...write, body: { mode: "write", wordCount: 3 } });
    assert.ok(errors.some(e => e.includes("wordCount")));
  });

  it("never hands the student the spelling in write mode", () => {
    const projected = JSON.stringify(mod.sanitizeForStudent(write));
    assert.doesNotMatch(projected, /مَدْرَسَة|مدرسة/);
  });

  it("hands the student the options in choice mode, and nothing else", () => {
    const projected = mod.sanitizeForStudent(choice) as Record<string, unknown>;
    assert.equal((projected["options"] as unknown[]).length, 3);
    assert.equal(projected["text"], undefined);
  });

  it("marks a written answer strictly", () => {
    assert.equal(mod.grade!(write, { text: "مدرسة" }).status, "correct");
    assert.equal(mod.grade!(write, { text: "مدرسه" }).status, "incorrect");
    assert.equal(mod.grade!(write, { text: "   " }).status, "unanswered");
  });

  it("marks a tapped spelling", () => {
    assert.equal(mod.grade!(choice, { optionIds: ["a"] }).status, "correct");
    assert.equal(mod.grade!(choice, { optionIds: ["b"] }).status, "incorrect");
    assert.equal(mod.grade!(choice, { optionIds: [] }).status, "unanswered");
  });

  it("is never written by a model", () => {
    assert.equal(mod.mockable, false);
  });
});
