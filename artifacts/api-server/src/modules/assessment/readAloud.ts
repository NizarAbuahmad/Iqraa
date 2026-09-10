/**
 * Scoring a read-aloud: how much of a known passage the student actually said.
 *
 * The reference text is printed on the student's screen, so unlike every other
 * open response here there is a right answer to compare against and no
 * judgement to make. That is the whole reason this type exists in the
 * deterministic half of the registry: a model asked "how good was this
 * reading?" is guessing at fluency from a transcript that has already thrown
 * away the pronunciation, and it would return a confident number for it.
 *
 * What this measures is **word accuracy** — the standard word error rate,
 * inverted. Alignment is a Levenshtein edit distance over word arrays, which
 * costs O(reference × spoken) and is the reason `MAX_WORDS` exists.
 *
 * What it deliberately does NOT measure: pronunciation, stress, intonation,
 * pace. Whisper transcribes an accented reading of "three" as "three", so a
 * high score here means "said the right words in the right order", not "spoke
 * well". Anything claiming the latter needs audio features this pipeline does
 * not have, and saying so plainly is better than a number that implies it.
 *
 * Word-level, not character-level, because character distance rewards a
 * near-miss inside a long word and punishes a short correct one; and ordered,
 * not set-based, because `stemSimilarity` in `validator.ts` is Jaccard — under
 * it, a student reading the passage backwards scores a perfect 1.0.
 */

/**
 * Words compared after this are not compared at all.
 *
 * The alignment matrix is |reference| × |spoken| cells, so an unbounded
 * transcript against an unbounded passage is a denial-of-service vector on a
 * route whose only identity is a shared link. 600 words is roughly four
 * minutes of read-aloud — far beyond any sensible task — and truncating is
 * safe because the score is a ratio: a student who reads the first 600 words
 * correctly scores 1.0 either way.
 */
export const MAX_WORDS = 600;

/**
 * Split into comparable words.
 *
 * Punctuation goes, because a reader does not say it and Whisper's decision to
 * write "don't" or "do not", "Mr." or "Mr", is not the student's doing.
 * Case goes for the same reason. Digits are kept as written rather than
 * spelled out: "1990" read aloud comes back from Whisper as "1990" far more
 * often than as "nineteen ninety", and a passage that turns on numbers is a
 * poor read-aloud passage anyway.
 *
 * Apostrophes inside a word survive so "we're" stays one token rather than
 * becoming "we" + "re", which would score a correct contraction as two errors.
 */
export function normalizeForReading(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    // Curly apostrophes to straight, so the same contraction from two sources
    // is one token. Whisper emits ’ and a pasted passage usually has '.
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    // A leading or trailing apostrophe is punctuation, not part of the word.
    .replace(/(^|\s)'+|'+(?=\s|$)/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Levenshtein distance over two word arrays.
 *
 * Two rows rather than a full matrix: only the previous row is ever read, and
 * at MAX_WORDS a full matrix is 360,000 numbers for no benefit.
 */
function wordDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitution = prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = prev[j]! + 1;
      const insertion = curr[j - 1]! + 1;
      curr[j] = Math.min(substitution, deletion, insertion);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

export interface ReadingScore {
  /** Word accuracy in [0,1] — 1 means every reference word was said, in order. */
  accuracy: number;
  /** Reference words, after normalization and truncation. */
  referenceWords: number;
  /** Words the student actually said, after the same treatment. */
  spokenWords: number;
  /** Insertions + deletions + substitutions against the reference. */
  errors: number;
}

/**
 * Compare a transcript against the passage the student was asked to read.
 *
 * Accuracy is clamped at 0: error count can exceed the reference length when a
 * student says far more than the passage, and a negative accuracy is not a
 * thing a teacher can act on.
 */
export function scoreReading(reference: string, transcript: string): ReadingScore {
  const ref = normalizeForReading(reference).slice(0, MAX_WORDS);
  const said = normalizeForReading(transcript).slice(0, MAX_WORDS);

  if (ref.length === 0) {
    // No reference is a broken question, not a perfect reading. Validation
    // rejects an empty passage, so this is the belt to that's braces — and it
    // returns 0 rather than 1 so a bug can never hand out full marks.
    return { accuracy: 0, referenceWords: 0, spokenWords: said.length, errors: said.length };
  }

  const errors = wordDistance(ref, said);
  return {
    accuracy: Math.max(0, 1 - errors / ref.length),
    referenceWords: ref.length,
    spokenWords: said.length,
    errors,
  };
}
