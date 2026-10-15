/**
 * «الاختبارات القادمة» — the exams with a planned day from today on, for the
 * School tab. Pure: the lists come from GET /student/exams and /parent/exams
 * (services/studentExam.ts), which already apply every visibility rule.
 *
 * An exam's day is plain text ("YYYY-MM-DD", the teacher's calendar day, no
 * zone), unlike a homework due date, which is an Amman instant. Compare it as a
 * string against `ammanToday()`; never `new Date(examDate)`, which moves the day
 * in any zone west of UTC.
 */
import { dueBadge, formatDueDate, isValidYmd } from './homework.ts';
import type { ChildExams, MyExam, MyExamState } from './myExams.ts';

export interface ExamGroup {
  key: string;
  displayName: string;
  exams: MyExam[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * How far an exam has got for the child, for choosing between two copies of one
 * exam that two roster rows of the same child each carry. A released result is
 * the furthest (hiding it behind a paper copy that is still «بانتظار العلامة»
 * would take the mark away from the family); a paper exam waits for marks, and
 * a closed one has nothing to show at all.
 */
const ADVANCE: Record<MyExamState, number> = {
  result: 5,
  submitted: 4,
  in_progress: 3,
  available: 2,
  paper: 1,
  closed: 0,
};

/**
 * Mirrors `STATE_ORDER` / `sortStudentExams` in
 * api-server/src/modules/assessment/studentExams.ts, which sorts one roster
 * row's list: what the student can act on first, then everything else, newest
 * first. A child's rows from two teachers are merged here, so the merge has to
 * be put back in the order the server would have given a single list.
 */
const SERVER_STATE_ORDER: Record<MyExamState, number> = {
  in_progress: 0,
  available: 1,
  submitted: 2,
  result: 2,
  closed: 2,
  paper: 2,
};

function serverOrder(a: MyExam, b: MyExam): number {
  const byState = SERVER_STATE_ORDER[a.state] - SERVER_STATE_ORDER[b.state];
  if (byState !== 0) return byState;
  return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
}

/**
 * A parent's list is one entry per roster row; the School tab's picker is one
 * per child (the server's `key`). Same name order as the server's grouping.
 * An exam that two of a child's rows both carry is listed once, as its most
 * advanced copy, and each child's merged list is sorted like the server's.
 */
export function groupChildExams(children: readonly ChildExams[]): ExamGroup[] {
  const byKey = new Map<string, ExamGroup>();
  for (const child of children) {
    const key = child.key || child.studentId;
    const group = byKey.get(key) ?? { key, displayName: child.displayName, exams: [] };
    for (const e of child.exams) {
      const at = group.exams.findIndex(x => x.evaluationId === e.evaluationId);
      if (at === -1) group.exams.push(e);
      else if (ADVANCE[e.state] > ADVANCE[group.exams[at]!.state]) group.exams[at] = e;
    }
    byKey.set(key, group);
  }
  for (const group of byKey.values()) group.exams.sort(serverOrder);
  return [...byKey.values()].sort(
    (a, b) => a.displayName.trim().localeCompare(b.displayName.trim(), 'ar') || (a.key < b.key ? -1 : 1),
  );
}

const timeKey = (e: MyExam) => (e.examTime && TIME.test(e.examTime) ? e.examTime : '99:99');
const titleOf = (e: MyExam) => e.titleAr || e.title || '';

/** Dated today or later, soonest first; whatever their state. */
export function upcomingExams(exams: readonly MyExam[], today: string): MyExam[] {
  return exams
    .filter(e => typeof e.examDate === 'string' && isValidYmd(e.examDate) && e.examDate >= today)
    .sort(
      (a, b) =>
        a.examDate!.localeCompare(b.examDate!) ||
        timeKey(a).localeCompare(timeKey(b)) ||
        titleOf(a).localeCompare(titleOf(b), 'ar'),
    );
}

/** HH:MM in a left-to-right isolate, or null for no (or a malformed) time. */
export function formatExamTime(examTime: string | null | undefined): string | null {
  return examTime && TIME.test(examTime) ? `\u2066${examTime}\u2069` : null;
}

/** The day as DD-MM-YYYY (same as homework), then the time, each isolated. */
export function formatExamWhen(examDate: string, examTime: string | null | undefined): string {
  const time = formatExamTime(examTime);
  return time ? `${formatDueDate(examDate)} ${time}` : formatDueDate(examDate);
}

export type ExamDayKind = 'today' | 'tomorrow' | 'later';

export function examDayKind(examDate: string, today: string): ExamDayKind {
  const badge = dueBadge(examDate, today);
  return badge.kind === 'today' || badge.kind === 'tomorrow' ? badge.kind : 'later';
}
