/**
 * Arabic orthographic normalisation, shared by everything that compares or
 * searches Arabic text.
 *
 * Lived in `artifacts/api-server/src/modules/assessment/normalize.ts`, where it
 * was written for answer grading. Passage retrieval needs exactly the same
 * folding, and the api-server package depends on this one, so the function had
 * to move down rather than be copied up — a second Arabic normaliser that
 * drifts from the first is a bug nobody would find for months. The grading
 * helpers built on it (`numericValue`, `answersMatch`, `matchesAny`) stayed
 * where they are; they are about marking, not about Arabic.
 *
 * The original rationale, unchanged and still the point:
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

/**
 * Tashkeel marks: tanween, the short vowels, shadda, sukun (U+064B–U+0652)
 * and the superscript alef (U+0670). Not tatweel, not hamza, not letters.
 */
const TASHKEEL_MARKS = /[ً-ْٰ]/g;

/**
 * A curriculum title as a screen should show it: no tashkeel.
 *
 * The NCCD books are fully vowelled for students, and their titles were
 * copied in that way, so a lesson card read «الاستماعُ» — a case ending on a
 * heading, which no Arabic heading carries. About 3,300 titles in the data
 * have marks.
 *
 * **Display only.** The stored title is left vowelled on purpose: lesson
 * lookup scores tokens WITHOUT folding tashkeel (`resolveGroundedKbLesson` in
 * the app's `knowledgeBase.ts`), and that ranking is what separates two
 * same-named lessons in different subjects. Stripping the data would re-rank
 * them. So call this where a title is rendered, never where one is stored,
 * compared or sent to a generator.
 */
export function plainTitle(input: string | null | undefined): string {
  if (!input) return '';
  return input.normalize('NFC').replace(TASHKEEL_MARKS, '');
}

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
