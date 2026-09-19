/**
 * Teaching plans — a teacher's own free-text note of what they intend to
 * teach (school, grades, topics, schedule). See lib/db/src/schema/teachingPlans.ts
 * for why this is separate from `classGroups`/`/classes`.
 *
 * No student data here, so unlike roster.ts this does not need
 * `requireRosterConsent`.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { teachingPlans } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { isSchemaMissing } from "../lib/schemaMissing.js";

const router = Router();

// Scoped to this router's own path — see the mount-order warning in roster.ts
// and CLAUDE.md: a bare `router.use(mw)` here would guard every router
// mounted after it.
router.use("/teaching-plans", authMiddleware, requireRole(...TEACHER_ROLES));

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Single exit for every teaching-plan failure: 503 + a code when the schema is absent. */
function failTeachingPlans(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  err: unknown,
  action: string,
  message: string,
): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — teaching_plans table is missing from this database. ` +
        "Run `pnpm --filter @workspace/db run push` against DATABASE_URL.",
    );
    res.status(503).json({
      code: "teaching_plans_storage_unavailable",
      error: "Teaching plan storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: message });
}

router.get("/teaching-plans", async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(teachingPlans)
      .where(and(eq(teachingPlans.teacherId, req.user!.id), isNull(teachingPlans.archivedAt)))
      .orderBy(asc(teachingPlans.createdAt));

    res.json({ plans: rows });
  } catch (err) {
    failTeachingPlans(res, err, "list teaching plans", "Failed to load teaching plans");
  }
});

router.post("/teaching-plans", async (req: AuthenticatedRequest, res) => {
  try {
    const title = trimmed(req.body?.title);
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const [row] = await db
      .insert(teachingPlans)
      .values({
        teacherId: req.user!.id,
        title,
        schoolName: trimmed(req.body?.schoolName),
        grades: trimmed(req.body?.grades),
        topics: trimmed(req.body?.topics),
        time: trimmed(req.body?.time),
      })
      .returning();

    res.status(201).json({ plan: row });
  } catch (err) {
    failTeachingPlans(res, err, "create teaching plan", "Failed to create teaching plan");
  }
});

router.patch("/teaching-plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const planId = req.params["id"] as string;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ["title", "schoolName", "grades", "topics", "time"] as const) {
      if (req.body?.[field] !== undefined) patch[field] = trimmed(req.body[field]);
    }
    if (patch["title"] === "") {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }

    const [row] = await db
      .update(teachingPlans)
      .set(patch)
      .where(and(eq(teachingPlans.id, planId), eq(teachingPlans.teacherId, req.user!.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Teaching plan not found" });
      return;
    }
    res.json({ plan: row });
  } catch (err) {
    failTeachingPlans(res, err, "update teaching plan", "Failed to update teaching plan");
  }
});

router.delete("/teaching-plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const planId = req.params["id"] as string;
    const [row] = await db
      .update(teachingPlans)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(teachingPlans.id, planId), eq(teachingPlans.teacherId, req.user!.id)))
      .returning({ id: teachingPlans.id });

    if (!row) {
      res.status(404).json({ error: "Teaching plan not found" });
      return;
    }
    res.json({ archived: row.id });
  } catch (err) {
    failTeachingPlans(res, err, "archive teaching plan", "Failed to archive teaching plan");
  }
});

export default router;
