/**
 * How a learning objective reads on the teacher's screen and in the exports.
 *
 * NCCD outcomes open with the masdar «تعرُّف …» («تعرُّف مفهوم الاقتران
 * المركّب»). Teachers read that as stilted and asked for «معرفة». The change
 * is display-only on purpose: the curriculum data keeps the ministry's wording
 * (it is quoted back to the books, and `blooms.ts` keys the Understand level on
 * it), and only the lesson plan's «الأهداف» — on screen, in the HTML/PDF export
 * and in the plain-text export — is rewritten at render time.
 *
 * Only a leading bare masdar is touched, with or without its diacritics
 * (تعرُّف / تعرّف / تعرف). «التعرُّف إلى» and a mid-sentence «تعرُّف» are left
 * alone: the first is a different construction and the second is prose.
 */
const LEADING_TAARRUF = /^(\s*(?:[•\-–]\s*)?)تعر[ً-ْ]{0,2}ف(?=\s|$)/u;

export function displayObjective(text: string): string {
  return text.replace(LEADING_TAARRUF, '$1معرفة');
}
