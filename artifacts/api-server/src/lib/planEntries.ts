/**
 * Validation for a teaching plan's schedule — `[{ lessonId, week }]`.
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

/** Matches MAX_PLAN_ENTRIES / MAX_PLAN_WEEK in artifacts/mobile/services/planEntries.ts. */
export const MAX_PLAN_ENTRIES = 200;
export const MAX_PLAN_WEEK = 60;

export interface PlanEntry {
  lessonId: string;
  week: number;
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
    const { lessonId, week } = item as { lessonId?: unknown; week?: unknown };
    if (typeof lessonId !== "string" || !lessonId) throw "each entry needs a lessonId";
    if (typeof week !== "number" || !Number.isInteger(week) || week < 1 || week > MAX_PLAN_WEEK) {
      throw `each entry needs a whole week between 1 and ${MAX_PLAN_WEEK}`;
    }
    // A lesson is taught in one week. Two entries for it is a client bug, and
    // storing both would make the app's `weekOf` answer differently depending
    // on array order.
    if (seen.has(lessonId)) throw "a lesson cannot appear twice in one plan";
    seen.add(lessonId);
    parsed.push({ lessonId, week });
  }
  return parsed;
}
