/**
 * The review table for a scanned class: one row per photograph.
 *
 * Everything the screen decides about a row lives here as a pure function, so
 * the rules that protect a child's marks are tested rather than buried in JSX:
 * which rows block a save, which are only flagged, and what a row remembers so
 * a retry does not repeat or skip work.
 *
 * A row *blocks* the save when saving it would put marks on the wrong child or
 * store a number that is not a mark: no student chosen, two papers for one
 * student, a box that does not hold a valid mark. A row is only *flagged* when
 * saving is safe but the teacher should know: the student already has a paper
 * (it is skipped, never overwritten), cells are blank (saved as unmarked), or
 * the marks do not add up to the total written on the paper.
 *
 * Free of react-native so `node --test` can load it.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { ClassScanResponse, ScanCandidate, ScanMatchStatus } from './evaluations.ts';

export type RowState =
  | 'queued'
  | 'reading'
  | 'read'
  | 'failed'
  | 'not_run'
  | 'saved'
  | 'save_failed'
  | 'skipped_existing'
  /** Set aside by the teacher (a second photo of one paper, a blank page). Never saved. */
  | 'discarded';

export interface ReviewQuestion {
  id: string;
  /** 1-based, as on the paper. */
  number: number;
  maxMarks: number;
}

export interface ReviewRow {
  /** Stable per photograph, so state updates find their row after a re-render. */
  key: string;
  state: RowState;
  /** Null until a student is assigned — a `confirm` or `none` row starts here. */
  studentId: string | null;
  matchStatus: ScanMatchStatus | null;
  nameRead: string | null;
  candidates: ScanCandidate[];
  /** Text in each question's box, by question id. Blank means unmarked, never zero. */
  marks: Record<string, string>;
  writtenTotal: number | null;
  /** Remembered after the first successful start, so a retry never starts again. */
  attemptId: string | null;
  /** Questions whose mark has been written, so a retry does not repeat them. */
  savedQuestionIds: string[];
  /**
   * Every question whose mark has ever been written to this row's paper. Append
   * only: an edit does not clear it, so a box cleared after its mark reached the
   * server is refused rather than silently left behind.
   */
  writtenQuestionIds: string[];
  /** A scan-error key while reading, or the save error afterwards. */
  error: string | null;
}

export interface ReviewContext {
  questions: readonly ReviewQuestion[];
  /** Students who already have a paper for this exam. */
  hasAttempt: ReadonlySet<string>;
}

export function newRow(key: string): ReviewRow {
  return {
    key,
    state: 'queued',
    studentId: null,
    matchStatus: null,
    nameRead: null,
    candidates: [],
    marks: {},
    writtenTotal: null,
    attemptId: null,
    savedQuestionIds: [],
    writtenQuestionIds: [],
    error: null,
  };
}

/** A photograph came back read. Only a `confident` match arrives assigned. */
export function rowFromScan(row: ReviewRow, res: ClassScanResponse): ReviewRow {
  const marks: Record<string, string> = {};
  for (const p of res.proposals) marks[p.questionId] = String(p.awardedMarks);
  return {
    ...row,
    state: 'read',
    studentId: res.match.status === 'confident' ? res.match.studentId : null,
    matchStatus: res.match.status,
    nameRead: res.nameRead,
    candidates: res.match.candidates,
    marks,
    writtenTotal: res.writtenTotal,
    error: null,
  };
}

/**
 * A row that has started a paper is locked to that student. The paper already
 * holds what was written from this photo, so moving the row to another child
 * would leave those marks on the first child's paper — and the first child's
 * own photo would then find a paper it did not make and be skipped.
 */
export function isStudentLocked(row: ReviewRow): boolean {
  return row.attemptId !== null;
}

/**
 * Assign or reassign a row's student. Free until the row has started a paper;
 * after that it is a no-op (see `isStudentLocked`) — the paper is corrected from
 * the student's own page, not by moving the row.
 */
export function assignStudent(row: ReviewRow, studentId: string | null): ReviewRow {
  if (studentId === row.studentId) return row;
  if (isStudentLocked(row)) return row;
  return { ...row, studentId };
}

const DISCARDABLE: readonly RowState[] = ['read', 'failed', 'not_run', 'save_failed'];

/**
 * Whether the teacher may set this photo aside: a duplicate of another paper, a
 * blank or back page. Only before it has started a paper — after that the
 * paper exists and ignoring the photo would hide it.
 */
export function canDiscard(row: ReviewRow): boolean {
  return row.attemptId === null && DISCARDABLE.includes(row.state);
}

/** Set a photo aside. A discarded row blocks nothing and is never saved. */
export function discardRow(row: ReviewRow): ReviewRow {
  return canDiscard(row) ? { ...row, state: 'discarded' } : row;
}

/**
 * What the screen shows for each student, so two children with one name do not
 * look identical in the chips and the picker. A unique name is itself; a shared
 * one gets the school reference when every sharer has a different one, and its
 * place among the sharers (1, 2, …, roster order) otherwise. Names are compared
 * as displayed (trimmed), not normalised: the point is what the teacher sees.
 */
export function rosterLabels(
  roster: ReadonlyArray<{ id: string; displayName: string; externalRef?: string | null }>,
): Map<string, string> {
  const byName = new Map<string, Array<{ id: string; shown: string; ref: string }>>();
  for (const s of roster) {
    const name = s.displayName.trim();
    const group = byName.get(name) ?? [];
    group.push({ id: s.id, shown: s.displayName, ref: (s.externalRef ?? '').trim() });
    byName.set(name, group);
  }
  const labels = new Map<string, string>();
  for (const [name, group] of byName) {
    if (group.length === 1) {
      labels.set(group[0]!.id, group[0]!.shown);
      continue;
    }
    const refs = group.map(g => g.ref);
    const useRefs = refs.every(r => r !== '') && new Set(refs).size === refs.length;
    group.forEach((g, i) => labels.set(g.id, `${name} (${useRefs ? g.ref : i + 1})`));
  }
  return labels;
}

/**
 * True when the student already has a paper that this row did not start. A row
 * holding its own `attemptId` is retrying its own paper, which is never "existing".
 */
export function countsAsExisting(row: ReviewRow, ctx: ReviewContext): boolean {
  return row.studentId !== null && row.attemptId === null && ctx.hasAttempt.has(row.studentId);
}

/**
 * Edit a box. An edit invalidates that question's "already written" memory, so
 * a retry after a half-failed save writes the corrected number, not the old one.
 */
export function setMark(row: ReviewRow, questionId: string, text: string): ReviewRow {
  return {
    ...row,
    marks: { ...row.marks, [questionId]: text },
    savedQuestionIds: row.savedQuestionIds.filter(id => id !== questionId),
  };
}

export type MarkParse = { kind: 'blank' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

/** A box's text as a mark: Arabic digits and `٫`/`,` decimals accepted, range-checked. */
export function parseMark(text: string, max: number): MarkParse {
  const t = toLatinDigits(text).trim().replace(/[٫,،]/g, '.');
  if (t === '') return { kind: 'blank' };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { kind: 'invalid' };
  const value = Number(t);
  return value > max ? { kind: 'invalid' } : { kind: 'ok', value };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function rowTotal(row: ReviewRow, questions: readonly ReviewQuestion[]): number {
  let sum = 0;
  for (const q of questions) {
    const parsed = parseMark(row.marks[q.id] ?? '', q.maxMarks);
    if (parsed.kind === 'ok') sum += parsed.value;
  }
  return round2(sum);
}

export type Blocker = 'no_student' | 'duplicate_student' | 'mark_invalid';
export type Flag = 'has_attempt' | 'blank_cells' | 'total_mismatch';
export interface RowReport {
  blockers: Blocker[];
  flags: Flag[];
}

/** States a row can be saved from. A retry of a failed save is a save. */
const SAVABLE: readonly RowState[] = ['read', 'save_failed'];
export const isSavableState = (s: RowState): boolean => SAVABLE.includes(s);

export function reportRows(
  rows: readonly ReviewRow[],
  ctx: ReviewContext,
): Map<string, RowReport> {
  const live = rows.filter(r => isSavableState(r.state));

  // A student with a paper already is skipped whatever the row says, so those
  // rows take no part in the duplicate check or the blockers.
  const claims = new Map<string, number>();
  for (const r of live) {
    if (r.studentId && !countsAsExisting(r, ctx)) {
      claims.set(r.studentId, (claims.get(r.studentId) ?? 0) + 1);
    }
  }

  const out = new Map<string, RowReport>();
  for (const r of live) {
    const report: RowReport = { blockers: [], flags: [] };
    if (!r.studentId) {
      report.blockers.push('no_student');
    } else if (countsAsExisting(r, ctx)) {
      report.flags.push('has_attempt');
    } else {
      if ((claims.get(r.studentId) ?? 0) > 1) report.blockers.push('duplicate_student');
      let blank = false;
      let invalid = false;
      for (const q of ctx.questions) {
        const parsed = parseMark(r.marks[q.id] ?? '', q.maxMarks);
        if (parsed.kind === 'blank') blank = true;
        if (parsed.kind === 'invalid') invalid = true;
      }
      if (invalid) report.blockers.push('mark_invalid');
      if (blank) report.flags.push('blank_cells');
      if (r.writtenTotal !== null && Math.abs(rowTotal(r, ctx.questions) - r.writtenTotal) >= 0.005) {
        report.flags.push('total_mismatch');
      }
    }
    out.set(r.key, report);
  }
  return out;
}

/** Rows the save will actually write: assigned, and not already sat. */
export function savableRows(rows: readonly ReviewRow[], ctx: ReviewContext): ReviewRow[] {
  return rows.filter(
    r => isSavableState(r.state) && r.studentId !== null && !countsAsExisting(r, ctx),
  );
}

/** Save is allowed when nothing blocks and there is something to write. */
export function canSave(rows: readonly ReviewRow[], ctx: ReviewContext): boolean {
  const reports = reportRows(rows, ctx);
  for (const report of reports.values()) if (report.blockers.length > 0) return false;
  return savableRows(rows, ctx).length > 0;
}

export function saveSummary(rows: readonly ReviewRow[]): {
  saved: number;
  needAttention: number;
  skipped: number;
} {
  let saved = 0;
  let needAttention = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.state === 'saved') saved++;
    else if (r.state === 'skipped_existing') skipped++;
    else if (r.state === 'save_failed' || r.state === 'failed' || r.state === 'not_run') needAttention++;
  }
  return { saved, needAttention, skipped };
}
