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
import { classGroups } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Returns `undefined` (field omitted), `null` (explicit detach), or a
 * verified id; throws a plain string on an id that does not belong to this
 * teacher, which the caller turns into a 400.
 */
export async function resolveClassGroupId(
  raw: unknown,
  teacherId: string,
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw "classGroupId must be a string or null";

  const [owned] = await db
    .select({ id: classGroups.id })
    .from(classGroups)
    .where(and(eq(classGroups.id, raw), eq(classGroups.teacherId, teacherId)));
  if (!owned) throw "classGroupId does not refer to one of your classes";
  return raw;
}
