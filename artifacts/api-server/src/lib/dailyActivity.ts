/**
 * Pure pieces of GET /admin/daily-activity: the `days` parameter and the zero-filled daily series.
 * The SQL lives in the route; this file has no database import so `node --test` can load it.
 *
 * A "day" is a calendar day in Asia/Amman, a fixed UTC+3 — the same day the homework due dates and
 * the product's teachers use (see CLAUDE.md «A homework due date is a calendar day»).
 */

export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;

/** Amman is a fixed UTC+3 (no daylight saving since 2022). */
export const AMMAN_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDays(raw: unknown): { days: number } | { error: string } {
  if (raw === undefined) return { days: DEFAULT_DAYS };
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return { error: "days must be a whole number" };
  const days = Number(raw);
  if (days < 1 || days > MAX_DAYS) return { error: `days must be between 1 and ${MAX_DAYS}` };
  return { days };
}

/** The Amman calendar day (YYYY-MM-DD) an instant falls on. */
export function ammanDay(at: Date): string {
  return new Date(at.getTime() + AMMAN_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The instant the given Amman day starts, as a UTC `Date`. */
export function ammanDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - AMMAN_OFFSET_HOURS * 60 * 60 * 1000);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export interface ActivityRow {
  day: string;
  active: number;
  newUsers: number;
  returningUsers: number;
}

export interface SignupRow {
  day: string;
  count: number;
}

export interface DailyActivity {
  day: string;
  /** Distinct users who generated with AI or saved a material that day. */
  active: number;
  /** Of those, accounts created that same day. */
  new: number;
  /** Of those, accounts created on an earlier day. */
  returning: number;
  /** Accounts created that day, active or not. */
  signups: number;
}

/** One entry per day, oldest first, the last being `endDay`; days with no rows are zeros. */
export function buildDailySeries(
  endDay: string,
  days: number,
  activity: ActivityRow[],
  signups: SignupRow[],
): DailyActivity[] {
  const byDay = new Map(activity.map((r) => [r.day, r]));
  const signupsByDay = new Map(signups.map((r) => [r.day, r.count]));
  const series: DailyActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(endDay, -i);
    const row = byDay.get(day);
    series.push({
      day,
      active: row?.active ?? 0,
      new: row?.newUsers ?? 0,
      returning: row?.returningUsers ?? 0,
      signups: signupsByDay.get(day) ?? 0,
    });
  }
  return series;
}
