/**
 * Every question the spelling bank generates must survive the real registry.
 *
 * `@workspace/arabic-spelling` mirrors `QuestionDraft` rather than importing
 * it — it is bundled into the phone app too, and the assessment module pulls in
 * `@workspace/db`. The copy is three field names and it is fine. The *drift* is
 * not, and it is silent in the worst way: a bank that emits a body the registry
 * rejects produces a worksheet that fails to save, or worse, an option shape
 * the grader reads differently from the shape the student was shown.
 *
 * So this runs the generator over every rule, at every kind, across a spread of
 * seeds, and puts each result through the same `validate` a teacher's own
 * question goes through. It lives here rather than in the package because this
 * is the side that already depends on both.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SPELLING_RULES, takeSpellingItems } from "@workspace/arabic-spelling";
import type { SpellingItemKind } from "@workspace/arabic-spelling";
import { QUESTION_TYPES, type QuestionDraft } from "../questionTypes.ts";

const KINDS: SpellingItemKind[] = ["choose", "judge", "write", "tap"];

describe("the spelling bank emits questions the registry accepts", () => {
  it("has rules to check", () => {
    // Guards the test itself — an empty bank would pass every loop below.
    assert.ok(SPELLING_RULES.length >= 3, "the bank looks empty");
  });

  for (const rule of SPELLING_RULES) {
    for (const kind of KINDS) {
      it(`${rule.id} / ${kind}`, () => {
        for (let seed = 1; seed <= 25; seed++) {
          // Zero items is a legitimate answer for a kind this rule cannot
          // support. الألف الفارقة admits exactly one plausible misspelling per
          // word, so no word makes a three-option question, and padding one out
          // with a distractor from another rule was the bug that produced
          // «أرجو | ارجو | أرجوا» — an alif-fariqa question testing hamza.
          // The vacuity guard moved down to "the rule produces something".
          for (const item of takeSpellingItems(rule, rule.words.length, { kinds: [kind], seed })) {
            const draft = item as QuestionDraft;
            const errors = QUESTION_TYPES[draft.type].validate(draft);
            assert.deepEqual(
              errors,
              [],
              `${rule.id} ${kind} seed ${seed}: ${errors.join(", ")}\n${JSON.stringify(item)}`,
            );
          }
        }
      });
    }

    it(`${rule.id} produces questions at all`, () => {
      // The guard the per-kind loops gave up, kept where it is actually true: a
      // rule that supports no kind at all is broken, however valid its silence
      // is for any one kind. This is what caught the rotation sticking on an
      // unsupported kind and returning an empty grade 3 worksheet.
      const earliest = Math.min(...rule.grades);
      for (const grade of [undefined, earliest, Math.max(...rule.grades)]) {
        const items = takeSpellingItems(rule, 8, { seed: 3, grade });
        assert.ok(
          items.length >= 5,
          `${rule.id} produced ${items.length} questions for grade ${String(grade)}`,
        );
      }
    });
  }
});

describe("the generated key marks the generated answer correct", () => {
  /**
   * The assertion that matters most. A bank whose questions validate but whose
   * keys are wrong is worse than no bank at all: it marks deterministically,
   * with no teacher in the loop, and tells a child their correct spelling is
   * wrong. So mark each question with its own answer and require full marks.
   */
  for (const rule of SPELLING_RULES) {
    it(`${rule.id} marks its own answers correct`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        for (const item of takeSpellingItems(rule, rule.words.length, { seed })) {
          const draft = item as QuestionDraft;
          const mod = QUESTION_TYPES[draft.type];
          assert.ok(mod.grade, `${draft.type} must be self-marking`);

          const response = draft.type === "true_false"
            ? { value: draft.expectedAnswer["value"] }
            : draft.expectedAnswer["optionIds"]
              ? { optionIds: draft.expectedAnswer["optionIds"] }
              : { text: draft.expectedAnswer["text"] };

          const result = mod.grade(draft, response as Record<string, unknown>);
          assert.equal(
            result.status,
            "correct",
            `${rule.id} seed ${seed} marked its own key ${result.status}: ${JSON.stringify(item)}`,
          );
        }
      }
    });
  }

  it("marks a listed misspelling wrong", () => {
    // The other direction: a grader that accepts everything would pass the
    // loop above and measure nothing.
    for (const rule of SPELLING_RULES) {
      for (const word of rule.words) {
        const draft: QuestionDraft = {
          type: "dictation",
          body: { mode: "write" },
          expectedAnswer: { text: word.correct },
        };
        for (const bad of word.wrong) {
          const result = QUESTION_TYPES.dictation.grade!(draft, { text: bad });
          assert.equal(
            result.status,
            "incorrect",
            `«${bad}» was accepted for «${word.correct}» in ${rule.id}`,
          );
        }
      }
    }
  });
});
