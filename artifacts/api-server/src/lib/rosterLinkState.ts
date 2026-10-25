/**
 * Whether an account holds a roster link to a student who is not archived.
 *
 * Lives here, not in `routes/auth.ts`, because the auth middleware needs the same answer to decide whether a
 * student is held for a parent's approval, and a middleware cannot import a route. Archived rows do not count:
 * `/messaging/contacts` already drops them, and this is that rule.
 */
import { systemDb as db, rosterLinks, students } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export async function hasLiveRosterLink(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rosterLinks.id })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), isNull(students.archivedAt)))
    .limit(1);
  return !!row;
}
