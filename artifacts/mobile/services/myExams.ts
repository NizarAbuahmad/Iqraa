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

/** How many rows want something from the student now — for the entry tile. */
export function actionableCount(exams: readonly MyExam[]): number {
  return exams.filter(e => myExamAction(e) === 'start' || myExamAction(e) === 'continue').length;
}
