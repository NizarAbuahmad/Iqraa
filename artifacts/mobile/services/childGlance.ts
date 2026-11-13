/**
 * «نظرة سريعة» — the card at the top of a parent's «المدرسة»: for the child the picker shows, how much homework is
 * due in the next seven days, how much is late, the next dated exam and the latest released result. Pure, built from
 * the three lists the screen already loads (no new API), so `node --test` pins it.
 *
 * It must say nothing the rows below would not:
 * - «متأخّر» counts only items someone can tick (`canTrack`) that are not done and the server calls overdue — exactly
 *   the rows that wear the red badge. An untracked item is never called late.
 * - «مطلوب» is a calendar fact (a due day in the window), so an untracked item counts; a tracked one already done does not.
 * - A list that has not loaded (or failed) is `null` here, and its lines are left out rather than shown as zero: «لا
 *   واجبات» while homework failed to load would be a claim the screen cannot back.
 *
 * Days are Amman calendar days compared as `YYYY-MM-DD` strings (`ammanToday`, `addDays`), never a device-local `Date`.
 */
import { addDays, dueBadge, type DueBadge, type FamilyHomework } from './homework.ts';
import type { MyExam } from './myExams.ts';
import { upcomingExams } from './upcomingExams.ts';

/** The window «مطلوب» counts: today and the six days after it. */
export const GLANCE_DAYS = 7;

export interface ChildGlance {
  /** Homework lines: null when the homework list is not loaded. */
  homework: { dueSoon: number; late: number } | null;
  /** Exam lines: null when the exam list is not loaded. */
  exams: { next: { exam: MyExam; day: DueBadge } | null; lastResult: MyExam | null } | null;
}

export function childGlance(input: {
  homework: readonly FamilyHomework[] | null;
  exams: readonly MyExam[] | null;
  today: string;
}): ChildGlance {
  const { today } = input;
  const last = addDays(today, GLANCE_DAYS - 1);
  const homework = input.homework
    ? {
        dueSoon: input.homework.filter(h => !(h.canTrack && h.done) && h.dueDate >= today && h.dueDate <= last).length,
        late: input.homework.filter(h => h.canTrack && !h.done && h.state === 'overdue').length,
      }
    : null;

  let exams: ChildGlance['exams'] = null;
  if (input.exams) {
    const soonest = upcomingExams(input.exams, today)[0] ?? null;
    const released = input.exams
      .filter(e => e.result !== null && e.result !== undefined)
      .sort((a, b) => (b.submittedAt ?? b.publishedAt ?? '').localeCompare(a.submittedAt ?? a.publishedAt ?? ''));
    exams = {
      next: soonest ? { exam: soonest, day: dueBadge(soonest.examDate!, today) } : null,
      lastResult: released[0] ?? null,
    };
  }
  return { homework, exams };
}

/** Whether the card has anything to show: at least one of its lists loaded. */
export function glanceHasContent(g: ChildGlance): boolean {
  return g.homework !== null || g.exams !== null;
}
