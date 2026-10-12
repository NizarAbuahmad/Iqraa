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
import { db, rosterLinks, students, users } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { GuardianLink } from "../modules/family/children.ts";
import type { LinkedAccount } from "../modules/notifications/familyPush.ts";

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

/**
 * Which of these live roster rows have a student account, i.e. a `self` link to
 * ANY user. Only a self-linked account can tick homework off, so a child none of
 * whose rows is in this set cannot be "late" — nobody is able to say they did it.
 * One query for any number of children.
 */
export async function studentIdsWithSelfAccount(studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  const linked = await db
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(
      and(inArray(rosterLinks.studentId, studentIds), eq(rosterLinks.relation, "self"), isNull(students.archivedAt)),
    );
  return new Set(linked.map(l => l.studentId));
}

/**
 * Rows → accounts: every account linked to these live roster rows, `self` and
 * `guardian`, with what a push needs to decide about it — the child's name,
 * the account's switches and whether it is suspended. The reverse of the two
 * helpers above. Not filtered here: the reminder needs to know a suspended
 * student account EXISTS (the child can tick), even though it is not pushed.
 */
export async function accountsLinkedTo(studentIds: readonly string[]): Promise<LinkedAccount[]> {
  if (studentIds.length === 0) return [];
  const rows = await db
    .select({
      userId: rosterLinks.userId,
      relation: rosterLinks.relation,
      studentId: students.id,
      childName: students.displayName,
      pushPrefs: users.pushPrefs,
      suspendedAt: users.suspendedAt,
    })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .innerJoin(users, eq(users.id, rosterLinks.userId))
    .where(and(inArray(rosterLinks.studentId, [...studentIds]), isNull(students.archivedAt)));
  return rows.map(r => ({
    userId: r.userId,
    relation: r.relation,
    studentId: r.studentId,
    childName: r.childName,
    pushPrefs: r.pushPrefs,
    suspended: r.suspendedAt !== null,
  }));
}
