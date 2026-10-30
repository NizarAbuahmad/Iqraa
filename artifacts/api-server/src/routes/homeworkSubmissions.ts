/**
 * A student's project for a homework that asks for one: the student's routes (`/student/homework`)
 * and the teacher's two reads (`/homework/:id/submissions`, and one student's). The parent's read
 * is not in this file yet.
 *
 * Guards are path-scoped and repeat the ones in familyHomework.ts on purpose, so moving a mount
 * cannot quietly open a route: see mountOrder.test.ts. No bare `router.use(mw)`.
 *
 * Every failure to resolve — a missing homework, one that does not ask for a project, another
 * class's, an account with no roster row in the class — is the same 404. In the student routes no
 * `studentId` is ever read from a request: the row comes from the account
 * (lib/homeworkSubmission.ts). The teacher's one-student read does take `:studentId` from the URL,
 * and `readForTeacher` checks it against the homework's own class.
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
  listForTeacher,
  readForTeacher,
  readOwnSubmission,
  removePhoto,
  setNote,
  signPhotos,
  submissionTarget,
  submit,
  viewSubmission,
  type SubmissionTarget,
} from "../lib/homeworkSubmission.ts";
import { dueAtToDueDate, isUuid } from "../modules/homework/rules.ts";
import { ownedHomework } from "./homework";
import { parseNote, parsePhotoUpload } from "../modules/homework/submission.ts";

const router = Router();

router.use("/student/homework", authMiddleware, requireRole("student"));
router.use("/homework", authMiddleware, requireRole(...TEACHER_ROLES));

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

async function currentView(t: SubmissionTarget) {
  return viewSubmission(await readOwnSubmission(t), t.dueAt);
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
      await deleteObject(key).catch(err => logger.error({ err }, "student homework submission: could not remove a refused photo"));
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
    if (result === "locked" || result === "empty") {
      res.status(409).json({
        error: result === "locked" ? "This project is locked" : "A handed-in project cannot be emptied",
        code: result,
      });
      return;
    }
    // Best effort: the row no longer lists the photo, so a leftover object is unreachable, not exposed.
    await deleteObject(result.key).catch(err => logger.error({ err }, "student homework submission: could not delete a removed photo"));
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

export default router;
