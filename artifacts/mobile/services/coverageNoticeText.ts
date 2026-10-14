/**
 * The «الدروس المغطاة» list, capped. A whole-book paper can cover 60+ lessons;
 * printing every title turns a one-line notice into a wall. The count line
 * («n من total») is always shown by the caller, so cutting the names loses no
 * information about how much was covered. Titles can repeat across units, so
 * this only caps — it never dedupes.
 */
export const MAX_COVERED_NAMES = 6;

export function capCoveredNames(
  titles: readonly string[],
  max: number = MAX_COVERED_NAMES,
): { shown: string[]; hidden: number } {
  return { shown: titles.slice(0, max), hidden: Math.max(0, titles.length - max) };
}

/** «a، b، c و54 أخرى» — the capped names joined, with the suffix when any are cut. */
export function coveredNamesText(
  titles: readonly string[],
  separator: string,
  moreText: (hidden: number) => string,
  max: number = MAX_COVERED_NAMES,
): string {
  const { shown, hidden } = capCoveredNames(titles, max);
  const joined = shown.join(separator);
  return hidden > 0 ? `${joined} ${moreText(hidden)}` : joined;
}
