/**
 * Does a laid-out teaching plan hold up against the curriculum and the
 * timetable it was made for?
 *
 * `parsePlanEntries` (API) and `normalizePlanEntries` (client) already answer
 * "is each entry well formed" — a real date, a lesson id, no duplicates. What
 * neither can say is whether the *plan* is sensible: that it names lessons the
 * class actually has, teaches them in the book's order, puts them on days the
 * class meets, and leaves each lesson the periods the teacher guide gives it.
 *
 * Returns issues, never throws and never edits: a teacher may deliberately
 * reorder or skip lessons, so this is for auditing a generated plan
 * (`autoScheduleEntries`) and for flagging a hand-made one, not for rejecting.
 *
 * Free of `@workspace/curriculum` like `planEntries.ts`, so bare `node --test`
 * loads it — the caller passes the class's lessons in book order.
 */
import type { PlanEntry, ScheduleLesson } from './planEntries.ts';

export type PlanIssueCode =
  | 'unknown_lesson'
  | 'duplicate_lesson'
  | 'out_of_order'
  | 'missing_lesson'
  | 'off_meeting_day'
  | 'too_tight';

export interface PlanIssue {
  code: PlanIssueCode;
  lessonId: string;
  detail?: string;
}

export interface PlanCheckOptions {
  /** Weekdays the class meets, 0 = Sunday … 6 = Saturday. Omit to skip the timetable checks. */
  meetingDays?: readonly number[];
  /** Every lesson must appear — true for a generated plan, false for a teacher's partial one. */
  requireAll?: boolean;
}

const dayOf = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

/** Meeting-day slots in (from, to] — how many class sessions lie between two lessons. */
function slotsBetween(from: string, to: string, days: ReadonlySet<number>): number {
  let n = 0;
  const end = new Date(`${to}T00:00:00`).getTime();
  for (let t = new Date(`${from}T00:00:00`).getTime() + 86_400_000; t <= end; t += 86_400_000) {
    if (days.has(new Date(t).getDay())) n += 1;
  }
  return n;
}

export function checkPlan(
  entries: readonly PlanEntry[],
  lessons: readonly ScheduleLesson[],
  options: PlanCheckOptions = {},
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const bookIndex = new Map(lessons.map((l, i) => [l.id, i]));
  const days = options.meetingDays ? new Set(options.meetingDays) : null;

  const seen = new Set<string>();
  for (const e of entries) {
    if (!bookIndex.has(e.lessonId)) issues.push({ code: 'unknown_lesson', lessonId: e.lessonId });
    if (seen.has(e.lessonId)) issues.push({ code: 'duplicate_lesson', lessonId: e.lessonId });
    seen.add(e.lessonId);
    if (days && !days.has(dayOf(e.date))) {
      issues.push({ code: 'off_meeting_day', lessonId: e.lessonId, detail: e.date });
    }
  }

  // Calendar order, ties kept in entry order (the same rule `entriesByDate` uses).
  const byDate = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .map(x => x.e)
    .filter(e => bookIndex.has(e.lessonId));

  for (let i = 1; i < byDate.length; i++) {
    const prev = byDate[i - 1]!;
    const cur = byDate[i]!;
    if (bookIndex.get(cur.lessonId)! < bookIndex.get(prev.lessonId)!) {
      issues.push({ code: 'out_of_order', lessonId: cur.lessonId, detail: `taught after ${prev.lessonId}` });
    }
    // The previous lesson is owed `periods` sessions before the next begins.
    // Only meaningful with a timetable, and only when the lesson has a real count.
    const owed = lessons[bookIndex.get(prev.lessonId)!]!.periods;
    if (days && owed && owed > 1) {
      const given = slotsBetween(prev.date, cur.date, days);
      if (given < owed) {
        issues.push({
          code: 'too_tight',
          lessonId: prev.lessonId,
          detail: `${owed} periods needed, ${given} before ${cur.lessonId}`,
        });
      }
    }
  }

  if (options.requireAll) {
    for (const l of lessons) if (!seen.has(l.id)) issues.push({ code: 'missing_lesson', lessonId: l.id });
  }
  return issues;
}
