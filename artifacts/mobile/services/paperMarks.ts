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
import type { AttemptListRow, Difficulty, EvaluationQuestion, EvaluationStatus, PaperQuestionInput } from './evaluations.ts';

/** MAX_MARKS_PER_QUESTION in api-server/src/modules/assessment/paperExam.ts. */
export const QUICK_PAPER_MAX = 100;
/**
 * Rows per request. The server takes up to 100 (PAPER_TOTALS_MAX_ROWS), but
 * each row is several queries and a hand-in, and 100 of them run close to the
 * client's 45 s timeout; 50 leaves room.
 */
export const PAPER_TOTALS_CHUNK = 50;

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
/** Words for a per-row refusal. `marks_out_of_range` is a function key: it needs the total. */
export function paperTotalErrorText(
  t: (key: (typeof PAPER_TOTAL_ERROR_KEY)[PaperTotalErrorCode], ...args: string[]) => string,
  code: PaperTotalErrorCode,
  max: number,
): string {
  // Passing the total to a plain-string key is harmless; leaving it off a function key prints "undefined".
  return t(PAPER_TOTAL_ERROR_KEY[code], String(max));
}

export type MarkParse = { ok: true; value: number | null } | { ok: false; error: 'invalid' | 'range' | 'precision' | 'length' };

/** What the server reads as a plain decimal: «12», «12.5», «12.», «.5». */
const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;
/** Direction marks a right-to-left keyboard or a paste can carry: LRM, RLM, ALM, and the isolates. */
const BIDI_MARKS = /[\u200E\u200F\u061C\u2066-\u2069]/g;

/** MAX_MARKS_TEXT in api-server/src/lib/paperTotals.ts. */
const MAX_MARKS_TEXT = 16;

export function parsePaperMark(text: string, max: number): MarkParse {
  const s = toLatinDigits(text).replace(BIDI_MARKS, '').trim().replace(/[٫,]/g, '.');
  if (s === '') return { ok: true, value: null };
  if (s.length > MAX_MARKS_TEXT) return { ok: false, error: 'length' };
  if (!NUMBER.test(s)) return { ok: false, error: 'invalid' };
  // At most two SIGNIFICANT decimals: «12.500» is 12.5, «12.505» is not a mark.
  if ((s.split('.')[1] ?? '').replace(/0+$/, '').length > 2) return { ok: false, error: 'precision' };
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
    const { saved, pendingFinal } = storedMark(byStudent.get(s.id));
    return {
      studentId: s.id,
      name: s.displayName,
      saved,
      pendingFinal,
      text: saved === null ? '' : formatMark(saved),
      status: { kind: 'idle' },
    };
  });
}

/** What the server holds for one student, from their attempt row. */
function storedMark(a: Pick<AttemptListRow, 'submittedAt' | 'result'> | undefined): { saved: number | null; pendingFinal: boolean } {
  const saved = a?.result && !a.result.isProvisional ? Number(a.result.earnedMarks) : null;
  return { saved, pendingFinal: saved !== null && !a?.submittedAt };
}

/**
 * Bring `saved` / `pendingFinal` back in line with the server after a request
 * whose outcome is unknown (a timeout: the server may have finished), WITHOUT
 * touching what the teacher has typed. A row's status goes back to idle — a
 * tick or an error would describe an answer we never saw — and `rowState`
 * then reports the truth: a row the server did save is clean, one it did not
 * is still dirty.
 */
export function refreshStoredMarks(
  rows: readonly GridRow[],
  attempts: readonly Pick<AttemptListRow, 'studentId' | 'submittedAt' | 'result'>[],
): GridRow[] {
  const byStudent = new Map(attempts.map(a => [a.studentId, a]));
  return rows.map(row => ({ ...row, ...storedMark(byStudent.get(row.studentId)), status: { kind: 'idle' } }));
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

/**
 * Fold the server's per-student answer into the grid.
 *
 * Called with two arguments it takes each answer at face value: the box shows
 * what the server stored and the row says saved / cleared / refused.
 *
 * Pass `sent` (studentId -> the value that went up, built from
 * `buildTotalsRequest(...).totals`) and a row the teacher edited while the
 * request was in flight keeps what they typed. `saved` and `pendingFinal`
 * always follow the server (it is the truth about what is stored), but when
 * the box no longer says what was sent the text stays, the status goes back
 * to idle (a tick or an error describes the OLD text), and `rowState` then
 * reports the row dirty against the new `saved`. A blank box equals a sent
 * `null`; a student missing from `sent` counts as edited.
 *
 * Rules for the screen (Task 9):
 *  - Apply it with FUNCTIONAL state, once per chunk:
 *    `setRows(prev => mergeTotalsResponse(prev, chunkResponse, sent))`.
 *    Merging into a closed-over snapshot loses chunk 1's results when chunk 2
 *    returns.
 *  - Lock the inputs and the save button while saving: that is the primary
 *    guard; the `sent` rule is only the backstop.
 *  - A client timeout does not mean nothing was saved — the server may have
 *    finished. Refetch the attempts before assuming; saving again is
 *    idempotent (an unchanged mark answers `unchanged`).
 */
export function mergeTotalsResponse(
  rows: readonly GridRow[],
  results: readonly PaperTotalResult[],
  sent?: ReadonlyMap<string, number | null>,
): GridRow[] {
  const byStudent = new Map(results.map(r => [r.studentId, r]));
  return rows.map(row => {
    const r = byStudent.get(row.studentId);
    if (!r) return row;
    // Server truth first; an error carries no new stored value.
    const stored =
      r.status === 'error'
        ? { saved: row.saved, pendingFinal: row.pendingFinal }
        : { saved: r.marks, pendingFinal: false };
    if (sent) {
      const cur = parsePaperMark(row.text, Infinity);
      const unchanged = cur.ok && sent.has(row.studentId) && cur.value === sent.get(row.studentId);
      if (!unchanged) return { ...row, ...stored, status: { kind: 'idle' } };
    }
    if (r.status === 'error') return { ...row, status: { kind: 'error', code: r.code } };
    if (r.status === 'cleared') return { ...row, ...stored, text: '', status: { kind: 'cleared' } };
    return { ...row, ...stored, text: formatMark(r.marks), status: { kind: 'saved' } };
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

/** Parse failures all read as the same sentence on the row: a mark from 0 to the total, two decimals at most. */
const PARSE_ERROR_CODE = {
  invalid: 'marks_out_of_range',
  range: 'marks_out_of_range',
  precision: 'marks_out_of_range',
  length: 'marks_out_of_range',
} as const satisfies Record<Extract<MarkParse, { ok: false }>['error'], PaperTotalErrorCode>;

/**
 * Why a row is red, as a refusal code the screen words with `paperTotalErrorText`:
 * a box that does not parse (every `MarkParse` error, `length` included), else
 * what the server last refused this row for. `null` when the row is fine.
 */
export function rowProblemCode(row: GridRow, max: number): PaperTotalErrorCode | null {
  const parsed = parsePaperMark(row.text, max);
  if (!parsed.ok) return PARSE_ERROR_CODE[parsed.error];
  return row.status.kind === 'error' ? row.status.code : null;
}

/**
 * How many marks already SAVED on the server this save would clear (a blank box
 * over a stored mark). A blank row that never had a mark is not counted: there
 * is nothing to lose, so no confirmation.
 */
export function savedMarksToClear(rows: readonly GridRow[], max: number): number {
  let n = 0;
  for (const row of rows) {
    const s = rowState(row, max);
    if (!s.invalid && s.dirty && s.value === null && row.saved !== null) n++;
  }
  return n;
}

/** Per-student refusals in one chunk's answer. */
export function countRefused(results: readonly PaperTotalResult[]): number {
  return results.filter(r => r.status === 'error').length;
}

/**
 * Whether a failed request may still have been applied. A 4xx is the server
 * saying no before it touched anything; a timeout, a dropped connection or a
 * 5xx says nothing about what it finished, so the caller refetches before
 * believing "nothing saved".
 */
export function saveOutcomeUncertain(err: unknown): boolean {
  const status = (err as { status?: unknown } | null | undefined)?.status;
  return !(typeof status === 'number' && status >= 400 && status < 500);
}

export type MarksBlocker = 'not_quick' | 'needs_publish' | 'needs_class';

export const MARKS_BLOCKER_KEY = {
  not_quick: 'marksGridNotQuick',
  needs_publish: 'marksGridNeedsPublish',
  needs_class: 'marksGridNeedsClass',
} as const satisfies Record<MarksBlocker, string>;

/**
 * What stops the mark book opening, in the order a teacher can fix them: not a
 * quick paper exam, still a draft, no class. A CLOSED exam is fine — the route
 * takes marks for a published or a closed exam. (An exam with no level scale
 * only shows itself as the route's 409 `no_level_scale`, at save.)
 */
export function marksBlocker(
  questions: readonly QuestionShape[],
  status: EvaluationStatus,
  classGroupId: string | null | undefined,
): MarksBlocker | null {
  if (!isQuickPaperExam(questions)) return 'not_quick';
  if (status === 'draft') return 'needs_publish';
  if (!classGroupId) return 'needs_class';
  return null;
}

/** Split a list into requests of `size` rows (the server refuses more than its PAPER_TOTALS_MAX_ROWS = 100 with a 400). */
export function chunkTotals<T>(rows: readonly T[], size: number = PAPER_TOTALS_CHUNK): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`chunkTotals needs a whole size of at least 1, got ${size}`);
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
