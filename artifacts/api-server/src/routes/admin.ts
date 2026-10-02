/**
 * Admin usage summary — real counts from data already durably stored
 * (users, saved materials, evaluations, feedback), not a second analytics
 * pipeline. Deep usage/trace data (screens visited, tool opens) lives in
 * PostHog already; this endpoint deliberately doesn't try to duplicate it —
 * see STATUS.md.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  aiGenerations,
  classGroups,
  db,
  evaluations,
  feedback,
  manualMetrics,
  parentContacts,
  refreshTokens,
  savedMaterials,
  siteSignups,
  students,
  users,
} from "@workspace/db";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getBudgetStatus, getUserBudgetLimitUsd } from "../lib/aiBudget.js";
import { currentPeriodStart } from "../lib/aiUsageLog.js";
import { RATE_LIMITS } from "../lib/rateLimit.js";
import { parseDateRange, parseMetricInput, parseSiteSignup, siteKeyMatches, toCsv, UUID } from "../lib/adminMetrics.js";
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

    const since30 = sql`now() - interval '30 days'`;
    const periodStart = currentPeriodStart();
    const [
      usersByRole,
      signupsByDay,
      [authSplit],
      [active],
      aiByKind,
      topSpenders,
      [classCounts],
      parentLettersByChannel,
      [emailCounts],
    ] = await Promise.all([
      db
        .select({
          role: users.role,
          count: sql<number>`count(*)::int`,
          suspended: sql<number>`count(${users.suspendedAt})::int`,
        })
        .from(users)
        .groupBy(users.role),
      db
        .select({
          day: sql<string>`to_char(${users.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          role: users.role,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(gte(users.createdAt, since30))
        .groupBy(sql`1`, users.role)
        .orderBy(sql`1`),
      db
        .select({
          google: sql<number>`count(${users.googleId})::int`,
          password: sql<number>`count(*) filter (where ${users.googleId} is null)::int`,
        })
        .from(users),
      // "Active" = generated something with AI or saved a material. Logging in
      // alone doesn't count — the question is whether the tool is being used.
      db.execute<{ d7: number; d30: number }>(sql`
        select
          count(distinct user_id) filter (where created_at >= now() - interval '7 days')::int as d7,
          count(distinct user_id)::int as d30
        from (
          select user_id, created_at from ai_generations
            where created_at >= now() - interval '30 days' and user_id is not null
          union all
          select user_id, created_at from saved_materials
            where created_at >= now() - interval '30 days'
        ) a`).then((r) => r.rows),
      db
        .select({
          kind: aiGenerations.kind,
          count: sql<number>`count(*)::int`,
          hits: sql<number>`count(*) filter (where ${aiGenerations.cacheStatus} = 'hit')::int`,
          costUsd: sql<number>`coalesce(sum(${aiGenerations.costUsd}), 0)::float`,
          p50Ms: sql<number | null>`percentile_cont(0.5) within group (order by ${aiGenerations.durationMs})::int`,
          p95Ms: sql<number | null>`percentile_cont(0.95) within group (order by ${aiGenerations.durationMs})::int`,
        })
        .from(aiGenerations)
        .where(gte(aiGenerations.createdAt, periodStart))
        .groupBy(aiGenerations.kind)
        .orderBy(desc(sql`4`)),
      db
        .select({
          userId: aiGenerations.userId,
          email: users.email,
          role: users.role,
          costUsd: sql<number>`sum(${aiGenerations.costUsd})::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(aiGenerations)
        .innerJoin(users, eq(users.id, aiGenerations.userId))
        .where(gte(aiGenerations.createdAt, periodStart))
        .groupBy(aiGenerations.userId, users.email, users.role)
        .orderBy(desc(sql`4`))
        .limit(10),
      db
        .execute<{ classes: number; students: number; students30d: number }>(sql`
          select
            (select count(*)::int from ${classGroups}) as classes,
            (select count(*)::int from ${students}) as students,
            (select count(*)::int from ${students} where ${students.createdAt} >= now() - interval '30 days') as "students30d"`)
        .then((r) => r.rows),
      db
        .select({
          channel: parentContacts.channel,
          total: sql<number>`count(*)::int`,
          last30d: sql<number>`count(*) filter (where ${parentContacts.createdAt} >= now() - interval '30 days')::int`,
        })
        .from(parentContacts)
        .groupBy(parentContacts.channel),
      db
        .select({
          waitlist: sql<number>`count(*) filter (where ${siteSignups.kind} = 'waitlist')::int`,
          contact: sql<number>`count(*) filter (where ${siteSignups.kind} = 'contact')::int`,
        })
        .from(siteSignups),
    ]);

    const signupPlatforms = await db
      .select({ platform: sql<string>`coalesce(${users.signupPlatform}, 'unknown')`, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(sql`1`)
      .orderBy(desc(sql`2`));

    res.json({
      totalUsers,
      totalEvaluations,
      signupPlatforms,
      usersWithoutRecovery,
      materialsByType: Object.fromEntries(materialsByType.map((r) => [r.type, r.count])),
      feedbackByRating: Object.fromEntries(feedbackByRating.map((r) => [r.rating, r.count])),
      usersByRole,
      suspendedCount: usersByRole.reduce((n, r) => n + r.suspended, 0),
      signupsByDay,
      authSplit,
      activeUsers7d: active?.d7 ?? 0,
      activeUsers30d: active?.d30 ?? 0,
      ai: { budget: getBudgetStatus(), byKind: aiByKind, topSpenders },
      classes: classCounts,
      parentLetters: parentLettersByChannel,
      siteSignups: emailCounts,
      limits: {
        userBudgetUsd: getUserBudgetLimitUsd("teacher"),
        studentBudgetUsd: getUserBudgetLimitUsd("student"),
        rateLimits: [...RATE_LIMITS].map(([name, l]) => ({ name, ...l })).sort((a, b) => a.name.localeCompare(b.name)),
      },
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

const PAGE = 30;
const offsetOf = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);

/**
 * GET /admin/users?q=&status=all|suspended&offset=
 * Newest first, with this month's AI spend so a heavy user stands out.
 */
router.get("/admin/users", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const q = typeof req.query["q"] === "string" ? req.query["q"].trim().slice(0, 100) : "";
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const range = parseDateRange(req.query as Record<string, unknown>);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }
    const where = and(
      q ? or(ilike(users.email, like), ilike(users.firstName, like), ilike(users.lastName, like)) : undefined,
      req.query["status"] === "suspended" ? isNotNull(users.suspendedAt) : undefined,
      range.from ? gte(users.createdAt, range.from) : undefined,
      range.to ? lt(users.createdAt, range.to) : undefined,
    );
    const spend = sql<number>`coalesce((
      select sum(${aiGenerations.costUsd}) from ${aiGenerations}
      where ${aiGenerations.userId} = ${users.id} and ${aiGenerations.createdAt} >= ${currentPeriodStart()}
    ), 0)::float`;
    const [items, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          google: sql<boolean>`${users.googleId} is not null`,
          signupPlatform: users.signupPlatform,
          signupReferrer: users.signupReferrer,
          createdAt: users.createdAt,
          lastLogin: users.lastLogin,
          suspendedAt: users.suspendedAt,
          suspendedReason: users.suspendedReason,
          monthSpendUsd: spend,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(PAGE)
        .offset(offsetOf(req.query["offset"])),
      db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
    ]);
    res.json({ items, total });
  } catch (err) {
    logger.error({ err }, "admin users list failed");
    res.status(500).json({ error: "Failed to list users" });
  }
});

/**
 * POST /admin/users/:id/suspend { reason }
 *
 * Blocking from the users list, rather than only from a chat report. The
 * suspension itself is the existing one (auth middleware 403s every route but
 * /auth/me and account deletion); unblocking is the existing
 * POST /moderation/users/:id/unsuspend. Never onto an admin, for the same
 * reason moderation refuses it: an admin could lock every other admin out.
 */
router.post(
  "/admin/users/:id/suspend",
  authMiddleware,
  requireRole(...ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetId = req.params["id"] as string;
      if (!UUID.test(targetId)) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (ADMIN_ROLES.includes(target.role)) {
        res.status(403).json({ error: "An administrator cannot be suspended" });
        return;
      }
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
      await db.update(users).set({ suspendedAt: new Date(), suspendedReason: reason }).where(eq(users.id, targetId));
      // ponytail: the log line is the audit trail, as for set-password above.
      logger.info({ actorId: req.user!.id, targetId }, "admin suspended user");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "admin suspend failed");
      res.status(500).json({ error: "Failed to suspend user" });
    }
  },
);

/** GET /admin/metrics — every hand-entered growth number, oldest first per key. */
router.get("/admin/metrics", authMiddleware, requireRole(...ADMIN_ROLES), async (_req, res) => {
  try {
    const rows = await db
      .select({ key: manualMetrics.key, value: manualMetrics.value, date: manualMetrics.recordedOn })
      .from(manualMetrics)
      .orderBy(asc(manualMetrics.key), asc(manualMetrics.recordedOn));
    res.json({ items: rows });
  } catch (err) {
    logger.error({ err }, "admin metrics read failed");
    res.status(500).json({ error: "Failed to read metrics" });
  }
});

/** POST /admin/metrics { key, value, date? } — one number per key per day; re-entering a day replaces it. */
router.post("/admin/metrics", authMiddleware, requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
  const parsed = parseMetricInput(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    await db
      .insert(manualMetrics)
      .values({ ...parsed, recordedBy: req.user!.id })
      .onConflictDoUpdate({
        target: [manualMetrics.key, manualMetrics.recordedOn],
        set: { value: parsed.value, recordedBy: req.user!.id },
      });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "admin metric write failed");
    res.status(500).json({ error: "Failed to save metric" });
  }
});

/** GET /admin/signups?kind=waitlist|contact&offset= — or &format=csv for all of them. */
router.get("/admin/signups", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const kind = req.query["kind"];
    const range = parseDateRange(req.query as Record<string, unknown>);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }
    const where = and(
      kind === "waitlist" || kind === "contact" ? eq(siteSignups.kind, kind) : undefined,
      range.from ? gte(siteSignups.createdAt, range.from) : undefined,
      range.to ? lt(siteSignups.createdAt, range.to) : undefined,
    );
    const base = db.select().from(siteSignups).where(where).orderBy(desc(siteSignups.createdAt));
    if (req.query["format"] === "csv") {
      const rows = await base;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="iqraa-signups.csv"`);
      // BOM so Excel reads the Arabic as UTF-8.
      res.send("﻿" + toCsv(
        ["date", "kind", "email", "name", "message", "context"],
        rows.map((r) => [r.createdAt, r.kind, r.email, r.name, r.message, r.context]),
      ));
      return;
    }
    const [items, [{ total }]] = await Promise.all([
      base.limit(PAGE).offset(offsetOf(req.query["offset"])),
      db.select({ total: sql<number>`count(*)::int` }).from(siteSignups).where(where),
    ]);
    res.json({ items, total });
  } catch (err) {
    logger.error({ err }, "admin signups list failed");
    res.status(500).json({ error: "Failed to list signups" });
  }
});

/**
 * GET /admin/ai-costs?from=&to= — the AI spend page. Defaults to the current
 * UTC month, which is the budget period. Every breakdown reads the same rows
 * with the same filter, so the tables agree with the totals.
 */
router.get("/admin/ai-costs", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  const range = parseDateRange(req.query as Record<string, unknown>);
  if ("error" in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  const from = range.from ?? currentPeriodStart();
  const where = and(gte(aiGenerations.createdAt, from), range.to ? lt(aiGenerations.createdAt, range.to) : undefined);
  const calls = sql<number>`count(*)::int`;
  const hits = sql<number>`count(*) filter (where ${aiGenerations.cacheStatus} = 'hit')::int`;
  const costUsd = sql<number>`coalesce(sum(${aiGenerations.costUsd}), 0)::float`;
  const promptTokens = sql<number>`coalesce(sum(${aiGenerations.promptTokens}), 0)::int`;
  const completionTokens = sql<number>`coalesce(sum(${aiGenerations.completionTokens}), 0)::int`;
  try {
    const [[totals], byDay, byKind, byModel, byUser] = await Promise.all([
      db.select({ calls, hits, costUsd, promptTokens, completionTokens }).from(aiGenerations).where(where),
      db
        .select({ day: sql<string>`to_char(${aiGenerations.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, calls, costUsd })
        .from(aiGenerations)
        .where(where)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({
          kind: aiGenerations.kind,
          calls,
          hits,
          costUsd,
          p50Ms: sql<number | null>`percentile_cont(0.5) within group (order by ${aiGenerations.durationMs})::int`,
          p95Ms: sql<number | null>`percentile_cont(0.95) within group (order by ${aiGenerations.durationMs})::int`,
        })
        .from(aiGenerations)
        .where(where)
        .groupBy(aiGenerations.kind)
        .orderBy(desc(sql`4`)),
      db
        .select({ model: aiGenerations.model, calls, costUsd, promptTokens, completionTokens })
        .from(aiGenerations)
        .where(where)
        .groupBy(aiGenerations.model)
        .orderBy(desc(sql`3`)),
      db
        .select({ userId: aiGenerations.userId, email: users.email, role: users.role, calls, costUsd })
        .from(aiGenerations)
        .innerJoin(users, eq(users.id, aiGenerations.userId))
        .where(where)
        .groupBy(aiGenerations.userId, users.email, users.role)
        .orderBy(desc(sql`5`))
        .limit(50),
    ]);
    res.json({
      from: from.toISOString(),
      to: (range.to ?? new Date()).toISOString(),
      totals,
      byDay,
      byKind,
      byModel,
      byUser,
      budget: getBudgetStatus(),
    });
  } catch (err) {
    logger.error({ err }, "admin ai-costs failed");
    res.status(500).json({ error: "Failed to load AI costs" });
  }
});

/**
 * POST /site/signups — called server-to-server by iqrra.com's Vercel functions
 * (Site_Iqra/api/waitlist.mjs, feedback.mjs) with `x-site-key: SITE_INGEST_KEY`.
 * Not a browser endpoint: without the key it is 404, so it doesn't exist as far
 * as anyone probing is concerned. Resend stays the site's own path; this is a
 * copy the dashboard can count.
 */
const siteSignupLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60, name: "site-signups" });

router.post("/site/signups", siteSignupLimiter, async (req, res) => {
  if (!siteKeyMatches(process.env.SITE_INGEST_KEY, req.headers["x-site-key"])) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = parseSiteSignup(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    await db.insert(siteSignups).values(parsed);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "site signup insert failed");
    res.status(500).json({ error: "Failed to store signup" });
  }
});

export default router;
