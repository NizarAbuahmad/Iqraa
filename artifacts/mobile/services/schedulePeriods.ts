/**
 * Period-time arithmetic for the weekly timetable (app/schedule).
 *
 * The one-period-at-a-time editor is how production ended up with
 * الحصة 1 = 11:00, الحصة 2 = 10:00, الحصة 3 = 09:00 — a teacher typing seven
 * times by hand gets one wrong. `generatePeriods` asks for the three things
 * a school day is actually defined by (how many, when it starts, how long
 * each is — plus an optional break) and lays out the whole day in order.
 * Individual periods stay editable afterwards.
 *
 * Mirrors the bounds in artifacts/api-server/src/lib/schedule.ts, which is
 * the trust boundary; this side only exists so a wrong value is caught in
 * the form rather than as a 400. Free of React Native and
 * `@workspace/curriculum` so the bare `node --test` runner loads it.
 */

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MIN_PERIOD_COUNT = 1;
export const MAX_PERIOD_COUNT = 12;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 480;
const MINUTES_PER_DAY = 24 * 60;

export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && TIME_RE.test(s);
}

export function isValidDuration(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_DURATION_MINUTES && n <= MAX_DURATION_MINUTES;
}

/** "08:45" → 525. Caller guarantees `isValidTime`. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

/** 525 → "08:45". Caller guarantees 0 ≤ m < 1440. */
export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * "08:45" + 45 → "09:30". Returns null when the result would leave the day
 * (a period cannot end tomorrow) or the input is malformed — the caller
 * decides whether that is "show nothing" or "refuse the form".
 */
export function addMinutes(hhmm: string, minutes: number): string | null {
  if (!isValidTime(hhmm) || !Number.isInteger(minutes) || minutes < 0) return null;
  const total = toMinutes(hhmm) + minutes;
  if (total >= MINUTES_PER_DAY) return null;
  return fromMinutes(total);
}

/** When a period ends, or '' if its own data does not add up. */
export function endTime(period: { startTime: string; durationMinutes: number }): string {
  return addMinutes(period.startTime, period.durationMinutes) ?? '';
}

/** "08:00–08:45" for a header cell; just the start when the end is unknown. */
export function formatRange(period: { startTime: string; durationMinutes: number }): string {
  const end = endTime(period);
  return end ? `${period.startTime}–${end}` : period.startTime;
}

export interface GeneratePeriodsInput {
  count: number;
  firstStart: string;
  durationMinutes: number;
  /** 1-based period after which the break falls; null/undefined = no break. */
  breakAfter?: number | null;
  breakMinutes?: number | null;
}

export interface GeneratedPeriod {
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
}

/**
 * The whole day's periods, back to back, with one optional break.
 *
 * Returns `[]` rather than a partial list when the day does not fit —
 * generating six of seven periods and stopping silently is exactly the
 * "one wrong time" this exists to prevent. The wizard shows a hint instead.
 */
export function generatePeriods(input: GeneratePeriodsInput): GeneratedPeriod[] {
  const { count, firstStart, durationMinutes } = input;
  if (!Number.isInteger(count) || count < MIN_PERIOD_COUNT || count > MAX_PERIOD_COUNT) return [];
  if (!isValidTime(firstStart) || !isValidDuration(durationMinutes)) return [];

  const breakAfter = input.breakAfter ?? null;
  const breakMinutes = input.breakMinutes ?? 0;
  const hasBreak = breakAfter !== null && Number.isInteger(breakAfter) && breakAfter >= 1 && breakAfter < count;
  if (hasBreak && (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > MAX_DURATION_MINUTES)) return [];

  const periods: GeneratedPeriod[] = [];
  let cursor = toMinutes(firstStart);
  for (let n = 1; n <= count; n++) {
    if (cursor + durationMinutes > MINUTES_PER_DAY) return [];
    periods.push({ periodNumber: n, startTime: fromMinutes(cursor), durationMinutes });
    cursor += durationMinutes;
    if (hasBreak && n === breakAfter) cursor += breakMinutes;
  }
  return periods;
}
