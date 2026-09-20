/**
 * Validation for a teaching plan's schedule — `[{ lessonId, date }]`, one
 * calendar date per lesson.
 *
 * Its own module, with no imports, for the reason mountOrder.test.ts explains
 * about the rest of this server: the route files use extensionless specifiers
 * that only esbuild resolves, so `routes/teachingPlans.ts` cannot be loaded by
 * `node --test`. This can, which is how the validating path gets a test.
 *
 * The client has a `normalizePlanEntries` too (artifacts/mobile/services/
 * planEntries.ts). They are deliberately not the same function: that one is
 * for *display* and drops bad elements so an old row stays readable, this one
 * is the trust boundary and rejects, because a request is a teacher's
 * deliberate act and silently saving nine of the ten lessons they picked is
 * worse than a failed save they can see.
 */

/** Matches MAX_PLAN_ENTRIES in artifacts/mobile/services/planEntries.ts. */
export const MAX_PLAN_ENTRIES = 200;
/** How far a date may sit from today before it's a typo, not a schedule — matches the client. */
const MAX_PLAN_DATE_SPAN_DAYS = 365 * 3;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PlanEntry {
  lessonId: string;
  date: string;
}

/**
 * A syntactically-plausible, in-range calendar date. Rejects `2026-02-30`:
 * `Date` silently rolls an impossible day into the next month, so
 * re-formatting the parsed date and comparing strings is what actually
 * catches it — a naive year/month/day range check would not.
 */
function isValidPlanDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  if (`${y}-${m}-${d}` !== date) return false;
  const spanDays = Math.abs(parsed.getTime() - Date.now()) / 86_400_000;
  return spanDays <= MAX_PLAN_DATE_SPAN_DAYS;
}

/**
 * Returns `undefined` when the field was omitted (a PATCH that does not touch
 * the schedule), the parsed entries otherwise. Throws a plain string on bad
 * input, which the caller turns into a 400 — matching `resolveClassGroupId`.
 *
 * Lesson ids are not checked against the curriculum catalog. The catalog
 * lives in the app and ships with it, and a plan written against last term's
 * ids must not become unsaveable because a lesson was renumbered; the UI
 * already handles an id it cannot resolve by not rendering it.
 */
export function parsePlanEntries(raw: unknown): PlanEntry[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw "entries must be an array";
  if (raw.length > MAX_PLAN_ENTRIES) throw `entries must hold at most ${MAX_PLAN_ENTRIES} lessons`;

  const seen = new Set<string>();
  const parsed: PlanEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) throw "each entry must be an object";
    const { lessonId, date } = item as { lessonId?: unknown; date?: unknown };
    if (typeof lessonId !== "string" || !lessonId) throw "each entry needs a lessonId";
    if (typeof date !== "string" || !isValidPlanDate(date)) {
      throw "each entry needs a valid date (YYYY-MM-DD, within a few years of today)";
    }
    // A lesson is taught on one date. Two entries for it is a client bug, and
    // storing both would make the app's `dateOf` answer differently depending
    // on array order.
    if (seen.has(lessonId)) throw "a lesson cannot appear twice in one plan";
    seen.add(lessonId);
    parsed.push({ lessonId, date });
  }
  return parsed;
}
