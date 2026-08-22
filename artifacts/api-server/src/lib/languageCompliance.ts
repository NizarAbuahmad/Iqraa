/**
 * Did the model answer in the language it was asked in?
 *
 * Arabic is the product language, and a reply that drifts into English is a
 * hard failure a teacher sees immediately — but it is invisible to every other
 * measure the evaluation takes. Latency, tokens and cost are all identical
 * whether the answer is in Arabic or not, and a chat reply has no JSON shape
 * to conform to, so the generation checks do not apply either.
 *
 * This is the one thing about a prose reply that can be scored objectively
 * rather than rated by a human, so it is worth scoring.
 */

/**
 * Share of the reply's *letters* that are Arabic script, 0–1.
 *
 * Counts letters only. Digits, punctuation, whitespace and maths symbols are
 * excluded deliberately: a correct Arabic answer about derivatives is full of
 * `f(x) = 2x`, and counting those characters would score a perfectly good
 * reply as half-English. Latin letters inside an otherwise Arabic answer are
 * what this is looking for.
 *
 * Returns 0 for a reply with no letters at all (an empty or symbols-only
 * response), which is a failure in its own right and should not be flattered
 * with a 1.
 */
export function arabicShare(text: string): number {
  // U+0620–U+064A is the Arabic letter range; the presentation forms and
  // Arabic-Indic digits are excluded on purpose (digits are not letters).
  const arabic = text.match(/[ؠ-ي]/gu)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/gu)?.length ?? 0;
  const letters = arabic + latin;
  if (letters === 0) return 0;
  return arabic / letters;
}

/**
 * The floor a reply to an Arabic question must clear.
 *
 * Not 1.0, and not close to it: a good Arabic answer legitimately carries
 * Latin maths notation, element symbols (`NaCl`), and occasionally an English
 * term in parentheses. 0.7 separates "Arabic answer with notation in it" from
 * "English answer with a few Arabic words".
 */
export const ARABIC_REPLY_FLOOR = 0.7;

/** True when a reply to an Arabic prompt is actually in Arabic. */
export function answeredInArabic(text: string): boolean {
  return arabicShare(text) >= ARABIC_REPLY_FLOOR;
}
