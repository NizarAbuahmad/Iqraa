/**
 * Tell the class an exam's results are out. Before this, a student found out
 * only by happening to open «اختباراتي».
 *
 * Two channels, because a push reaches only the Android app:
 *   - a push to every account linked to a roster row that handed a paper in:
 *     the student themself (`self`), and each parent (`guardian`), whose push
 *     names the child — a parent can hold several;
 *   - one line in the exam's class group, under the teacher's name, which the
 *     web app's inbox shows too. Not pushed again: the students it would
 *     reach already got the push above.
 *
 * Both open `/my-exams`, which shows a parent «نتائج أبنائي» — the same
 * release rule, read through `GET /parent/exams`.
 *
 * Fire-and-forget, like the message push in routes/messaging.ts: the caller
 * has already answered the teacher, and a failure here must never turn into
 * a failed release.
 */
import {
  db,
  attempts,
  chatMessages,
  chatParticipants,
  chatThreads,
  classGroups,
  devicePushTokens,
  rosterLinks,
  students,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { syncClassGroupThread } from "./classThread.ts";
import { deadTokensFrom, PUSH_CHANNEL, sendExpoPush } from "./pushNotifications.ts";
import { releaseAnnouncement } from "./resultsRelease.ts";

export async function announceResultsRelease(evaluation: {
  id: string;
  teacherId: string;
  classGroupId: string | null;
  title: string | null;
  titleAr: string | null;
}): Promise<void> {
  const text = releaseAnnouncement(evaluation);

  const sat = await db
    .select({ userId: rosterLinks.userId, relation: rosterLinks.relation, childName: students.displayName })
    .from(attempts)
    .innerJoin(students, eq(students.id, attempts.studentId))
    .innerJoin(rosterLinks, eq(rosterLinks.studentId, attempts.studentId))
    .where(and(eq(attempts.evaluationId, evaluation.id), isNotNull(attempts.submittedAt), isNull(students.archivedAt)));
  const userIds = [...new Set(sat.map(r => r.userId))];

  if (userIds.length > 0) {
    const tokens = await db
      .select({ userId: devicePushTokens.userId, expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(inArray(devicePushTokens.userId, userIds));
    const messages = sat.flatMap(link => {
      const { title, body } =
        link.relation === "guardian"
          ? text.guardianPush(link.childName)
          : { title: text.pushTitle, body: text.pushBody };
      return tokens
        .filter(t => t.userId === link.userId)
        .map(t => ({ to: t.expoPushToken, title, body, data: { screen: "my-exams" }, channelId: PUSH_CHANNEL.results }));
    });
    if (messages.length > 0) {
      const results = await sendExpoPush(messages);
      const dead = deadTokensFrom(results);
      if (dead.length > 0) await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
    }
  }

  if (!evaluation.classGroupId) return;
  const [group] = await db
    .select({ id: classGroups.id, teacherId: classGroups.teacherId, name: classGroups.name, nameAr: classGroups.nameAr })
    .from(classGroups)
    .where(and(eq(classGroups.id, evaluation.classGroupId), isNull(classGroups.archivedAt)))
    .limit(1);
  // The exam's class must still be this teacher's: the line goes out in
  // their name.
  if (!group || group.teacherId !== evaluation.teacherId) return;

  const thread = await syncClassGroupThread(group.id, group.teacherId, group.name, group.nameAr);
  const [line] = await db
    .insert(chatMessages)
    .values({ threadId: thread.id, senderId: group.teacherId, body: text.groupLine })
    .returning({ createdAt: chatMessages.createdAt });
  const at = line?.createdAt ?? new Date();
  await db.update(chatThreads).set({ updatedAt: at }).where(eq(chatThreads.id, thread.id));
  // The teacher pressed the button; their own line is not unread to them.
  await db
    .update(chatParticipants)
    .set({ lastReadAt: at })
    .where(and(eq(chatParticipants.threadId, thread.id), eq(chatParticipants.userId, group.teacherId)));
}
