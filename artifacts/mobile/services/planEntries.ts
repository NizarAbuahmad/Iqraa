/**
 * A teaching plan's schedule: which curriculum lesson is taught on which
 * calendar day.
 *
 * Was week numbers ("week 3") — replaced because a teacher opening the app
 * wants to know what to teach *today*, and a week number does not answer
 * that without also holding the term's start date in their head. A real date
 * does directly: `entryForDate(entries, todayISO())`.
 *
 * A lesson is carried as its **KB id**, never its title —
 * `searchKBSemantic(title)` returns a different lesson for 16 of the
 * picker's 63 lessons, so a plan keyed by title would silently swap «قانون
 * الجيوب» for «قانون جيب التمام» (CLAUDE.md, "A lesson title does not
 * identify a lesson").
 *
 * Stored as one `jsonb` column rather than a child table: a plan's entries
 * are always read and written whole, and nothing queries across plans.
 * Because jsonb will hold whatever was put in it — including rows written by
 * an older client, or by hand, or (until today) week numbers from before this
 * rewrite — nothing here trusts its shape. `normalizePlanEntries` is the only
 * way in, and a `week`-shaped row is simply not a valid entry anymore: it is
 * dropped like any other malformed element, not migrated. This shipped hours
 * before the rewrite, to nobody yet, so there is nothing to carry forward.
 *
 * Free of `@workspace/curriculum` on purpose, so the bare `node --test`
 * runner can load it (CLAUDE.md on `services/__tests__`). Lesson ids are
 * validated as strings here; whether an id still exists in the catalog is the
 * caller's question, and the UI answers it by simply not rendering a lesson
 * it cannot resolve.
 */

export interface PlanEntry {
  lessonId: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
}

/** Guards against a plan row large enough to be a denial of service. */
export const MAX_PLAN_ENTRIES = 200;

/**
 * How far a date may sit from today before it is almost certainly a typo or
 * an attack rather than a real school schedule — three years either way.
 */
const MAX_PLAN_DATE_SPAN_DAYS = 365 * 3;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local device date as `YYYY-MM-DD` — never `toISOString()`, which shifts to UTC and can read as yesterday or tomorrow near midnight. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today, in the device's own local time — the frame a teacher's school day is actually in. */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * A syntactically-plausible, in-range calendar date.
 *
 * Rejects `2026-02-30` and similar: `Date` silently rolls an impossible day
 * forward into the next month, so a naive parse-and-compare-year check would
 * accept it. Re-formatting the parsed date and comparing strings catches it.
 */
export function isValidPlanDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || toISODate(parsed) !== date) return false;
  const spanDays = Math.abs(parsed.getTime() - Date.now()) / 86_400_000;
  return spanDays <= MAX_PLAN_DATE_SPAN_DAYS;
}

function isEntryShape(value: unknown): value is { lessonId: unknown; date: unknown } {
  return typeof value === 'object' && value !== null;
}

/**
 * The only way to turn stored/received JSON into entries.
 *
 * Invalid entries are dropped rather than rejected: this runs against rows
 * that already exist, and one bad element must not make a teacher's whole
 * plan unreadable. A lesson appears at most once — the last date wins, which
 * is what re-assigning a lesson in the UI means.
 */
export function normalizePlanEntries(raw: unknown): PlanEntry[] {
  if (!Array.isArray(raw)) return [];
  const byLesson = new Map<string, string>();
  for (const item of raw) {
    if (!isEntryShape(item)) continue;
    const { lessonId, date } = item;
    if (typeof lessonId !== 'string' || !lessonId) continue;
    if (typeof date !== 'string' || !isValidPlanDate(date)) continue;
    byLesson.set(lessonId, date);
    if (byLesson.size >= MAX_PLAN_ENTRIES) break;
  }
  return [...byLesson].map(([lessonId, date]) => ({ lessonId, date }));
}

/** Add, move, or (with `date: null`) remove a lesson. Returns a new array. */
export function setEntryDate(
  entries: readonly PlanEntry[],
  lessonId: string,
  date: string | null,
): PlanEntry[] {
  const without = entries.filter(e => e.lessonId !== lessonId);
  if (date === null) return without;
  if (!isValidPlanDate(date)) return [...entries];
  if (without.length >= MAX_PLAN_ENTRIES) return [...entries];
  return [...without, { lessonId, date }];
}

export interface PlanDay {
  date: string;
  lessonIds: string[];
}

/**
 * Entries grouped for display, dates ascending.
 *
 * Within a day the entries keep the order they were added in — there is no
 * second key worth inventing, and sorting by lesson id would scramble a
 * unit's own sequence.
 */
export function entriesByDate(entries: readonly PlanEntry[]): PlanDay[] {
  const days = new Map<string, string[]>();
  for (const e of entries) {
    const bucket = days.get(e.date);
    if (bucket) bucket.push(e.lessonId);
    else days.set(e.date, [e.lessonId]);
  }
  // ISO dates sort correctly as plain strings.
  return [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([date, lessonIds]) => ({ date, lessonIds }));
}

/** The date a lesson sits on, or null when it is not in the plan. */
export function dateOf(entries: readonly PlanEntry[], lessonId: string): string | null {
  return entries.find(e => e.lessonId === lessonId)?.date ?? null;
}

/** Every entry on exactly this date — what a teacher is teaching that day. */
export function entriesOnDate(entries: readonly PlanEntry[], date: string): PlanEntry[] {
  return entries.filter(e => e.date === date);
}

/**
 * The soonest entry on or after `fromDate` — "what's next" when nothing is
 * scheduled for today itself. Ties keep entry order, matching `entriesByDate`.
 */
export function nextEntry(entries: readonly PlanEntry[], fromDate: string): PlanEntry | null {
  const upcoming = entries.filter(e => e.date >= fromDate).sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

export interface ScheduleLesson {
  id: string;
  /** Teacher-guide period count; treated as 1 when unknown. */
  periods: number | null;
}

/**
 * Lays out every lesson across a class's meeting days, starting from
 * `startDate`, one entry per lesson.
 *
 * A lesson worth N periods occupies N consecutive meeting-day slots before
 * the next lesson starts — so the term's pacing stays honest even though only
 * one date is recorded per lesson (its first slot). A two-period lesson is
 * not marked as "today" on its second day; `entriesOnDate` is an exact-date
 * match. That is a deliberate simplification, not an oversight — multi-day
 * "still on this lesson" tracking would need a stored duration per entry for
 * a distinction period counts already only approximate.
 * ponytail: single-day-per-lesson only; add a `spanDays` field if teachers
 * actually need "still on this lesson" to survive past its start day.
 *
 * Replaces the whole schedule — this is "lay out my term", not a merge. The
 * caller confirms with the teacher before calling it over existing entries.
 */
export function autoScheduleEntries(
  lessons: readonly ScheduleLesson[],
  startDate: string,
  meetingDays: readonly number[],
): PlanEntry[] {
  const days = [...new Set(meetingDays)].filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!isValidPlanDate(startDate) || days.length === 0 || lessons.length === 0) return [];

  const entries: PlanEntry[] = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  const advance = () => {
    do {
      cursor = new Date(cursor.getTime() + 86_400_000);
    } while (!days.includes(cursor.getDay()));
  };
  // Land the cursor on the first real meeting day at or after startDate,
  // rather than assuming the teacher's chosen start date is itself one.
  while (!days.includes(cursor.getDay())) cursor = new Date(cursor.getTime() + 86_400_000);

  for (const lesson of lessons.slice(0, MAX_PLAN_ENTRIES)) {
    entries.push({ lessonId: lesson.id, date: toISODate(cursor) });
    const span = Math.max(1, lesson.periods ?? 1);
    for (let i = 0; i < span; i++) advance();
  }
  return entries;
}
