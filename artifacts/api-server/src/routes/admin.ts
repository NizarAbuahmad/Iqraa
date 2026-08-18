/**
 * Admin usage summary — real counts from data already durably stored
 * (users, saved materials, evaluations, feedback), not a second analytics
 * pipeline. Deep usage/trace data (screens visited, tool opens) lives in
 * PostHog already; this endpoint deliberately doesn't try to duplicate it —
 * see STATUS.md.
 */
import { Router } from "express";
import { db, evaluations, feedback, savedMaterials, users } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();
const ADMIN_ROLES = ["school_admin", "system_admin"];

router.get("/admin/usage-summary", authMiddleware, requireRole(...ADMIN_ROLES), async (_req, res) => {
  try {
    const [[{ count: totalUsers }], materialsByType, [{ count: totalEvaluations }], feedbackByRating] =
      await Promise.all([
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
      ]);

    res.json({
      totalUsers,
      totalEvaluations,
      materialsByType: Object.fromEntries(materialsByType.map((r) => [r.type, r.count])),
      feedbackByRating: Object.fromEntries(feedbackByRating.map((r) => [r.rating, r.count])),
    });
  } catch (err) {
    logger.error({ err }, "admin usage summary failed");
    res.status(500).json({ error: "Failed to fetch usage summary" });
  }
});

export default router;
