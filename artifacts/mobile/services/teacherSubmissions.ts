/**
 * What a teacher reads of a class's project submissions: the roster list for one homework and one student's
 * project. Pure, and imports only the project types from `homeworkSubmission.ts`, so `node --test` loads it.
 *
 * The normalizers are tolerant on purpose: a row the server could not name (no student id) is dropped rather than
 * rendered as a blank line a teacher might open, and an unknown `status` reads as «not handed in», never as handed in.
 */
import { dateLocale } from './dateLabels.ts';
import {
  normalizeSubmission,
  normalizeSubmissionState,
  type SubmissionState,
  type SubmissionView,
} from './homeworkSubmission.ts';

export interface TeacherSubmissionRow {
  studentId: string;
  displayName: string;
  /**
   * The roster record has a student account linked now; without one the student cannot hand in. A server that
   * does not send the flag (an older one) reads as `true`: the list then behaves as it did before the flag.
   */
  hasAccount: boolean;
  status: SubmissionState;
  submittedAt: string | null;
  photoCount: number;
}

export interface TeacherSubmissionList {
  homework: { id: string; title: string; dueDate: string };
  submittedCount: number;
  /**
   * The «Y» of the card's «X of Y»: the records that have an account, the same number the class's homework list
   * carries. Absent (an older server) reads as the number of rows.
   */
  trackableCount: number;
  submissions: TeacherSubmissionRow[];
}

export interface TeacherSubmissionDetail {
  student: { id: string; displayName: string };
  submission: SubmissionView;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

export function normalizeTeacherSubmissionList(raw: unknown): TeacherSubmissionList {
  const r = isRecord(raw) ? raw : {};
  const hw = isRecord(r['homework']) ? r['homework'] : {};
  const submissions: TeacherSubmissionRow[] = [];
  if (Array.isArray(r['submissions'])) {
    for (const row of r['submissions']) {
      if (!isRecord(row)) continue;
      const studentId = str(row['studentId']);
      if (!studentId) continue;
      submissions.push({
        studentId,
        displayName: str(row['displayName']),
        // Only an explicit false means «no account»: a missing flag must not turn a whole class into account-less rows.
        hasAccount: row['hasAccount'] !== false,
        status: normalizeSubmissionState(row['status']),
        submittedAt: str(row['submittedAt']) || null,
        photoCount: count(row['photoCount']),
      });
    }
  }
  return {
    homework: { id: str(hw['id']), title: str(hw['title']), dueDate: str(hw['dueDate']) },
    submittedCount: count(r['submittedCount']),
    trackableCount: typeof r['trackableCount'] === 'number' ? count(r['trackableCount']) : submissions.length,
    submissions,
  };
}

/**
 * Null when the student is missing (there is nobody to show a project of) or when the reply carries no `submission`
 * object. The server always sends one, an empty `{}` included; a 2xx without it is a proxy's page or a broken reply,
 * and reading that as an empty project would show a teacher «nothing handed in» for a project that exists.
 */
export function normalizeTeacherSubmissionDetail(raw: unknown): TeacherSubmissionDetail | null {
  if (!isRecord(raw) || !isRecord(raw['student']) || !isRecord(raw['submission'])) return null;
  const id = str(raw['student']['id']);
  if (!id) return null;
  return {
    student: { id, displayName: str(raw['student']['displayName']) },
    submission: normalizeSubmission(raw['submission']),
  };
}

/** A route param as one string: expo-router types a param `string | string[]`, and a repeated one arrives as an array. */
export function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/**
 * «30 Oct 2026, 11:05» — when a project was handed in, for the detail screen. The calendar day and the clock are
 * Amman's, the same calendar the server judges «late» by, so a project marked late never shows a day that is not.
 * Latin digits (`dateLocale`, services/dateLabels.ts). Null when there is no moment to show. Display only.
 */
export function formatHandedInAt(iso: string | null | undefined, lang: 'ar' | 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  try {
    return d.toLocaleString(dateLocale(lang), { ...opts, timeZone: 'Asia/Amman' });
  } catch {
    // A runtime without time-zone data: the device's own zone is better than no time.
    try {
      return d.toLocaleString(dateLocale(lang), opts);
    } catch {
      return null;
    }
  }
}

/** The note a screen leaves for the one it goes back to (a Toast that outlives the navigation). */
export type SubmissionsFlash = 'subDeleted' | 'subAlreadyGone';
let pendingFlash: { key: SubmissionsFlash; homeworkId: string } | null = null;

/** Leave a note for the NEXT focus of one homework's list screen. The newest wins. */
export function rememberSubmissionsFlash(key: SubmissionsFlash, homeworkId: string): void {
  pendingFlash = { key, homeworkId };
}

/**
 * The note left for this homework's list, once: reading it clears it. A list of another homework gets nothing, and
 * the note is dropped rather than kept for a later focus: it was about a project that list does not show.
 */
export function takeSubmissionsFlash(homeworkId: string): SubmissionsFlash | null {
  const flash = pendingFlash;
  pendingFlash = null;
  return flash && flash.homeworkId === homeworkId ? flash.key : null;
}

/** Only a handed-in row (on time or late) has a project to open. */
export function rowOpensDetail(row: { status: SubmissionState }): boolean {
  return row.status === 'submitted' || row.status === 'late';
}

/** What a row shows: its hand-in state, or «no account» for a record that never could hand in (never one that did). */
export type RowState = SubmissionState | 'noAccount';

/**
 * A record without an account that has not handed in is not «not handed in yet»: it cannot. A record whose account
 * was unlinked after it handed in keeps its hand-in state, and still opens (`rowOpensDetail` reads the status alone).
 */
export function rowState(row: { status: SubmissionState; hasAccount: boolean }): RowState {
  return row.status === 'none' && !row.hasAccount ? 'noAccount' : row.status;
}
