/**
 * Verifying that a class id a client sent actually belongs to the caller.
 *
 * Extracted out of teachingPlans.ts, which had this inline before
 * schedule.ts needed the exact same check for a slot's `classGroupId` — two
 * routes hand-verifying class ownership independently is how one of them
 * eventually skips it. `savedMaterials.classGroupId` (workspace.ts) still
 * accepts a classGroupId unchecked; that is the shape of the bug this exists
 * to prevent — a client attaching its own data to a class it does not own.
 */
import { db } from "@workspace/db";
import { classGroups, type ClassGroup } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./classResource.ts";

/**
 * The class row for `classId` if this teacher owns it AND it is not archived;
 * `undefined` otherwise.
 *
 * Archiving is the product's "delete" (DELETE /classes/:id), and until this
 * existed only the class *list* honoured it — every per-id route accepted an
 * archived class, so a stale deep link, a saved material's `classGroupId` or
 * an old schedule slot could keep adding students, minting join codes and
 * attaching exams to a class the teacher had removed. One lookup for all of
 * them, so the next route added cannot forget the filter. Callers answer 404
 * on `undefined` without saying which of the three conditions failed — see
 * routes/roster.ts on why "exists but not yours" must not be distinguishable.
 */
export async function findLiveClass(
  classId: string,
  teacherId: string,
): Promise<ClassGroup | undefined> {
  // A malformed id would reach Postgres as a uuid cast error — a 500, not 404.
  if (!isUuid(classId)) return undefined;
  const [group] = await db
    .select()
    .from(classGroups)
    .where(
      and(
        eq(classGroups.id, classId),
        eq(classGroups.teacherId, teacherId),
        isNull(classGroups.archivedAt),
      ),
    )
    .limit(1);
  return group;
}

/**
 * Returns `undefined` (field omitted), `null` (explicit detach), or a
 * verified id; throws a plain string on an id that does not belong to this
 * teacher (or names an archived class), which the caller turns into a 400.
 */
export async function resolveClassGroupId(
  raw: unknown,
  teacherId: string,
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw "classGroupId must be a string or null";

  if (!(await findLiveClass(raw, teacherId))) {
    throw "classGroupId does not refer to one of your classes";
  }
  return raw;
}
