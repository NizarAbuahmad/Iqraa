/**
 * Math Corner practice: a student's best «اختبر نفسك» score per lesson, and the
 * teacher's view of it per class.
 *
 * - `PUT /student/math-practice` `{ lessonId, correct, total }` — written to every
 *   `self`-linked roster row of the account (`math_practice_results`), keeping the
 *   best ratio; each call is an attempt. An account with no roster row gets
 *   `{ saved: false }`: its score stays on the device, which is not an error.
 * - `GET /classes/:id/math-practice` — the live members of the teacher's live class
 *   who practised, one row per (student, lesson).
 *
 * Path-scoped guards, like every router here (see `mountOrder.test.ts`); the
 * class read carries its guards on the route, as `/classes/:id/homework` does.
 * Practice never feeds mastery.
 */
import { Router } from "express";
import { db, classMemberships, mathPracticeResults, students } from "@workspace/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { findLiveClass } from "../lib/classOwnership.js";
import { selfLinkedStudentIds } from "../lib/familyAccess.ts";
import { logger } from "../lib/logger";
import { parsePractice } from "../modules/mathPractice/practice.ts";

const router = Router();

router.use("/student/math-practice", authMiddleware, requireRole("student"));

router.put("/student/math-practice", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({ code: "student_accounts_disabled", error: "Parent and student accounts are not available yet." });
      return;
    }
    const parsed = parsePractice(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: "invalid" });
      return;
    }
    const rows = await selfLinkedStudentIds(req.user!.id);
    if (rows.length === 0) {
      res.json({ saved: false });
      return;
    }
    const { lessonId, correct, total } = parsed.value;
    // Qualified on purpose: inside ON CONFLICT an unqualified column can be ambiguous with `excluded`.
    const better = sql`excluded.correct * "math_practice_results"."total" > "math_practice_results"."correct" * excluded.total`;
    await db
      .insert(mathPracticeResults)
      .values(rows.map(studentId => ({ studentId, lessonId, correct, total })))
      .onConflictDoUpdate({
        target: [mathPracticeResults.studentId, mathPracticeResults.lessonId],
        set: {
          correct: sql`CASE WHEN ${better} THEN excluded.correct ELSE "math_practice_results"."correct" END`,
          total: sql`CASE WHEN ${better} THEN excluded.total ELSE "math_practice_results"."total" END`,
          attempts: sql`"math_practice_results"."attempts" + 1`,
          practicedAt: sql`now()`,
        },
      });
    res.json({ saved: true });
  } catch (err) {
    logger.error({ err }, "math practice save failed");
    res.status(500).json({ error: "Failed to save your result" });
  }
});

router.get(
  "/classes/:id/math-practice",
  authMiddleware,
  requireRole(...TEACHER_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const klass = await findLiveClass(String(req.params["id"]), req.user!.id);
      if (!klass) {
        res.status(404).json({ error: "Class not found" });
        return;
      }
      const rows = await db
        .select({
          studentId: mathPracticeResults.studentId,
          displayName: students.displayName,
          lessonId: mathPracticeResults.lessonId,
          correct: mathPracticeResults.correct,
          total: mathPracticeResults.total,
          attempts: mathPracticeResults.attempts,
          practicedAt: mathPracticeResults.practicedAt,
        })
        .from(mathPracticeResults)
        .innerJoin(
          classMemberships,
          and(eq(classMemberships.classGroupId, klass.id), eq(classMemberships.studentId, mathPracticeResults.studentId)),
        )
        .innerJoin(students, eq(students.id, mathPracticeResults.studentId))
        .where(isNull(students.archivedAt))
        .orderBy(asc(students.displayName), asc(mathPracticeResults.lessonId));
      res.json({ results: rows.map(r => ({ ...r, practicedAt: r.practicedAt.toISOString() })) });
    } catch (err) {
      logger.error({ err }, "math practice load failed");
      res.status(500).json({ error: "Failed to load practice" });
    }
  },
);

export default router;
