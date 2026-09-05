/**
 * The student's side of an exam link.
 *
 * Deliberately does **not** go through `apiFetch`. That client attaches the
 * teacher's access token, refreshes it, and signs the teacher out when the
 * refresh fails — all of which is wrong here in a way that would be hard to
 * see: a teacher opening a link to check it would send their own credentials
 * to a public endpoint, and a student's expired sitting would trigger a
 * sign-out flow for an account that does not exist.
 *
 * The student's token lives in memory and in this module only. It is not put
 * in the shared token store, so it can never be mistaken for a session.
 */
import { getApiBaseUrl } from './apiClient.ts';
import type { StudentResponse } from './studentAnswers.ts';

export { isAnswered } from './studentAnswers.ts';
export type { StudentResponse };

export interface ExamSummary {
  title: string;
  titleAr: string;
  questionCount: number;
  totalMarks: string;
  timeLimitMin: number | null;
  language: string;
}

export interface RosterName {
  id: string;
  displayName: string;
  taken: boolean;
}

/** A question as the student sees it: no key, no rubric. See `studentView.ts`. */
export interface StudentQuestion {
  id: string;
  orderIndex: number;
  type: string;
  marks: string;
  body: Record<string, unknown>;
}

export class StudentExamError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'StudentExamError';
    this.status = status;
    this.code = code;
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* not JSON — the status is all we have */
    }
    throw new StudentExamError(detail || `Request failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

export function openExam(code: string): Promise<{ evaluation: ExamSummary; students: RosterName[] }> {
  return call(`/take/${encodeURIComponent(code)}`);
}

export function claimName(
  code: string,
  studentId: string,
): Promise<{
  token: string;
  student: { id: string; displayName: string };
  questions: StudentQuestion[];
  /**
   * Curriculum lessons this paper covers, for the book-figure panel. The
   * server sends ids only; the figures themselves are bundled into this app,
   * so `bookFigureRefsForObjectives`' sibling resolves them with no network.
   * Optional so a client running against an older API simply shows none.
   */
  lessonIds?: string[];
}> {
  return call(`/take/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export function getExamState(token: string): Promise<{
  status: string;
  submittedAt: string | null;
  questions: StudentQuestion[];
  answers: { questionId: string; response: StudentResponse }[];
  /** See `claimName` — present on resume too, so a reload keeps the panel. */
  lessonIds?: string[];
}> {
  return call('/take/attempt/state', { token });
}

export function saveStudentAnswer(
  token: string,
  questionId: string,
  response: StudentResponse,
): Promise<{ saved: boolean }> {
  return call(`/take/attempt/answers/${questionId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ response }),
  });
}

export function submitStudentExam(token: string): Promise<{ submitted: boolean }> {
  return call('/take/attempt/submit', { method: 'POST', token });
}
