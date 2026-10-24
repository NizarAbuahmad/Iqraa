/**
 * Admin usage summary — real counts from data already durably stored
 * (users, saved materials, evaluations, feedback), not a second analytics
 * pipeline. Deep usage/trace data (screens visited, tool opens) lives in
 * PostHog already; this endpoint deliberately doesn't try to duplicate it —
 * see STATUS.md.
 */
import { Router } from "express";
import { hashPassword } from "../lib/passwordHash.js";
import {
  aiGenerations,
  classGroups,
  systemDb as db, // Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
  evaluations,
  feedback,
  manualMetrics,
  parentContacts,
  refreshTokens,
  savedMaterials,
  schools,
  siteSignups,
  students,
  users,
} from "@workspace/db";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { getBudgetStatus, getUserBudgetLimitUsd } from "../lib/aiBudget.js";
import { currentPeriodStart } from "../lib/aiUsageLog.js";
import { RATE_LIMITS } from "../lib/rateLimit.js";
import { parseSchoolAssignment, parseSchoolIdFilter, parseSchoolInput } from "../lib/adminSchools.js";
import { parseDateRange, parseMetricInput, parsePublicIdea, parseSiteSignup, siteKeyMatches, toCsv, UUID } from "../lib/adminMetrics.js";
import { notifyAdminsOfWaitlistSignup } from "../lib/adminNotify.js";
import { fetchSubscriberCount } from "../lib/youtubeSubscribers.js";
import { sendAppInviteEmail } from "../lib/email.js";
import { isValidEmailAddress } from "../lib/emailAddress.js";
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
          // Password accounts only: a parent or student who signed up from a
          // teacher's code has neither, and counting them here would make the
          // split say "password" for a child who has never typed one.
          password: sql<number>`count(*) filter (where ${users.googleId} is null and ${users.passwordHash} is not null)::int`,
          codeOnly: sql<number>`count(*) filter (where ${users.googleId} is null and ${users.passwordHash} is null and ${users.loginCodeHash} is not null)::int`,
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
          idea: sql<number>`count(*) filter (where ${siteSignups.kind} = 'idea')::int`,
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

      const passwordHash = await hashPassword(password);
      // One transaction: the user row stays locked until the sessions are gone,
      // which is what an in-flight `/auth/refresh` waits on.
      const revoked = await db.transaction(async tx => {
        await tx.update(users).set({ passwordHash }).where(eq(users.id, target.id));
        return tx
          .delete(refreshTokens)
          .where(eq(refreshTokens.userId, target.id))
          .returning({ id: refreshTokens.id });
      });

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
const offsetOf = (v: unknown) => {
  const n = Math.floor(Number(v));
  // `?offset=1e400` is Infinity, which `|| 0` lets through to Postgres.
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * GET /admin/users?q=&status=all|suspended&role=&schoolId=&offset=
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
    let schoolId: string | undefined;
    try {
      schoolId = parseSchoolIdFilter(req.query["schoolId"]);
    } catch (msg) {
      res.status(400).json({ error: String(msg) });
      return;
    }
    const where = and(
      q ? or(ilike(users.email, like), ilike(users.firstName, like), ilike(users.lastName, like)) : undefined,
      req.query["status"] === "suspended" ? isNotNull(users.suspendedAt) : undefined,
      // The schools screen lists teachers, and a school's own teachers.
      typeof req.query["role"] === "string" && req.query["role"] ? eq(users.role, req.query["role"]) : undefined,
      schoolId ? eq(users.schoolId, schoolId) : undefined,
      range.from ? gte(users.createdAt, range.from) : undefined,
      range.to ? lt(users.createdAt, range.to) : undefined,
    );
    // Table names written out, not interpolated. In a single-table select drizzle
    // renders interpolated columns unqualified, so this once read `user_id = id`
    // inside the subquery — comparing ai_generations.user_id with its own id — and
    // every row showed $0. It only came right when the school join below made
    // drizzle qualify them; spelling it out keeps it right without that join.
    const spend = sql<number>`coalesce((
      select sum("ai_generations"."cost_usd") from "ai_generations"
      where "ai_generations"."user_id" = "users"."id" and "ai_generations"."created_at" >= ${currentPeriodStart()}
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
          schoolId: users.schoolId,
          schoolName: schools.name,
          monthSpendUsd: spend,
        })
        .from(users)
        .leftJoin(schools, eq(schools.id, users.schoolId))
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
 * Schools — who counts as a colleague for the exam calendar (GET /exam-calendar).
 *
 * `system_admin` only, deliberately narrower than the rest of this file's
 * ADMIN_ROLES: membership decides whose exam dates a teacher can read, so a
 * `school_admin` who could assign teachers could place themselves in any school
 * and read its calendar. Membership is never self-declared; see lib/db/src/schema/schools.ts.
 */
const SCHOOL_ADMIN_ROLES = ["system_admin"];

/** GET /admin/schools — every school with its teacher count, A to Z. */
router.get("/admin/schools", authMiddleware, requireRole(...SCHOOL_ADMIN_ROLES), async (_req, res) => {
  try {
    const items = await db
      .select({
        id: schools.id,
        name: schools.name,
        createdAt: schools.createdAt,
        // Written out, not interpolated: in a single-table select drizzle renders
        // columns unqualified, so `${users.schoolId} = ${schools.id}` becomes
        // `school_id = id` and compares users.school_id with users.id — always 0.
        teacherCount: sql<number>`(select count(*)::int from "users" where "users"."school_id" = "schools"."id")`,
      })
      .from(schools)
      .orderBy(asc(schools.name));
    res.json({ items });
  } catch (err) {
    logger.error({ err }, "admin schools list failed");
    res.status(500).json({ error: "Failed to list schools" });
  }
});

/** POST /admin/schools { name } */
router.post(
  "/admin/schools",
  authMiddleware,
  requireRole(...SCHOOL_ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    let input: { name: string };
    try {
      input = parseSchoolInput(req.body);
    } catch (msg) {
      res.status(400).json({ error: String(msg) });
      return;
    }
    try {
      const [school] = await db.insert(schools).values({ name: input.name }).returning();
      logger.info({ actorId: req.user!.id, schoolId: school!.id }, "admin created school");
      res.status(201).json({ school });
    } catch (err) {
      logger.error({ err }, "admin create school failed");
      res.status(500).json({ error: "Failed to create the school" });
    }
  },
);

/**
 * PUT /admin/users/:id/school { schoolId | null }
 *
 * Teachers only — a parent or student in a school would read colleagues' exam
 * dates through nothing but a role check on the calendar route, and has no
 * business there. `null` removes the teacher from their school.
 */
router.put(
  "/admin/users/:id/school",
  authMiddleware,
  requireRole(...SCHOOL_ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    const targetId = req.params["id"] as string;
    if (!UUID.test(targetId)) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let schoolId: string | null;
    try {
      schoolId = parseSchoolAssignment(req.body);
    } catch (msg) {
      res.status(400).json({ error: String(msg) });
      return;
    }
    try {
      const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (target.role !== "teacher") {
        res.status(400).json({ error: "Only a teacher can be placed in a school" });
        return;
      }
      if (schoolId) {
        const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).limit(1);
        if (!school) {
          res.status(404).json({ error: "School not found" });
          return;
        }
      }
      await db.update(users).set({ schoolId }).where(eq(users.id, targetId));
      // ponytail: the log line is the audit trail, as for set-password above.
      logger.info({ actorId: req.user!.id, targetId, schoolId }, "admin set user school");
      res.json({ ok: true, schoolId });
    } catch (err) {
      logger.error({ err }, "admin set school failed");
      res.status(500).json({ error: "Failed to update the school" });
    }
  },
);

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

let youtubeTriedAt = 0;

/**
 * Today's YouTube subscriber count, fetched the first time an admin opens the
 * dashboard each day — no scheduler to run, and a day nobody looks is a gap in
 * a chart nobody saw. A number an admin already typed for today is kept, and a
 * failed lookup is not retried for 30 minutes so a bad key costs one 4 s wait,
 * not one per page load. Never throws: the dashboard loads without it.
 */
async function refreshYoutubeMetric(): Promise<void> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey || Date.now() - youtubeTriedAt < 30 * 60 * 1000) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [have] = await db
      .select({ id: manualMetrics.id })
      .from(manualMetrics)
      .where(and(eq(manualMetrics.key, "youtube"), eq(manualMetrics.recordedOn, today)))
      .limit(1);
    if (have) return;
    youtubeTriedAt = Date.now();
    const value = await fetchSubscriberCount(apiKey);
    if (value == null) return;
    await db.insert(manualMetrics).values({ key: "youtube", value, recordedOn: today }).onConflictDoNothing();
  } catch {
    // Deliberately no `err` in the log: the request URL carries the API key.
    logger.warn("youtube subscriber refresh failed");
  }
}

/** GET /admin/metrics — every growth number, oldest first per key. YouTube fills itself; the rest are typed in. */
router.get("/admin/metrics", authMiddleware, requireRole(...ADMIN_ROLES), async (_req, res) => {
  await refreshYoutubeMetric();
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
      kind === "waitlist" || kind === "contact" || kind === "idea" ? eq(siteSignups.kind, kind) : undefined,
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
 * POST /admin/invites {email} — mails the Android download link to someone who
 * asked for it. system_admin only, and rate-limited: this sends mail from the
 * app's own domain to an address the caller chose.
 */
const inviteLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 100, name: "admin-invites" });

router.post("/admin/invites", authMiddleware, requireRole("system_admin"), inviteLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  if (!isValidEmailAddress(email)) {
    res.status(400).json({ error: "email" });
    return;
  }
  if (!(await sendAppInviteEmail(email))) {
    res.status(502).json({ error: "send" });
    return;
  }
  logger.info({ to: email }, "app invite sent");
  res.json({ ok: true });
});

/** `?platform=` on the AI pages: «mobile» is both app stores, «unknown» is rows with no marker. */
const PLATFORM_FILTERS: Record<string, (col: typeof aiGenerations.platform) => SQL> = {
  web: (col) => eq(col, "web"),
  mobile: (col) => inArray(col, ["android", "ios"]),
  unknown: (col) => isNull(col),
};

/**
 * GET /admin/ai-costs?from=&to=&platform= — the AI spend page. Defaults to the current
 * UTC month, which is the budget period. Every breakdown reads the same rows
 * with the same filter, so the tables agree with the totals.
 */
router.get("/admin/ai-costs", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  const range = parseDateRange(req.query as Record<string, unknown>);
  if ("error" in range) {
    res.status(400).json({ error: range.error });
    return;
  }
  const platform = req.query["platform"];
  if (platform !== undefined && platform !== "" && !(typeof platform === "string" && Object.hasOwn(PLATFORM_FILTERS, platform))) {
    res.status(400).json({ error: "platform must be mobile, web or unknown" });
    return;
  }
  const from = range.from ?? currentPeriodStart();
  // `byPlatform` reads `inRange`, not `where`: it is the comparison, so it
  // must keep showing every platform while one is picked.
  const inRange = and(gte(aiGenerations.createdAt, from), range.to ? lt(aiGenerations.createdAt, range.to) : undefined);
  const where = and(inRange, platform ? PLATFORM_FILTERS[platform as string]!(aiGenerations.platform) : undefined);
  const calls = sql<number>`count(*)::int`;
  const hits = sql<number>`count(*) filter (where ${aiGenerations.cacheStatus} = 'hit')::int`;
  const costUsd = sql<number>`coalesce(sum(${aiGenerations.costUsd}), 0)::float`;
  const promptTokens = sql<number>`coalesce(sum(${aiGenerations.promptTokens}), 0)::int`;
  const completionTokens = sql<number>`coalesce(sum(${aiGenerations.completionTokens}), 0)::int`;
  try {
    const [[totals], byDay, byKind, byModel, byUser, byPlatform] = await Promise.all([
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
      db
        .select({
          platform: sql<string>`coalesce(${aiGenerations.platform}, 'unknown')`,
          calls,
          hits,
          costUsd,
          p50Ms: sql<number | null>`percentile_cont(0.5) within group (order by ${aiGenerations.durationMs})::int`,
          p95Ms: sql<number | null>`percentile_cont(0.95) within group (order by ${aiGenerations.durationMs})::int`,
        })
        .from(aiGenerations)
        .where(inRange)
        .groupBy(sql`1`)
        .orderBy(desc(sql`4`)),
    ]);
    res.json({
      from: from.toISOString(),
      to: (range.to ?? new Date()).toISOString(),
      totals,
      byDay,
      byKind,
      byModel,
      byUser,
      byPlatform,
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

// «اقترح ميزة» for visitors with no account. Unlike /site/signups there is no
// shared key to check — the browser posts here directly — so the limits are
// the defence: a person suggests a few ideas, not dozens, and the global cap
// bounds how fast even many IPs together can fill the table.
const publicIdeaIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, name: "site-ideas-ip" });
const publicIdeaGlobalLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 200,
  name: "site-ideas-all",
  key: () => "all",
});

router.post("/site/ideas", publicIdeaIpLimiter, publicIdeaGlobalLimiter, async (req, res) => {
  const parsed = parsePublicIdea(req.body);
  if ("spam" in parsed) {
    // Looks like success, so a bot has nothing to learn from the response.
    res.json({ ok: true });
    return;
  }
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    await db.insert(siteSignups).values(parsed);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "public idea insert failed");
    res.status(500).json({ error: "Failed to store idea" });
  }
});

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
    // After the answer, fire-and-forget: a push failure must not fail a signup
    // that is already stored. Contact messages are not pushed.
    if (parsed.kind === "waitlist") {
      void notifyAdminsOfWaitlistSignup({ email: parsed.email, context: parsed.context });
    }
  } catch (err) {
    logger.error({ err }, "site signup insert failed");
    res.status(500).json({ error: "Failed to store signup" });
  }
});

export default router;
