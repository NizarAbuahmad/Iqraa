/**
 * The one rule for who belongs in a class's chat thread.
 *
 * Lifted out of routes/messaging.ts unchanged when a second caller appeared:
 * unlinking an account from a roster row (DELETE /students/:id/links/:userId in
 * routes/roster.ts) has to rebuild the same membership, and a hand-written
 * delete over there would have been a second copy of this rule — one that gets
 * it wrong the moment the same user is self-linked to another child in the same
 * class. Derivation lives here; both routes call it.
 */
import { db } from "@workspace/db";
import {
  chatThreads,
  chatParticipants,
  classMemberships,
  students,
  rosterLinks,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

/**
 * Get-or-create the one thread for a class, then reconcile membership to
 * exactly the teacher plus every student self-linked to a current member of
 * the class. Never removes the teacher, even if some future bug left them
 * out of `desired` — that guarantee is the whole point of this function, so
 * it is asserted here directly rather than trusted to always fall out of the
 * query above it.
 */
export async function syncClassGroupThread(
  classGroupId: string,
  teacherId: string,
  name: string,
  nameAr: string,
) {
  let [thread] = await db.select().from(chatThreads).where(eq(chatThreads.classGroupId, classGroupId)).limit(1);
  if (!thread) {
    const inserted = await db
      .insert(chatThreads)
      .values({ type: "class_group", classGroupId, title: name, titleAr: nameAr })
      .onConflictDoNothing()
      .returning();
    thread = inserted[0];
    if (!thread) {
      // Lost a create race to a concurrent request — the row exists now.
      [thread] = await db.select().from(chatThreads).where(eq(chatThreads.classGroupId, classGroupId)).limit(1);
    }
  } else if (thread.title !== name || thread.titleAr !== nameAr) {
    // Keep the thread's display name in sync with the class's — a rename
    // shouldn't leave the thread showing the class's old name forever.
    [thread] = await db
      .update(chatThreads)
      .set({ title: name, titleAr: nameAr, updatedAt: new Date() })
      .where(eq(chatThreads.id, thread.id))
      .returning();
  }
  if (!thread) throw new Error("Failed to create class thread");

  const studentUserRows = await db
    .select({ userId: rosterLinks.userId })
    .from(classMemberships)
    .innerJoin(students, eq(students.id, classMemberships.studentId))
    .innerJoin(
      rosterLinks,
      and(eq(rosterLinks.studentId, classMemberships.studentId), eq(rosterLinks.relation, "self")),
    )
    .where(and(eq(classMemberships.classGroupId, classGroupId), isNull(students.archivedAt)));

  const desired = new Set<string>([teacherId, ...studentUserRows.map(r => r.userId)]);

  await db
    .insert(chatParticipants)
    .values([...desired].map(userId => ({ threadId: thread.id, userId })))
    .onConflictDoNothing();

  const current = await db.select().from(chatParticipants).where(eq(chatParticipants.threadId, thread.id));
  const toRemove = current
    .map(p => p.userId)
    .filter(userId => userId !== teacherId && !desired.has(userId));
  if (toRemove.length > 0) {
    await db
      .delete(chatParticipants)
      .where(and(eq(chatParticipants.threadId, thread.id), inArray(chatParticipants.userId, toRemove)));
  }

  return thread;
}
