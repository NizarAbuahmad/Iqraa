/**
 * What the geometry sketchpad calls its points on screen. The scene names them
 * A, B, C … (`mathGeometry.ts`, and everything computed stays Latin); only the
 * display changes, the way maths is computed in latin `x` and shown as «س».
 *
 * The Jordanian books name points أ، ب، ج، د، هـ … in the abjad order, and
 * write a shape's name with its letters apart («المثلث أ ب ج»). Two choices:
 * - **س and ص are skipped.** They are the axes' names, and a point called ص
 *   next to «(س − أ)² + (ص − ب)²» would read as a variable.
 * - **Letters are separated by a space.** Arabic letters written together join
 *   into one word («بج»), which is not two points.
 *
 * Free of react-native so `node --test` loads it.
 */

/** The 26 names for points A–Z, in the books' order, without س and ص. */
export const ARABIC_POINT_LETTERS: readonly string[] = [
  'أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م',
  'ن', 'ع', 'ف', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ',
];

/**
 * A point's name, or a shape's name (its points' labels run together: «ABC»),
 * as shown to the user. Latin in English; in Arabic each letter A–Z becomes its
 * book letter and a multi-letter name has its letters apart. Anything that is
 * not a label passes through unchanged.
 */
export function pointName(name: string, lang: 'ar' | 'en'): string {
  if (lang !== 'ar') return name;
  return [...name]
    .map(ch => {
      const i = ch.charCodeAt(0) - 65;
      return i >= 0 && i < ARABIC_POINT_LETTERS.length && ch.length === 1 ? ARABIC_POINT_LETTERS[i] : ch;
    })
    .join(name.length > 1 ? ' ' : '');
}
