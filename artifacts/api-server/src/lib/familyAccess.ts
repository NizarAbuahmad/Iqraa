/**
 * Which roster rows a signed-in student or parent is linked to.
 *
 * Every student/parent read scopes through `roster_links`: a student is the
 * rows their account is `self`-linked to, a parent is the rows it is
 * `guardian`-linked to. These two queries used to live inline in
 * `routes/studentExams.ts`; the schedule (and later homework) need them too,
 * and "who may see this child" should be decided in exactly one place.
 *
 * Archived roster rows never count. The 404/empty behaviour for a row that is
 * not linked is the caller's — these only answer "which rows".
 */
import { db, rosterLinks, students } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import type { GuardianLink } from "../modules/family/children.ts";

/** Every live roster row this account is `self`-linked to. */
export async function selfLinkedStudentIds(userId: string): Promise<string[]> {
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)));
  return [...new Set(linked.map(l => l.studentId))];
}

/** Every live roster row this account is `guardian`-linked to, one per student id. */
export async function guardianLinkedStudents(userId: string): Promise<GuardianLink[]> {
  const linked = await db
    .select({ studentId: students.id, displayName: students.displayName })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(
      and(
        eq(rosterLinks.userId, userId),
        eq(rosterLinks.relation, "guardian"),
        isNull(students.archivedAt),
      ),
    );
  return [...new Map(linked.map(l => [l.studentId, l])).values()];
}
