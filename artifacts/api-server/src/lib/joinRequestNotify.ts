/**
 * Pushes a class's teacher when a student's pick off the class code starts
 * waiting for them (routes/auth.ts — `/claim` and `/redeem`). Before this the
 * request sat in the class's «طلبات الانضمام» banner until the teacher happened
 * to open the Students tab, while the child waited on a screen that said the
 * teacher had been asked.
 *
 * Only a NEW request pushes: the same account entering the same code again
 * changes nothing and is not news. The caller decides that; this only sends.
 *
 * Never throws — the request is already committed, and a push that fails must
 * not turn it into an error. The caller awaits it through `pushWithin`, before
 * answering, because Cloud Run throttles the CPU once a response is sent
 * (CLAUDE.md, «Work after `res.json` may never run on Cloud Run»).
 */
// systemDb: the caller is the joining student, and the teacher's class row and
// device tokens are the teacher's — under row-level security `db` reads none of them.
import { systemDb as db, classGroups, devicePushTokens, students } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { deadTokensFrom, sendExpoPush, PUSH_CHANNEL } from "./pushNotifications.ts";
import { logger } from "./logger.ts";
import { classLabel } from "../modules/notifications/familyPushText.ts";
import { joinRequestData, joinRequestText } from "../modules/notifications/joinRequestText.ts";

export async function notifyTeacherOfJoinRequest(input: { studentId: string; classGroupId: string }): Promise<void> {
  try {
    const [klass] = await db
      .select({ teacherId: classGroups.teacherId, name: classGroups.name, nameAr: classGroups.nameAr })
      .from(classGroups)
      .where(and(eq(classGroups.id, input.classGroupId), isNull(classGroups.archivedAt)))
      .limit(1);
    if (!klass) return;

    const [student] = await db
      .select({ displayName: students.displayName, displayNameAr: students.displayNameAr })
      .from(students)
      .where(eq(students.id, input.studentId))
      .limit(1);
    if (!student) return;

    const tokens = await db
      .select({ expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, klass.teacherId));
    if (tokens.length === 0) return;

    const text = joinRequestText({
      studentName: student.displayNameAr.trim() || student.displayName,
      className: classLabel(klass),
    });
    const results = await sendExpoPush(
      tokens.map(t => ({
        to: t.expoPushToken,
        ...text,
        data: joinRequestData(input.classGroupId),
        channelId: PUSH_CHANNEL.requests,
        sound: "default" as const,
      })),
    );
    const dead = deadTokensFrom(results);
    if (dead.length > 0) await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
  } catch (err) {
    logger.error({ err, classGroupId: input.classGroupId }, "join request push failed");
  }
}
