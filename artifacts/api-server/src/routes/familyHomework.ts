/**
 * «الواجبات» for students and parents. A student sees the homework of the live
 * classes their `self`-linked roster rows sit in and can tick it off; a parent
 * sees one list per child (guardian-linked rows grouped by name, exactly as
 * the schedule does, so the `key` matches) and can read but never tick.
 *
 * Path-scoped guards, like every other router here — see `mountOrder.test.ts`.
 * `studentExams.ts` already guards all of `/student` and `/parent`; these
 * repeat it on purpose, so moving a mount cannot quietly open the route.
 */
import { Router, type Response } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { guardianLinkedStudents, selfLinkedStudentIds } from "../lib/familyAccess.ts";
import { loadFamilyHomework } from "../lib/familyHomeworkLoad.ts";
import { setHomeworkDone } from "../lib/homeworkDone.ts";
import { groupChildren } from "../modules/family/children.ts";

const router = Router();

router.use("/student/homework", authMiddleware, requireRole("student"));
router.use("/parent/homework", authMiddleware, requireRole("parent"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;

router.get("/student/homework", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const homework = await loadFamilyHomework(await selfLinkedStudentIds(req.user!.id));
    res.json({ homework });
  } catch (err) {
    logger.error({ err }, "student homework failed");
    res.status(500).json({ error: "Failed to load your homework" });
  }
});

router.get("/parent/homework", async (req: AuthenticatedRequest, res) => {
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
        homework: await loadFamilyHomework(child.studentIds),
      })),
    );
    res.json({ children: lists });
  } catch (err) {
    logger.error({ err }, "parent homework failed");
    res.status(500).json({ error: "Failed to load your children's homework" });
  }
});

async function mark(req: AuthenticatedRequest, res: Response, done: boolean): Promise<void> {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const result = await setHomeworkDone(req.user!.id, String(req.params["id"]), done);
    if (result === "not_found") {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    res.json({ done });
  } catch (err) {
    logger.error({ err }, "student homework done failed");
    res.status(500).json({ error: "Failed to update your homework" });
  }
}

router.put("/student/homework/:id/done", (req: AuthenticatedRequest, res) => mark(req, res, true));
router.delete("/student/homework/:id/done", (req: AuthenticatedRequest, res) => mark(req, res, false));

export default router;
