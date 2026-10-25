/**
 * The site Q&A bot's fixed-answer matcher.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/siteAskMatch.test.ts
 *
 * The matcher is pure and conservative: a question is answered from the
 * reviewed list only when it clearly means one entry, and falls through to the
 * AI path otherwise. These tests use a small fixture list of their own and
 * import nothing but the module under test.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MATCH_MIN_MARGIN,
  MATCH_MIN_SCORE,
  detectLanguage,
  matchCurated,
  normalizeText,
  pickAnswer,
  tokenize,
} from "../siteAskMatch.ts";
import type { CuratedEntry } from "../siteAskMatch.ts";

const FIX: CuratedEntry[] = [
  { id: "price", phrases: ["هل استخدام إقرأ مجاني", "كم السعر", "ببلاش", "is iqraa free", "price", "how much does it cost"], ar: "A-price", en: "E-price" },
  { id: "what", phrases: ["ما هو إقرأ", "إقرأ", "what is iqraa", "tell me about iqraa"], ar: "A-what", en: "E-what" },
  { id: "android", phrases: ["هل يوجد تطبيق أندرويد", "تطبيق اندرويد", "android app", "play store"], ar: "A-android", en: "E-android" },
  { id: "grades", phrases: ["ما الصفوف والمواد المتاحة", "اي صفوف", "which grades", "which subjects"], ar: "A-grades", en: "E-grades" },
];

/** Dice over token sets, computed here from `tokenize` so a test can prove its own arithmetic. */
function dice(a: string, b: string): number {
  const qa = new Set(tokenize(a));
  const qb = new Set(tokenize(b));
  if (qa.size === 0 || qb.size === 0) return 0;
  let shared = 0;
  for (const t of qa) if (qb.has(t)) shared++;
  return (2 * shared) / (qa.size + qb.size);
}

const idOf = (message: string, entries: readonly CuratedEntry[] = FIX) => matchCurated(message, entries)?.entry.id ?? null;

describe("constants", () => {
  it("pins the thresholds", () => {
    assert.equal(MATCH_MIN_SCORE, 0.5);
    assert.equal(MATCH_MIN_MARGIN, 0.15);
  });
});

describe("normalizeText", () => {
  it("removes diacritics and tatweel", () => {
    assert.equal(normalizeText("مُحَمَّدٌ"), "محمد");
    assert.equal(normalizeText("إقـــرأ"), "اقرا");
    assert.equal(normalizeText("اللهٰ"), "الله");
  });

  it("folds alef forms to bare alef", () => {
    assert.equal(normalizeText("أ إ آ ٱ"), "ا ا ا ا");
  });

  it("folds ya, ta marbuta, waw-hamza and ya-hamza", () => {
    assert.equal(normalizeText("على"), "علي");
    assert.equal(normalizeText("مدرسة"), "مدرسه");
    assert.equal(normalizeText("مسؤول"), "مسوول");
    assert.equal(normalizeText("قائمة"), "قايمه");
  });

  it("maps Arabic-Indic and extended Arabic-Indic digits to ASCII", () => {
    assert.equal(normalizeText("١٢٣٤٥٦٧٨٩٠"), "1234567890");
    assert.equal(normalizeText("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
    assert.equal(normalizeText("الصف ١٠"), "الصف 10");
  });

  it("turns punctuation into single spaces and trims", () => {
    assert.equal(normalizeText("a؟b!c.d،e"), "a b c d e");
    assert.equal(normalizeText("  ؟؟ hello ،، world !!  "), "hello world");
    assert.equal(normalizeText("؟!.،"), "");
    assert.equal(normalizeText(""), "");
  });

  it("deletes apostrophes instead of splitting the word", () => {
    assert.equal(normalizeText("what's"), "whats");
    assert.equal(normalizeText("it\u2019s"), "its");
    assert.equal(normalizeText("rock 'n' roll"), "rock n roll");
  });

  it("lowercases", () => {
    assert.equal(normalizeText("HeLLo IQRAA"), "hello iqraa");
  });

  it("is idempotent", () => {
    for (const x of ["مُحَمَّدٌ؟", "إقـــرأ ١٢٣ !", "Is Iqraa FREE?", "what\u2019s it's", "على مدرسة مسؤول", "", "؟؟"]) {
      assert.equal(normalizeText(normalizeText(x)), normalizeText(x));
    }
  });
});

describe("tokenize", () => {
  it("removes Arabic and English stopwords", () => {
    assert.deepEqual(tokenize("هل ما هو سعر"), ["سعر"]);
    assert.deepEqual(tokenize("how do I get the price"), ["get", "price"]);
    assert.deepEqual(tokenize("what is it"), []);
  });

  it("strips one Arabic prefix", () => {
    assert.deepEqual(tokenize("الصفوف"), ["صفوف"]);
    assert.deepEqual(tokenize("للمعلمين"), ["معلمين"]);
    assert.deepEqual(tokenize("والمواد"), ["مواد"]);
    assert.deepEqual(tokenize("بالتطبيق"), ["تطبيق"]);
  });

  it("drops a token that is a stopword once its prefix is stripped", () => {
    assert.deepEqual(tokenize("اللي"), []);
    assert.deepEqual(tokenize("الان"), []);
    assert.deepEqual(tokenize("اللي سعر"), ["سعر"]);
    assert.deepEqual(tokenize("للمعلمين"), ["معلمين"]);
  });

  it("keeps a token whose remainder after the prefix would be under 2 letters", () => {
    assert.deepEqual(tokenize("الف"), ["الف"]);
    assert.deepEqual(tokenize("لله"), ["لله"]);
  });

  it("strips an English plural, but not -ss or short words", () => {
    assert.deepEqual(tokenize("teachers"), ["teacher"]);
    assert.deepEqual(tokenize("class"), ["class"]);
    assert.deepEqual(tokenize("bus"), ["bus"]);
  });

  it("keeps the product name", () => {
    assert.deepEqual(tokenize("إقرأ"), ["اقرا"]);
    assert.deepEqual(tokenize("Iqraa"), ["iqraa"]);
  });

  it("collapses duplicates, keeping first-seen order", () => {
    assert.deepEqual(tokenize("teacher teachers Teacher"), ["teacher"]);
    assert.deepEqual(tokenize("سعر السعر سعر"), ["سعر"]);
    assert.deepEqual(tokenize("beta alpha beta"), ["beta", "alpha"]);
  });

  it("returns [] for empty and punctuation-only input", () => {
    assert.deepEqual(tokenize(""), []);
    assert.deepEqual(tokenize("؟! ... ،،"), []);
  });
});

describe("detectLanguage", () => {
  it("detects Arabic", () => {
    assert.equal(detectLanguage("هل التطبيق مجاني؟"), "ar");
  });
  it("detects English", () => {
    assert.equal(detectLanguage("is it free?"), "en");
  });
  it("treats any Arabic letter as Arabic", () => {
    assert.equal(detectLanguage("هل Android متاح"), "ar");
  });
  it("defaults an empty message to Arabic", () => {
    assert.equal(detectLanguage(""), "ar");
  });
  it("treats digits and punctuation alone as English", () => {
    assert.equal(detectLanguage("123 ?!"), "en");
  });
});

describe("matchCurated — hits", () => {
  it("matches every fixture phrase exactly, to its own entry, with score 1", () => {
    for (const entry of FIX) {
      for (const phrase of entry.phrases) {
        const hit = matchCurated(phrase, FIX);
        assert.ok(hit, `no match for: ${phrase}`);
        assert.equal(hit.entry.id, entry.id, `wrong entry for: ${phrase}`);
        assert.equal(hit.score, 1, `score for: ${phrase}`);
      }
    }
  });

  it("ignores diacritics", () => {
    assert.equal(idOf("هَل يُوجَد تَطبِيق أَندرُويد"), "android");
  });

  it("ignores alef, ya and ta-marbuta spelling differences", () => {
    assert.equal(idOf("هل استخدام اقرا مجانى"), "price");
    assert.equal(idOf("ما الصفوف والمواد المتاحه"), "grades");
    assert.equal(idOf("هل يوجد تطبيق اندرويد"), "android");
    assert.equal(idOf("آقرأ"), "what");
  });

  it("ignores extra stopwords and a trailing question mark", () => {
    assert.equal(idOf("هل ممكن هل يوجد تطبيق أندرويد؟"), "android");
    assert.equal(idOf("ما هو إقرأ؟"), "what");
    assert.equal(idOf("can you tell me please what is iqraa?"), "what");
    assert.equal(idOf("is iqraa free?"), "price");
    assert.equal(idOf("Which grades?"), "grades");
  });

  it("ignores English case", () => {
    assert.equal(idOf("IS IQRAA FREE"), "price");
    assert.equal(idOf("What Is Iqraa"), "what");
    assert.equal(idOf("Android APP"), "android");
    assert.equal(idOf("HOW MUCH DOES IT COST"), "price");
  });

  it("matches the short dialect word", () => {
    const hit = matchCurated("ببلاش؟", FIX);
    assert.ok(hit);
    assert.equal(hit.entry.id, "price");
  });

  it("still matches with an apostrophe in the question", () => {
    assert.equal(idOf("what's iqraa?"), "what");
    assert.equal(idOf("What\u2019s Iqraa"), "what");
  });

  it("drops «اللي» as filler and matches for the right reason", () => {
    assert.deepEqual(tokenize("اللي هو إقرأ"), ["اقرا"]);
    const hit = matchCurated("اللي هو إقرأ", FIX);
    assert.ok(hit);
    assert.equal(hit.entry.id, "what");
    assert.equal(hit.score, 1);
  });

  it("accepts a score of exactly 0.5: «مجاني؟» is one of four tokens in the price phrase", () => {
    const hit = matchCurated("مجاني؟", FIX);
    assert.ok(hit);
    assert.equal(hit.entry.id, "price");
    assert.equal(hit.score, MATCH_MIN_SCORE);
  });

  it("treats exactly MATCH_MIN_SCORE as a hit and a hair below it as a miss", () => {
    // Made-up words, so nothing else in a list can share a token with them.
    // Every query word is also in the entry's vocabulary (in a low-scoring
    // second phrase), so the unknown-word veto stays out of the way and only
    // the score decides.
    //
    // At: Q = {alpha beta}, P = {alpha gamma}; shared 1, sizes 2+2 → 2*1/4 = 0.5 exactly.
    // The other phrase {beta delta epsilon zeta} scores 2*1/6 ≈ 0.333 against Q.
    const at: CuratedEntry[] = [{ id: "e", phrases: ["alpha gamma", "beta delta epsilon zeta"], ar: "a", en: "e" }];
    assert.equal(dice("alpha beta", "alpha gamma"), 0.5);
    assert.ok(dice("alpha beta", "beta delta epsilon zeta") < 0.5);
    const hit = matchCurated("alpha beta", at);
    assert.ok(hit);
    assert.equal(hit.score, 0.5);
    assert.equal(hit.score, MATCH_MIN_SCORE);

    // Below: Q has 6 tokens, P has 7, shared 3 → 2*3/13 ≈ 0.4615. Q's other
    // three words live in a second phrase (8 tokens, shared 3 → 6/14 ≈ 0.4286).
    const q = "alpha beta gamma delta epsilon zeta";
    const p = "alpha beta gamma eta theta iota kappa";
    const other = "delta epsilon zeta lambda mu nu xi omicron";
    assert.equal(tokenize(q).length, 6);
    assert.equal(tokenize(p).length, 7);
    assert.equal(tokenize(other).length, 8);
    assert.ok(Math.abs(dice(q, p) - 6 / 13) < 1e-12);
    assert.ok(Math.abs(dice(q, other) - 6 / 14) < 1e-12);
    assert.ok(Math.max(dice(q, p), dice(q, other)) < MATCH_MIN_SCORE);
    const vocabulary = new Set([...tokenize(p), ...tokenize(other)]);
    for (const t of tokenize(q)) assert.ok(vocabulary.has(t), `${t} must be known, so the score decides`);
    const below: CuratedEntry[] = [{ id: "e", phrases: [p, other], ar: "a", en: "e" }];
    assert.equal(matchCurated(q, below), null);
  });
});

describe("matchCurated — misses", () => {
  it("returns null for off-topic questions", () => {
    assert.equal(matchCurated("what is the capital of France", FIX), null);
    assert.equal(matchCurated("من فاز بكأس العالم", FIX), null);
  });

  it("returns null for a long question that merely contains the brand", () => {
    assert.equal(matchCurated("هل إقرأ أفضل من شات جي بي تي في كتابة الشعر", FIX), null);
    assert.equal(matchCurated("is iqraa better than chatgpt at writing poetry for my class tomorrow", FIX), null);
  });

  it("returns null for gibberish", () => {
    assert.equal(matchCurated("asdkjh qwlkej zxcmnb", FIX), null);
    assert.equal(matchCurated("ظظظ ضضض غغغ", FIX), null);
  });

  it("returns null for empty, whitespace, stopword-only and punctuation-only messages", () => {
    assert.equal(matchCurated("", FIX), null);
    assert.equal(matchCurated("   ", FIX), null);
    assert.equal(matchCurated("؟!؟", FIX), null);
    assert.equal(matchCurated("... ,,, ???", FIX), null);
    assert.equal(matchCurated("هل ما هو", FIX), null);
  });

  it("returns null for a known question frame about something no answer was written for", () => {
    // Each of these scored 0.5-0.8 on Dice alone and got a wrong fixed answer.
    for (const m of [
      "how much does chatgpt cost",
      "is chatgpt free",
      "what is the price of chatgpt",
      "is iqraa not free",
      "هل إقرأ آمن",
      "is iqraa safe",
      "هل يوجد تطبيق ايفون",
      "هل إقرأ آمن للأطفال",
    ]) {
      assert.equal(matchCurated(m, FIX), null, m);
    }
  });

  it("returns null for an empty entries list", () => {
    assert.equal(matchCurated("is iqraa free", []), null);
  });

  it("ignores an entry whose phrases are all empty", () => {
    const entries: CuratedEntry[] = [
      { id: "blank", phrases: ["", "؟", "هل"], ar: "a", en: "e" },
      { id: "none", phrases: [], ar: "a", en: "e" },
    ];
    assert.equal(matchCurated("is iqraa free", entries), null);
  });
});

describe("matchCurated — ambiguity", () => {
  it("returns null when two entries share an identical phrase", () => {
    const entries: CuratedEntry[] = [
      { id: "one", phrases: ["refund policy"], ar: "a1", en: "e1" },
      { id: "two", phrases: ["refund policy"], ar: "a2", en: "e2" },
    ];
    assert.equal(matchCurated("refund policy", entries), null);
  });

  // Q has 7 tokens. The best entry holds Q verbatim (score 1). The runner-up
  // shares part of Q, so its score is set by how much it shares and how long it is.
  const Q = "alpha beta gamma delta epsilon zeta eta";
  const best: CuratedEntry = { id: "best", phrases: [Q], ar: "a", en: "e" };

  it("returns null when the runner-up is just under the margin behind", () => {
    // Shared 6, P has 7 (one extra word): 2*6/14 = 0.857142…, gap 0.142857… < 0.15.
    const second: CuratedEntry = { id: "second", phrases: ["alpha beta gamma delta epsilon zeta omega"], ar: "a", en: "e" };
    const gap = 1 - dice(Q, second.phrases[0]!);
    assert.ok(Math.abs(gap - 1 / 7) < 1e-12);
    assert.ok(gap < MATCH_MIN_MARGIN);
    assert.equal(matchCurated(Q, [best, second]), null);
    assert.equal(matchCurated(Q, [second, best]), null);
  });

  it("returns the best when the runner-up is just over the margin behind", () => {
    // Shared 5, P has 5: 2*5/12 = 0.8333…, gap 0.1666… >= 0.15.
    const second: CuratedEntry = { id: "second", phrases: ["alpha beta gamma delta epsilon"], ar: "a", en: "e" };
    const gap = 1 - dice(Q, second.phrases[0]!);
    assert.ok(Math.abs(gap - 1 / 6) < 1e-12);
    assert.ok(gap >= MATCH_MIN_MARGIN);
    const hit = matchCurated(Q, [best, second]);
    assert.ok(hit);
    assert.equal(hit.entry.id, "best");
    assert.equal(hit.score, 1);
    assert.equal(matchCurated(Q, [second, best])?.entry.id, "best");
  });

  it("measures the margin between entries, not between one entry's phrases", () => {
    const entries: CuratedEntry[] = [
      { id: "one", phrases: [Q, Q + " omega"], ar: "a", en: "e" },
      { id: "two", phrases: ["theta iota kappa"], ar: "a", en: "e" },
    ];
    assert.equal(matchCurated(Q, entries)?.entry.id, "one");
  });
});

describe("matchCurated — vocabulary veto", () => {
  it("matches a message made only of known words in a new order", () => {
    assert.equal(idOf("free iqraa"), "price");
    assert.equal(idOf("مجاني استخدام إقرأ"), "price");
    assert.equal(idOf("store play"), "android");
  });

  it("refuses the same message once one unknown word is added", () => {
    assert.equal(idOf("free iqraa tomorrow"), null);
    assert.equal(idOf("مجاني استخدام إقرأ جديد"), null);
    assert.equal(idOf("store play offline"), null);
  });

  it("builds the vocabulary from every phrase of every entry", () => {
    const entries: CuratedEntry[] = [
      { id: "one", phrases: ["refund policy", "money back"], ar: "a", en: "e" },
      { id: "two", phrases: ["contact support"], ar: "a", en: "e" },
    ];
    assert.equal(idOf("money back", entries), "one");
    // "support" is only in entry two's phrases, yet it is known, so it does not veto entry one's win.
    assert.equal(idOf("refund policy support", entries), "one");
    assert.equal(idOf("refund policy shipping", entries), null);
  });
});

describe("matchCurated — determinism", () => {
  const messages = ["is iqraa free", "ببلاش؟", "هل يوجد تطبيق أندرويد", "what is iqraa", "which subjects", "اي صفوف", "nonsense words here"];

  it("gives the same winner for any order of entries", () => {
    const orders: CuratedEntry[][] = [
      [...FIX],
      [...FIX].reverse(),
      [FIX[2]!, FIX[0]!, FIX[3]!, FIX[1]!],
      [FIX[1]!, FIX[3]!, FIX[0]!, FIX[2]!],
    ];
    for (const m of messages) {
      const expected = idOf(m, FIX);
      for (const order of orders) assert.equal(idOf(m, order), expected, m);
    }
  });

  it("returns equal results when called twice", () => {
    for (const m of messages) {
      assert.deepEqual(matchCurated(m, FIX), matchCurated(m, FIX));
    }
  });

  it("does not mutate its inputs", () => {
    const copy = JSON.parse(JSON.stringify(FIX));
    matchCurated("is iqraa free", FIX);
    assert.deepEqual(FIX, copy);
  });
});

describe("pickAnswer", () => {
  const price = FIX[0]!;
  it("answers an Arabic question in Arabic", () => {
    assert.equal(pickAnswer(price, "هل التطبيق مجاني؟"), "A-price");
  });
  it("answers an English question in English", () => {
    assert.equal(pickAnswer(price, "is it free?"), "E-price");
  });
  it("answers a mixed question in Arabic", () => {
    assert.equal(pickAnswer(price, "هل Android مجاني"), "A-price");
  });
});
