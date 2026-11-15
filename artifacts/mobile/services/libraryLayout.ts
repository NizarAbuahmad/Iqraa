/**
 * Layout decisions for the library screen, kept out of the component so they
 * can be tested: the mobile test runner is bare `node --test` with no React
 * Native transform, so anything imported from `react-native` cannot be loaded.
 * Pure on purpose.
 */

/**
 * Cards per row, from the width of the content TRACK — not the window. On a
 * desktop the sidebar takes part of the window, and `CONTENT_MAX_WIDTH` caps
 * the rest, so the window width says nothing about how much room a card has.
 * The thresholds leave a card at least ~290px, enough for a 16:9 cover and a
 * two-line title.
 */
export function libraryColumns(trackWidth: number): 1 | 2 | 3 {
  if (trackWidth >= 960) return 3;
  if (trackWidth >= 600) return 2;
  return 1;
}

/**
 * Share of a row one cell takes, leaving room for the 12px gaps between cells:
 * three cells + two gaps and two cells + one gap both fit the track at every
 * width `libraryColumns` returns that count for. A fixed share, not
 * `flexGrow`, so a shelf with one or two results does not stretch them across
 * the whole row.
 */
export function cellWidthPercent(cols: 1 | 2 | 3): `${number}%` {
  return cols === 3 ? '32%' : cols === 2 ? '48.7%' : '100%';
}

/**
 * Kinds that have a picture worth showing large: a video, an infographic, a
 * photo. Everything else (a worksheet, a template, a document) has no cover,
 * and a large empty cover tile would only be decoration.
 */
const VISUAL_KINDS = new Set(['video', 'infographic', 'image']);
export function isVisualKind(kind: string): boolean {
  return VISUAL_KINDS.has(kind);
}

/**
 * How many items of a shelf the overview shows before «عرض الكل»: one row of
 * cards, or a few compact rows. Always at least one full row, so the preview
 * never looks like the whole shelf.
 */
export function previewCount(cols: 1 | 2 | 3, visual: boolean): number {
  if (cols === 1) return visual ? 3 : 4;
  return visual ? cols : cols * 2;
}

/**
 * Grades in the order a chip row shows them: highest first, by level. The
 * catalog's own order (`MVP_GRADE_IDS`) is append-only, because pickers persist
 * bare positions into it, so Grade 1 was appended after Grade 3 and before
 * Grade 2 — the library's chips read «…الثالث، الأول، الثاني». The library
 * holds its grade by id, never by position, so it may sort for display.
 * Returns a new array; the input is left as it is.
 */
export function gradesForChips<T extends { level: number }>(grades: readonly T[]): T[] {
  return [...grades].sort((a, b) => b.level - a.level);
}
