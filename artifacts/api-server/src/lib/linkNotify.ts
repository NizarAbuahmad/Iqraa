import { db, users, students, devicePushTokens } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendExpoPush, deadTokensFrom } from "./pushNotifications.ts";
import { buildLinkNotification } from "./linkNotifyMessage.ts";
import { logger } from "./logger.ts";

/**
 * Tells a student's teacher that an account just linked to them — the "lighter"
 * answer to a class code being a shared string: nothing is held for approval,
 * but a wrong link is noticed within minutes and the unlink button is one tap
 * away (routes/roster.ts, `DELETE /students/:id/links/:userId`).
 *
 * Fire-and-forget, never throws, same posture as adminNotify.ts: a push that
 * fails must not fail the claim.
 *
 * ponytail: push only, one per link. A teacher with a dead token or push off
 * hears nothing; add a "recently linked" card on the class screen if that bites.
 */
export async function notifyTeacherOfLink(args: {
  studentId: string;
  userId: string;
  relation: "self" | "guardian";
}): Promise<void> {
  try {
    const [student] = await db
      .select({ displayName: students.displayName, teacherId: students.teacherId })
      .from(students)
      .where(eq(students.id, args.studentId))
      .limit(1);
    const [joiner] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, args.userId))
      .limit(1);
    if (!student || !joiner) return;

    const tokens = await db
      .select({ expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, student.teacherId));
    if (tokens.length === 0) return;

    const msg = buildLinkNotification({
      relation: args.relation,
      joinerName: `${joiner.firstName} ${joiner.lastName}`,
      joinerEmail: joiner.email,
      studentName: student.displayName,
      studentId: args.studentId,
    });
    const results = await sendExpoPush(tokens.map(t => ({ to: t.expoPushToken, ...msg })));
    const dead = deadTokensFrom(results);
    if (dead.length > 0) {
      await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
    }
  } catch (err) {
    logger.error({ err }, "notifyTeacherOfLink failed");
  }
}
