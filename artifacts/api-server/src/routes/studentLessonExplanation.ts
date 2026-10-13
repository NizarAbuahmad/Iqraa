/**
 * «اشرح لي الدرس»: a student reads a stored, admin-approved explanation of a
 * lesson.
 *
 * Read-only over the shared artifact pool. This file never calls the model:
 * it imports no generation, budget or OpenAI code, so it needs none of the
 * three guards (live mode, spend caps, per-user quota) that every generation
 * route carries — they are absent on purpose, and a student cannot cause a
 * paid call. `studentLessonExplanation.test.ts` scans for the imports.
 *
 * Only rows a `system_admin` approved are served (`student_approved_at`).
 * What is stored is not what is shown: a teacher's row can sit under the
 * wrong lesson id, and a student is a minor.
 *
 * Path-scoped guard, like every other router here — see `mountOrder.test.ts`.
 */
import { Router } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { noteServed, reportVariant } from "../lib/artifactCache.ts";
import { notifyAdminsOfArtifactReport } from "../lib/adminNotify.ts";
import {
  isLessonRef,
  isUuid,
  parseLanguage,
  pickExplanation,
  stripTeacherNotes,
} from "../lib/lessonExplanation.ts";
import {
  isStudentVisibleExplanation,
  readApprovedExplanations,
} from "../lib/lessonExplanationStore.ts";

const router = Router();

router.use("/student/lesson-explanation", authMiddleware, requireRole("student"));

/** Express types a param as `string | string[]`; a repeated one must not reach a query as an array. */
const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const NOT_AVAILABLE = { error: "No explanation is available for this lesson.", code: "not_available" } as const;

/** GET /student/lesson-explanation/:lessonId?language=arabic|english */
router.get("/student/lesson-explanation/:lessonId", async (req: AuthenticatedRequest, res) => {
  const lessonId = one(req.params["lessonId"]);
  if (!isLessonRef(lessonId)) {
    res.status(404).json(NOT_AVAILABLE);
    return;
  }
  try {
    const rows = await readApprovedExplanations(lessonId, parseLanguage(one(req.query["language"] as string | undefined)));
    const row = pickExplanation(rows);
    if (!row) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    noteServed(row.id);
    res.json({ content: stripTeacherNotes(row.content), variantId: row.id });
  } catch (err) {
    logger.error({ err, lessonId }, "student lesson-explanation read failed");
    res.status(500).json({ error: "Failed to load the explanation." });
  }
});

/**
 * POST /student/lesson-explanation/:variantId/report
 *
 * Queues a report for a `system_admin` (`routes/moderation.ts`). It does NOT
 * retire the row, exactly as a teacher's report does not
 * (`/generate/variants/:id/retire` calls the same `reportVariant`); only the
 * admin's resolve route retires. The row keeps serving until reviewed. What
 * differs is the reporter: a teacher can ask for a fresh paper straight away,
 * but a student cannot trigger generation, so nothing replaces the explanation
 * for them while the report waits.
 */
router.post("/student/lesson-explanation/:variantId/report", async (req: AuthenticatedRequest, res) => {
  const variantId = one(req.params["variantId"]);
  if (!isUuid(variantId)) {
    res.status(404).json(NOT_AVAILABLE);
    return;
  }
  try {
    if (!(await isStudentVisibleExplanation(variantId))) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    const outcome = await reportVariant({ artifactId: variantId, reporterUserId: req.user!.id });
    if (!outcome.ok) {
      res.status(404).json(NOT_AVAILABLE);
      return;
    }
    if (!outcome.duplicate) {
      logger.warn(
        { artifactId: variantId, reportId: outcome.reportId, userId: req.user?.id },
        "lesson explanation reported by a student",
      );
      notifyAdminsOfArtifactReport({ kind: outcome.kind, lessonRef: outcome.lessonRef }).catch((err) =>
        logger.error({ err, artifactId: variantId }, "admin artifact-report notification failed"),
      );
    }
    res.json({ reported: true });
  } catch (err) {
    logger.error({ err, variantId }, "student lesson-explanation report failed");
    res.status(500).json({ error: "Failed to send the report." });
  }
});

export default router;
