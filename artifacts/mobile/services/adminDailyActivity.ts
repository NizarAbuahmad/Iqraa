/**
 * What the dashboard's daily-activity chart reads off GET /admin/daily-activity: how tall each
 * stacked bar is and the few numbers under it.
 *
 * Kept out of the component so a test can load it: the mobile runner cannot import anything that
 * pulls in `react-native`.
 *
 * "Active" is the API's definition (generated with AI or saved a material, once per person per Amman
 * day), not "opened the app" — see the API route and the status log.
 */
export type DailyActivityDay = {
  day: string;
  active: number;
  /** Of `active`, accounts created that same day. */
  new: number;
  /** Of `active`, accounts created on an earlier day. */
  returning: number;
  /** Accounts created that day, active or not. */
  signups: number;
};

export type DailyActivityResponse = { timezone: string; days: DailyActivityDay[] };

/** The tallest bar's value; at least 1 so an empty window never divides by zero. */
export function chartMax(days: DailyActivityDay[]): number {
  return Math.max(1, ...days.map(d => d.active));
}

/** Each segment's height as a share of the chart, so the two stack to the day's total. */
export function barRatios(d: DailyActivityDay, max: number): { newRatio: number; returningRatio: number } {
  return { newRatio: d.new / max, returningRatio: d.returning / max };
}

export type ActivityTotals = {
  /** Mean of `active` over every day in the window, quiet days included. */
  averageActive: number;
  /** The busiest day (the earliest when two tie); null when nobody was active. */
  peak: { day: string; active: number } | null;
  newPersonDays: number;
  returningPersonDays: number;
  signups: number;
};

export function activityTotals(days: DailyActivityDay[]): ActivityTotals {
  let peak: ActivityTotals['peak'] = null;
  let newPersonDays = 0;
  let returningPersonDays = 0;
  let signups = 0;
  let activeSum = 0;
  for (const d of days) {
    activeSum += d.active;
    newPersonDays += d.new;
    returningPersonDays += d.returning;
    signups += d.signups;
    if (d.active > 0 && (!peak || d.active > peak.active)) peak = { day: d.day, active: d.active };
  }
  return {
    averageActive: days.length ? activeSum / days.length : 0,
    peak,
    newPersonDays,
    returningPersonDays,
    signups,
  };
}
