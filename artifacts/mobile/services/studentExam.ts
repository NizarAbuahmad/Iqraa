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
 *
 * `claimEvaluationAsSelf` below is the one deliberate exception: it uses
 * `apiFetch` on purpose, because it *is* asking "who is signed in" rather than
 * avoiding it. See its own comment.
 */
import { apiFetch, apiJson, getApiBaseUrl } from './apiClient.ts';
import { fetchWithTimeout } from './fetchWithTimeout.ts';
import { NO_PROGRESS, type MasteryProgress } from './lessonLock.ts';
import type { StudentResponse } from './studentAnswers.ts';
import type { CompetencyKey, CompetencyScore, LevelKey } from './evaluations.ts';

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
  // With a deadline, like every other call in the app. A socket that died
  // silently mid-paper left one `saveStudentAnswer` pending forever; the
  // save queue returns that same promise for later edits to the question,
  // so they were never sent, and «إرسال» awaited a flush that never settled.
  const res = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
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

export interface ClaimedAttempt {
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
  /** Minutes allowed, and when they run out — null means untimed. */
  timeLimitMin?: number | null;
  deadlineAt?: string | null;
  /** Set when `claim-self` handed back a sitting this account already held. */
  resumed?: boolean;
}

export function claimName(code: string, studentId: string): Promise<ClaimedAttempt> {
  return call(`/take/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

/**
 * Claim this student's own roster row automatically, for a student who is
 * signed into a real account already linked to it — no tap on a name.
 *
 * The one function in this file that uses `apiFetch`, and on purpose: every
 * other export here avoids the shared session specifically so an anonymous
 * exam sitting is never mistaken for a signed-in one, but this call *is*
 * that signed-in session, used to answer "who is asking". `null` covers
 * every reason it might not apply — signed out, signed in as a teacher or
 * parent, or no roster row linked to this class — and all of them mean the
 * same thing to the caller: fall back to the ordinary picker, silently. This
 * is not an error case; most students opening a link still have neither an
 * account nor a link.
 */
export async function claimEvaluationAsSelf(code: string): Promise<ClaimedAttempt | null> {
  const res = await apiFetch(`/take/${encodeURIComponent(code)}/claim-self`, { method: 'POST' });
  if (!res.ok) return null;
  return (await res.json()) as ClaimedAttempt;
}

export function getExamState(token: string): Promise<{
  status: string;
  submittedAt: string | null;
  questions: StudentQuestion[];
  answers: { questionId: string; response: StudentResponse }[];
  /** See `claimName` — present on resume too, so a reload keeps the panel. */
  lessonIds?: string[];
  timeLimitMin?: number | null;
  deadlineAt?: string | null;
  /** The server's clock when it answered, so the countdown can correct for a fast or slow device. */
  serverNow?: string;
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

/**
 * Send a read-aloud recording to be stored and transcribed.
 *
 * Unlike every other answer this file saves, the server owns what gets
 * written: it stores the audio, transcribes it, and composes the response
 * itself. The client cannot be the one to say what was heard.
 *
 * `durationMs` is measured by the caller and travels separately from the
 * blob because it is what gets billed, and bytes are a poor proxy — a few
 * hundred kilobytes of opus can be an hour of audio.
 */
export function uploadReadAloud(
  token: string,
  questionId: string,
  audioDataUrl: string,
  durationMs: number,
): Promise<{ saved: boolean; transcript: string; takesLeft: number }> {
  return call(`/take/attempt/audio/${questionId}`, {
    method: 'POST',
    token,
    body: JSON.stringify({ audio: audioDataUrl, durationMs }),
  });
}

export function submitStudentExam(token: string): Promise<{ submitted: boolean }> {
  return call('/take/attempt/submit', { method: 'POST', token });
}

/** What a student may see of their own mark. See `studentView.ts` on the server. */
export interface StudentResult {
  levelKey: LevelKey | null;
  percent: number;
  earnedMarks: number;
  totalMarks: number;
  competencyScores: Record<CompetencyKey, CompetencyScore>;
}

/**
 * `ready: false` means "not yet" and nothing more — it covers both "the
 * teacher has not opted this exam into student-visible results" and "grading
 * isn't finished", on purpose. See `studentResultReady` on the server.
 */
export function getExamResult(token: string): Promise<{ ready: boolean; result?: StudentResult }> {
  return call('/take/attempt/result', { token });
}

/**
 * «اختباراتي»: every exam set to the signed-in student's classes, with where
 * each one stands. Uses `apiFetch` on purpose, like `claimEvaluationAsSelf`:
 * this *is* the signed-in session asking about itself. Throws an `ApiError`
 * the screen translates with `apiErrorMessage`.
 */
export async function getMyExams(): Promise<import('./myExams.ts').MyExam[]> {
  const data = await apiJson<{ exams: import('./myExams.ts').MyExam[] }>('/student/exams');
  return data.exams ?? [];
}

/** A parent's «نتائج أبنائي»: each guardian-linked child's exams. */
export async function getChildExams(): Promise<import('./myExams.ts').ChildExams[]> {
  const data = await apiJson<{ children: import('./myExams.ts').ChildExams[] }>('/parent/exams');
  return data.children ?? [];
}

/**
 * What the mastery gate needs: which lessons the student has passed and which
 * have a quiz to pass. Never throws — any failure answers "gate off", so a
 * lookup that cannot complete locks nothing (see `lessonLock.ts`).
 */
export async function getMyProgress(): Promise<MasteryProgress> {
  try {
    const data = await apiJson<Partial<MasteryProgress>>('/student/progress');
    if (!data.enabled) return NO_PROGRESS;
    return {
      enabled: true,
      passedLessonIds: Array.isArray(data.passedLessonIds) ? data.passedLessonIds : [],
      // Absent from an API older than the release rule; reads as nothing waiting.
      awaitingLessonIds: Array.isArray(data.awaitingLessonIds) ? data.awaitingLessonIds : [],
      quizLessonIds: Array.isArray(data.quizLessonIds) ? data.quizLessonIds : [],
      retakeEvaluationIds: Array.isArray(data.retakeEvaluationIds) ? data.retakeEvaluationIds : [],
    };
  } catch {
    return NO_PROGRESS;
  }
}

/**
 * Throw away a failed lesson-quiz sitting so it can be sat again. Resolves with
 * the exam's share code, which the screen opens straight away — `/take/:code`
 * then starts a fresh sitting for the signed-in student. Throws an `ApiError`
 * carrying the server's refusal `code`.
 */
export async function retakeExam(evaluationId: string): Promise<{ shareCode: string | null }> {
  const data = await apiJson<{ shareCode?: string | null }>(
    `/student/exams/${encodeURIComponent(evaluationId)}/retake`,
    { method: 'POST' },
  );
  return { shareCode: data.shareCode ?? null };
}

/**
 * The grades the signed-in student's classes are in, first one first. The
 * library and the curriculum browser open on it instead of the catalog's
 * first grade. Never throws: on any failure the screen keeps its old default.
 */
export async function getMyGradeIds(): Promise<string[]> {
  try {
    const data = await apiJson<{ gradeIds?: string[] }>('/student/grades');
    return Array.isArray(data.gradeIds) ? data.gradeIds : [];
  } catch {
    return [];
  }
}
