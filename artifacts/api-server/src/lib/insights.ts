/**
 * Pure pieces of the admin insights page (`routes/adminInsights.ts`,
 * docs/superpowers/specs/2026-11-19-admin-user-insights-design.md): the period parameter, the
 * small-group suppression on the demographic breakdowns, and the weekly retention cohorts.
 * The SQL lives in the route; this file has no database import so `node --test` can load it.
 */
import { addDays } from "./dailyActivity.ts";

export const INSIGHTS_DAYS = [7, 30, 90] as const;
export const DEFAULT_INSIGHTS_DAYS = 30;

export function parseInsightsDays(raw: unknown): { days: number } | { error: string } {
  if (raw === undefined) return { days: DEFAULT_INSIGHTS_DAYS };
  const days = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(INSIGHTS_DAYS as readonly number[]).includes(days)) return { error: "days must be 7, 30 or 90" };
  return { days };
}

/**
 * The page's role filter (`?role=`). `teacher` is everyone who uses the teacher app — a school
 * admin included — while a `system_admin` is the team and is never counted (`COUNTED_ROLES`).
 */
export const INSIGHTS_ROLES = ["all", "teacher", "student", "parent"] as const;
export type InsightsRole = (typeof INSIGHTS_ROLES)[number];

const ROLE_GROUPS: Record<InsightsRole, readonly string[]> = {
  all: ["teacher", "school_admin", "student", "parent"],
  teacher: ["teacher", "school_admin"],
  student: ["student"],
  parent: ["parent"],
};

/** The account roles a filter counts. Never `system_admin`, whatever the filter. */
export function rolesOf(role: InsightsRole): readonly string[] {
  return ROLE_GROUPS[role];
}

export function parseInsightsRole(raw: unknown): { role: InsightsRole } | { error: string } {
  if (raw === undefined || raw === "") return { role: "all" };
  if (typeof raw === "string" && (INSIGHTS_ROLES as readonly string[]).includes(raw)) return { role: raw as InsightsRole };
  return { error: `role must be one of ${INSIGHTS_ROLES.join(", ")}` };
}

/**
 * A breakdown cell for fewer people than this is shown as "<3", so a breakdown — alone or
 * against another one — cannot point at one teacher ("the only woman over 50 in Karak").
 */
export const MIN_GROUP = 3;

export interface BreakdownRow {
  key: string;
  /** null when the group is 1–2 people (suppressed). */
  count: number | null;
}

export interface Breakdown {
  /**
   * People with an answer, and people without one. Both are null when any cell is hidden: with
   * either of them (and the teacher total shown on the page), a single hidden cell is the
   * difference of what is shown — «male 10, female <3, answered 12» says female is 2.
   */
  answered: number | null;
  unanswered: number | null;
  /** Largest first; suppressed cells last. */
  rows: BreakdownRow[];
}

/** Hides both totals when any cell is hidden, so no cell can be recovered by subtraction. */
function sealTotals(answered: number, unanswered: number, rows: BreakdownRow[]): Breakdown {
  const anyHidden = rows.some((r) => r.count === null) || (answered > 0 && answered < MIN_GROUP);
  return anyHidden ? { answered: null, unanswered: null, rows } : { answered, unanswered, rows };
}

/** Counts per value (`key: null` = no answer) → a suppressed breakdown. */
export function breakdown(counts: { key: string | null; count: number }[]): Breakdown {
  let answered = 0;
  let unanswered = 0;
  const shown: BreakdownRow[] = [];
  const hidden: BreakdownRow[] = [];
  for (const { key, count } of counts) {
    if (key === null || key === "") {
      unanswered += count;
      continue;
    }
    answered += count;
    if (count > 0 && count < MIN_GROUP) hidden.push({ key, count: null });
    else shown.push({ key, count });
  }
  shown.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.key.localeCompare(b.key));
  hidden.sort((a, b) => a.key.localeCompare(b.key));
  return sealTotals(answered, unanswered, [...shown, ...hidden]);
}

/** How far back the route reads activity: the longest period, which also covers churn (44 days) and the cohorts (8 weeks). */
export const ACTIVITY_LOOKBACK_DAYS = 90;

/** "Churned" = active in the CHURN_BEFORE days that ended CHURN_QUIET days ago, and not since. */
export const CHURN_QUIET_DAYS = 14;
export const CHURN_BEFORE_DAYS = 30;

export interface ActivitySummary {
  /** People active at least once in the period. */
  active: number;
  /** Of those, active on two or more different days. */
  returning: number;
  /** Active in the 30 days before the last 14, and not in the last 14 — independent of the period. */
  churned: number;
  /** Distinct active days in the period, per person. */
  activeDays: Map<string, number>;
}

/**
 * From (person, active day) pairs — one per person per Amman day, any source — to the period's
 * active / returning counts and the churn count. `endDay` is today (Amman).
 */
export function summarizeActivity(rows: { userId: string; day: string }[], endDay: string, days: number): ActivitySummary {
  const from = addDays(endDay, -(days - 1));
  const quietFrom = addDays(endDay, -(CHURN_QUIET_DAYS - 1));
  const churnFrom = addDays(quietFrom, -CHURN_BEFORE_DAYS);
  const daysInPeriod = new Map<string, Set<string>>();
  const before = new Set<string>();
  const recent = new Set<string>();
  for (const { userId, day } of rows) {
    if (day >= from && day <= endDay) {
      if (!daysInPeriod.has(userId)) daysInPeriod.set(userId, new Set());
      daysInPeriod.get(userId)!.add(day);
    }
    if (day >= quietFrom && day <= endDay) recent.add(userId);
    else if (day >= churnFrom && day < quietFrom) before.add(userId);
  }
  const activeDays = new Map([...daysInPeriod].map(([u, d]) => [u, d.size]));
  return {
    active: activeDays.size,
    returning: [...activeDays.values()].filter((n) => n >= 2).length,
    churned: [...before].filter((u) => !recent.has(u)).length,
    activeDays,
  };
}

/**
 * A breakdown where one person can hold several values (the subjects or grades a teacher teaches).
 * The rows are per value, as `breakdown`; but summing them would count a two-subject teacher twice,
 * so who answered is given separately: `withAny` people hold at least one value, of `total`.
 */
export function multiValueBreakdown(counts: { key: string; count: number }[], withAny: number, total: number): Breakdown {
  const { rows } = breakdown(counts);
  return sealTotals(withAny, Math.max(0, total - withAny), rows);
}

/** The Sunday (Jordan's school week starts on Sunday) of a `YYYY-MM-DD` day. */
export function weekStartOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -dow);
}

export interface Cohort {
  /** The Sunday the sign-up week starts. */
  week: string;
  size: number;
  /** active[i] = how many of the cohort were active in week `week + i` (i = 0 is the sign-up week). */
  active: number[];
}

/**
 * Retention by sign-up week, oldest first, ending with `currentWeek`: each cohort's size, and how
 * many of its people were active in each week from their sign-up week up to the current one.
 * Activity by anyone outside the cohorts (an older account) is ignored.
 */
export function buildCohorts(
  currentWeek: string,
  weeks: number,
  signups: { userId: string; signupWeek: string }[],
  activity: { userId: string; week: string }[],
): Cohort[] {
  const weekList: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) weekList.push(addDays(currentWeek, -7 * i));
  const cohortOf = new Map(signups.map((s) => [s.userId, s.signupWeek]));
  const activeSets = new Map<string, Set<string>>(); // `${cohort}|${week}` → users
  for (const { userId, week } of activity) {
    const cohort = cohortOf.get(userId);
    if (!cohort || week < cohort) continue;
    const k = `${cohort}|${week}`;
    if (!activeSets.has(k)) activeSets.set(k, new Set());
    activeSets.get(k)!.add(userId);
  }
  return weekList.map((week, idx) => {
    const size = signups.filter((s) => s.signupWeek === week).length;
    const active = weekList.slice(idx).map((w) => activeSets.get(`${week}|${w}`)?.size ?? 0);
    return { week, size, active };
  });
}
