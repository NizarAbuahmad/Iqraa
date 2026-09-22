/**
 * Invariants over the hand-authored bank.
 *
 * A wrong answer key on a spelling question is the worst thing this product can
 * ship: it is marked deterministically, with no teacher in the loop, and the
 * child is told their correct spelling is wrong. None of these assertions can
 * prove a word is spelled right — only a person can — but each one rules out a
 * whole class of authoring slip that review misses at the fiftieth word.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeArabic } from "@workspace/curriculum";
import { SPELLING_RULES, rulesForGrade, rulesForLesson } from "../rules.ts";
import { takeSpellingItems } from "../items.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

/** Strict normalisation, mirroring `modules/assessment/dictation.ts`. */
function strict(s: string): string {
  return s.normalize("NFKC").replace(/[ً-ْٰ]/g, "").replace(/ـ/g, "").trim();
}

/** Character-level Levenshtein, for "is this a near miss or a different word". */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        prev[j]! + 1,
        curr[j - 1]! + 1,
      );
    }
    prev = curr;
  }
  return prev[b.length]!;
}

describe("every rule is well formed", () => {
  it("has unique ids", () => {
    const ids = SPELLING_RULES.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  for (const rule of SPELLING_RULES) {
    describe(rule.id, () => {
      it("names itself, its rule and its lessons", () => {
        assert.ok(rule.nameAr.trim(), "nameAr is empty");
        assert.ok(rule.ruleAr.trim().length > 40, "ruleAr is too short to be the rule");
        assert.ok(rule.grades.length > 0, "belongs to no grade");
        assert.ok(rule.lessonIds.length > 0, "anchored to no lesson");
        assert.ok(rule.words.length >= 8, `only ${rule.words.length} words — too few to build a worksheet`);
      });

      it("spells every word with harakat", () => {
        // Not pedantry. The grades that learn these rules read vowelled text,
        // and an unvowelled word cannot be read aloud correctly — «كتب» is
        // كَتَبَ or كُتُب and the letters do not say which. A spoken dictation
        // prompt built from an unvowelled word asks the wrong question.
        for (const w of rule.words) {
          assert.match(w.correct, /[ً-ْ]/, `«${w.correct}» carries no harakat`);
        }
      });

      it("never lists a misspelling that is the correct spelling", () => {
        // The catastrophic slip: a distractor that is right makes a multiple
        // choice with two correct options, and marks the child wrong whichever
        // they pick.
        for (const w of rule.words) {
          for (const bad of w.wrong) {
            assert.notEqual(strict(bad), strict(w.correct), `«${bad}» IS the spelling of «${w.correct}»`);
          }
        }
      });

      it("never lists a misspelling that another word spells correctly", () => {
        const corrects = new Set(rule.words.map(w => strict(w.correct)));
        for (const w of rule.words) {
          for (const bad of w.wrong) {
            assert.ok(
              !corrects.has(strict(bad)),
              `«${bad}» is a distractor for «${w.correct}» and the answer to another word`,
            );
          }
        }
      });

      it("keeps every misspelling a near miss, not a different word", () => {
        // A distractor three edits away is not tempting, so it measures
        // nothing — and is usually a typo in the bank rather than a mistake a
        // child makes.
        for (const w of rule.words) {
          for (const bad of w.wrong) {
            const d = editDistance(strict(w.correct), strict(bad));
            assert.ok(d >= 1 && d <= 2, `«${bad}» is ${d} edits from «${w.correct}»`);
          }
        }
      });

      it("has no duplicate words", () => {
        const seen = rule.words.map(w => strict(w.correct));
        assert.equal(new Set(seen).size, seen.length, "the same word appears twice");
      });

      it("puts each word in its own sentence where it has one", () => {
        for (const w of rule.words) {
          if (!w.sentenceAr) continue;
          assert.ok(
            strict(w.sentenceAr).includes(strict(w.correct).replace(/[ًٌٍَُِّْ]/g, "")),
            `«${w.sentenceAr}» does not contain «${w.correct}»`,
          );
        }
      });
    });
  }
});

describe("the bank is anchored to curriculum that exists", () => {
  /** Lesson ids present in one Arabic book, by `g<n>s<n>` key. */
  const lessonsByBook = new Map<string, Set<string>>();
  for (let grade = 1; grade <= 7; grade++) {
    for (const semester of [1, 2]) {
      const file = path.join(
        repoRoot,
        `lib/curriculum/src/data/iqra_curriculum_g${grade}_arabic_sem${semester}.json`,
      );
      let raw: string;
      try {
        raw = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const parsed = JSON.parse(raw) as { units?: { lessons?: { id?: string }[] }[] };
      const ids = new Set<string>();
      for (const unit of parsed.units ?? []) {
        for (const lesson of unit.lessons ?? []) {
          if (lesson.id) ids.add(lesson.id);
        }
      }
      lessonsByBook.set(`g${grade}s${semester}`, ids);
    }
  }

  it("found the Arabic books to check against", () => {
    // Guards the test itself: an empty map would make every assertion below
    // trivially true, which is how a renamed data file goes unnoticed.
    assert.ok(lessonsByBook.size >= 12, `only ${lessonsByBook.size} Arabic books found`);
  });

  for (const rule of SPELLING_RULES) {
    it(`${rule.id} points at real lessons`, () => {
      for (const ref of rule.lessonIds) {
        const [book, lessonId] = ref.split(":");
        assert.ok(book && lessonId, `«${ref}» is not g<grade>s<semester>:<lessonId>`);
        const ids = lessonsByBook.get(book);
        assert.ok(ids, `no Arabic book ${book}`);
        assert.ok(ids.has(lessonId), `${book} has no lesson ${lessonId}`);
      }
    });
  }

  it("claims a grade for every book it anchors to", () => {
    for (const rule of SPELLING_RULES) {
      for (const ref of rule.lessonIds) {
        const grade = Number(ref.slice(1, ref.indexOf("s")));
        assert.ok(
          rule.grades.includes(grade),
          `${rule.id} anchors to ${ref} but does not list grade ${grade}`,
        );
      }
    }
  });
});

describe("why this bank cannot be graded by normalizeArabic", () => {
  it("the shared normaliser folds the errors these rules test", () => {
    // The evidence, rule by rule, for the second comparator: every pair here is
    // a spelling mistake that `normalizeArabic` calls correct. If this ever
    // finds nothing, the shared normaliser changed — check it, not this test.
    const folded = SPELLING_RULES.flatMap(rule =>
      rule.words.flatMap(w =>
        w.wrong
          .filter(bad => normalizeArabic(bad) === normalizeArabic(w.correct))
          .map(bad => `${rule.id}: ${bad} = ${w.correct}`),
      ),
    );
    assert.ok(folded.length >= 20, `only ${folded.length} pairs fold — expected most of the bank`);
  });
});

describe("lookups", () => {
  it("finds rules by grade", () => {
    assert.ok(rulesForGrade(2).length > 0);
    assert.equal(rulesForGrade(9).length, 0, "grade 9 teaches writing genres, not spelling");
  });

  it("finds rules by lesson", () => {
    assert.ok(rulesForLesson("g2s1:u3_l4").some(r => r.id === "hamza-wasl-qat"));
    assert.equal(rulesForLesson("g2s1:u1_l1").length, 0);
  });
});

describe("takeSpellingItems", () => {
  const rule = SPELLING_RULES[0]!;

  it("is deterministic", () => {
    // A teacher who regenerates a worksheet and gets a different paper cannot
    // check the one they printed.
    assert.deepEqual(
      takeSpellingItems(rule, 6, { seed: 42 }),
      takeSpellingItems(rule, 6, { seed: 42 }),
    );
  });

  it("varies with the seed", () => {
    assert.notDeepEqual(
      takeSpellingItems(rule, 6, { seed: 1 }),
      takeSpellingItems(rule, 6, { seed: 2 }),
    );
  });

  it("asks about a different word each time", () => {
    const items = takeSpellingItems(rule, 8, { seed: 3 });
    const asked = items.map(i => JSON.stringify(i.body) + JSON.stringify(i.expectedAnswer));
    assert.equal(new Set(asked).size, asked.length, "the same word was asked twice");
  });

  it("returns what it has rather than padding with repeats", () => {
    const items = takeSpellingItems(rule, 500, { seed: 4 });
    assert.ok(items.length <= rule.words.length);
    assert.ok(items.length >= 8);
  });

  it("honours the kinds asked for", () => {
    const items = takeSpellingItems(rule, 4, { kinds: ["write"], seed: 5 });
    assert.ok(items.every(i => i.type === "dictation" && i.body["mode"] === "write"));
  });

  it("never builds a choice with a duplicate option", () => {
    for (const r of SPELLING_RULES) {
      for (let seed = 1; seed <= 20; seed++) {
        for (const item of takeSpellingItems(r, r.words.length, { kinds: ["choose", "tap"], seed })) {
          const texts = (item.body["options"] as { text: string }[]).map(o => o.text);
          assert.equal(new Set(texts).size, texts.length, `duplicate option in ${r.id} at seed ${seed}`);
        }
      }
    }
  });

  it("always marks exactly one option correct, and it is the right one", () => {
    for (const r of SPELLING_RULES) {
      for (let seed = 1; seed <= 20; seed++) {
        for (const item of takeSpellingItems(r, r.words.length, { kinds: ["choose", "tap"], seed })) {
          const options = item.body["options"] as { id: string; text: string }[];
          const keyed = item.expectedAnswer["optionIds"] as string[];
          assert.equal(keyed.length, 1);
          const answer = options.find(o => o.id === keyed[0]);
          assert.ok(answer, "the key names an option that is not there");
          const known = r.words.some(w => strict(w.correct) === strict(answer.text));
          assert.ok(known, `«${answer.text}» is marked correct but is not a spelling in ${r.id}`);
        }
      }
    }
  });

  it("does not always answer خطأ on a judge item", () => {
    // A worksheet whose every true/false answer is "wrong" teaches the pattern,
    // not the rule.
    const values = takeSpellingItems(SPELLING_RULES[0]!, 12, { kinds: ["judge"], seed: 7 })
      .map(i => i.expectedAnswer["value"]);
    assert.ok(values.includes(true) && values.includes(false), "every judge item has the same answer");
  });
});
