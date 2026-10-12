/**
 * The order a generated evaluation is stored in.
 *
 * A ministry exam puts its question types in blocks — choice, then صح/خطأ,
 * then matching, complete, then the written answers — each under its own
 * «السؤال الأول: …» direction. A model asked for a mixed paper returns it in
 * whatever order it likes, and the mock generator rotates types, so a stored
 * paper read MCQ, written, true/false, MCQ… and the teacher screen had no
 * block to put a heading over.
 *
 * `orderIndex` is assigned from this order at insert, so every reader — the
 * teacher's list, the student's walk through the exam, a future print — sees
 * the same paper. Stable within a type, so the generator's own sequence (and
 * which questions a surplus trim dropped) is untouched. Keep in step with
 * `EXAM_TYPE_ORDER` in `artifacts/mobile/services/examBlocks.ts`.
 */
export const EXAM_TYPE_ORDER: readonly string[] = [
  "multiple_choice", "true_false", "matching", "fill_blank",
  "short_answer", "open_ended", "problem_solving", "practical_task",
  "read_aloud", "dictation",
];

/** Rank of a type; a type this list does not know sorts last rather than first. */
function rank(type: string): number {
  const i = EXAM_TYPE_ORDER.indexOf(type);
  return i === -1 ? EXAM_TYPE_ORDER.length : i;
}

/** A new array grouped into ministry blocks; the input is not touched. */
export function inPaperOrder<T>(items: readonly T[], typeOf: (item: T) => string): T[] {
  return items
    .map((item, i) => ({ item, i, r: rank(typeOf(item)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}
