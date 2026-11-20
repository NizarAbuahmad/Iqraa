/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
 *
 *   GET  /admin/newsletter                          — when the last issue went out, and who would get one now
 *   POST /admin/newsletter/test {subject, body}     — one copy to the caller; records the text as tested
 *   POST /admin/newsletter/send {issueId, subject, body}
 *                                                   — the tested text, to every eligible teacher not yet mailed it
 *
 * System admin only. Nothing here runs by itself: there is no schedule, and the send route
 * refuses any text that was not test-sent to the admin in the last 24 hours (lib/newsletter.ts,
 * `sendDecision`). Do not add a caller that is not a person pressing a button.
 *
 * Reads through `systemDb` (listed in lib/__tests__/systemDbFiles.test.ts): it reads every
 * teacher's address, and its two tables have no app-role grant.
 *
 * Every path starts `/admin/newsletter` and each route carries its own guards, so mounting
 * this router at the root shadows nothing (mountOrder.test.ts).
 *
 * The send is synchronous, like the waitlist broadcast: 100 per batch, ~0.6 s apart, fine into
 * the low thousands. The answer is written after the mail is handed over and recorded, because
 * work after `res.json` may never run on Cloud Run.
 */
import { Router } from "express";
import { newsletterIssues, newsletterSends, systemDb as db, users } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { UUID } from "../lib/adminMetrics.js";
import { sendBroadcast } from "../lib/email.js";
import { suppressedAmong } from "../lib/emailSuppression.ts";
import { logger } from "../lib/logger.js";
import {
  NEWSLETTER_ROLES,
  TEACHER_FOOTER,
  newsletterHash,
  parseNewsletter,
  pickTeacherRecipients,
  sendDecision,
  teacherUnsubscribeUrl,
} from "../lib/newsletter.ts";
import { createRateLimiter } from "../lib/rateLimit.js";
import { renderBroadcastBody } from "../lib/siteMail.js";

const router = Router();

const limiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  name: "admin-newsletter",
  key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/** A send that died mid-way must not lock the issue for ever. */
const SENDING_CLAIM_MINUTES = 10;

const teacherRows = () =>
  db
    .select({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified, suspendedAt: users.suspendedAt })
    .from(users)
    .where(inArray(users.role, [...NEWSLETTER_ROLES]));

router.get("/admin/newsletter", authMiddleware, requireRole("system_admin"), async (_req, res) => {
  try {
    const recipients = pickTeacherRecipients(await teacherRows());
    const suppressed = await suppressedAmong(recipients.map((r) => r.email));
    const [last] = await db
      .select({ sentAt: newsletterIssues.sentAt })
      .from(newsletterIssues)
      .where(isNotNull(newsletterIssues.sentAt))
      .orderBy(desc(newsletterIssues.sentAt))
      .limit(1);
    res.json({ lastSentAt: last?.sentAt ?? null, eligible: recipients.length - suppressed.size, unsubscribed: suppressed.size });
  } catch (err) {
    logger.error({ err }, "newsletter summary failed");
    res.status(500).json({ error: "Failed to load" });
  }
});

router.post("/admin/newsletter/test", authMiddleware, requireRole("system_admin"), limiter, async (req: AuthenticatedRequest, res) => {
  const parsed = parseNewsletter(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const me = req.user!;
  if (!me.email) {
    res.status(400).json({ error: "no-email" });
    return;
  }
  try {
    const out = await sendBroadcast(
      [{ id: me.id, email: me.email }],
      `[تجريبي] ${parsed.subject}`,
      renderBroadcastBody(parsed.text),
      teacherUnsubscribeUrl,
      TEACHER_FOOTER,
    );
    if (out.sent.length === 0) {
      // The admin's own address is on the unsubscribe list: say so rather than "could not send".
      res.status(out.skipped.length > 0 ? 409 : 502).json({ error: out.skipped.length > 0 ? "unsubscribed" : "send" });
      return;
    }
    // One unsent issue at a time: this test replaces the last one, whose id then no longer sends.
    await db.delete(newsletterIssues).where(isNull(newsletterIssues.sentAt));
    const [issue] = await db
      .insert(newsletterIssues)
      .values({ subject: parsed.subject, body: parsed.text, contentHash: newsletterHash(parsed.subject, parsed.text), createdBy: me.id })
      .returning({ id: newsletterIssues.id });
    res.json({ issueId: issue!.id, sentTo: me.email });
  } catch (err) {
    logger.error({ err }, "newsletter test failed");
    res.status(500).json({ error: "Failed to send" });
  }
});

router.post("/admin/newsletter/send", authMiddleware, requireRole("system_admin"), limiter, async (req: AuthenticatedRequest, res) => {
  const parsed = parseNewsletter(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const issueId = (req.body as { issueId?: unknown } | null)?.issueId;
  if (typeof issueId !== "string" || !UUID.test(issueId)) {
    res.status(400).json({ error: "issueId" });
    return;
  }
  try {
    const [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, issueId)).limit(1);
    const decision = sendDecision(issue, parsed.subject, parsed.text);
    if (decision !== "ok") {
      res.status(409).json({ error: decision });
      return;
    }

    // Claim the issue, so a second request for it (a double tap, a retry while this one runs) mails nobody.
    const claimed = await db
      .update(newsletterIssues)
      .set({ sendingAt: sql`now()` })
      .where(
        and(
          eq(newsletterIssues.id, issueId),
          or(isNull(newsletterIssues.sendingAt), lt(newsletterIssues.sendingAt, sql`now() - make_interval(mins => ${SENDING_CLAIM_MINUTES})`)),
        ),
      )
      .returning({ id: newsletterIssues.id });
    if (claimed.length === 0) {
      res.status(409).json({ error: "sending" });
      return;
    }

    try {
      const already = new Set(
        (await db.select({ userId: newsletterSends.userId }).from(newsletterSends).where(eq(newsletterSends.issueId, issueId))).map((r) => r.userId),
      );
      const recipients = pickTeacherRecipients(await teacherRows()).filter((r) => !already.has(r.id));
      const out = await sendBroadcast(recipients, parsed.subject, renderBroadcastBody(parsed.text), teacherUnsubscribeUrl, TEACHER_FOOTER);

      const accepted = new Set(out.sent.map((e) => e.toLowerCase()));
      const sentIds = recipients.filter((r) => accepted.has(r.email.toLowerCase())).map((r) => r.id);
      if (sentIds.length > 0) {
        try {
          await db.insert(newsletterSends).values(sentIds.map((userId) => ({ issueId, userId }))).onConflictDoNothing();
          await db
            .update(newsletterIssues)
            .set({ sentAt: sql`coalesce(${newsletterIssues.sentAt}, now())` })
            .where(eq(newsletterIssues.id, issueId));
        } catch (err) {
          // The mail is out and we cannot remember to whom: a retry would mail them again, so say so loudly.
          logger.error({ err, issueId, sent: sentIds.length }, "newsletter sent but not recorded — do not retry this issue");
          res.status(500).json({ error: "sent-not-recorded", sent: sentIds.length });
          return;
        }
      }
      logger.info(
        { by: req.user!.id, issueId, sent: out.sent.length, failed: out.failed.length, skipped: out.skipped.length },
        "teacher newsletter",
      );
      res.json({ sent: out.sent.length, failed: out.failed.length, skipped: out.skipped.length });
    } finally {
      await db
        .update(newsletterIssues)
        .set({ sendingAt: null })
        .where(eq(newsletterIssues.id, issueId))
        .catch((err) => logger.error({ err, issueId }, "newsletter claim not released"));
    }
  } catch (err) {
    logger.error({ err }, "newsletter send failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
