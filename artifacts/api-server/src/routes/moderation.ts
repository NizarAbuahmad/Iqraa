/**
 * The other half of "report" — somewhere the reports go.
 *
 * `POST /messaging/reports` has existed since messaging shipped, writing rows
 * that nothing ever read: no route listed them, nothing moved `status` off
 * `open`, and nothing had ever set `chatMessages.archivedAt` even though the
 * message list already filters on it. So the button worked, the table filled
 * up, and no report could be acted on. Apple's guideline 1.2 asks for four
 * things from an app carrying user content — filtering, reporting, blocking,
 * and the developer removing content and ejecting the offender within 24
 * hours. Only the middle two existed.
 *
 * Two endpoints do the work, because a moderator does not browse and then act
 * later; they open a report and decide once. `resolve` is that decision —
 * hide the message, suspend the author, both, or neither — applied as one
 * call so a queue cannot end up with a hidden message and an open report
 * disagreeing about what happened.
 *
 * Admin-only, deliberately. The teacher who owns a thread already sees every
 * message in it, so a per-teacher queue would add no visibility; what was
 * missing is the operator-level power to act, which is what 1.2 asks of the
 * developer specifically.
 */
import { Router } from "express";
import {
  chatMessages,
  chatReports,
  chatThreads,
  db,
  users,
  type ChatReportStatus,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();
const ADMIN_ROLES = ["school_admin", "system_admin"];
const STATUSES: ChatReportStatus[] = ["open", "reviewed", "dismissed"];

// Two joins onto the same table need two names, or the query silently reads
// one person's row for both sides of the report.
const reporter = alias(users, "reporter");
const reported = alias(users, "reported");

/**
 * GET /moderation/reports?status=open&limit=&offset=
 *
 * Newest first. Carries the reported message's own text and attachment
 * alongside the report, because a moderator deciding whether to hide
 * something must be able to read it without opening the thread as somebody
 * they are not.
 */
router.get("/moderation/reports", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { status, limit, offset } = req.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageOffset = Math.max(Number(offset) || 0, 0);
    const wanted = STATUSES.includes(status as ChatReportStatus)
      ? (status as ChatReportStatus)
      : undefined;
    const where = wanted ? eq(chatReports.status, wanted) : undefined;

    const rows = await db
      .select({
        id: chatReports.id,
        reason: chatReports.reason,
        status: chatReports.status,
        createdAt: chatReports.createdAt,
        threadId: chatReports.threadId,
        threadTitle: chatThreads.title,
        messageId: chatReports.messageId,
        // Null when the report named no message, and also when the message
        // has since been deleted — `chatReports.messageId` is `set null`, so
        // "reported a person, not a post" and "the post is gone" look the
        // same here on purpose.
        messageBody: chatMessages.body,
        messageAttachmentKind: chatMessages.attachmentKind,
        messageArchivedAt: chatMessages.archivedAt,
        reporterId: reporter.id,
        reporterName: sql<string>`${reporter.firstName} || ' ' || ${reporter.lastName}`,
        reportedId: reported.id,
        reportedName: sql<string>`${reported.firstName} || ' ' || ${reported.lastName}`,
        reportedEmail: reported.email,
        reportedRole: reported.role,
        reportedSuspendedAt: reported.suspendedAt,
      })
      .from(chatReports)
      .innerJoin(reporter, eq(chatReports.reporterUserId, reporter.id))
      .innerJoin(reported, eq(chatReports.reportedUserId, reported.id))
      .innerJoin(chatThreads, eq(chatReports.threadId, chatThreads.id))
      .leftJoin(chatMessages, eq(chatReports.messageId, chatMessages.id))
      .where(where)
      .orderBy(desc(chatReports.createdAt))
      .limit(pageSize)
      .offset(pageOffset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatReports)
      .where(where);

    // The open count is what says whether the 24-hour obligation is being
    // met, so it is returned whatever the current filter is.
    const [{ count: openCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatReports)
      .where(eq(chatReports.status, "open"));

    res.json({ reports: rows, total: count, openCount });
  } catch (err) {
    logger.error({ err }, "list moderation reports failed");
    res.status(500).json({ error: "Failed to load reports" });
  }
});

/**
 * POST /moderation/reports/:id/resolve
 *
 * Body: { outcome: 'reviewed' | 'dismissed', hideMessage?: boolean,
 *         suspendUser?: boolean, suspendReason?: string }
 *
 * One call for the whole decision. `dismissed` with actions attached is
 * refused rather than quietly honoured: "there was nothing wrong here" and
 * "I hid it and suspended them" cannot both be true of one report, and a
 * queue that accepts the contradiction stops being an audit trail.
 */
router.post(
  "/moderation/reports/:id/resolve",
  authMiddleware,
  requireRole(...ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { outcome, hideMessage, suspendUser, suspendReason } = req.body as {
        outcome?: string;
        hideMessage?: boolean;
        suspendUser?: boolean;
        suspendReason?: string;
      };

      if (outcome !== "reviewed" && outcome !== "dismissed") {
        res.status(400).json({ error: "outcome must be 'reviewed' or 'dismissed'" });
        return;
      }
      if (outcome === "dismissed" && (hideMessage || suspendUser)) {
        res.status(400).json({ error: "A dismissed report cannot also hide or suspend" });
        return;
      }

      const [report] = await db
        .select()
        .from(chatReports)
        .where(eq(chatReports.id, req.params["id"] as string))
        .limit(1);
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      // A moderator must not be able to lock themselves — or every other
      // admin — out of the tool that reverses a suspension.
      if (suspendUser) {
        const [target] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, report.reportedUserId))
          .limit(1);
        if (!target) {
          res.status(404).json({ error: "Reported user no longer exists" });
          return;
        }
        if (ADMIN_ROLES.includes(target.role)) {
          res.status(403).json({ error: "An administrator cannot be suspended from here" });
          return;
        }
      }

      let hidden = false;
      if (hideMessage) {
        if (!report.messageId) {
          res.status(400).json({ error: "This report does not name a message to hide" });
          return;
        }
        // Hide, never delete: `chatMessages.archivedAt` is already filtered
        // out of every thread read (see routes/messaging.ts), so this removes
        // it from view while the evidence survives an appeal.
        const updated = await db
          .update(chatMessages)
          .set({ archivedAt: new Date() })
          .where(and(eq(chatMessages.id, report.messageId), sql`${chatMessages.archivedAt} is null`))
          .returning({ id: chatMessages.id });
        hidden = updated.length > 0;
      }

      if (suspendUser) {
        await db
          .update(users)
          .set({
            suspendedAt: new Date(),
            suspendedReason: (suspendReason ?? "").trim().slice(0, 500),
          })
          .where(eq(users.id, report.reportedUserId));
      }

      const [saved] = await db
        .update(chatReports)
        .set({ status: outcome })
        .where(eq(chatReports.id, report.id))
        .returning();

      // The only durable record of who did what: there is no moderation audit
      // table, and the report row holds an outcome but not an actor.
      // ponytail: logs, not a table. Add one when a second moderator exists.
      logger.info(
        {
          reportId: report.id,
          moderatorId: req.user!.id,
          outcome,
          hidden,
          suspendedUserId: suspendUser ? report.reportedUserId : undefined,
        },
        "moderation action",
      );

      res.json({ report: saved, hidden });
    } catch (err) {
      logger.error({ err }, "resolve moderation report failed");
      res.status(500).json({ error: "Failed to resolve report" });
    }
  },
);

/**
 * POST /moderation/users/:id/unsuspend
 *
 * Not folded into `resolve`: lifting a suspension is not a decision about a
 * report, and by the time someone appeals, the report that caused it is
 * closed.
 */
router.post(
  "/moderation/users/:id/unsuspend",
  authMiddleware,
  requireRole(...ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const [updated] = await db
        .update(users)
        .set({ suspendedAt: null, suspendedReason: "" })
        .where(eq(users.id, req.params["id"] as string))
        .returning({ id: users.id, email: users.email });

      if (!updated) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      logger.info(
        { userId: updated.id, moderatorId: req.user!.id },
        "moderation suspension lifted",
      );
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "unsuspend failed");
      res.status(500).json({ error: "Failed to lift the suspension" });
    }
  },
);

export default router;
