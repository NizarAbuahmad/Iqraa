/**
 * Input checks for the admin school endpoints — see lib/db/src/schema/schools.ts.
 *
 * Its own module, no imports, so `node --test` can load it (route files cannot).
 * Throws a message string, like schedule.ts, for the route to turn into a 400.
 */

export const MAX_SCHOOL_NAME = 80;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSchoolInput(body: unknown): { name: string } {
  const raw = (body as { name?: unknown } | null | undefined)?.name;
  if (typeof raw !== "string") throw "name is required";
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw "name is required";
  if (name.length > MAX_SCHOOL_NAME) throw `name must be at most ${MAX_SCHOOL_NAME} characters`;
  return { name };
}

/**
 * `schoolId: null` removes the teacher from their school. An absent field is an
 * error, not a removal — a request that forgot it must not evict anyone.
 */
export function parseSchoolAssignment(body: unknown): string | null {
  const raw = (body as { schoolId?: unknown } | null | undefined)?.schoolId;
  if (raw === null) return null;
  if (typeof raw !== "string" || !UUID_RE.test(raw)) throw "schoolId must be a school id, or null to remove";
  return raw;
}

/**
 * `?schoolId=` on GET /admin/users. Absent or empty means no filter; anything
 * else must be a school id. A malformed one used to be ignored, which turned
 * "this school's teachers" into "every teacher" — and the schools screen puts a
 * Remove button on each row it gets back.
 */
export function parseSchoolIdFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string" || !UUID_RE.test(raw)) throw "schoolId must be a school id";
  return raw;
}
