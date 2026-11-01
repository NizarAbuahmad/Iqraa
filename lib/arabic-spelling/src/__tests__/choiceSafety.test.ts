/**
 * A choice question shows one word's spelling beside its misspellings and no
 * sentence. That is only safe while every misspelling is a non-word: a child who
 * reads «أمن» beside «آمن» is right, and is marked wrong.
 *
 * Found 2026-11-01 by an independent review of the /play spelling game, then
 * measured: about half of the questions the bank could build offered a real word
 * as a wrong option (قلم beside قلمًا, رمي beside رمى, أبني beside ابني). The
 * words that do are marked `dictationOnly`. They stay in the bank and are still
 * asked as dictation (the teacher reads the word, so nothing is ambiguous), and
 * are never built into choose, judge or tap items.
 *
 * Nothing here can prove a word is a non-word — only a person reading the list
 * can, and that is what `dictationOnly` records. What these tests rule out is
 * the mechanical slips: a cross-rule collision, a flagged word leaking back into
 * a choice, a flag with no reason.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SPELLING_RULES } from "../rules.ts";
import { orthographicVariants, takeSpellingItems } from "../items.ts";

const strip = (s: string) => s.normalize("NFKC").replace(/[ً-ٰٟ]/g, "").trim();

const allWords = SPELLING_RULES.flatMap(r => r.words.map(w => ({ rule: r, word: w })));
const flagged = allWords.filter(x => x.word.dictationOnly !== undefined);

/** Every correct spelling in the bank, bare. */
const bankCorrect = new Set(allWords.map(x => strip(x.word.correct)));

describe("a wrong option is never a correct spelling anywhere in the bank", () => {
  for (const rule of SPELLING_RULES) {
    it(rule.id, () => {
      for (const w of rule.words) {
        if (w.dictationOnly !== undefined) continue;
        const own = strip(w.correct);
        const options = [...w.wrong.map(strip), ...orthographicVariants(w.correct, rule.variantClass)];
        for (const o of options) {
          if (o === own) continue;
          assert.ok(!bankCorrect.has(o), `«${o}» is offered beside «${w.correct}» and is the correct spelling of another bank word`);
        }
      }
    });
  }
});

describe("dictationOnly", () => {
  it("is a reason, never a bare flag", () => {
    assert.ok(flagged.length > 0, "no word is flagged: the bank was not reviewed");
    for (const { rule, word } of flagged) {
      assert.equal(typeof word.dictationOnly, "string");
      assert.ok(word.dictationOnly!.trim().length >= 8, `${rule.id} «${word.correct}» has no reason`);
    }
  });

  it("is counted per rule, so a new flag or a removed one is a decision", () => {
    const perRule: Record<string, number> = {};
    for (const { rule } of flagged) perRule[rule.id] = (perRule[rule.id] ?? 0) + 1;
    assert.deepEqual(perRule, {
      "hamza-wasl-qat": 3,
      "alif-fariqa": 5,
      "hamzat-al-madd": 6,
      "hamza-mutawassita": 2,
      "huruf-tuntuq-la-tuktab": 3,
      "nun-sakina-tanwin": 4,
      "hamza-mutarrafa": 1,
      "tanwin-al-fath": 4,
      "alif-layyina-fawq-thulathiya": 3,
      "alif-nihayat-afal-thulathiya": 5,
      "hamza-mutarrafa-tanwin-fath": 5,
      "hathf-hamzat-ibn": 1,
      "hamzat-istifham-ala-wasl": 8,
    });
  });

  it("never reaches a choose, judge or tap item", () => {
    for (const rule of SPELLING_RULES) {
      // Per rule: «جزء» is a flagged word's misspelling in one rule and an ordinary correct word in another.
      const own = flagged.filter(x => x.rule === rule);
      const flaggedCorrect = new Set(own.map(x => strip(x.word.correct)));
      const flaggedShown = new Set(own.flatMap(x => (x.word.wrong[0] ? [strip(x.word.wrong[0])] : [])));
      for (let seed = 1; seed <= 40; seed++) {
        const items = takeSpellingItems(rule, rule.words.length, { kinds: ["choose", "judge", "tap"], seed });
        for (const item of items) {
          if (item.type === "true_false") {
            const shown = strip(/«([^»]+)»/.exec(String(item.body["statement"]))![1]!);
            assert.ok(!flaggedCorrect.has(shown) && !flaggedShown.has(shown), `judge item on flagged word «${shown}» (${rule.id})`);
          } else {
            const options = item.body["options"] as { id: string; text: string }[];
            const keyed = (item.expectedAnswer["optionIds"] as string[])[0]!;
            const answer = options.find(o => o.id === keyed)!.text;
            assert.ok(!flaggedCorrect.has(answer), `choice item on flagged word «${answer}» (${rule.id})`);
          }
        }
      }
    }
  });

  it("is still dictated: every flagged word can come out as a write item", () => {
    for (const rule of SPELLING_RULES) {
      const items = takeSpellingItems(rule, rule.words.length, { kinds: ["write"], seed: 3 });
      assert.equal(items.length, rule.words.length, `${rule.id} lost words from dictation`);
    }
  });

  it("leaves a fully flagged rule with dictation, not an empty worksheet", () => {
    const rule = SPELLING_RULES.find(r => r.id === "hamzat-istifham-ala-wasl")!;
    assert.ok(rule.words.every(w => w.dictationOnly !== undefined));
    const items = takeSpellingItems(rule, 4, { seed: 2 });
    assert.equal(items.length, 4);
    assert.ok(items.every(i => i.type === "dictation" && i.body["mode"] === "write"));
    assert.deepEqual(takeSpellingItems(rule, 4, { kinds: ["choose"], seed: 2 }), []);
  });
});
