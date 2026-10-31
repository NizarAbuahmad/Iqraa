/**
 * Which spelling of a student's name a letter home carries. An Arabic letter
 * uses the Arabic name when the teacher has recorded one and the roster name
 * otherwise (a Latin «ahmad» in an Arabic greeting reads as a mistake, but a
 * guessed transliteration would be worse — see `students.displayNameAr`). An
 * English letter always uses the roster name, which is the Latin one.
 */
export interface NamedStudent {
  displayName: string;
  displayNameAr?: string;
}

export function letterStudentName(s: NamedStudent, arabic: boolean): string {
  const ar = (s.displayNameAr ?? '').trim();
  return arabic && ar ? ar : s.displayName;
}

/**
 * The name field after the letter's language flips: the other spelling of the
 * same child if the field still holds one of the two, and whatever the teacher
 * typed over it otherwise. Never overwrites an edit.
 */
export function nameAfterLanguageChange(current: string, s: NamedStudent, arabic: boolean): string {
  const held = current.trim();
  const ours = [s.displayName.trim(), (s.displayNameAr ?? '').trim()].filter(Boolean);
  return ours.includes(held) ? letterStudentName(s, arabic) : current;
}
