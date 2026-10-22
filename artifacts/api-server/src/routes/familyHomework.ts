/**
 * «الواجبات» for students and parents. A student sees the homework of the live
 * classes their `self`-linked roster rows sit in and can tick it off; a parent
 * sees one list per child (guardian-linked rows grouped by name, exactly as
 * the schedule does, so the `key` matches) and can read but never tick. Both
 * can open a saved material the teacher attached (…/:id/materials/:materialId).
 *
 * Path-scoped guards, like every other router here — see `mountOrder.test.ts`.
 * `studentExams.ts` already guards all of `/student` and `/parent`; these
 * repeat it on purpose, so moving a mount cannot quietly open the route.
 */
import { Router, type Response } from "express";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { guardianLinkedStudents, selfLinkedStudentIds, studentIdsWithSelfAccount } from "../lib/familyAccess.ts";
import { loadFamilyHomework } from "../lib/familyHomeworkLoad.ts";
import { loadHomeworkMaterial } from "../lib/homeworkMaterial.ts";
import { setHomeworkDone } from "../lib/homeworkDone.ts";
import { recordGameResult } from "../lib/homeworkGame.ts";
import { groupChildren } from "../modules/family/children.ts";
import { parseGameResult } from "../modules/homework/game.ts";

const router = Router();

router.use("/student/homework", authMiddleware, requireRole("student"));
router.use("/parent/homework", authMiddleware, requireRole("parent"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;
const NO_MATERIAL = { error: "Attachment not found" } as const;

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
    // An item can only be "late" if someone can tick it off, and ticking is per
    // class — so the rule lives on each ITEM (`canTrack`, built in
    // buildFamilyHomework from the child's rows in that item's class). The
    // child-level `canTrack` below is only an aggregate for a client that wants
    // one answer per child: informational, never the rule for a given item.
    const withAccount = await studentIdsWithSelfAccount(children.flatMap(c => c.studentIds));
    const lists = await Promise.all(
      children.map(async child => {
        const homework = await loadFamilyHomework(child.studentIds, new Date(), withAccount);
        return {
          key: child.key,
          displayName: child.displayName,
          // Any item trackable; with no items to judge, whether any live row has an account.
          canTrack: homework.length > 0 ? homework.some(i => i.canTrack) : child.studentIds.some(id => withAccount.has(id)),
          homework,
        };
      }),
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

/**
 * One of the teacher's saved materials attached to a homework, read-only and
 * without its answers. Every refusal is the same 404 — see lib/homeworkMaterial.ts
 * for the conditions. A parent reads through any child's rows: a child in two
 * classes may be linked under two rows, and only the one in this homework's
 * class matters, which the loader decides.
 */
async function material(req: AuthenticatedRequest, res: Response, studentIds: string[]): Promise<void> {
  const item = await loadHomeworkMaterial(studentIds, String(req.params["id"]), String(req.params["materialId"]));
  if (!item) {
    res.status(404).json(NO_MATERIAL);
    return;
  }
  res.json({ material: item });
}

router.get("/student/homework/:id/materials/:materialId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    await material(req, res, await selfLinkedStudentIds(req.user!.id));
  } catch (err) {
    logger.error({ err }, "student homework material failed");
    res.status(500).json({ error: "Failed to load the attachment" });
  }
});

router.get("/parent/homework/:id/materials/:materialId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    await material(req, res, (await guardianLinkedStudents(req.user!.id)).map(c => c.studentId));
  } catch (err) {
    logger.error({ err }, "parent homework material failed");
    res.status(500).json({ error: "Failed to load the attachment" });
  }
});

/**
 * A finished round of a game the teacher attached. Body `{ lessonId, game, score,
 * total }` (400 `invalid` otherwise); the homework must carry that lesson's game.
 * The best result per (lesson, game) is kept and the homework
 * is ticked off, for the account's own rows in the homework's class only.
 * Everything is written before the answer. Every other failure is one 404.
 */
router.put("/student/homework/:id/game-result", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const parsed = parseGameResult(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: parsed.code });
      return;
    }
    const saved = await recordGameResult(req.user!.id, String(req.params["id"]), parsed.value);
    if (!saved) {
      res.status(404).json({ ...NO_HOMEWORK, code: "not_found" });
      return;
    }
    res.json(saved);
  } catch (err) {
    logger.error({ err }, "student game result failed");
    res.status(500).json({ error: "Failed to save your result" });
  }
});

router.put("/student/homework/:id/done", (req: AuthenticatedRequest, res) => mark(req, res, true));
router.delete("/student/homework/:id/done", (req: AuthenticatedRequest, res) => mark(req, res, false));

export default router;
