/**
 * What each card of the admin dashboard's «التنزيلات والمتابعون» panel shows for
 * a chosen period: the latest number, and how far it has moved over the period.
 *
 * Kept out of the screen so a test can load it: the mobile runner cannot import
 * anything that pulls in `react-native`.
 */
export type MetricRow = { key: string; value: number; date: string };

/** `last` is "since the previous entry"; `7` / `30` are days; `all` is since the first entry. */
export const GROWTH_PERIODS = ['last', '7', '30', 'all'] as const;
export type GrowthPeriod = (typeof GROWTH_PERIODS)[number];

export type GrowthSummary = {
  /** The newest entry, whatever the period. Null before anything is recorded. */
  last: MetricRow | null;
  /** The entry the change is measured from. Null when there is nothing earlier to compare with. */
  base: MetricRow | null;
  change: number | null;
  /** The newest entry is older than the period's first day: nothing was recorded in it. */
  stale: boolean;
};

/**
 * A signed number or a `YYYY-MM-DD` day inside Arabic text. Left to the bidi
 * algorithm «منذ 2026-09-20» draws the day backwards and «+70» as «70+», so each
 * is isolated left-to-right, as `formatDueDate` does for homework.
 */
export const isolateLtr = (s: string) => `⁦${s}⁩`;

const DAY_MS = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/**
 * `rows` are one metric's entries, oldest first (the order GET /admin/metrics
 * returns them in). `today` is a `YYYY-MM-DD` day, passed in so a test is not
 * tied to the clock.
 */
export function growthSummary(rows: MetricRow[], period: GrowthPeriod, today: string): GrowthSummary {
  const last = rows[rows.length - 1] ?? null;
  if (!last) return { last: null, base: null, change: null, stale: false };

  let base: MetricRow | undefined;
  let stale = false;
  if (period === 'last') {
    base = rows[rows.length - 2];
  } else if (period === 'all') {
    base = rows.length > 1 ? rows[0] : undefined;
  } else {
    const start = dayMs(today) - Number(period) * DAY_MS;
    stale = dayMs(last.date) < start;
    // Where the period began: the last entry on or before its first day, or, when
    // the metric is newer than that, its first entry inside the period.
    const before = rows.filter(r => dayMs(r.date) <= start);
    base = before[before.length - 1] ?? rows.find(r => dayMs(r.date) > start);
  }
  if (!base || base === last) return { last, base: null, change: null, stale };
  return { last, base, change: last.value - base.value, stale };
}
