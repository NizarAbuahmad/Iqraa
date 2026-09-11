/**
 * Admin usage summary — real counts from data already durably stored
 * (users, saved materials, evaluations, feedback), not a second analytics
 * pipeline. Deep usage/trace data (screens visited, tool opens) lives in
 * PostHog already; this endpoint deliberately doesn't try to duplicate it —
 * see STATUS.md.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, evaluations, feedback, refreshTokens, savedMaterials, users } from "@workspace/db";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import {
  canAdminSetPassword,
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from "../lib/passwordPolicy.js";

const router = Router();
const ADMIN_ROLES = ["school_admin", "system_admin"];

/** Postgres rejects a malformed uuid with 22P02, which would surface as a 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/admin/usage-summary", authMiddleware, requireRole(...ADMIN_ROLES), async (_req, res) => {
  try {
    const [
      [{ count: totalUsers }],
      materialsByType,
      [{ count: totalEvaluations }],
      feedbackByRating,
      [{ count: usersWithoutRecovery }],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db
        .select({ type: savedMaterials.type, count: sql<number>`count(*)::int` })
        .from(savedMaterials)
        .groupBy(savedMaterials.type),
      db.select({ count: sql<number>`count(*)::int` }).from(evaluations),
      db
        .select({ rating: feedback.rating, count: sql<number>`count(*)::int` })
        .from(feedback)
        .groupBy(feedback.rating),
      /**
       * Accounts with a password and no Google account to fall back on —
       * the ones that removing password reset on 2026-09-10 left with no
       * way back in at all. Counted here rather than guessed at, because it
       * is the number that decides whether a reset flow is worth building
       * an email provider for, or whether the admin set-password route
       * below already over-serves the problem.
       */
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(isNotNull(users.passwordHash), isNull(users.googleId))),
    ]);

    res.json({
      totalUsers,
      totalEvaluations,
      usersWithoutRecovery,
      materialsByType: Object.fromEntries(materialsByType.map((r) => [r.type, r.count])),
      feedbackByRating: Object.fromEntries(feedbackByRating.map((r) => [r.rating, r.count])),
    });
  } catch (err) {
    logger.error({ err }, "admin usage summary failed");
    res.status(500).json({ error: "Failed to fetch usage summary" });
  }
});

/**
 * POST /admin/users/:id/password
 *
 * The stopgap for an account with no way back in. Password reset was removed
 * on 2026-09-10 because there is no email provider to send a token through,
 * which left an email+password account on a non-Google address with no
 * recovery route at all (see STATUS.md). Until a reset flow returns, this is
 * the only one, and it costs an out-of-band conversation with an admin.
 *
 * `system_admin` only, and never onto another admin — see `canAdminSetPassword`
 * for why that second half matters more than the first.
 *
 * Every session the account holds is revoked with the change. A password set
 * to lock someone out is worth nothing while the refresh token they already
 * hold keeps minting access tokens for another 30 days.
 *
 * ponytail: no audit table, so the log line below is the audit trail. Add one
 * if this endpoint ever runs often enough that grepping logs stops working.
 */
const setPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  name: "admin-set-password",
});

router.post(
  "/admin/users/:id/password",
  authMiddleware,
  requireRole("system_admin"),
  setPasswordLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { password } = req.body as { password?: string };
      if (!password || !isStrongPassword(password)) {
        res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
        return;
      }

      const targetId = req.params["id"] as string;
      if (!UUID.test(targetId)) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const [target] = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!canAdminSetPassword(req.user!.role, target)) {
        res.status(403).json({ error: "Cannot set the password of an admin account" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.update(users).set({ passwordHash }).where(eq(users.id, target.id));

      const revoked = await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, target.id))
        .returning({ id: refreshTokens.id });

      // Names both people and never the password — this line is the only
      // record that the change happened.
      logger.info(
        {
          actorId: req.user!.id,
          targetId: target.id,
          sessionsRevoked: revoked.length,
        },
        "admin set user password",
      );

      res.json({
        ok: true,
        userId: target.id,
        email: target.email,
        sessionsRevoked: revoked.length,
      });
    } catch (err) {
      logger.error({ err }, "admin set password failed");
      res.status(500).json({ error: "Failed to set password" });
    }
  },
);

export default router;
