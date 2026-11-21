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
 * the low thousands. The answer is written after the work is done, because work after `res.json`
 * may never run on Cloud Run.
 *
 * Who is mailed is recorded BEFORE each batch is handed to the provider (and taken back for the
 * ones the provider did not accept), so a crash can make a teacher miss an issue but never get it
 * twice. A retry skips everyone recorded, by user id and by address, and a run mails only the
 * teachers whose record its own insert wrote. Re-testing the identical text resumes the issue
 * that already has it (an edited text, even by one character, is a new issue). Only the admin
 * who received the test copy may send it.
 */
import { Router } from "express";
import { newsletterIssues, newsletterSends, systemDb as db, users } from "@workspace/db";
import { and, desc, eq, gte, inArray, ne, notExists, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
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
    .where(inArray(users.role, [...NEWSLETTER_ROLES]))
    .orderBy(users.createdAt, users.id);

const releaseClaim = (issueId: string) =>
  db
    .update(newsletterIssues)
    .set({ sendingAt: null })
    .where(eq(newsletterIssues.id, issueId))
    .then(() => undefined)
    .catch((err) => logger.error({ err, issueId }, "newsletter claim not released"));

/** Recipients per provider call: matches the batch size of sendBroadcast (lib/email.ts). */
const CHUNK = 100;
const CHUNK_PAUSE_MS = 600;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    // Never touch an issue that is being sent: its draft row is what the send is reading.
    const [busy] = await db
      .select({ id: newsletterIssues.id })
      .from(newsletterIssues)
      .where(gte(newsletterIssues.sendingAt, sql`now() - make_interval(mins => ${SENDING_CLAIM_MINUTES})`))
      .limit(1);
    if (busy) {
      res.status(409).json({ error: "sending" });
      return;
    }
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
    const contentHash = newsletterHash(parsed.subject, parsed.text);
    // One text is one issue: `content_hash` is unique, so a test of text that already has an issue
    // (perhaps sent in part, then its test expired) resumes THAT issue and its recorded recipients
    // are skipped, and two simultaneous tests of the same text land on the same issue. The issue
    // becomes the caller's, since only the admin who got the test copy may send it.
    const [issue] = await db
      .insert(newsletterIssues)
      .values({ subject: parsed.subject, body: parsed.text, contentHash, createdBy: me.id })
      .onConflictDoUpdate({
        target: newsletterIssues.contentHash,
        set: { testedAt: sql`now()`, createdBy: me.id, subject: sql`excluded.subject`, body: sql`excluded.body` },
      })
      .returning({ id: newsletterIssues.id });
    // One unsent issue at a time: this test replaces the last one, whose id then no longer sends.
    await db
      .delete(newsletterIssues)
      .where(
        and(
          ne(newsletterIssues.id, issue!.id),
          isNull(newsletterIssues.sentAt),
          // An issue with recipients is the record of who was mailed, whatever its sent_at
          // (the stamp can fail to land after the provider took the mail), and the cascade
          // would erase that record.
          notExists(db.select({ one: sql`1` }).from(newsletterSends).where(eq(newsletterSends.issueId, newsletterIssues.id))),
          or(isNull(newsletterIssues.sendingAt), lt(newsletterIssues.sendingAt, sql`now() - make_interval(mins => ${SENDING_CLAIM_MINUTES})`)),
        ),
      );
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
    // Only the admin who received the test copy may send it: another admin has not read this
    // text in their own inbox. Re-testing the identical text makes the issue theirs.
    if (issue!.createdBy !== req.user!.id) {
      res.status(409).json({ error: "not-tested" });
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
      const sentUsers = await db
        .select({ userId: newsletterSends.userId, email: users.email })
        .from(newsletterSends)
        .innerJoin(users, eq(users.id, newsletterSends.userId))
        .where(eq(newsletterSends.issueId, issueId));
      const alreadyIds = new Set(sentUsers.map((r) => r.userId));
      const alreadyEmails = new Set(sentUsers.map((r) => (r.email ?? "").trim().toLowerCase()));
      const recipients = pickTeacherRecipients(await teacherRows()).filter(
        (r) => !alreadyIds.has(r.id) && !alreadyEmails.has(r.email.toLowerCase()),
      );
      const html = renderBroadcastBody(parsed.text);

      let sent = 0;
      let failed = 0;
      let skipped = 0;
      for (let at = 0; at < recipients.length; at += CHUNK) {
        const slice = recipients.slice(at, at + CHUNK);
        if (at > 0) await sleep(CHUNK_PAUSE_MS);
        await db.update(newsletterIssues).set({ sendingAt: sql`now()` }).where(eq(newsletterIssues.id, issueId));
        let mine: Set<string>;
        try {
          // Write ahead: if we die after the provider took the mail, nobody is mailed twice.
          const inserted = await db
            .insert(newsletterSends)
            .values(slice.map((r) => ({ issueId, userId: r.id })))
            .onConflictDoNothing()
            .returning({ userId: newsletterSends.userId });
          mine = new Set(inserted.map((r) => r.userId));
        } catch (err) {
          logger.error({ err, issueId, chunk: slice.length }, "newsletter write-ahead failed — chunk not sent, stopping");
          failed += recipients.length - at;
          break;
        }
        // The primary key decides: a row that already existed belongs to another run (one that
        // took a stale claim while this one stalled), which mails that teacher. Not mailed, not counted.
        const chunk = slice.filter((r) => mine.has(r.id));
        if (chunk.length === 0) continue;
        const out = await sendBroadcast(chunk, parsed.subject, html, teacherUnsubscribeUrl, TEACHER_FOOTER);
        const accepted = new Set(out.sent.map((e) => e.toLowerCase()));
        // Only this request's own rows are taken back.
        const notSent = chunk.filter((r) => !accepted.has(r.email.toLowerCase())).map((r) => r.id);
        if (notSent.length > 0) {
          try {
            await db.delete(newsletterSends).where(and(eq(newsletterSends.issueId, issueId), inArray(newsletterSends.userId, notSent)));
          } catch (err) {
            // They stay marked as sent: missing an issue is the safe side.
            logger.error({ err, issueId, count: notSent.length }, "newsletter: unsent recipients could not be un-recorded");
          }
        }
        if (out.sent.length > 0) {
          await db
            .update(newsletterIssues)
            .set({ sentAt: sql`coalesce(${newsletterIssues.sentAt}, now())` })
            .where(eq(newsletterIssues.id, issueId));
        }
        sent += out.sent.length;
        failed += out.failed.length;
        skipped += out.skipped.length;
      }
      logger.info({ by: req.user!.id, issueId, sent, failed, skipped }, "teacher newsletter");
      // Release before answering: nothing is guaranteed to run after `res.json`.
      await releaseClaim(issueId);
      res.json({ sent, failed, skipped });
    } finally {
      await releaseClaim(issueId); // also on an error path; harmless twice
    }
  } catch (err) {
    logger.error({ err }, "newsletter send failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
