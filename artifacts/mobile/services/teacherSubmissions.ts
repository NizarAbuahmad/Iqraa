/**
 * What a teacher reads of a class's project submissions: the roster list for one homework and one student's
 * project. Pure, and imports only the project types from `homeworkSubmission.ts`, so `node --test` loads it.
 *
 * The normalizers are tolerant on purpose: a row the server could not name (no student id) is dropped rather than
 * rendered as a blank line a teacher might open, and an unknown `status` reads as «not handed in», never as handed in.
 */
import {
  normalizeSubmission,
  normalizeSubmissionState,
  type SubmissionState,
  type SubmissionView,
} from './homeworkSubmission.ts';

export interface TeacherSubmissionRow {
  studentId: string;
  displayName: string;
  status: SubmissionState;
  submittedAt: string | null;
  photoCount: number;
}

export interface TeacherSubmissionList {
  homework: { id: string; title: string; dueDate: string };
  submittedCount: number;
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
        status: normalizeSubmissionState(row['status']),
        submittedAt: str(row['submittedAt']) || null,
        photoCount: count(row['photoCount']),
      });
    }
  }
  return {
    homework: { id: str(hw['id']), title: str(hw['title']), dueDate: str(hw['dueDate']) },
    submittedCount: count(r['submittedCount']),
    submissions,
  };
}

/** Null when the student is missing: there is nobody to show a project of. */
export function normalizeTeacherSubmissionDetail(raw: unknown): TeacherSubmissionDetail | null {
  if (!isRecord(raw) || !isRecord(raw['student'])) return null;
  const id = str(raw['student']['id']);
  if (!id) return null;
  return {
    student: { id, displayName: str(raw['student']['displayName']) },
    submission: normalizeSubmission(raw['submission']),
  };
}

/** Only a handed-in row (on time or late) has a project to open. */
export function rowOpensDetail(row: { status: SubmissionState }): boolean {
  return row.status === 'submitted' || row.status === 'late';
}
