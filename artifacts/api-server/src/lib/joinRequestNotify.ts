/**
 * Pushes a class's teacher when a student's pick off the class code starts
 * waiting for them (routes/auth.ts — `/claim` and `/redeem`). Before this the
 * request sat in the class's «طلبات الانضمام» banner until the teacher happened
 * to open the Students tab, while the child waited on a screen that said the
 * teacher had been asked.
 *
 * Only a NEW request pushes: the same account entering the same code again
 * changes nothing and is not news. The caller decides that. This decides the
 * rest: one push per class per JOIN_REQUEST_PUSH_WINDOW_MINUTES (a whole class
 * joining off the board is one ring, not thirty — the banner and the bell count
 * them), and silent at night (joinRequestDelivery).
 *
 * Never throws — the request is already committed, and a push that fails must
 * not turn it into an error. The caller awaits it through `pushWithin`, before
 * answering, because Cloud Run throttles the CPU once a response is sent
 * (CLAUDE.md, «Work after `res.json` may never run on Cloud Run»).
 */
// systemDb: the caller is the joining student, and the teacher's class row and
// device tokens are the teacher's — under row-level security `db` reads none of them.
import { systemDb as db, classGroups, classMemberships, devicePushTokens, rosterLinkRequests, students } from "@workspace/db";
import { and, eq, gt, inArray, isNull, not, sql } from "drizzle-orm";
import { deadTokensFrom, sendExpoPush } from "./pushNotifications.ts";
import { logger } from "./logger.ts";
import { classLabel } from "../modules/notifications/familyPushText.ts";
import {
  JOIN_REQUEST_PUSH_WINDOW_MINUTES,
  joinRequestData,
  joinRequestDelivery,
  joinRequestPushes,
  joinRequestText,
} from "../modules/notifications/joinRequestText.ts";
import { quietHoursEnabled } from "../modules/notifications/quietHours.ts";

export async function notifyTeacherOfJoinRequest(input: {
  studentId: string;
  classGroupId: string;
  /** The account that asked — its own request is not one of «the others». */
  userId: string;
  now?: Date;
}): Promise<void> {
  try {
    const [{ n: others } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rosterLinkRequests)
      .innerJoin(
        classMemberships,
        and(eq(classMemberships.studentId, rosterLinkRequests.studentId), eq(classMemberships.classGroupId, input.classGroupId)),
      )
      .where(
        and(
          gt(rosterLinkRequests.createdAt, sql`now() - make_interval(mins => ${JOIN_REQUEST_PUSH_WINDOW_MINUTES})`),
          not(and(eq(rosterLinkRequests.studentId, input.studentId), eq(rosterLinkRequests.userId, input.userId))!),
        ),
      );
    if (!joinRequestPushes(others)) return;

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
    const delivery = joinRequestDelivery(input.now ?? new Date(), quietHoursEnabled());
    const results = await sendExpoPush(
      tokens.map(t => ({ to: t.expoPushToken, ...text, data: joinRequestData(input.classGroupId), ...delivery })),
    );
    const dead = deadTokensFrom(results);
    if (dead.length > 0) await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
  } catch (err) {
    logger.error({ err, classGroupId: input.classGroupId }, "join request push failed");
  }
}
