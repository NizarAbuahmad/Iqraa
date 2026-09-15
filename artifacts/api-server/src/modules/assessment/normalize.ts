/**
 * Grading-time comparison helpers.
 *
 * `normalizeArabic` itself now lives in `@workspace/curriculum` — passage
 * retrieval needs the identical folding, and that package is a dependency of
 * this one, so the function moved down rather than being copied up. It is
 * re-exported here so every existing import keeps working and there is still
 * exactly one implementation.
 *
 * What stays here is about marking rather than about Arabic: parsing a number
 * out of a normalised string, and deciding whether a student's answer matches
 * an accepted one.
 */
import { normalizeArabic } from "@workspace/curriculum";

export { normalizeArabic };

/** Parses a number from an already-normalised string, or null if it isn't one. */
export function numericValue(normalized: string): number | null {
  if (!normalized) return null;
  // Reject strings that merely start with a number ("7 سم" is not 7 here; the
  // key lists the unit when it wants it).
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Decimal places written in an already-normalised numeric string. */
function decimalPlaces(normalized: string): number {
  const dot = normalized.indexOf(".");
  return dot === -1 ? 0 : normalized.length - dot - 1;
}

/**
 * Compares an answer to one accepted key.
 *
 * Numbers compare so that `7`, `٧` and `7.0` all match, and a key of `0.333`
 * accepts `0.3333`. Everything else compares as normalised text.
 *
 * The tolerance is about how precisely a decimal was written, never about how
 * big the number is. This was a 1% *relative* tolerance until 2026-09-15, which
 * is the same thing for `0.333` and catastrophic for the whole numbers Grade 10
 * maths is full of: 1% of 360 is 3.6, so a key of 360 accepted 357, and 1000
 * accepted 1009. Every integer answer from 99 up marked its neighbours correct,
 * unattended — `fill_blank` grades deterministically, with no teacher in the
 * loop.
 */
export function answersMatch(studentRaw: unknown, keyRaw: unknown): boolean {
  const student = normalizeArabic(studentRaw);
  const key = normalizeArabic(keyRaw);
  if (!student || !key) return false;
  if (student === key) return true;

  const a = numericValue(student);
  const b = numericValue(key);
  if (a === null || b === null) return false;
  if (a === b) return true;

  // Both written as whole numbers: nothing was rounded, so there is nothing to
  // forgive. A different integer is a different answer.
  if (Number.isInteger(a) && Number.isInteger(b)) return false;

  // One side carries decimals, so one of them may be the other rounded. Accept
  // a difference of up to half a unit in the last place the *coarser* side
  // wrote — that is the most it could have lost to rounding. Comparing at the
  // finer precision instead would reject `0.3333` against a key of `0.333`,
  // which is the case this tolerance exists for.
  const dp = Math.min(decimalPlaces(student), decimalPlaces(key));
  return Math.abs(a - b) <= 0.5 * 10 ** -dp;
}

/** True when the answer matches any of the accepted forms for a blank. */
export function matchesAny(studentRaw: unknown, accepted: readonly unknown[]): boolean {
  return accepted.some(key => answersMatch(studentRaw, key));
}
