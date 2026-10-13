/**
 * The exam calendar — the teacher's own dated exams and, once an admin has put
 * them in a school, their colleagues'. See
 * artifacts/api-server/src/routes/examCalendar.ts. Pure reads of the result
 * live in examCalendarModel.ts.
 *
 * No local fallback, like roster.ts and schedule.ts: a colleague's exam date is
 * server state with no offline meaning, and a stale cached copy would turn the
 * clash warning into false calm.
 */
import { apiFetch } from './apiClient.ts';
import type { ExamCalendarResponse } from './examCalendarModel.ts';

export class ExamCalendarError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ExamCalendarError';
    this.status = status;
    this.code = code;
  }

  /** The API is up but this database predates exam dates (migration not yet run). */
  get isUnavailable(): boolean {
    return this.code === 'exam_calendar_unavailable';
  }
}

/** Exams dated `from`..`to`, both inclusive, as "YYYY-MM-DD". */
export async function getExamCalendar(from: string, to: string): Promise<ExamCalendarResponse> {
  const res = await apiFetch(`/exam-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new ExamCalendarError(detail || `Loading the exam calendar failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as ExamCalendarResponse;
}
