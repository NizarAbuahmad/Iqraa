/**
 * What an English paper may take from the curriculum data.
 *
 * The NCCD outcomes exist in Arabic only, and some lessons, concepts and terms
 * have only an Arabic title or carry an Arabic gloss. An English plan, activity
 * or deck must not print those untranslated, so each reads its data through
 * here. One definition of "Arabic" and of the exception for it, shared by the
 * revision plan, activity and deck, so they cannot disagree about which line to
 * keep (they did: the deck dropped a whole title for a Quranic mark).
 *
 * Free of react-native so `node --test` can load it.
 */

/** Arabic LETTERS: not the Quranic marks or Arabic-Indic digits a few Latin titles carry, which are real content. */
export const ARABIC_LETTER = /[ء-ي]/;

/**
 * A bracketed gloss that IS the content: one to three Arabic letters, with
 * optional separators and marks — «The Letter Baa (ب)», «Alif (ا, ى)». The
 * grade-1 Arabic book teaches the letters themselves, so cutting them would
 * leave a lesson with no name for what it teaches. Anything longer is a gloss
 * of the English and is cut.
 */
export const LETTER_GLOSS = /^[(（]\s*[ء-ي][ً-ٟ]*(?:\s*[,،/\-–]\s*[ء-ي][ً-ٟ]*){0,2}\s*[)）]$/;

/**
 * An English line from our own data, or null when it has nothing English in it.
 *
 * A bracketed Arabic gloss («Looking good (جميل)») is cut and the English kept,
 * except a short letter gloss (`LETTER_GLOSS`); a line that is Arabic through
 * and through is dropped, never transliterated or translated.
 */
export function englishOnly(s: string): string | null {
  if (!ARABIC_LETTER.test(s)) return s;
  const group = /\s*[(（][^()（）]*[ء-ي][^()（）]*[)）]/g;
  const cut = s.replace(group, m => (LETTER_GLOSS.test(m.trim()) ? m : '')).trim();
  const outside = cut.replace(/[(（][^()（）]*[)）]/g, g => (LETTER_GLOSS.test(g) ? '' : g)).trim();
  return outside && !ARABIC_LETTER.test(outside) ? cut : null;
}

/** The text with every allowed letter gloss removed — what is left must hold no Arabic letter. */
export function withoutLetterGlosses(s: string): string {
  return s.replace(/[(（][^()（）]*[)）]/g, g => (LETTER_GLOSS.test(g) ? '' : g));
}
