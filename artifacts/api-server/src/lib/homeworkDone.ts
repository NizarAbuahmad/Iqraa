/**
 * A student ticking homework off (or taking the tick back).
 *
 * Completion is per roster row, so "this account marks it done" has to mean
 * "the roster rows this account IS, that are in this homework's class":
 * the account's `self`-linked rows ∩ the live members of the homework's live
 * class. A row the account is linked to but which sits in another class (a
 * child taught by two teachers is two rows) must not get a completion for
 * homework it was never set — and nothing may land on a row the account is
 * not linked to. No matching row is one answer, `"not_found"`, whatever the
 * reason (missing, malformed, another class, archived class or homework).
 *
 * Idempotent both ways: the insert is `ON CONFLICT DO NOTHING`, the delete
 * removes only what is there.
 */
import { db, classGroups, classMemberships, homework, homeworkCompletions } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { selfLinkedStudentIds } from "./familyAccess.ts";
import { isUuid } from "../modules/homework/rules.ts";

export async function setHomeworkDone(userId: string, homeworkId: string, done: boolean): Promise<"ok" | "not_found"> {
  if (!isUuid(homeworkId)) return "not_found";

  const own = await selfLinkedStudentIds(userId);
  if (own.length === 0) return "not_found";

  const [target] = await db
    .select({ classGroupId: homework.classGroupId })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(eq(homework.id, homeworkId), isNull(homework.archivedAt), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!target) return "not_found";

  const members = await db
    .select({ studentId: classMemberships.studentId })
    .from(classMemberships)
    .where(and(eq(classMemberships.classGroupId, target.classGroupId), inArray(classMemberships.studentId, own)));
  const rows = [...new Set(members.map(m => m.studentId))];
  if (rows.length === 0) return "not_found";

  if (done) {
    await db
      .insert(homeworkCompletions)
      .values(rows.map(studentId => ({ homeworkId, studentId })))
      .onConflictDoNothing();
  } else {
    await db
      .delete(homeworkCompletions)
      .where(and(eq(homeworkCompletions.homeworkId, homeworkId), inArray(homeworkCompletions.studentId, rows)));
  }
  return "ok";
}
