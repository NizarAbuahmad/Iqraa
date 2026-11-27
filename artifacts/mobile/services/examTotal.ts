/**
 * The total a generated exam is out of («العلامة الكلية»), as the new-exam
 * screen offers it. `null` is «تلقائي»: the paper keeps whatever its questions
 * add up to. The API scales the generated questions to a chosen total in whole
 * marks, one at least per question, and refuses a total below the question count
 * (`targetTotalMarks` on `POST /evaluations`).
 *
 * Append new totals in order; the screen stores the chosen VALUE, not its index.
 */
export const TOTAL_CHOICES: readonly (number | null)[] = [null, 10, 20, 25, 30, 40, 50, 60, 100];

/** The totals worth offering for a paper of `count` questions. */
export function totalChoicesFor(count: number): (number | null)[] {
  return TOTAL_CHOICES.filter(t => t === null || t >= count);
}

/** What to send for the chosen total: nothing for «تلقائي» or a total the count has outgrown. */
export function totalToSend(total: number | null, count: number): number | undefined {
  return total !== null && total >= count ? total : undefined;
}
