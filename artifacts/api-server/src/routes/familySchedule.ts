/**
 * «جدول الحصص» for students and parents: the weekly timetable, read-only,
 * assembled from the teachers' own (see modules/schedule/familySchedule.ts).
 *
 * A student sees the classes their `self`-linked roster rows sit in. A parent
 * sees one entry per child, children being their guardian-linked rows grouped
 * by name (modules/family/children.ts) so a child taught by two teachers is
 * one entry, not two.
 *
 * Path-scoped guards, like every other router here — see `mountOrder.test.ts`.
 * `studentExams.ts` already guards all of `/student` and `/parent`; these
 * repeat it on purpose, so moving a mount cannot quietly open the route.
 */
import { Router } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { guardianLinkedStudents, selfLinkedStudentIds } from "../lib/familyAccess.ts";
import { loadFamilySchedule } from "../lib/familyScheduleLoad.ts";
import { groupChildren } from "../modules/family/children.ts";

const router = Router();

router.use("/student/schedule", authMiddleware, requireRole("student"));
router.use("/parent/schedule", authMiddleware, requireRole("parent"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;

router.get("/student/schedule", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const schedule = await loadFamilySchedule(await selfLinkedStudentIds(req.user!.id));
    res.json({ schedule });
  } catch (err) {
    logger.error({ err }, "student schedule failed");
    res.status(500).json({ error: "Failed to load your schedule" });
  }
});

router.get("/parent/schedule", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const children = groupChildren(await guardianLinkedStudents(req.user!.id));
    const lists = await Promise.all(
      children.map(async child => ({
        key: child.key,
        displayName: child.displayName,
        schedule: await loadFamilySchedule(child.studentIds),
      })),
    );
    res.json({ children: lists });
  } catch (err) {
    logger.error({ err }, "parent schedule failed");
    res.status(500).json({ error: "Failed to load your children's schedule" });
  }
});

export default router;
