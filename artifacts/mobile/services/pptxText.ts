/**
 * The defaults every PowerPoint text box in an exported deck gets: its
 * direction, its typeface and its language.
 *
 * Kept apart from `exportPptx.ts`, which imports react-native and expo at
 * module scope, so `node --test` can load this one.
 *
 * - **Direction.** pptxgenjs writes a paragraph's `rtl="1"` from that text's
 *   own `rtlMode` (for a run array, from the first run of each line); the
 *   presentation-level flag reaches nothing else. A line with an Arabic
 *   letter is laid out right-to-left. A line with none — an answer option
 *   «(2, 0)», a table cell «-2», a value «٢» — is laid out left-to-right,
 *   still right-aligned by the caller: inside a right-to-left paragraph the
 *   bidi algorithm printed «(2, 0)» as «(0 ,2)», a different point.
 * - **Typeface.** PowerPoint draws Arabic in a run's complex-script face
 *   (`<a:cs>`), and pptxgenjs's theme sets only the Latin one, so every run
 *   without its own `fontFace` fell back to the theme's Arabic default
 *   (Arial / Times New Roman) — Google Slides reported every body line in
 *   Arial. A `fontFace` on the run writes latin, ea and cs alike.
 * - **Language.** Runs said `lang="en-US"`, so PowerPoint's spell-checker
 *   would read every Arabic word as misspelt English.
 */
import { hasArabicLetter } from './mathRender.ts';

/** The language an exported deck's runs are tagged with. */
export function pptxLang(isAr: boolean): string {
  return isAr ? 'ar-JO' : 'en-US';
}

export type TextDefaults = { fontFace: string; lang: string; rtlMode: boolean };

/** The defaults for one piece of text; a caller's own options win over them. */
export function textDefaults(text: string, isAr: boolean, bodyFont: string): TextDefaults {
  return { fontFace: bodyFont, lang: pptxLang(isAr), rtlMode: isAr && hasArabicLetter(text) };
}

type Run = { text?: string; options?: Record<string, unknown> };

/**
 * `addText`'s arguments with the defaults filled in. A run array needs them on
 * each run — the outer options never reach the runs — and each run takes the
 * outer `fontFace`/`lang`/`rtlMode` when the caller set one, so
 * `addText(runs, { fontFace: HEAD })` keeps its heading face.
 */
export function withTextDefaults(
  text: unknown,
  opts: Record<string, unknown> | undefined,
  isAr: boolean,
  bodyFont: string,
): [unknown, Record<string, unknown>] {
  if (Array.isArray(text)) {
    const runs = text as Run[];
    const outer: Record<string, unknown> = {};
    for (const k of ['fontFace', 'lang', 'rtlMode'] as const) {
      if (opts && opts[k] !== undefined) outer[k] = opts[k];
    }
    const joined = runs.map(r => r.text ?? '').join('');
    return [
      runs.map(r => ({ ...r, options: { ...textDefaults(r.text ?? '', isAr, bodyFont), ...outer, ...r.options } })),
      { ...textDefaults(joined, isAr, bodyFont), ...opts },
    ];
  }
  return [text, { ...textDefaults(typeof text === 'string' ? text : '', isAr, bodyFont), ...opts }];
}
