/**
 * The «اختباراتي» list, as the screen reads it.
 *
 * Types mirror `GET /student/exams` (`modules/assessment/studentExams.ts` on
 * the server, where the state and release rules live and are tested). What is
 * decided here is only presentation: which label a state shows and what
 * tapping a row does. Pure and free of React Native, so it runs under the
 * bare test runner like the rest of `services/`.
 */
import { SUBJECTS } from '@workspace/curriculum';
import type { StudentResult } from './studentExam.ts';

export type MyExamState = 'available' | 'in_progress' | 'submitted' | 'result' | 'closed';

export interface MyExam {
  evaluationId: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  totalMarks: number;
  timeLimitMin: number | null;
  publishedAt: string | null;
  /** The teacher's planned day, "YYYY-MM-DD"; planning only, it never opens or closes the exam. */
  examDate?: string | null;
  /** "HH:MM", only ever set together with `examDate`. */
  examTime?: string | null;
  state: MyExamState;
  /** Present only while the exam link admits the student. */
  shareCode: string | null;
  submittedAt: string | null;
  deadlineAt: string | null;
  result: StudentResult | null;
}

/** One child's list, as `GET /parent/exams` returns it — no row carries a link. */
export interface ChildExams {
  studentId: string;
  displayName: string;
  exams: MyExam[];
}

export const MY_EXAM_STATE_KEY = {
  available: 'myExamsStateAvailable',
  in_progress: 'myExamsStateInProgress',
  submitted: 'myExamsStateSubmitted',
  result: 'myExamsStateResult',
  closed: 'myExamsStateClosed',
} as const satisfies Record<MyExamState, string>;

export type MyExamAction = 'start' | 'continue' | 'toggle_result' | null;

/**
 * What tapping a row does. Only an open link is ever followed: a closed exam
 * answers `/take/:code` like an unknown code, so following it would land the
 * student on «هذا الرابط غير متاح» for an exam they can see right here.
 */
export function myExamAction(exam: MyExam): MyExamAction {
  if (exam.state === 'result' && exam.result) return 'toggle_result';
  if (!exam.shareCode) return null;
  if (exam.state === 'available') return 'start';
  if (exam.state === 'in_progress') return 'continue';
  return null;
}

/**
 * Whether the row offers «أعد المحاولة». The server lists a quiz as retakeable
 * only once the teacher has released its result; the row checks it shows that
 * result too, so a retake bar can never sit beside «بانتظار النتيجة» and say
 * "failed" before the teacher has. A parent never retakes for a child.
 */
export function canRetakeExam(exam: Pick<MyExam, 'evaluationId' | 'state'>, retakeEvaluationIds: readonly string[], isParent: boolean): boolean {
  return !isParent && exam.state === 'result' && retakeEvaluationIds.includes(exam.evaluationId);
}

/** The exam's title in the reader's language, falling back to the other. */
export function myExamTitle(exam: Pick<MyExam, 'title' | 'titleAr'>, lang: 'ar' | 'en'): string {
  return (lang === 'ar' ? exam.titleAr || exam.title : exam.title || exam.titleAr) || '';
}

/** The subject's name, or null for an id the catalog no longer has. */
export function subjectLabel(subjectId: string, lang: 'ar' | 'en'): string | null {
  const s = SUBJECTS.find(x => x.id === subjectId);
  if (!s) return null;
  return (lang === 'ar' ? s.nameAr : s.name) || null;
}

/**
 * The list as two sections. «القادمة» is what can still be sat — soonest planned
 * day first, undated after the dated ones. «السابقة» is everything handed in or
 * over, newest first. The server already orders by state, so each section only
 * needs its own tiebreak; a stable sort keeps that order among equals.
 */
export function splitMyExams(exams: readonly MyExam[]): { upcoming: MyExam[]; past: MyExam[] } {
  const upcoming = exams.filter(e => e.state === 'available' || e.state === 'in_progress');
  const past = exams.filter(e => e.state !== 'available' && e.state !== 'in_progress');
  upcoming.sort((a, b) => {
    if (a.examDate && b.examDate) return a.examDate.localeCompare(b.examDate) || (a.examTime ?? '').localeCompare(b.examTime ?? '');
    if (a.examDate) return -1;
    if (b.examDate) return 1;
    return 0;
  });
  past.sort((a, b) => (b.submittedAt ?? b.publishedAt ?? '').localeCompare(a.submittedAt ?? a.publishedAt ?? ''));
  return { upcoming, past };
}

export interface SubjectAverage {
  subjectId: string;
  /** Rounded 0–100. */
  percent: number;
  count: number;
}

export interface ProgressSummary {
  /** Papers whose result the teacher has released. */
  taken: number;
  /** Rounded 0–100, or null when there is nothing released to average. */
  averagePercent: number | null;
  bySubject: SubjectAverage[];
}

/**
 * Where the student stands, from released results only. A row is `result`
 * only when the server's release rule passed, so a paper still waiting on the
 * teacher contributes nothing — not even to the count.
 */
export function progressSummary(exams: readonly MyExam[]): ProgressSummary {
  const done = exams.filter((e): e is MyExam & { result: NonNullable<MyExam['result']> } => e.state === 'result' && e.result !== null);
  if (done.length === 0) return { taken: 0, averagePercent: null, bySubject: [] };
  const sums = new Map<string, { total: number; count: number }>();
  for (const e of done) {
    const s = sums.get(e.subjectId) ?? { total: 0, count: 0 };
    s.total += e.result.percent;
    s.count += 1;
    sums.set(e.subjectId, s);
  }
  const bySubject = [...sums].map(([subjectId, s]) => ({ subjectId, percent: Math.round(s.total / s.count), count: s.count }));
  bySubject.sort((a, b) => b.count - a.count || a.subjectId.localeCompare(b.subjectId));
  return {
    taken: done.length,
    averagePercent: Math.round(done.reduce((n, e) => n + e.result.percent, 0) / done.length),
    bySubject,
  };
}

/** How many rows want something from the student now — for the entry tile. */
export function actionableCount(exams: readonly MyExam[]): number {
  return exams.filter(e => myExamAction(e) === 'start' || myExamAction(e) === 'continue').length;
}
