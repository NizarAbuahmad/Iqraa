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

export type HistoryRow = { date: string; value: number; change: number | null };

/**
 * The entries behind a card, newest first, each with how far it moved from the
 * entry before it (null for the very first entry ever, which has no earlier one
 * even when it is the last row shown). `rows` are oldest first.
 */
export function growthHistory(rows: MetricRow[], limit = 10): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (let i = rows.length - 1; i >= 0 && out.length < limit; i--) {
    const r = rows[i]!;
    out.push({ date: r.date, value: r.value, change: i > 0 ? r.value - rows[i - 1]!.value : null });
  }
  return out;
}

/** One dot of a card's trend line. Both axes run 0..1; `y` 1 is the highest value. */
export type SparkPoint = { x: number; y: number };

const SPARK_LAST_ENTRIES = 8;
const SPARK_ALL_ENTRIES = 60;

/**
 * The trend line under a card: the entries the period's change is measured
 * over, spread along the time axis by their dates (so a month-long gap is a
 * long stretch, not one step). Empty when there are fewer than two entries to
 * join, or when nothing was recorded inside the period.
 */
export function sparkPoints(rows: MetricRow[], period: GrowthPeriod, today: string): SparkPoint[] {
  let shown: MetricRow[];
  if (period === 'last') shown = rows.slice(-SPARK_LAST_ENTRIES);
  else if (period === 'all') shown = rows.slice(-SPARK_ALL_ENTRIES);
  else {
    const { base, stale } = growthSummary(rows, period, today);
    shown = stale ? [] : rows.slice(base ? rows.indexOf(base) : Math.max(rows.length - 1, 0));
  }
  if (shown.length < 2) return [];

  const t0 = dayMs(shown[0]!.date);
  const span = dayMs(shown[shown.length - 1]!.date) - t0;
  const values = shown.map(r => r.value);
  const lo = Math.min(...values);
  const range = Math.max(...values) - lo;
  return shown.map((r, i) => ({
    // Entries all on one day have no time to spread over, so they go evenly.
    x: span > 0 ? (dayMs(r.date) - t0) / span : i / (shown.length - 1),
    y: range > 0 ? (r.value - lo) / range : 0.5,
  }));
}

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
