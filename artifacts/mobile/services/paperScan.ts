/**
 * Turning a scanned exam paper into the rows of the paper-exam grid.
 *
 * The grid is the teacher's: a scan only pre-fills it. Anything the server
 * could not read stays blank (marks) or falls back exactly as the grid's own
 * default already does (objective, competency), and every scanned row carries
 * `review` until the teacher touches it, so a suggestion is never mistaken for
 * a decision. Free of react-native so `node --test` can load it.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { CompetencyKey, PaperScanRow } from './evaluations.ts';

export interface GridRow {
  marks: string;
  objectiveId: string;
  competencyKey: CompetencyKey;
  /** Came from a scan and the teacher has not looked at it yet. */
  review: boolean;
}

export function gridFromScan(
  rows: readonly PaperScanRow[],
  objectiveIds: readonly string[],
  fallbackCompetency: CompetencyKey,
): GridRow[] {
  const fallbackObjective = objectiveIds[0] ?? '';
  return rows.map(r => ({
    // Blank, not a default: the grid's own validation names the row.
    marks: r.marks === null ? '' : String(r.marks),
    objectiveId:
      r.objectiveId !== null && objectiveIds.includes(r.objectiveId) ? r.objectiveId : fallbackObjective,
    competencyKey: r.competencyKey ?? fallbackCompetency,
    review: true,
  }));
}

/** How many scanned rows still have no marks — what the teacher is told to fill in. */
export function blankMarkCount(rows: readonly { marks: string }[]): number {
  return rows.filter(r => !(Number(toLatinDigits(r.marks)) > 0)).length;
}

/**
 * The scanned marks disagree with the total the paper prints for itself. Either
 * a question was missed or a mark was misread; both are worth one glance before
 * the grid is saved. Null when they agree or the paper prints no total.
 */
export function totalMismatch(
  rows: readonly { marks: string }[],
  printedTotal: number | null,
): { sum: number; printed: number } | null {
  if (printedTotal === null) return null;
  let sum = 0;
  for (const r of rows) {
    const v = Number(toLatinDigits(r.marks));
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  sum = Math.round(sum * 100) / 100;
  return Math.abs(sum - printedTotal) < 0.005 ? null : { sum, printed: printedTotal };
}
