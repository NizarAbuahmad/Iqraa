/**
 * Tells the admins a chat message was reported.
 *
 * A reported message carries a 24-hour moderation obligation (the moderation
 * screen, artifacts/mobile/app/admin/moderation.tsx), and until now the report
 * route told nobody: it sat there until an admin happened to open the screen.
 *
 * The notification goes by email and push, so it is fixed wording — never the
 * message, the reason, or anyone's name; the admin reads those on the moderation
 * screen. Rate limit: one notification per reporter per 10 minutes (shared across
 * instances, adminAlertGate.ts). Different reporters each notify, so a second
 * person's report of the same thread is not hidden, but one person pressing
 * report repeatedly is one ring.
 *
 * Never throws. No database import at module scope.
 */
import { claimAlert } from "./adminAlertGate.ts";
import { logger } from "./logger.ts";
import type { AdminAlert, AlertDeps } from "./aiAlerts.ts";

export const MESSAGE_REPORT_ALERT_WINDOW_MS = 10 * 60 * 1000;

export function messageReportAlert(): AdminAlert {
  return {
    title: "بلاغ جديد عن رسالة",
    body: "أبلغ مستخدم عن رسالة في المحادثات. تجب مراجعة البلاغ خلال 24 ساعة من شاشة الإشراف.",
    bodyEn: "A user reported a chat message. Review it on the moderation screen within 24 hours.",
    subject: "بلاغ جديد عن رسالة بانتظار المراجعة / New message report awaiting review",
    screen: "moderation",
    path: "/admin/moderation",
  };
}

export async function alertMessageReport(reporterUserId: string, deps: AlertDeps = {}): Promise<void> {
  try {
    if (!(await claimAlert(`msg-report:${reporterUserId}`, MESSAGE_REPORT_ALERT_WINDOW_MS, deps))) return;
    const notify =
      deps.notify ??
      (async (alert: AdminAlert) => {
        const { notifyAdminsOfAlert } = await import("./adminNotify.ts");
        await notifyAdminsOfAlert(alert);
      });
    await notify(messageReportAlert());
  } catch (err) {
    logger.error({ err }, "message report alert failed");
  }
}
