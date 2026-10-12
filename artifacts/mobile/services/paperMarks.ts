/**
 * The class mark book for a paper exam typed as one total per student — the
 * logic behind app/evaluations/[id]/marks.tsx, and the «مجموع فقط» question the
 * new-exam screen creates. Pure: loaded by bare `node --test`, so types only
 * from evaluations.ts (which imports apiClient).
 *
 * A row is dirty when what the box says differs from what the server holds —
 * or when the server holds a mark that was never handed in (typed on the
 * student's own page without «سلّم»): families cannot see that one, and
 * «حفظ الكل» is the step that hands it in.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { AttemptListRow, Difficulty, EvaluationQuestion, PaperQuestionInput } from './evaluations.ts';

/** MAX_MARKS_PER_QUESTION in api-server/src/modules/assessment/paperExam.ts. */
export const QUICK_PAPER_MAX = 100;
/** Rows per request: well under the server's 300, and under apiFetch's timeout. */
export const PAPER_TOTALS_CHUNK = 100;

export type PaperTotalErrorCode =
  | 'not_in_class'
  | 'not_in_group'
  | 'marks_out_of_range'
  | 'kept_student_work'
  | 'not_quick_paper'
  | 'failed';

export type PaperTotalResult =
  | { studentId: string; status: 'saved' | 'unchanged'; marks: number }
  | { studentId: string; status: 'cleared'; marks: null }
  | { studentId: string; status: 'error'; code: PaperTotalErrorCode };

export const PAPER_TOTAL_ERROR_KEY = {
  not_in_class: 'marksGridErrNotInClass',
  not_in_group: 'marksGridErrNotInGroup',
  marks_out_of_range: 'marksGridInvalid',
  kept_student_work: 'marksGridErrKept',
  not_quick_paper: 'marksGridNotQuick',
  failed: 'marksGridErrFailed',
} as const satisfies Record<PaperTotalErrorCode, string>;

/**
 * `length`: more characters than the server reads as a mark (16). The app
 * refuses it here, so a pasted megabyte never goes up in a request body.
 */
export type MarkParse = { ok: true; value: number | null } | { ok: false; error: 'invalid' | 'range' | 'precision' | 'length' };

const NUMBER = /^\d+(\.\d+)?$/;

/** MAX_MARKS_TEXT in api-server/src/lib/paperTotals.ts. */
const MAX_MARKS_TEXT = 16;

export function parsePaperMark(text: string, max: number): MarkParse {
  const s = toLatinDigits(text).trim().replace(/[٫,]/g, '.');
  if (s === '') return { ok: true, value: null };
  if (s.length > MAX_MARKS_TEXT) return { ok: false, error: 'length' };
  if (!NUMBER.test(s)) return { ok: false, error: 'invalid' };
  if ((s.split('.')[1] ?? '').length > 2) return { ok: false, error: 'precision' };
  const value = Number(s);
  if (value < 0 || value > max) return { ok: false, error: 'range' };
  return { ok: true, value };
}

export function formatMark(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export type RowStatus = { kind: 'idle' } | { kind: 'saved' } | { kind: 'cleared' } | { kind: 'error'; code: PaperTotalErrorCode };

export interface GridRow {
  studentId: string;
  name: string;
  /** The mark the server holds (final or not), or null. */
  saved: number | null;
  /** The server holds `saved` but it was never handed in, so no family can see it. */
  pendingFinal: boolean;
  /** What the box says. */
  text: string;
  status: RowStatus;
}

export function initialGridRows(
  roster: readonly { id: string; displayName: string }[],
  attempts: readonly Pick<AttemptListRow, 'studentId' | 'submittedAt' | 'result'>[],
): GridRow[] {
  const byStudent = new Map(attempts.map(a => [a.studentId, a]));
  return roster.map(s => {
    const a = byStudent.get(s.id);
    const saved = a?.result && !a.result.isProvisional ? Number(a.result.earnedMarks) : null;
    return {
      studentId: s.id,
      name: s.displayName,
      saved,
      pendingFinal: saved !== null && !a?.submittedAt,
      text: saved === null ? '' : formatMark(saved),
      status: { kind: 'idle' },
    };
  });
}

export function editRow(rows: readonly GridRow[], studentId: string, text: string): GridRow[] {
  return rows.map(r => (r.studentId === studentId ? { ...r, text, status: { kind: 'idle' } } : r));
}

export function rowState(row: GridRow, max: number): { dirty: boolean; invalid: boolean; value: number | null } {
  const parsed = parsePaperMark(row.text, max);
  if (!parsed.ok) return { dirty: false, invalid: true, value: null };
  const value = parsed.value;
  const dirty = value !== row.saved || (value !== null && row.pendingFinal);
  return { dirty, invalid: false, value };
}

export function buildTotalsRequest(
  rows: readonly GridRow[],
  max: number,
): { totals: { studentId: string; marks: number | null }[]; invalidIds: string[] } {
  const totals: { studentId: string; marks: number | null }[] = [];
  const invalidIds: string[] = [];
  for (const row of rows) {
    const s = rowState(row, max);
    if (s.invalid) invalidIds.push(row.studentId);
    else if (s.dirty) totals.push({ studentId: row.studentId, marks: s.value });
  }
  return { totals, invalidIds };
}

export function mergeTotalsResponse(rows: readonly GridRow[], results: readonly PaperTotalResult[]): GridRow[] {
  const byStudent = new Map(results.map(r => [r.studentId, r]));
  return rows.map(row => {
    const r = byStudent.get(row.studentId);
    if (!r) return row;
    if (r.status === 'error') return { ...row, status: { kind: 'error', code: r.code } };
    if (r.status === 'cleared') return { ...row, saved: null, pendingFinal: false, text: '', status: { kind: 'cleared' } };
    return { ...row, saved: r.marks, pendingFinal: false, text: formatMark(r.marks), status: { kind: 'saved' } };
  });
}

export function gridSummary(
  rows: readonly GridRow[],
  max: number,
): { total: number; entered: number; dirty: number; invalid: number; errors: number } {
  let entered = 0, dirty = 0, invalid = 0, errors = 0;
  for (const row of rows) {
    const s = rowState(row, max);
    if (row.saved !== null && !row.pendingFinal) entered++;
    if (s.dirty) dirty++;
    if (s.invalid) invalid++;
    if (row.status.kind === 'error') errors++;
  }
  return { total: rows.length, entered, dirty, invalid, errors };
}

/** PAPER_TOTALS_MAX_ROWS in api-server/src/modules/assessment/paperTotals.ts is the server's cap; a request over it is a 400. */
export function chunkTotals<T>(rows: readonly T[], size: number = PAPER_TOTALS_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

/**
 * Why the whole save was refused (a 409 the route sends before touching any
 * row). Keyed on status AND code: the same word on another status is not the
 * route's. `not_published` means a draft only — the route accepts a closed
 * exam, so this copy never asks for a publish the teacher already did.
 */
const REFUSAL_KEY = {
  not_published: 'marksGridNeedsPublish',
  no_class: 'marksGridNeedsClass',
  not_quick_paper: 'marksGridNotQuick',
  no_level_scale: 'marksGridNoLevelScale',
} as const;

export type PaperTotalsFailureKey = (typeof REFUSAL_KEY)[keyof typeof REFUSAL_KEY] | 'marksGridSaveFailed';

export function paperTotalsFailureKey(err: unknown): PaperTotalsFailureKey {
  const e = err as { status?: unknown; code?: unknown } | null | undefined;
  if (e && typeof e === 'object' && e.status === 409 && typeof e.code === 'string' && Object.hasOwn(REFUSAL_KEY, e.code)) {
    return REFUSAL_KEY[e.code as keyof typeof REFUSAL_KEY];
  }
  return 'marksGridSaveFailed';
}

type QuestionShape = Pick<EvaluationQuestion, 'gradingMode' | 'body'>;
/** The server's rule (paperExam.ts `isPaperQuestion`): marked by hand, nothing in the body. */
const isPaperQ = (q: QuestionShape) => q.gradingMode === 'manual' && Object.keys(q.body ?? {}).length === 0;

export function isPaperExam(questions: readonly QuestionShape[]): boolean {
  return questions.length > 0 && questions.every(isPaperQ);
}

export function isQuickPaperExam(questions: readonly QuestionShape[]): boolean {
  return questions.length === 1 && isPaperQ(questions[0]!);
}

/**
 * «مجموع فقط»: a paper exam of one question worth the total, measured against
 * the first selected objective. Its competency breakdown rests on one question,
 * which scoring reports as "not enough evidence" rather than a percentage.
 */
export function quickPaperQuestions(
  totalText: string,
  objectiveIds: readonly string[],
  difficulty: Difficulty,
): { ok: true; questions: PaperQuestionInput[] } | { ok: false } {
  const parsed = parsePaperMark(totalText, QUICK_PAPER_MAX);
  const objectiveId = objectiveIds[0];
  if (!parsed.ok || parsed.value === null || parsed.value <= 0 || !objectiveId) return { ok: false };
  return { ok: true, questions: [{ marks: parsed.value, objectiveId, competencyKey: 'understanding', difficulty }] };
}
