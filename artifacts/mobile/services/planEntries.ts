/**
 * A teaching plan's schedule: which curriculum lesson is taught in which week.
 *
 * This replaces `topics` (free text) and `date` (free text). A lesson is
 * carried as its **KB id**, never its title — `searchKBSemantic(title)`
 * returns a different lesson for 16 of the picker's 63 lessons, so a plan
 * keyed by title would silently swap «قانون الجيوب» for «قانون جيب التمام»
 * (CLAUDE.md, "A lesson title does not identify a lesson").
 *
 * Stored as one `jsonb` column rather than a child table: a plan's entries are
 * always read and written whole, and nothing queries across plans. Because
 * jsonb will hold whatever was put in it — including rows written by an older
 * client, or by hand — nothing here trusts its shape. `normalizePlanEntries`
 * is the only way in.
 *
 * Free of `@workspace/curriculum` on purpose, so the bare `node --test` runner
 * can load it (CLAUDE.md on `services/__tests__`). Lesson ids are validated as
 * strings here; whether an id still exists in the catalog is the caller's
 * question, and the UI answers it by simply not rendering a lesson it cannot
 * resolve.
 */

export interface PlanEntry {
  lessonId: string;
  /** 1-based week within the plan. */
  week: number;
}

/** Guards against a plan row large enough to be a denial of service. */
export const MAX_PLAN_ENTRIES = 200;
/** A school year is ~40 weeks; 60 leaves room without accepting nonsense. */
export const MAX_PLAN_WEEK = 60;

function isEntry(value: unknown): value is { lessonId: unknown; week: unknown } {
  return typeof value === 'object' && value !== null;
}

/**
 * The only way to turn stored/received JSON into entries.
 *
 * Invalid entries are dropped rather than rejected: this runs against rows
 * that already exist, and one bad element must not make a teacher's whole
 * plan unreadable. A lesson appears at most once — the last week wins, which
 * is what re-assigning a lesson in the UI means.
 */
export function normalizePlanEntries(raw: unknown): PlanEntry[] {
  if (!Array.isArray(raw)) return [];
  const byLesson = new Map<string, number>();
  for (const item of raw) {
    if (!isEntry(item)) continue;
    const { lessonId, week } = item;
    if (typeof lessonId !== 'string' || !lessonId) continue;
    if (typeof week !== 'number' || !Number.isInteger(week)) continue;
    if (week < 1 || week > MAX_PLAN_WEEK) continue;
    byLesson.set(lessonId, week);
    if (byLesson.size >= MAX_PLAN_ENTRIES) break;
  }
  return [...byLesson].map(([lessonId, week]) => ({ lessonId, week }));
}

/** Add, move, or (with `week: null`) remove a lesson. Returns a new array. */
export function setEntryWeek(
  entries: readonly PlanEntry[],
  lessonId: string,
  week: number | null,
): PlanEntry[] {
  const without = entries.filter(e => e.lessonId !== lessonId);
  if (week === null) return without;
  if (!Number.isInteger(week) || week < 1 || week > MAX_PLAN_WEEK) return [...entries];
  if (without.length >= MAX_PLAN_ENTRIES) return [...entries];
  return [...without, { lessonId, week }];
}

export interface PlanWeek {
  week: number;
  lessonIds: string[];
}

/**
 * Entries grouped for display, weeks ascending.
 *
 * Within a week the entries keep the order they were added in, which is the
 * order the teacher picked them — there is no second key worth inventing, and
 * sorting by lesson id would scramble a unit's own sequence.
 */
export function entriesByWeek(entries: readonly PlanEntry[]): PlanWeek[] {
  const weeks = new Map<number, string[]>();
  for (const e of entries) {
    const bucket = weeks.get(e.week);
    if (bucket) bucket.push(e.lessonId);
    else weeks.set(e.week, [e.lessonId]);
  }
  return [...weeks]
    .sort((a, b) => a[0] - b[0])
    .map(([week, lessonIds]) => ({ week, lessonIds }));
}

/** The week a lesson sits in, or null when it is not in the plan. */
export function weekOf(entries: readonly PlanEntry[], lessonId: string): number | null {
  return entries.find(e => e.lessonId === lessonId)?.week ?? null;
}
