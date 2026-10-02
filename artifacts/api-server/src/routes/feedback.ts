import { Router } from "express";
import { db, feedback, users } from "@workspace/db";
import { desc, eq, and, gte, lt, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { parseDateRange, UUID } from "../lib/adminMetrics.js";

const router = Router();

const ADMIN_ROLES = ["school_admin", "system_admin"];
const VALID_RATINGS = ["up", "down"];

// POST /feedback — any signed-in teacher, on the content they were just shown.
router.post("/feedback", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { materialType, toolId, rating, comment } = req.body as {
      materialType?: string;
      toolId?: string;
      rating?: string;
      comment?: string;
    };

    if (!materialType?.trim()) {
      res.status(400).json({ error: "materialType is required" });
      return;
    }
    if (!rating || !VALID_RATINGS.includes(rating)) {
      res.status(400).json({ error: "rating must be 'up' or 'down'" });
      return;
    }

    const [row] = await db
      .insert(feedback)
      .values({
        userId: req.user!.id,
        materialType: materialType.trim(),
        toolId: (toolId ?? "").trim(),
        rating,
        // A cap here isn't validation theater — it keeps one runaway paste
        // from making a single feedback row unreasonably large in the list view.
        comment: (comment ?? "").trim().slice(0, 2000),
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "submit feedback failed");
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// GET /feedback — admin only. Paginated, newest first, optional rating/materialType filters.
router.get("/feedback", authMiddleware, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { rating, materialType, limit, offset } = req.query as {
      rating?: string;
      materialType?: string;
      limit?: string;
      offset?: string;
    };

    const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const pageOffset = Math.max(Number(offset) || 0, 0);
    const range = parseDateRange(req.query as Record<string, unknown>);
    if ("error" in range) {
      res.status(400).json({ error: range.error });
      return;
    }

    const conditions = [
      rating && VALID_RATINGS.includes(rating) ? eq(feedback.rating, rating) : undefined,
      materialType ? eq(feedback.materialType, materialType) : undefined,
      range.from ? gte(feedback.createdAt, range.from) : undefined,
      range.to ? lt(feedback.createdAt, range.to) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: feedback.id,
        materialType: feedback.materialType,
        toolId: feedback.toolId,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(feedback)
      .innerJoin(users, eq(feedback.userId, users.id))
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(pageSize)
      .offset(pageOffset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(where);

    res.json({ items: rows, total: count, limit: pageSize, offset: pageOffset });
  } catch (err) {
    logger.error({ err }, "list feedback failed");
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// DELETE /feedback/:id — admin only. "I've read this one": a note is removed
// once acted on, so the list is a to-do, not an archive. Counts in
// usage-summary drop with it, which is the honest reading of "handled".
router.delete("/feedback/:id", authMiddleware, requireRole(...ADMIN_ROLES), async (req: AuthenticatedRequest, res) => {
  const id = req.params["id"] as string;
  if (!UUID.test(id)) {
    res.status(404).json({ error: "Feedback not found" });
    return;
  }
  try {
    const [gone] = await db.delete(feedback).where(eq(feedback.id, id)).returning({ id: feedback.id });
    if (!gone) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    logger.info({ actorId: req.user!.id, feedbackId: id }, "admin deleted feedback");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete feedback failed");
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
