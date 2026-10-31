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
// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
import { systemDb as db } from "@workspace/db";
import {
  chatMessages,
  chatThreads,
  chatParticipants,
  classGroups,
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

  await reconcileClassThreadMembers(thread.id, classGroupId, teacherId);
  return thread;
}

/**
 * Rebuild an existing class thread's membership after the roster changed —
 * a student removed from the class, or an already-linked student added to it.
 *
 * Without this, membership was only reconciled when somebody next opened the
 * class thread (GET /messaging/threads/class/:id), so a child taken off the
 * roster kept reading and posting in that class's chat until then. Posting
 * checks `chat_participants` alone, not current membership.
 *
 * Deliberately a no-op when the class has no thread yet: `syncClassGroupThread`
 * get-or-creates, and a roster edit should not conjure an empty chat into a
 * teacher's inbox.
 */
export async function resyncClassGroupThreadIfExists(classGroupId: string, teacherId: string): Promise<void> {
  const [thread] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(eq(chatThreads.classGroupId, classGroupId))
    .limit(1);
  if (!thread) return;
  await reconcileClassThreadMembers(thread.id, classGroupId, teacherId);
}

/**
 * Keep the thread's display name in step with a class rename. Same no-op rule
 * as above when there is no thread. `syncClassGroupThread` also does this on
 * open, so until this existed a renamed class showed its old name in the
 * inbox until somebody happened to open the chat.
 */
export async function renameClassGroupThread(classGroupId: string, name: string, nameAr: string): Promise<void> {
  await db
    .update(chatThreads)
    .set({ title: name, titleAr: nameAr, updatedAt: new Date() })
    .where(eq(chatThreads.classGroupId, classGroupId));
}

async function reconcileClassThreadMembers(threadId: string, classGroupId: string, teacherId: string): Promise<void> {
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
    .values([...desired].map(userId => ({ threadId, userId })))
    .onConflictDoNothing();

  const current = await db.select().from(chatParticipants).where(eq(chatParticipants.threadId, threadId));
  const toRemove = current
    .map(p => p.userId)
    .filter(userId => userId !== teacherId && !desired.has(userId));
  if (toRemove.length > 0) {
    await db
      .delete(chatParticipants)
      .where(and(eq(chatParticipants.threadId, threadId), inArray(chatParticipants.userId, toRemove)));
  }
}

/**
 * Rebuild every existing class thread a student sits in. For the claim
 * route: a freshly linked account belongs in its class chat from the moment
 * the link exists, not from the next time the teacher happens to open it.
 * Same no-op rule as `resyncClassGroupThreadIfExists`: a claim should not
 * conjure an empty chat into a teacher's inbox.
 */
export async function syncClassThreadsForStudent(studentId: string): Promise<void> {
  const memberships = await db
    .select({ classGroupId: classMemberships.classGroupId, teacherId: classGroups.teacherId })
    .from(classMemberships)
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(eq(classMemberships.studentId, studentId), isNull(classGroups.archivedAt)));
  for (const m of memberships) {
    await resyncClassGroupThreadIfExists(m.classGroupId, m.teacherId);
  }
}

/**
 * After an account's links to some roster rows were deleted: take it out of the
 * chats that only existed because of those links.
 *
 * A direct thread and a custom group are created only for someone connected to
 * the teacher (a roster link to one of their students), and sending and reading
 * check participation alone, so removing the link left the account reading and
 * posting in them. For each teacher whose students it was just unlinked from,
 * and only if it now has no link left to ANY of that teacher's students (a
 * parent unlinked from one child but still linked to another keeps everything),
 * remove it from that teacher's direct thread and from the custom groups that
 * teacher owns. Class chats are not handled here: they are re-derived from the
 * roster by `syncClassThreadsForStudent`.
 *
 * Messages stay (moderation reads them, and a re-link brings the thread back
 * through `openDirectThread`). The teacher's side of the emptied direct thread
 * is hidden, so the inbox does not keep a chat with nobody in it; opening it
 * again un-hides it.
 */
export async function pruneTeacherChatsAfterUnlink(userId: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return;
  const teachers = await db
    .selectDistinct({ teacherId: students.teacherId })
    .from(students)
    .where(inArray(students.id, studentIds));
  for (const { teacherId } of teachers) {
    const [stillConnected] = await db
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .where(and(eq(students.teacherId, teacherId), eq(rosterLinks.userId, userId)))
      .limit(1);
    if (stillConnected) continue;

    const directKey = [teacherId, userId].sort().join(":");
    const [direct] = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(eq(chatThreads.directKey, directKey))
      .limit(1);
    if (direct) {
      await db
        .delete(chatParticipants)
        .where(and(eq(chatParticipants.threadId, direct.id), eq(chatParticipants.userId, userId)));
      await db
        .update(chatParticipants)
        .set({ hiddenAt: new Date() })
        .where(and(eq(chatParticipants.threadId, direct.id), eq(chatParticipants.userId, teacherId)));
    }

    const groups = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(and(eq(chatThreads.type, "custom_group"), eq(chatThreads.createdBy, teacherId)));
    if (groups.length > 0) {
      await db
        .delete(chatParticipants)
        .where(
          and(
            inArray(chatParticipants.threadId, groups.map(g => g.id)),
            eq(chatParticipants.userId, userId),
          ),
        );
    }
  }
}

/**
 * An archived class's thread goes with it. `chatThreads.archivedAt` existed
 * and the inbox already filtered on it; nothing ever set it, so archiving a
 * class left its chat live for every member.
 */
export async function archiveClassThread(classGroupId: string): Promise<void> {
  await db
    .update(chatThreads)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(chatThreads.classGroupId, classGroupId), isNull(chatThreads.archivedAt)));
}

/**
 * One line in a class's group chat, in the teacher's name, sent by the server
 * for something the teacher did (results released, homework shared). Not
 * pushed: each caller has already pushed the families it concerns. Bumps the
 * thread so it rises in the inbox. The teacher's read mark is NOT moved: their
 * own line is never counted as unread, and moving it would bury any family
 * reply they have not opened.
 */
export async function postToClassThread(
  group: { id: string; teacherId: string; name: string; nameAr: string },
  body: string,
): Promise<void> {
  const thread = await syncClassGroupThread(group.id, group.teacherId, group.name, group.nameAr);
  const [line] = await db
    .insert(chatMessages)
    .values({ threadId: thread.id, senderId: group.teacherId, body })
    .returning({ createdAt: chatMessages.createdAt });
  const at = line?.createdAt ?? new Date();
  await db.update(chatThreads).set({ updatedAt: at }).where(eq(chatThreads.id, thread.id));
}
