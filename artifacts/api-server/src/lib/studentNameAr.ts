/**
 * The Arabic spelling of a student's name (`students.displayNameAr`).
 *
 * Its only job is to appear in an Arabic letter home, so a value with no
 * Arabic letter in it (a Latin name pasted into the wrong box, digits, a dash)
 * would defeat that and look like a mistake on the parent's phone. Empty is
 * allowed and means "not recorded": it clears the field.
 */
export const MAX_NAME_AR_LENGTH = 100;

const ARABIC_LETTER = /[ء-يٱ-ۓݐ-ݿ]/;
// Anything that is not an Arabic letter, a mark on one (harakat, tatweel), a
// space, or the few joiners a name can carry. Latin letters and digits —
// Arabic-Indic ones too, which sit inside U+0600–06FF — are what this refuses.
const NOT_NAME = /[^ء-ؿـ-ٰٟ-ۓەݐ-ݿ\s'’.\-‌‍]/;

export type NameArCheck =
  | { ok: true; value: string }
  | { ok: false; code: "student_name_ar_invalid" | "student_name_ar_too_long" };

export function checkNameAr(raw: unknown): NameArCheck {
  if (typeof raw !== "string") return { ok: false, code: "student_name_ar_invalid" };
  const value = raw.replace(/\s+/g, " ").trim();
  if (value === "") return { ok: true, value };
  if (value.length > MAX_NAME_AR_LENGTH) return { ok: false, code: "student_name_ar_too_long" };
  if (!ARABIC_LETTER.test(value) || NOT_NAME.test(value)) {
    return { ok: false, code: "student_name_ar_invalid" };
  }
  return { ok: true, value };
}
