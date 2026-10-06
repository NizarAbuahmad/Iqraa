// artifacts/api-server/src/lib/adminNotify.ts
import { db, users, devicePushTokens } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendExpoPush, deadTokensFrom, PUSH_CHANNEL } from "./pushNotifications.ts";
import { sendArtifactReportedEmail } from "./email.ts";
import { logger } from "./logger.ts";

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

    await Promise.all(admins.map((a) => sendArtifactReportedEmail(a.email, args)));
  } catch (err) {
    logger.error({ err }, "notifyAdminsOfArtifactReport failed");
  }
}
