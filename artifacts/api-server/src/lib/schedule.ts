/**
 * Validation for a teacher's weekly period timetable — see
 * lib/db/src/schema/schedule.ts for what the two tables mean.
 *
 * Its own module, no imports, for the same reason planEntries.ts is: route
 * files use extensionless specifiers only esbuild resolves, so
 * `routes/schedule.ts` cannot be loaded by `node --test`. This can.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MIN_PERIOD_NUMBER = 1;
/** Generous — real Jordanian school days run well under this. */
export const MAX_PERIOD_NUMBER = 12;
export const MIN_DURATION_MINUTES = 1;
/** Eight hours; a bound against nonsense, not a real ceiling on a period. */
export const MAX_DURATION_MINUTES = 480;
export const MAX_NOTES_LENGTH = 500;

export function isValidPeriodNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_PERIOD_NUMBER && n <= MAX_PERIOD_NUMBER;
}

export function isValidDayOfWeek(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6;
}

export function isValidTimeOfDay(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

export function isValidDurationMinutes(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_DURATION_MINUTES && n <= MAX_DURATION_MINUTES;
}

export interface PeriodInput {
  startTime: string;
  durationMinutes: number;
}

/**
 * Validates a period upsert body. `periodNumber` is not part of this — it
 * comes from the URL, like `/schedule/periods/:periodNumber` — so it is
 * checked by the route with `isValidPeriodNumber` directly.
 *
 * Throws a plain string on bad input, which the caller turns into a 400 —
 * matching `resolveClassGroupId` and `parsePlanEntries`.
 */
export function parsePeriodInput(body: unknown): PeriodInput {
  if (typeof body !== "object" || body === null) throw "request body must be an object";
  const { startTime, durationMinutes } = body as { startTime?: unknown; durationMinutes?: unknown };
  if (!isValidTimeOfDay(startTime)) throw "startTime must be HH:MM, 24-hour";
  if (durationMinutes !== undefined && !isValidDurationMinutes(durationMinutes)) {
    throw `durationMinutes must be a whole number between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}`;
  }
  return { startTime, durationMinutes: durationMinutes ?? 45 };
}

export interface SlotInput {
  classGroupId: string | null | undefined;
  notes: string | undefined;
}

/**
 * Validates a slot upsert body. `classGroupId`'s *ownership* is not checked
 * here — that needs a database round trip, so the route does it with
 * `resolveClassGroupId`, same split as teachingPlans.ts.
 */
export function parseSlotInput(body: unknown): SlotInput {
  if (typeof body !== "object" || body === null) throw "request body must be an object";
  const { classGroupId, notes } = body as { classGroupId?: unknown; notes?: unknown };
  if (classGroupId !== undefined && classGroupId !== null && typeof classGroupId !== "string") {
    throw "classGroupId must be a string or null";
  }
  if (notes !== undefined && typeof notes !== "string") throw "notes must be a string";
  if (typeof notes === "string" && notes.length > MAX_NOTES_LENGTH) {
    throw `notes must be at most ${MAX_NOTES_LENGTH} characters`;
  }
  return { classGroupId: classGroupId as string | null | undefined, notes: notes as string | undefined };
}
