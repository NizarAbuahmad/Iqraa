/**
 * How a run of `scripts/build-premade-sheets.ts` changes the manifest.
 *
 * Upsert by id, drop what `shouldDrop` names, sort by id so a re-run is a
 * reviewable diff. The script passes a rule covering two cases, and both are the
 * same mistake if missed — *the code refuses it and the data still ships it*:
 *
 *  - a lesson that is held back (`HELD_BACK`), at any level;
 *  - a lesson the build REFUSED this run at this level (no question bank for it,
 *    or the sheet it produced repeats a question). Before this, such a sheet was
 *    simply left where an earlier run put it, so a generator that had learned to
 *    stop padding left the padded sheets shipping for ever.
 *
 * Pure and generic on purpose: it is the one place that decides what a re-run
 * erases, and it is tested without a generator, a catalog or a file.
 */
export function mergeSheets<T extends { id: string }>(
  existing: readonly T[],
  produced: readonly T[],
  shouldDrop: (sheet: T) => boolean,
): T[] {
  const byId = new Map(existing.map(sheet => [sheet.id, sheet]));
  for (const sheet of produced) byId.set(sheet.id, sheet);
  return [...byId.values()].filter(sheet => !shouldDrop(sheet)).sort((a, b) => a.id.localeCompare(b.id));
}
