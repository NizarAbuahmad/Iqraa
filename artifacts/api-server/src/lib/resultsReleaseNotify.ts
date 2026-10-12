/**
 * Tell the class an exam's results are out. Before this, a student found out
 * only by happening to open «اختباراتي».
 *
 * Two channels, because a push reaches only the Android app:
 *   - a push to every account linked to a roster row whose paper is handed in
 *     and finally marked (not provisional), except suspended accounts and
 *     anyone who switched results off: the student themself (`self`), and
 *     each parent (`guardian`), whose push names the child — a parent can
 *     hold several;
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
  attemptResults,
  attempts,
  chatMessages,
  chatParticipants,
  chatThreads,
  classGroups,
  students,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { syncClassGroupThread } from "./classThread.ts";
import { accountsLinkedTo } from "./familyAccess.ts";
import { sendFamilyPush } from "./familyPush.ts";
import { releaseAnnouncement } from "./resultsRelease.ts";

/**
 * Live roster rows whose result on this exam a family can now open: handed in
 * AND final (`studentResultReady` also needs the release, which the callers
 * check). A provisional paper is still being marked; telling its family
 * "results are out" would point them at a row with no result. `only` narrows
 * to rows a caller just saved (paper marks typed after the release).
 */
export async function finalResultStudentIds(evaluationId: string, only?: readonly string[]): Promise<string[]> {
  if (only && only.length === 0) return [];
  const rows = await db
    .select({ studentId: attempts.studentId })
    .from(attempts)
    .innerJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .where(
      and(
        eq(attempts.evaluationId, evaluationId),
        isNotNull(attempts.submittedAt),
        eq(attemptResults.isProvisional, false),
        isNull(students.archivedAt),
        only ? inArray(attempts.studentId, [...only]) : undefined,
      ),
    );
  return [...new Set(rows.map(r => r.studentId))];
}

export async function announceResultsRelease(evaluation: {
  id: string;
  teacherId: string;
  classGroupId: string | null;
  title: string | null;
  titleAr: string | null;
}): Promise<void> {
  const text = releaseAnnouncement(evaluation);

  // Through the shared family sender (lib/familyPush.ts): suspended accounts
  // and anyone who switched results off are left out, a quiet-hours push is
  // silent, dead devices are pruned.
  await sendFamilyPush({
    category: "results",
    accounts: await accountsLinkedTo(await finalResultStudentIds(evaluation.id)),
    data: { screen: "my-exams" },
    text: r => (r.relation === "guardian" ? text.guardianPush(r.childName) : { title: text.pushTitle, body: text.pushBody }),
  });

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
