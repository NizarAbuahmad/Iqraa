/**
 * Attempt lifecycle after creation: reading it back, saving answers, submitting.
 *
 * Creating an attempt lives in evaluations.ts (it needs the evaluation's live
 * questions and level scale); everything here is keyed by the attempt's own
 * id. An attempt carries no teacherId of its own, so ownership is always
 * proven by joining back to the evaluation that owns it.
 */
import { Router } from "express";
import { createRateLimiter } from "../lib/rateLimit";
import { db } from "@workspace/db";
import {
  attemptAnswers,
  attemptQuestionGrades,
  attemptResults,
  attempts,
  classMemberships,
  evaluations,
  gradeOverrides,
  recommendations,
  students,
} from "@workspace/db";
import type { EvaluationQuestion } from "@workspace/db";
import { and, eq, isNull, ne } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import {
  deriveVerdict,
  isVerdict,
  normalizeManualMarks,
} from "../modules/assessment/manualGrade";
import {
  gradeSubmission,
  recomputeResult,
  snapshotBands,
  snapshotQuestions,
} from "../modules/assessment/attemptGrading.ts";
import {
  buildScanPrompt,
  parseScanResponse,
  type ScannableQuestion,
} from "../modules/assessment/scanMarks";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  getGenerationModel,
  recordUsage,
} from "../lib/aiBudget.ts";
import { extractJSON } from "../lib/generationShape.ts";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
// Path-scoped — see the note in roster.ts and evaluations.ts. This router
// owns only /attempts; it must not re-declare a guard for /evaluations, which
// evaluations.ts already covers, or every request there would run auth twice.
// requireRole closes the gap where any authenticated user, not just a
// teacher, could review or grade attempts.
router.use("/attempts", authMiddleware, requireRole(...TEACHER_ROLES));

// Burst ceiling on the one model-backed route here. /chat and /generate get
// theirs in routes/index.ts; this one was missed, so a loop could call the
// model as fast as it answered. Mounted after authMiddleware so it keys per
// user, not per school NAT address.
const aiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "ai-scan-marks",
  key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

async function ownedAttempt(attemptId: string, teacherId: string) {
  const [row] = await db
    .select({ attempt: attempts, evaluation: evaluations })
    .from(attempts)
    .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
    .where(and(eq(attempts.id, attemptId), eq(evaluations.teacherId, teacherId)))
    .limit(1);
  return row;
}

/** Owned-or-nothing, same rule as everywhere else: never distinguish
 *  "not yours" from "not there". */
async function ownedStudent(id: string, teacherId: string) {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, id), eq(students.teacherId, teacherId)))
    .limit(1);
  return row;
}

router.get("/attempts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const [student] = await db
      .select({ id: students.id, displayName: students.displayName })
      .from(students)
      .where(eq(students.id, owned.attempt.studentId))
      .limit(1);
    const answers = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, owned.attempt.id));
    const grades = await db
      .select()
      .from(attemptQuestionGrades)
      .where(eq(attemptQuestionGrades.attemptId, owned.attempt.id));
    const [result] = await db
      .select()
      .from(attemptResults)
      .where(eq(attemptResults.attemptId, owned.attempt.id))
      .limit(1);
    const nextSteps = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.attemptId, owned.attempt.id));

    res.json({
      attempt: owned.attempt,
      evaluation: {
        id: owned.evaluation.id,
        title: owned.evaluation.title,
        titleAr: owned.evaluation.titleAr,
        // Carried so the app can open a generator already scoped to this
        // exam's grade and subject. Without them the tool opens at index 0 and
        // offers to build grade-1 material for a grade-10 gap.
        gradeId: owned.evaluation.gradeId,
        subjectId: owned.evaluation.subjectId,
        bookId: owned.evaluation.bookId,
      },
      student,
      questions: owned.attempt.questionSnapshot,
      answers,
      grades,
      result: result ?? null,
      recommendations: nextSteps,
    });
  } catch (err) {
    logger.error({ err }, "get attempt failed");
    res.status(500).json({ error: "Failed to load attempt" });
  }
});

router.put("/attempts/:id/answers/:questionId", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const questionId = req.params["questionId"] as string;
    const snapshot = (owned.attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    if (!snapshot.some(q => q.id === questionId)) {
      res.status(404).json({ error: "Question not found in this attempt" });
      return;
    }

    const response =
      req.body?.response && typeof req.body.response === "object" ? req.body.response : null;
    if (!response) {
      res.status(400).json({ error: "response is required" });
      return;
    }

    const [answer] = await db
      .insert(attemptAnswers)
      .values({ attemptId: owned.attempt.id, questionId, response, isFinal: true })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: { response, isFinal: true, updatedAt: new Date() },
      })
      .returning();

    // First answer moves the attempt out of "not_started" so a teacher's
    // student list reflects work in progress, not just started-vs-submitted.
    if (owned.attempt.status === "not_started") {
      await db
        .update(attempts)
        .set({ status: "in_progress", startedAt: owned.attempt.startedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(attempts.id, owned.attempt.id));
    }

    res.json({ answer });
  } catch (err) {
    logger.error({ err }, "save answer failed");
    res.status(500).json({ error: "Failed to save the answer" });
  }
});

/**
 * Grades every question the deterministic tier can mark, scores the attempt,
 * and stores both. Questions with no deterministic grader (open_ended,
 * short_answer, problem_solving, practical_task) are left ungraded — Tier 2
 * (math equivalence) and Tier 3 (AI rubric grading) do not exist yet — and the
 * result is marked provisional until a teacher marks them by hand below.
 * Re-submitting recomputes cleanly: existing grades and the result are
 * replaced, not appended to.
 *
 * **A teacher's mark survives a re-submit.** Only machine grades are cleared
 * and recomputed. Re-submitting is the normal way to pick up a corrected
 * answer, and if it wiped hand marks a teacher would lose an evening's
 * marking to a button they had every reason to press.
 */
router.post("/attempts/:id/submit", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const graded = await gradeSubmission(owned.attempt);
    if (!graded.ok) {
      res.status(409).json({ error: graded.error });
      return;
    }
    const { machineGrades, recomputed } = graded;

    res.json({
      attempt: recomputed.attempt,
      grades: machineGrades,
      ungradedQuestionIds: recomputed.ungradedQuestionIds,
      result: recomputed.result,
      recommendations: recomputed.recommendations,
    });
  } catch (err) {
    logger.error({ err }, "submit attempt failed");
    res.status(500).json({ error: "Failed to submit the attempt" });
  }
});

/**
 * A teacher marks one question by hand — the only way an open-ended answer
 * gets a mark, and the way a machine mark gets corrected.
 *
 * The mark is written as a normal grade row with `grader: 'teacher'`, so
 * everything downstream (scoring, the result, the dashboard) treats it like
 * any other mark and the badge still says who produced it. Correcting a mark
 * that already existed also appends to `grade_overrides` — that table is the
 * evidence for "the machine said 2, the teacher said 3", and it is the only
 * thing that can ever show whether the automatic grader is worth trusting.
 *
 * A *first* mark on a previously unmarked question writes no override row:
 * nothing was overridden, and recording an invented "was 0, unanswered" as the
 * prior state would put a claim about the student into an audit trail.
 */
router.put("/attempts/:id/grades/:questionId", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const questionId = req.params["questionId"] as string;
    const snapshot = (owned.attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    const question = snapshot.find(q => q.id === questionId);
    if (!question) {
      res.status(404).json({ error: "Question not found in this attempt" });
      return;
    }

    const maxMarks = Number(question.marks);
    const awardedMarks = normalizeManualMarks(req.body?.awardedMarks, maxMarks);
    if (awardedMarks === null) {
      res.status(400).json({
        error: `awardedMarks must be a number between 0 and ${maxMarks}`,
        code: "marks_out_of_range",
      });
      return;
    }
    const verdict = isVerdict(req.body?.verdict)
      ? req.body.verdict
      : deriveVerdict(awardedMarks, maxMarks);
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) : "";

    const [previous] = await db
      .select()
      .from(attemptQuestionGrades)
      .where(
        and(
          eq(attemptQuestionGrades.attemptId, owned.attempt.id),
          eq(attemptQuestionGrades.questionId, questionId),
        ),
      )
      .limit(1);

    const values = {
      attemptId: owned.attempt.id,
      questionId,
      awardedMarks: awardedMarks.toFixed(2),
      maxMarks: maxMarks.toFixed(2),
      verdict,
      grader: "teacher" as const,
      // A teacher's mark is not a guess, so it carries no confidence and never
      // queues for review — it *is* the review.
      confidence: null,
      needsReview: false,
      // The teacher's comment on this answer replaces the machine's rationale,
      // because the machine's verdict no longer stands.
      rationaleAr: note,
      gradedAt: new Date(),
    };
    const [grade] = await db
      .insert(attemptQuestionGrades)
      .values(values)
      .onConflictDoUpdate({
        target: [attemptQuestionGrades.attemptId, attemptQuestionGrades.questionId],
        set: values,
      })
      .returning();

    if (previous) {
      await db.insert(gradeOverrides).values({
        attemptId: owned.attempt.id,
        questionId,
        teacherId: req.user!.id,
        oldMarks: previous.awardedMarks,
        newMarks: values.awardedMarks,
        oldVerdict: previous.verdict,
        newVerdict: verdict,
        note,
      });
    }

    const recomputed = await recomputeResult(owned.attempt);
    res.json({
      grade,
      attempt: recomputed.attempt,
      result: recomputed.result,
      recommendations: recomputed.recommendations,
    });
  } catch (err) {
    logger.error({ err }, "manual grade failed");
    res.status(500).json({ error: "Failed to save the mark" });
  }
});

/**
 * Read the teacher's handwritten marks off a photo of the paper.
 *
 * A class of thirty on a ten-question paper is three hundred numbers typed by
 * hand. The teacher has already marked the paper; this saves them typing it
 * out again.
 *
 * **It writes nothing.** The response is a set of proposals that land in the
 * boxes on screen, and the ordinary marking endpoint is still the only thing
 * that saves a mark. That is deliberate, and it is the whole safety design: a
 * misread cannot become a mark without a teacher seeing the number first.
 *
 * The photo is not stored. It goes to the model and is discarded — there is no
 * object storage in this app, and inventing one to hold exam papers belonging
 * to minors is a decision that deserves its own conversation rather than
 * arriving as a side effect of a convenience feature.
 */
router.post("/attempts/:id/scan-marks", aiLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const image = typeof req.body?.image === "string" ? req.body.image : "";
    // A data URL, because there is nowhere to put a file.
    if (!image.startsWith("data:image/")) {
      res.status(400).json({ error: "image must be a data URL", code: "bad_image" });
      return;
    }
    // Roughly a high-quality phone photo once base64 has inflated it by a
    // third. A guard against a request the model would refuse anyway, with a
    // message that tells the teacher what to do instead.
    if (image.length > 8_000_000) {
      res.status(413).json({
        error: "That photo is too large. Take it again at a lower quality.",
        code: "image_too_large",
      });
      return;
    }

    assertLiveModeEnabled();
    assertBudgetAvailable();
    await assertUserQuotaAvailable(req.user!.id);

    const snapshot = (owned.attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    if (snapshot.length === 0) {
      res.status(409).json({ error: "This attempt has no questions" });
      return;
    }
    const questions: ScannableQuestion[] = snapshot.map((q, i) => ({
      questionId: q.id,
      number: i + 1,
      maxMarks: Number(q.marks),
      type: q.type,
    }));

    const prompt = buildScanPrompt(questions);
    const model = getGenerationModel();
    const completion = await openai.chat.completions.create({
      model,
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: prompt.system },
        {
          role: "user",
          content: [
            { type: "text", text: prompt.user },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });
    recordUsage(completion.usage, model, {
      kind: "quiz",
      promptVersion: "scan-marks-1",
      userId: req.user!.id,
    });

    const parsed = parseScanResponse(
      extractJSON(completion.choices[0]?.message?.content ?? "{}"),
      questions,
    );

    res.json({
      ...parsed,
      model,
      // Stated in the response so a client cannot present these as saved.
      saved: false,
    });
  } catch (err) {
    if (err instanceof AiUserQuotaExceededError) {
      res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
      return;
    }
    if (err instanceof AiBudgetExceededError) {
      res.status(429).json({ error: err.message, code: "budget_exceeded" });
      return;
    }
    if (err instanceof AiLiveModeOffError) {
      res.status(503).json({ error: err.message, code: "live_mode_off" });
      return;
    }
    logger.error({ err }, "scan marks failed");
    res.status(502).json({
      error:
        "Could not read that photo. Nothing was changed — try again, or enter the marks by hand.",
      code: "scan_unavailable",
    });
  }
});

/**
 * The teacher's note on the sitting, and moving a sitting to another student.
 *
 * Reassignment is the safety net under the shared exam link. A student can tap
 * the wrong name on the class list, and a level attached to the wrong child is
 * worse than no level — so it has to be fixable, by the one person who knows
 * whose handwriting it is.
 */
router.patch("/attempts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const updates: { teacherComment?: string; studentId?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (typeof req.body?.teacherComment === "string") {
      updates.teacherComment = req.body.teacherComment.trim().slice(0, 4000);
    }

    if (typeof req.body?.studentId === "string" && req.body.studentId.trim()) {
      const studentId = req.body.studentId.trim();
      const student = await ownedStudent(studentId, req.user!.id);
      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }
      // The sitting must land on a current member of the exam's own class:
      // ownership alone let a paper be moved onto an archived student, or
      // one in a different class, where no roster would ever show it. An
      // evaluation whose class was deleted (`classGroupId` set null) keeps
      // the ownership rule only.
      const classId = owned.evaluation.classGroupId;
      const eligibleQuery = classId
        ? db
            .select({ id: students.id })
            .from(students)
            .innerJoin(classMemberships, eq(classMemberships.studentId, students.id))
            .where(
              and(
                eq(students.id, studentId),
                isNull(students.archivedAt),
                eq(classMemberships.classGroupId, classId),
              ),
            )
        : db
            .select({ id: students.id })
            .from(students)
            .where(and(eq(students.id, studentId), isNull(students.archivedAt)));
      const [eligible] = await eligibleQuery.limit(1);
      if (!eligible) {
        res.status(404).json({ error: "Student not found" });
        return;
      }
      // One sitting per student per exam. Moving onto a student who already
      // has one would leave two papers for the same child and no way to say
      // which is theirs.
      const [clash] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(
          and(
            eq(attempts.evaluationId, owned.attempt.evaluationId),
            eq(attempts.studentId, studentId),
          ),
        )
        .limit(1);
      if (clash && clash.id !== owned.attempt.id) {
        res.status(409).json({
          error: "That student already has a sitting for this exam",
          code: "student_has_attempt",
        });
        return;
      }
      updates.studentId = studentId;
    }

    if (updates.teacherComment === undefined && updates.studentId === undefined) {
      res.status(400).json({ error: "teacherComment or studentId is required" });
      return;
    }

    const [attempt] = await db
      .update(attempts)
      .set(updates)
      .where(eq(attempts.id, owned.attempt.id))
      .returning();

    res.json({ attempt });
  } catch (err) {
    logger.error({ err }, "update attempt failed");
    res.status(500).json({ error: "Failed to update the attempt" });
  }
});

/**
 * Release a sitting so the name can be claimed again.
 *
 * The other half of the shared-link safety net: a student whose phone died, or
 * who opened someone else's name and stopped, leaves a claimed name nobody can
 * use. Deleting the attempt frees it.
 *
 * Deliberately destructive and deliberately teacher-only. Marks, answers,
 * grades and recommendations cascade with it — which is why the UI must name
 * what is being thrown away rather than calling this "reset".
 */
router.delete("/attempts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    await db.delete(attempts).where(eq(attempts.id, owned.attempt.id));
    res.json({ deleted: true });
  } catch (err) {
    logger.error({ err }, "delete attempt failed");
    res.status(500).json({ error: "Failed to release this sitting" });
  }
});

export default router;
