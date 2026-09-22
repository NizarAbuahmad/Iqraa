/**
 * Scoring a dictation (إملاء): did the student write the word the way Arabic
 * spells it?
 *
 * ## The one rule this file exists to enforce
 *
 * **Never grade dictation through `normalizeArabic`** (`@workspace/curriculum`,
 * re-exported by `./normalize.ts`) or anything built on it — `answersMatch`,
 * `matchesAny`. It folds `أإآٱ → ا`, `ة → ه`, `ى → ي` and strips every haraka,
 * which is exactly the set of distinctions إملاء is taught and examined on.
 * A dictation graded through it marks «مدرسه» correct for «مدرسة»: a spelling
 * test that cannot detect a spelling error.
 *
 * That folding is right where it lives. A student who writes a maths answer
 * «اجابه» instead of «إجابة» has the maths right, and marking it wrong destroys
 * a teacher's trust in the whole level. Here the spelling IS the answer, so the
 * same fold is the bug. Two normalisers, on purpose — `dictation.test.ts` pins
 * that they disagree, so nobody can helpfully merge them later.
 *
 * **Nor through `normalizeForReading`** (`./readAloud.ts`). Its
 * `[^\p{L}\p{N}'\s]` replacement treats harakat as punctuation — they are
 * `\p{Mn}`, not `\p{L}` — and substitutes a space for each, so «مَدْرَسَة»
 * comes back as six one-letter tokens.
 *
 * ## What it does fold
 *
 * Only things that are not spelling: the same letter arriving from two
 * keyboards, and marks a student cannot see. Everything a teacher would circle
 * in red is preserved.
 *
 * ## No partial credit inside a word
 *
 * A misspelled word in إملاء is wrong. Half marks for «مدرسه» teach a child
 * that the tied taa is optional, which is the opposite of the lesson. Credit is
 * per whole word, and only a multi-word dictation can score in between.
 */
import { wordDistance } from "./readAloud.ts";

/**
 * Words compared after this are not compared at all — see `MAX_WORDS` in
 * `readAloud.ts` for the same reasoning. A dictation is a handful of words or
 * one sentence, so this bound is never reached in practice and exists because
 * the alignment is |expected| × |written| cells on a route whose only identity
 * is a shared link.
 */
export const MAX_DICTATION_WORDS = 120;

/**
 * Harakat and the superscript alef.
 *
 * Deliberately stops at U+0652. U+0653 (maddah), U+0654 (hamza above) and
 * U+0655 (hamza below) look like diacritics and are not: they are the second
 * half of `آ`, `أ` and `إ` in decomposed form. NFKC below composes them into
 * the letter, and stripping them instead would silently turn «أَكَلَ» into
 * «اكل» — the exact error the question is asking about.
 */
const HARAKAT = /[ً-ْٰ]/g;

/** Invisible marks. RTL keyboards and pasted text sprinkle these freely. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

/** Kashida. A stretched letter is a font decision, never a spelling one. */
const TATWEEL = /ـ/g;

/** Sentence-final punctuation. A missing full stop is not a misspelling. */
const TRAILING_PUNCT = /[.،؛؟!?…\s]+$/;

export interface DictationOptions {
  /**
   * Whether the student must type the harakat too.
   *
   * Default false, and it should stay false for primary grades: a child on a
   * phone keyboard cannot produce a haraka without a long-press they have never
   * been shown, so requiring them fails correct answers for a *device* reason.
   * What G1–G7 إملاء actually examines is letter orthography — hamza carriers,
   * tied taa, dotless yaa, the sun lam — and every one of those is a base
   * letter that survives the strip.
   *
   * True is the right setting for tanween on a final alif («كتابًا»), where the
   * haraka is the thing being tested. That is a per-question call, not a policy.
   */
  requireTashkeel?: boolean;
}

/**
 * Normalise for a spelling comparison: strict about letters, forgiving about
 * everything a student cannot control.
 *
 * NFKC first and not NFC: it composes `ا` + U+0654 into `أ` (the same letter
 * from a different keyboard), and additionally folds Arabic Presentation Forms
 * (U+FB50–U+FEFF) and the `ﻻ` ligature back to their base letters, which is
 * what a copy-paste out of a badly-generated PDF produces.
 *
 * What it never folds — the whole point:
 *   `أ إ آ ٱ ا` stay five distinct letters
 *   `ة` and `ه` stay distinct
 *   `ى` and `ي` stay distinct
 *   standalone `ء` is untouched (it is a letter — folding it changes جزء to جز)
 *   digits are not folded across scripts, because in a spelling test they aren't
 *
 * No `toLowerCase()`: a no-op for Arabic, and actively wrong if an English
 * spelling list ever lands here, where case is part of the spelling.
 */
export function normalizeForDictation(raw: unknown, opts: DictationOptions = {}): string {
  if (typeof raw !== "string") return "";
  let s = raw.normalize("NFKC");
  s = s.replace(INVISIBLE, "");
  s = s.replace(TATWEEL, "");
  if (!opts.requireTashkeel) s = s.replace(HARAKAT, "");
  s = s.replace(/ /g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(TRAILING_PUNCT, "");
  return s;
}

/** Split a dictation into whole words, each already strictly normalised. */
export function dictationWords(raw: unknown, opts: DictationOptions = {}): string[] {
  const normalized = normalizeForDictation(raw, opts);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean).slice(0, MAX_DICTATION_WORDS);
}

export interface DictationScore {
  /** Whole words written correctly, over the words dictated. */
  accuracy: number;
  expectedWords: number;
  writtenWords: number;
  /** Insertions + deletions + substitutions against the dictated text. */
  errors: number;
}

/**
 * Compare what the student wrote against what was dictated.
 *
 * Alignment is the word-array Levenshtein already used for read-aloud rather
 * than an index-by-index walk: a child who drops one word of a sentence has
 * made one error, and positional comparison would score every word after it
 * wrong too.
 */
export function scoreDictation(
  expected: string,
  written: unknown,
  opts: DictationOptions = {},
): DictationScore {
  const ref = dictationWords(expected, opts);
  const got = dictationWords(written, opts);

  if (ref.length === 0) {
    // A dictation with no text is a broken question, not a perfect answer.
    // Validation rejects it, so this is belt to that's braces — and it returns
    // 0 rather than 1 so a bug can never hand out full marks.
    return { accuracy: 0, expectedWords: 0, writtenWords: got.length, errors: got.length };
  }

  const errors = wordDistance(ref, got);
  return {
    accuracy: Math.max(0, 1 - errors / ref.length),
    expectedWords: ref.length,
    writtenWords: got.length,
    errors,
  };
}

/**
 * The letters a pair of spellings disagree on, with the error named.
 *
 * Common prefix plus common suffix, report the middle. Not a full edit-distance
 * backtrace: for the errors إملاء is actually about — one letter swapped for
 * its lookalike — the trimmed middle *is* the answer, and it costs twelve lines
 * instead of a matrix. A real backtrace is an upgrade behind this signature if
 * per-letter highlighting is ever asked for.
 *
 * `label` is what turns a mark into something a teacher can act on: «خطأ في
 * التاء المربوطة» tells them which rule to reteach, where a red cross does not.
 */
export interface SpellingDiff {
  /** The letters that should have been written. */
  expected: string;
  /** What the student wrote instead. */
  written: string;
  /** The rule this error belongs to, when the pair names one. */
  label: string | null;
}

/** Confusions a Jordanian primary pupil actually makes, and their rule names. */
const ERROR_CLASSES: ReadonlyArray<{ letters: string; label: string }> = [
  { letters: "ةه", label: "التاء المربوطة والهاء" },
  { letters: "أإآٱا", label: "الهمزة" },
  { letters: "ىي", label: "الألف اللينة" },
  { letters: "ضظ", label: "الضاد والظاء" },
  { letters: "سص", label: "السين والصاد" },
  { letters: "تط", label: "التاء والطاء" },
  { letters: "ذزظ", label: "الذال والزاي" },
  { letters: "قك", label: "القاف والكاف" },
];

function classify(expected: string, written: string): string | null {
  // Only a single-letter-for-single-letter swap is classifiable. Anything
  // longer is a different word, not a confusable pair, and guessing at a rule
  // name for it would send the teacher after the wrong lesson.
  if (expected.length !== 1 || written.length !== 1) return null;
  const found = ERROR_CLASSES.find(c => c.letters.includes(expected) && c.letters.includes(written));
  return found ? found.label : null;
}

export function spellingDiff(expectedRaw: string, writtenRaw: string): SpellingDiff | null {
  const expected = normalizeForDictation(expectedRaw);
  const written = normalizeForDictation(writtenRaw);
  if (!expected || !written || expected === written) return null;

  let start = 0;
  while (start < expected.length && start < written.length && expected[start] === written[start]) {
    start++;
  }
  let end = 0;
  while (
    end < expected.length - start &&
    end < written.length - start &&
    expected[expected.length - 1 - end] === written[written.length - 1 - end]
  ) {
    end++;
  }

  const expectedPart = expected.slice(start, expected.length - end);
  const writtenPart = written.slice(start, written.length - end);
  return { expected: expectedPart, written: writtenPart, label: classify(expectedPart, writtenPart) };
}

/**
 * The line a teacher reads on the marking screen, in Arabic.
 *
 * Arabic because the audience is an Arabic teacher marking Arabic — unlike
 * read-aloud, whose detail is English because its passage is. `gradeAttempt`
 * passes `detail` straight through, so this is what they see.
 */
export function dictationDetail(expected: string, written: unknown, score: DictationScore): string {
  if (score.expectedWords > 1) {
    const right = Math.max(0, score.expectedWords - score.errors);
    return `${right} من ${score.expectedWords} كلمات صحيحة`;
  }
  const writtenText = normalizeForDictation(written);
  const correct = normalizeForDictation(expected);
  if (!writtenText) return `لم تُكتب الكلمة، والصواب «${correct}»`;

  const diff = spellingDiff(expected, String(written));
  const base = `كتب «${writtenText}» والصواب «${correct}»`;
  return diff?.label ? `${base} — خطأ في ${diff.label}` : base;
}
