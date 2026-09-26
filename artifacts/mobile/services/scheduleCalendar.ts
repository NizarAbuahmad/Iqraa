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
  schoolName: string;
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
  /** In clock order (see `byClock`). */
  periods: AgendaPeriod[];
  lessons: AgendaLesson[];
}

/** `schoolName` absent reads as "", the unnamed default school. */
export interface SchedulePeriodLike {
  schoolName?: string;
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
}

export interface ScheduleSlotLike {
  schoolName?: string;
  dayOfWeek: number;
  periodNumber: number;
  classGroupId: string | null;
  notes?: string;
}

const schoolOf = (row: { schoolName?: string }): string => row.schoolName ?? '';

/**
 * Clock order, then period number. Period number alone is the day's order
 * within one school, but two schools' "period 1" are unrelated times; the
 * clock is the only order that interleaves them. A period whose time is
 * unknown sorts last.
 */
function byClock(a: { startTime: string; periodNumber: number }, b: { startTime: string; periodNumber: number }): number {
  const ta = a.startTime || '99:99';
  const tb = b.startTime || '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.periodNumber - b.periodNumber;
}

function findPeriod<P extends SchedulePeriodLike>(periods: readonly P[], slot: ScheduleSlotLike): P | undefined {
  return periods.find(p => p.periodNumber === slot.periodNumber && schoolOf(p) === schoolOf(slot));
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
      const period = findPeriod(periods, s);
      return {
        schoolName: schoolOf(s),
        periodNumber: s.periodNumber,
        startTime: period?.startTime ?? '',
        durationMinutes: period?.durationMinutes ?? 0,
        classGroupId: s.classGroupId as string,
      };
    })
    .sort(byClock);

  const agendaLessons: AgendaLesson[] = plans.flatMap(plan =>
    normalizePlanEntries(plan.entries)
      .filter(e => e.date === date)
      .map(e => ({ planId: plan.id, planTitle: plan.title, lessonId: e.lessonId })),
  );

  return { periods: agendaPeriods, lessons: agendaLessons };
}

export interface DayRow {
  schoolName: string;
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
  /** null for a free period — unlike the agenda, the day list shows those, so they can be filled. */
  classGroupId: string | null;
  notes: string;
}

/** Every period of every school on one weekday, filled or empty, in clock order. */
export function dayRows(
  dayOfWeek: number,
  periods: readonly SchedulePeriodLike[],
  slots: readonly ScheduleSlotLike[],
): DayRow[] {
  return periods
    .map(p => {
      const slot = slots.find(
        s => s.dayOfWeek === dayOfWeek && s.periodNumber === p.periodNumber && schoolOf(s) === schoolOf(p),
      );
      return {
        schoolName: schoolOf(p),
        periodNumber: p.periodNumber,
        startTime: p.startTime,
        durationMinutes: p.durationMinutes,
        classGroupId: slot?.classGroupId ?? null,
        notes: slot?.notes ?? '',
      };
    })
    .sort(byClock);
}

/** Distinct schools, the unnamed default first, then alphabetical. */
export function schoolsOf(
  periods: readonly SchedulePeriodLike[],
  slots: readonly ScheduleSlotLike[] = [],
): string[] {
  const names = new Set([...periods, ...slots].map(schoolOf));
  return [...names].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
}

const JORDAN_SCHOOL_WEEK = [0, 1, 2, 3, 4];

/** Sunday–Thursday, plus Friday/Saturday when asked for or when a class already sits on one. */
export function visibleWeekdays(slots: readonly ScheduleSlotLike[], showWeekend: boolean): number[] {
  if (showWeekend) return [0, 1, 2, 3, 4, 5, 6];
  const weekend = [5, 6].filter(d => slots.some(s => s.dayOfWeek === d && s.classGroupId));
  return [...JORDAN_SCHOOL_WEEK, ...weekend];
}

/** Today if it is a school day, otherwise the next one — Friday opens on Sunday. */
export function defaultDay(today: number, visible: readonly number[]): number {
  for (let i = 0; i < 7; i++) {
    const d = (today + i) % 7;
    if (visible.includes(d)) return d;
  }
  return visible[0] ?? 0;
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "HH:MM" a period ends, wrapping past midnight; "" for an unknown start. */
export function endTime(startTime: string, durationMinutes: number): string {
  const start = toMinutes(startTime);
  if (start === null) return '';
  const end = (start + durationMinutes) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** Whether `now` falls inside the period, start inclusive, end exclusive. */
export function isHappeningNow(startTime: string, durationMinutes: number, now: Date): boolean {
  const start = toMinutes(startTime);
  if (start === null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start && current < start + durationMinutes;
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
