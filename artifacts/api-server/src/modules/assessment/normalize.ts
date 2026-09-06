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

/**
 * Compares an answer to one accepted key.
 *
 * Numbers compare with a relative tolerance so `7`, `٧` and `7.0` all match,
 * and a key of `0.333` accepts `0.3333`. Everything else compares as normalised
 * text.
 */
export function answersMatch(
  studentRaw: unknown,
  keyRaw: unknown,
  relativeTolerance = 0.01,
): boolean {
  const student = normalizeArabic(studentRaw);
  const key = normalizeArabic(keyRaw);
  if (!student || !key) return false;
  if (student === key) return true;

  const a = numericValue(student);
  const b = numericValue(key);
  if (a === null || b === null) return false;
  if (a === b) return true;

  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return false;
  return Math.abs(a - b) / scale <= relativeTolerance;
}

/** True when the answer matches any of the accepted forms for a blank. */
export function matchesAny(studentRaw: unknown, accepted: readonly unknown[]): boolean {
  return accepted.some(key => answersMatch(studentRaw, key));
}
