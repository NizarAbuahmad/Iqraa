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
import type { ChildExams, MyExam } from './myExams.ts';

export interface ExamGroup {
  key: string;
  displayName: string;
  exams: MyExam[];
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A parent's list is one entry per roster row; the School tab's picker is one
 * per child (the server's `key`). Same name order as the server's grouping.
 */
export function groupChildExams(children: readonly ChildExams[]): ExamGroup[] {
  const byKey = new Map<string, ExamGroup>();
  for (const child of children) {
    const key = child.key || child.studentId;
    const group = byKey.get(key) ?? { key, displayName: child.displayName, exams: [] };
    for (const e of child.exams) {
      if (!group.exams.some(x => x.evaluationId === e.evaluationId)) group.exams.push(e);
    }
    byKey.set(key, group);
  }
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
