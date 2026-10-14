// artifacts/api-server/src/lib/adminNotify.ts
// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
import { systemDb as db, users, devicePushTokens } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendExpoPush, deadTokensFrom, PUSH_CHANNEL } from "./pushNotifications.ts";
import { sendArtifactReportedEmail } from "./email.ts";
import { logger } from "./logger.ts";
import { waitlistPush } from "./waitlistPush.ts";

/**
 * Pushes every `system_admin` when someone joins the website waitlist. Push
 * only — the signup is already in the admin «المسجّلون» list and in Resend, so
 * an email per signup would be a third copy. Never throws, for the same
 * reason as above: the visitor's signup has already been stored.
 */
export async function notifyAdminsOfWaitlistSignup(signup: { email: string; context: string }): Promise<void> {
  try {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "system_admin"));
    if (admins.length === 0) return;

    const tokenRows = await db
      .select({ expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(inArray(devicePushTokens.userId, admins.map((a) => a.id)));

    const push = waitlistPush(signup);
    const results = await sendExpoPush(tokenRows.map((t) => ({ to: t.expoPushToken, ...push })));
    const dead = deadTokensFrom(results);
    if (dead.length > 0) {
      await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
    }
  } catch (err) {
    logger.error({ err }, "notifyAdminsOfWaitlistSignup failed");
  }
}

/**
 * Pushes + emails every `system_admin` when a teacher reports a pooled
 * artifact. Never throws: a notification failure must not fail the
 * teacher's report call, so every branch here is caught and logged instead
 * of propagated — same posture as `sendExpoPush` itself.
 */
export async function notifyAdminsOfArtifactReport(args: {
  kind: string;
  lessonRef: string;
}): Promise<void> {
  try {
    const admins = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, "system_admin"));
    if (admins.length === 0) return;

    const adminIds = admins.map((a) => a.id);
    const tokenRows = await db
      .select({ expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(inArray(devicePushTokens.userId, adminIds));

    const body = `${args.kind} — ${args.lessonRef || "بدون درس محدد"}`;
    const results = await sendExpoPush(
      tokenRows.map((t) => ({
        to: t.expoPushToken,
        title: "تقرير محتوى جديد",
        body,
        data: { screen: "artifact-reports" },
        channelId: PUSH_CHANNEL.admin,
      })),
    );
    // Same pruning as chat pushes: a reinstalled or replaced phone otherwise
    // leaves a dead token that every later report pays for and never reaches.
    const dead = deadTokensFrom(results);
    if (dead.length > 0) {
      await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
    }

    // An admin account is a teacher-style one and has an email; the filter is for
    // the type, now that the column is nullable.
    await Promise.all(
      admins.flatMap((a) => (a.email ? [sendArtifactReportedEmail(a.email, args)] : [])),
    );
  } catch (err) {
    logger.error({ err }, "notifyAdminsOfArtifactReport failed");
  }
}
