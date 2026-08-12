/**
 * Arabic-aware normalisation, applied to both sides before any string compare.
 *
 * A student who writes the right answer a different way must not lose marks —
 * that is the rule the whole grading tier stands on. In Arabic, "different way"
 * is mostly orthographic: hamza carriers, taa marbuta, final yaa, harakat a
 * teacher typed and a student did not, and Arabic-Indic digits. Comparing raw
 * strings marks those wrong, and a wrong mark on a correct answer is the one
 * failure that destroys a teacher's trust in the whole level.
 *
 * Deliberately NOT normalised: standalone hamza `ء`. It is a letter, not a
 * diacritic — folding it changes words (جزء → جز).
 */

/** Harakat and other combining marks a teacher may or may not have typed. */
const HARAKAT = /[ً-ْٰـ]/g;

const AR_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  // Extended (Persian/Urdu) forms turn up when a keyboard is set that way.
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeArabic(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.normalize("NFKC");

  s = s.replace(HARAKAT, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d] ?? d);
  // Arabic decimal separator and thousands mark.
  s = s.replace(/٫/g, ".").replace(/٬/g, "");
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

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
