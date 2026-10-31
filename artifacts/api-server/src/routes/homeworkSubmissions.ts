/**
 * A student's project for a homework that asks for one: the student's routes (`/student/homework`),
 * the teacher's two reads (`/homework/:id/submissions`, and one student's) and one write (clearing one
 * student's project: `DELETE /homework/:id/submissions/:studentId`), and the parent's one
 * read-only route (`/parent/homework/:id/submissions`: the handed-in projects of their own children).
 *
 * Guards are path-scoped and repeat the ones in familyHomework.ts on purpose, so moving a mount
 * cannot quietly open a route: see mountOrder.test.ts. No bare `router.use(mw)`.
 *
 * Every failure to resolve — a missing homework, one that does not ask for a project, another
 * class's, an account with no roster row in the class, a parent with no child in it — is the same
 * 404. In the student routes no `studentId` is ever read from a request: the row comes from the account
 * (lib/homeworkSubmission.ts). The teacher's one-student read does take `:studentId` from the URL,
 * and `readForTeacher` checks it against the homework's own class.
 *
 * A student sees and changes only what their own account wrote: when the record's project was handed in by
 * another account (the teacher re-linked the record), the GET says `otherAuthor: true` with none of its content
 * and every write is 409 `other_author`; another account's draft reads as nothing and is replaced on the first
 * upload or note. The teacher's and the parent's reads are the record's and do not look at the author.
 */
import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rateLimit.ts";
import { deleteObject, isR2Configured, newHomeworkSubmissionKey, putObject } from "../lib/r2.js";
import {
  addPhoto,
  clearForTeacher,
  listForTeacher,
  readForParent,
  readForTeacher,
  readOwnSubmission,
  removePhoto,
  setNote,
  signPhotos,
  submissionTarget,
  submit,
  viewOwnSubmission,
  type SubmissionTarget,
} from "../lib/homeworkSubmission.ts";
import { dueAtToDueDate, isUuid } from "../modules/homework/rules.ts";
import { ownedHomework } from "./homework";
import { parseNote, parsePhotoUpload } from "../modules/homework/submission.ts";

const router = Router();

router.use("/student/homework", authMiddleware, requireRole("student"));
router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));
router.use("/parent/homework", authMiddleware, requireRole("parent"));

const DISABLED = {
  code: "student_accounts_disabled",
  error: "Parent and student accounts are not available yet.",
} as const;
const NO_HOMEWORK = { error: "Homework not found" } as const;

/** 60 photos an hour per account: far above a real project (six, with retakes), far below a file host. */
const photoLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 60,
  name: "homework-submission-photo",
  key: req => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/** The shared shell of every student route: the flag, the target, one 404, one 500. */
async function withTarget(
  req: AuthenticatedRequest,
  res: Response,
  what: string,
  run: (t: SubmissionTarget) => Promise<void>,
): Promise<void> {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const target = await submissionTarget(req.user!.id, String(req.params["id"]));
    if (!target) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    await run(target);
  } catch (err) {
    logger.error({ err }, `student homework submission: ${what} failed`);
    res.status(500).json({ error: `Failed to ${what}` });
  }
}

/** The caller's own view: another account's work on the record is never in it (lib/homeworkSubmission.ts). */
async function currentView(t: SubmissionTarget) {
  return viewOwnSubmission(await readOwnSubmission(t), t);
}

/**
 * The record's project was handed in by another account (the teacher unlinked it and linked this one). Nothing of
 * it may change; the app shows a notice and the way out is the teacher. One shape for every write.
 */
function refuseOtherAuthor(res: Response): void {
  res.status(409).json({ code: "other_author", error: "A project was already handed in for this record from another account" });
}

/** The project was removed (the teacher cleared it) while this write was on its way. Nothing was written; send it again. */
function refuseChanged(res: Response): void {
  res.status(409).json({ code: "changed", error: "The project changed while saving; send it again" });
}

router.get("/student/homework/:id/submission", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "load your project", async t => {
    res.json({ submission: await currentView(t), dueDate: dueAtToDueDate(t.dueAt) });
  }),
);

router.post("/student/homework/:id/submission/photos", photoLimiter, (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "save your photo", async t => {
    if (!isR2Configured()) {
      res.status(503).json({ code: "storage_unavailable", error: "Photo storage is not set up on this server yet." });
      return;
    }
    const parsed = parsePhotoUpload(req.body);
    if (!parsed.ok) {
      res.status(parsed.code === "file_too_large" ? 413 : 400).json({ error: parsed.error, code: parsed.code });
      return;
    }
    const { buffer, mime, extension } = parsed.value;
    // Stored first, then recorded: a refusal below removes the object, so a refused photo is never left behind.
    const key = newHomeworkSubmissionKey(t.homeworkId, t.studentId, extension);
    await putObject(key, buffer, mime);
    const photo = { id: randomUUID(), key, mime, sizeBytes: buffer.length };
    const result = await addPhoto(t, photo);
    if (result !== "ok") {
      await deleteObject(key).catch(err =>
        logger.error({ err, key, homeworkId: t.homeworkId }, "student homework submission: could not remove a refused photo"),
      );
      if (result === "other_author") {
        refuseOtherAuthor(res);
        return;
      }
      if (result === "changed") {
        refuseChanged(res);
        return;
      }
      res.status(409).json({ error: result === "locked" ? "This project is locked" : "A project holds at most six photos", code: result });
      return;
    }
    const [view] = await signPhotos([photo]);
    const row = await readOwnSubmission(t);
    res.status(201).json({ photo: view, photoCount: row?.photos.length ?? 1 });
  }),
);

router.delete("/student/homework/:id/submission/photos/:photoId", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "remove your photo", async t => {
    const result = await removePhoto(t, String(req.params["photoId"]));
    if (result === "not_found") {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    if (result === "other_author") {
      refuseOtherAuthor(res);
      return;
    }
    if (result === "locked" || result === "empty") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "A handed-in project cannot be emptied",
        code: result,
      });
      return;
    }
    // Best effort: the row no longer lists the photo, so a leftover object is unreachable, not exposed.
    await deleteObject(result.key).catch(err =>
      logger.error({ err, key: result.key, homeworkId: t.homeworkId }, "student homework submission: could not delete a removed photo"),
    );
    res.json({ removed: true });
  }),
);

router.put("/student/homework/:id/submission", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "save your note", async t => {
    const parsed = parseNote(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: parsed.code });
      return;
    }
    const result = await setNote(t, parsed.value);
    if (result === "other_author") {
      refuseOtherAuthor(res);
      return;
    }
    if (result === "changed") {
      refuseChanged(res);
      return;
    }
    if (result !== "ok") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "A handed-in project cannot be emptied",
        code: result,
      });
      return;
    }
    res.json({ submission: await currentView(t) });
  }),
);

router.post("/student/homework/:id/submission/submit", (req: AuthenticatedRequest, res) =>
  withTarget(req, res, "hand in your project", async t => {
    const result = await submit(t);
    if (result === "other_author") {
      refuseOtherAuthor(res);
      return;
    }
    if (result === "changed") {
      refuseChanged(res);
      return;
    }
    if (result !== "ok") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "Add a photo or a note first",
        code: result,
      });
      return;
    }
    res.json({ submission: await currentView(t) });
  }),
);

const NO_SUBMISSION = { error: "Submission not found" } as const;

router.get("/homework/:id/submissions", async (req: AuthenticatedRequest, res) => {
  try {
    const hw = await ownedHomework(String(req.params["id"]), req.user!.id);
    if (!hw || !hw.requiresSubmission) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const submissions = await listForTeacher(hw);
    res.json({
      homework: { id: hw.id, title: hw.title, dueDate: dueAtToDueDate(hw.dueAt) },
      submittedCount: submissions.filter(s => s.status !== "none").length,
      submissions,
    });
  } catch (err) {
    logger.error({ err }, "teacher homework submissions failed");
    res.status(500).json({ error: "Failed to load the submissions" });
  }
});

router.get("/homework/:id/submissions/:studentId", async (req: AuthenticatedRequest, res) => {
  try {
    const hw = await ownedHomework(String(req.params["id"]), req.user!.id);
    if (!hw || !hw.requiresSubmission) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const studentId = String(req.params["studentId"]);
    const found = isUuid(studentId) ? await readForTeacher(hw, studentId) : null;
    if (!found) {
      res.status(404).json(NO_SUBMISSION);
      return;
    }
    res.json({ student: { id: studentId, displayName: found.displayName }, submission: found.submission });
  } catch (err) {
    logger.error({ err }, "teacher homework submission failed");
    res.status(500).json({ error: "Failed to load the submission" });
  }
});

/**
 * Clears one student's project for this homework, draft or handed-in: its photos, its row and that record's tick
 * (lib/homeworkSubmission.ts `clearForTeacher`). The way out when a record's project was handed in from another
 * account (a mis-claim the teacher has since unlinked): the account linked now then starts clean. The same owner check
 * and the same 404s as the two reads above. Nothing to clear is a 404, so a repeated call is a 404, not a second 200.
 * A storage failure is a 500 with the database untouched (photos deleted before it stay deleted), and the same request
 * can be sent again. No lock is held while storage is called. No rate limit, like the other teacher writes on
 * `/homework`.
 */
router.delete("/homework/:id/submissions/:studentId", async (req: AuthenticatedRequest, res) => {
  try {
    const teacherId = req.user!.id;
    const hw = await ownedHomework(String(req.params["id"]), teacherId);
    if (!hw || !hw.requiresSubmission) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    const studentId = String(req.params["studentId"]);
    const cleared = isUuid(studentId) ? await clearForTeacher(hw, studentId) : null;
    if (!cleared) {
      res.status(404).json(NO_SUBMISSION);
      return;
    }
    logger.info({ homeworkId: hw.id, studentId, teacherId, photoCount: cleared.photoCount }, "homework submission cleared by teacher");
    res.json({ cleared: true });
  } catch (err) {
    logger.error({ err, homeworkId: String(req.params["id"]) }, "teacher homework submission clear failed");
    res.status(500).json({ error: "Failed to clear the submission" });
  }
});

/** Read-only: a guardian sees their own children's handed-in projects, never a draft. */
router.get("/parent/homework/:id/submissions", async (req: AuthenticatedRequest, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json(DISABLED);
      return;
    }
    const children = isUuid(String(req.params["id"])) ? await readForParent(req.user!.id, String(req.params["id"])) : null;
    if (!children) {
      res.status(404).json(NO_HOMEWORK);
      return;
    }
    res.json({ children });
  } catch (err) {
    logger.error({ err }, "parent homework submissions failed");
    res.status(500).json({ error: "Failed to load your child's project" });
  }
});

export default router;
