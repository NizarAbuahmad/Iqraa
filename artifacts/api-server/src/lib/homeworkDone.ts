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
import { db, classGroups, classMemberships, homework, homeworkCompletions, type HomeworkResource } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { selfLinkedStudentIds } from "./familyAccess.ts";
import { isUuid } from "../modules/homework/rules.ts";

export interface OwnHomeworkRows {
  /** The account's `self`-linked roster rows in the homework's class, sorted (so "the first" is stable). */
  rows: string[];
  resources: HomeworkResource[];
  /** The teacher asked for a project: this homework is done by handing it in, not by a tick. */
  requiresSubmission: boolean;
  dueAt: Date;
}

/**
 * The shared lookup behind every student write on a homework (the tick, a game
 * result): the live homework in a live class, and which of the account's own
 * roster rows sit in that class. `null` is the one answer for every way to fail.
 */
export async function ownHomeworkRows(userId: string, homeworkId: string): Promise<OwnHomeworkRows | null> {
  if (!isUuid(homeworkId)) return null;

  const own = await selfLinkedStudentIds(userId);
  if (own.length === 0) return null;

  const [target] = await db
    .select({ classGroupId: homework.classGroupId, resources: homework.resources, requiresSubmission: homework.requiresSubmission, dueAt: homework.dueAt })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(eq(homework.id, homeworkId), isNull(homework.archivedAt), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!target) return null;

  const members = await db
    .select({ studentId: classMemberships.studentId })
    .from(classMemberships)
    .where(and(eq(classMemberships.classGroupId, target.classGroupId), inArray(classMemberships.studentId, own)));
  const rows = [...new Set(members.map(m => m.studentId))].sort();
  if (rows.length === 0) return null;
  return { rows, resources: target.resources, requiresSubmission: target.requiresSubmission, dueAt: target.dueAt };
}

/**
 * Idempotent: a row already ticked keeps its original `doneAt`. `executor` lets a caller tick inside its own
 * transaction (a hand-in, lib/homeworkSubmission.ts).
 */
export async function tickRows(homeworkId: string, rows: string[], executor: Pick<typeof db, "insert"> = db): Promise<void> {
  await executor
    .insert(homeworkCompletions)
    .values(rows.map(studentId => ({ homeworkId, studentId })))
    .onConflictDoNothing();
}

/**
 * A homework that asks for a project is done by handing the project in, and by nothing else —
 * lib/homeworkSubmission.ts ticks it. Tapping "done" (or taking the tick back) on such a
 * homework is refused so the tick and the submission can never disagree.
 */
export async function setHomeworkDone(
  userId: string,
  homeworkId: string,
  done: boolean,
): Promise<"ok" | "not_found" | "submission_required"> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own) return "not_found";
  if (own.requiresSubmission) return "submission_required";

  if (done) {
    await tickRows(homeworkId, own.rows);
  } else {
    await db
      .delete(homeworkCompletions)
      .where(and(eq(homeworkCompletions.homeworkId, homeworkId), inArray(homeworkCompletions.studentId, own.rows)));
  }
  return "ok";
}
