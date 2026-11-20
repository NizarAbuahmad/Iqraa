/**
 * A «which one» question with nothing on the page to pick from.
 *
 * A worksheet files each bank item as short answer, fill-in or multiple choice
 * at random. Only multiple choice prints the options, so a pick filed as short
 * answer lost them: «أيّ وحدة أنسب لقياس طول الكتاب؟» keyed «مشبك الورق», with
 * no list a child could choose from and several defensible answers. Found
 * building the Grades 1–9 ready-made sheets on 2026-11-20, in nine templates
 * across grades 1, 5, 6, 8 and 9.
 *
 * `formatItem` (index.ts) uses this to keep a pick's options whatever slot it
 * lands in; the ready-made sheets' build gate
 * (`artifacts/mobile/services/premadeSheetGate.ts`) uses it to refuse a sheet.
 * One rule, so the two cannot drift.
 *
 * A pick is «أيّ» directly in front of what it points at («أي هذه الأشياء»,
 * «أيّ الأسئلة الآتية», one word between at most), or a «أنسب» question, or
 * the English «which of these / the following» or «best». It is unlisted when
 * its answer is not in its own text: «أي الأعداد الآتية فردي: 88، 26، 81، 54؟»
 * lists its choices and is fine. Merely mentioning «الآتي», «هذه» or «التالي»
 * is not a pick («ما العدد التالي للعدد 49؟», «رتّب الأعداد الآتية»), and neither is
 * a worked «أيّ» («أي عدد نضيفه إلى 243 لنحصل على 283؟»).
 */

const PICK_AR = /(أيّ|أي|أيهما|أيّهما|أيها|أيّها)\s+(\S+\s+)?(هذه|الآتية|الآتي|التالية|التالي)|أنسب/;
const PICK_EN = /\bwhich (of )?(these|the following)\b|\bbest\b/i;

/** Harakat, tatweel, guillemets and spaces do not decide whether an answer is on the page. */
function fold(text: string): string {
  return text.replace(/[ً-ْـ«»\s]/g, '').toLowerCase();
}

/** Is this a pick? Judged on the first line, where the ask is. */
export function isPick(text: string): boolean {
  const stem = text.split('\n')[0] ?? '';
  return PICK_AR.test(stem) || PICK_EN.test(stem);
}

/** A pick whose keyed answer is nowhere in its own text. */
export function isUnlistedPick(text: string, answer: string): boolean {
  const key = fold(answer);
  return isPick(text) && key.length > 0 && !fold(text).includes(key);
}
