/**
 * The student record's logic, kept free of React Native so `node --test` can
 * load it (CLAUDE.md: the mobile runner has no RN transform).
 */
import { arCountPhrase } from './arCount.ts';
import { lessonPickerParams, resolveLessonPrepContext } from './lessonPrep.ts';

/**
 * Below this an objective counts as weak. Mirrors `STUDENT_GAP_PERCENT` in
 * artifacts/api-server/src/modules/assessment/classInsights.ts — the app cannot
 * import the server module, so a test pins the value instead.
 */
export const WEAK_PERCENT = 60;

export type RecordExamStatus = 'not_sat' | 'in_progress' | 'submitted' | 'marked';

export interface StudentRecordExam {
  evaluationId: string;
  title: string;
  createdAt: string;
  status: RecordExamStatus;
  attemptId: string | null;
  earned: number | null;
  total: number | null;
  percent: number | null;
  provisional: boolean;
  teacherComment: string | null;
  submittedAt: string | null;
}

export interface StudentRecordObjective {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  earned: number;
  total: number;
  percent: number;
  marksLost: number;
  sittings: number;
  lastSeenAt: string;
}

export interface StudentRecord {
  student: { id: string; displayName: string; teacherNote: string; gender: string; linked: boolean };
  className: string;
  exams: StudentRecordExam[];
  /** Weakest first. */
  objectives: StudentRecordObjective[];
  provisionalCount: number;
  parent: { linked: boolean; lastContact: { kind: string; channel: string; at: string } | null };
}

/** The weak objectives, and what to show when there are none: the weakest anyway. */
export function focusObjectives(objs: readonly StudentRecordObjective[]): {
  weak: StudentRecordObjective[];
  shown: StudentRecordObjective[];
  allClear: boolean;
} {
  const weak = objs.filter(o => o.percent < WEAK_PERCENT);
  return { weak, shown: weak.length > 0 ? weak : objs.slice(0, 1), allClear: weak.length === 0 };
}

export function examStatusKey(status: RecordExamStatus) {
  switch (status) {
    case 'not_sat': return 'studentRecordNotSat' as const;
    case 'in_progress': return 'studentRecordInProgress' as const;
    case 'submitted': return 'studentRecordSubmitted' as const;
    case 'marked': return 'studentRecordMarked' as const;
  }
}

export function formatDay(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '/');
}

export function sittingsLine(o: StudentRecordObjective, lang: 'ar' | 'en'): string {
  const day = formatDay(o.lastSeenAt);
  if (lang === 'ar') return `في ${arCountPhrase(o.sittings, 'ورقة', 'ورقتين', 'أوراق')} · آخرها ${day}`;
  return `In ${o.sittings} ${o.sittings === 1 ? 'paper' : 'papers'} · latest ${day}`;
}

/** The worksheet generator on the lesson's own grade and subject — never a default. */
export function worksheetAction(o: StudentRecordObjective) {
  if (!o.lessonId) return null;
  const picker = lessonPickerParams(o.lessonId, 'ar');
  const context = resolveLessonPrepContext(o.lessonId, 'ar');
  if (!picker || !context) return null;
  return { pathname: '/ai-tools/worksheet' as const, params: { topic: context.topic, ...picker } };
}

export function lessonAction(o: StudentRecordObjective) {
  return o.lessonId
    ? { pathname: '/curriculum/lesson-detail' as const, params: { lessonId: o.lessonId } }
    : null;
}

export function recheckAction(classId: string, o: StudentRecordObjective) {
  return { pathname: '/evaluations/mini' as const, params: { classId, objectiveId: o.objectiveId } };
}

/** Only a paper that exists: the paper screen creates an attempt for one that does not. */
export function paperAction(exam: StudentRecordExam, studentId: string) {
  return exam.status !== 'not_sat' && exam.attemptId
    ? { pathname: '/evaluations/[id]/answers/[studentId]' as const, params: { id: exam.evaluationId, studentId } }
    : null;
}
