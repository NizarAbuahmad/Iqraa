/**
 * «الجدول الأسبوعي» for a student or parent — pure types and helpers. The
 * server assembles the week from the teachers' own timetables (api-server
 * `modules/schedule`), so it is only as complete as the teachers who have
 * filled theirs in; an empty week means "not entered yet", never "no lessons".
 *
 * The fetchers live in `familyScheduleApi.ts`.
 */
import { endTime } from './scheduleCalendar.ts';
import type { TranslationKey } from './i18n.ts';

export interface FamilyPeriod {
  periodNumber: number;
  /** "HH:MM" — null when the teacher never set this period's time. */
  startTime: string | null;
  durationMinutes: number | null;
  /** '' when it cannot be told without guessing. */
  subjectId: string;
  teacherName: string;
  notes: string;
}

export interface FamilyDay {
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  dayOfWeek: number;
  periods: FamilyPeriod[];
}

export interface FamilySchedule {
  days: FamilyDay[];
}

export interface ChildSchedule {
  key: string;
  displayName: string;
  schedule: FamilySchedule;
}

/** Index = `dayOfWeek`. */
export const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'schoolDaySun',
  'schoolDayMon',
  'schoolDayTue',
  'schoolDayWed',
  'schoolDayThu',
  'schoolDayFri',
  'schoolDaySat',
];

function isDay(d: unknown): d is FamilyDay {
  return (
    typeof d === 'object' &&
    d !== null &&
    typeof (d as FamilyDay).dayOfWeek === 'number' &&
    Array.isArray((d as FamilyDay).periods)
  );
}

/** Anything that is not a schedule reads as an empty one, so the screen shows "nothing yet". */
export function normalizeSchedule(raw: unknown): FamilySchedule {
  const days = (raw as { days?: unknown } | null | undefined)?.days;
  return { days: Array.isArray(days) ? days.filter(isDay) : [] };
}

/** "08:00–08:45", or null when the time was never set. */
export function periodTimeLabel(p: FamilyPeriod): string | null {
  if (!p.startTime || p.durationMinutes === null) return null;
  const end = endTime(p.startTime, p.durationMinutes);
  return end ? `${p.startTime}–${end}` : p.startTime;
}

export function activeChild(children: readonly ChildSchedule[], selectedKey: string | null): ChildSchedule | null {
  return children.find(c => c.key === selectedKey) ?? children[0] ?? null;
}
