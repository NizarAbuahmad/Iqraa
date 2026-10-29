/**
 * The arithmetic behind the admin date picker's month view
 * (components/admin/CalendarPicker.tsx), which stands in for the browser's
 * `<input type="date">` on phones.
 *
 * Pure, so a test can load it: the mobile runner cannot import `react-native`.
 * Dates are `YYYY-MM-DD` strings and months are 0-11, as in `Date`.
 */
export type Ymd = { y: number; m: number; d: number };

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function formatYmd({ y, m, d }: Ymd): string {
  return `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`;
}

/** Null for anything that is not a real calendar day (`2026-02-30`, `soon`, ''). */
export function parseYmd(s: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m && probe.getUTCDate() === d ? { y, m, d } : null;
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + m + delta;
  return { y: Math.floor(index / 12), m: ((index % 12) + 12) % 12 };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/**
 * A month as rows of seven, Sunday first (the week the Jordanian school year
 * runs on); `null` pads the days that belong to the neighbouring months.
 */
export function monthWeeks(y: number, m: number): (number | null)[][] {
  const lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** True when `ymd` falls outside `min`..`max` (either may be absent). Same-format strings compare as dates. */
export function isOutOfRange(ymd: string, min?: string, max?: string): boolean {
  return (!!min && ymd < min) || (!!max && ymd > max);
}

export const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Sunday first, one letter each. */
export const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
export const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
