/**
 * "What is my day?" — one day's agenda, combining the two schedule features
 * this app has: the weekly recurring period timetable (services/schedule.ts)
 * and each teaching plan's own per-lesson calendar dates
 * (services/planEntries.ts). They are deliberately not merged into one list:
 * a period slot has a time and no lesson; a plan entry has a date and no
 * time-of-day. Forcing them onto one sorted timeline would mean inventing an
 * ordering neither actually states.
 *
 * Free of `@workspace/curriculum` and React Native, so the bare `node --test`
 * runner can load it (CLAUDE.md on `services/__tests__`).
 */
import { normalizePlanEntries, toISODate } from './planEntries.ts';

export interface AgendaPeriod {
  periodNumber: number;
  /** "HH:MM", empty when this slot's period number has no matching period
   *  defined (e.g. the period was deleted after the slot was filled). */
  startTime: string;
  durationMinutes: number;
  classGroupId: string;
}

export interface AgendaLesson {
  planId: string;
  planTitle: string;
  lessonId: string;
}

export interface DayAgenda {
  /** Ascending by period number — the day's own order, not a guess at time. */
  periods: AgendaPeriod[];
  lessons: AgendaLesson[];
}

export interface SchedulePeriodLike {
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
}

export interface ScheduleSlotLike {
  dayOfWeek: number;
  periodNumber: number;
  classGroupId: string | null;
}

export interface PlanLike {
  id: string;
  title: string;
  entries: unknown;
}

/** Everything scheduled on one calendar date: this weekday's recurring
 *  periods, plus any lesson any plan has entered for this exact date. */
export function buildDayAgenda(
  date: string,
  periods: readonly SchedulePeriodLike[],
  slots: readonly ScheduleSlotLike[],
  plans: readonly PlanLike[],
): DayAgenda {
  const parsed = new Date(`${date}T00:00:00`);
  const dayOfWeek = Number.isNaN(parsed.getTime()) ? -1 : parsed.getDay();

  const agendaPeriods: AgendaPeriod[] = slots
    .filter(s => s.dayOfWeek === dayOfWeek && s.classGroupId)
    .map(s => {
      const period = periods.find(p => p.periodNumber === s.periodNumber);
      return {
        periodNumber: s.periodNumber,
        startTime: period?.startTime ?? '',
        durationMinutes: period?.durationMinutes ?? 0,
        classGroupId: s.classGroupId as string,
      };
    })
    .sort((a, b) => a.periodNumber - b.periodNumber);

  const agendaLessons: AgendaLesson[] = plans.flatMap(plan =>
    normalizePlanEntries(plan.entries)
      .filter(e => e.date === date)
      .map(e => ({ planId: plan.id, planTitle: plan.title, lessonId: e.lessonId })),
  );

  return { periods: agendaPeriods, lessons: agendaLessons };
}

/** True if a day has anything at all — the calendar grid's per-cell dot. */
export function dayHasAgenda(agenda: DayAgenda): boolean {
  return agenda.periods.length > 0 || agenda.lessons.length > 0;
}

/**
 * The 42 dates (6 fixed weeks) a month-grid calendar renders, including the
 * lead-in/lead-out days from the adjacent months that fill the first and
 * last rows. Always 6 rows rather than trimming a 4-or-5-row month: a
 * calendar that changes height every month is more surprising than a
 * calendar with a mostly-empty last row.
 */
export function monthGridDates(year: number, month: number): string[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) =>
    toISODate(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)),
  );
}

/** Whether an ISO date string falls within the given month (0-based). */
export function isInMonth(date: string, year: number, month: number): boolean {
  const d = new Date(`${date}T00:00:00`);
  return d.getFullYear() === year && d.getMonth() === month;
}
