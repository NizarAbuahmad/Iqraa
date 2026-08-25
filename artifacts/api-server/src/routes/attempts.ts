/**
 * Attempt lifecycle after creation: reading it back, saving answers, submitting.
 *
 * Creating an attempt lives in evaluations.ts (it needs the evaluation's live
 * questions and level scale); everything here is keyed by the attempt's own
 * id. An attempt carries no teacherId of its own, so ownership is always
 * proven by joining back to the evaluation that owns it.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  attemptAnswers,
  attemptQuestionGrades,
  attemptResults,
  attempts,
  evaluations,
  gradeOverrides,
  recommendations,
  students,
} from "@workspace/db";
import type { Attempt, EvaluationQuestion } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import {
  gradeAttempt,
  scorePersistedGrades,
  type AttemptQuestionInput,
} from "../modules/assessment/gradeAttempt";
import type { AttemptScore } from "../modules/assessment/scoring";
import {
  deriveVerdict,
  isVerdict,
  normalizeManualMarks,
} from "../modules/assessment/manualGrade";
import { recommendationsFor } from "../modules/assessment/recommend";
import type { LevelBandInput } from "../modules/assessment/scoring";
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
import { resolveObjectiveIds } from "@workspace/curriculum";

const router = Router();
// Path-scoped — see the note in roster.ts and evaluations.ts. This router
// owns only /attempts; it must not re-declare a guard for /evaluations, which
// evaluations.ts already covers, or every request there would run auth twice.
router.use("/attempts", authMiddleware);

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

/** The snapshot, in the shape the scoring modules take. */
function snapshotQuestions(attempt: Attempt): AttemptQuestionInput[] {
  const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
  return snapshot.map(q => ({
    questionId: q.id,
    type: q.type,
    body: q.body,
    expectedAnswer: q.expectedAnswer,
    competencyKey: q.competencyKey,
    objectiveId: q.objectiveId,
    marks: Number(q.marks),
    difficulty: q.difficulty,
  }));
}

function snapshotBands(attempt: Attempt): LevelBandInput[] {
  const scale = attempt.levelScaleSnapshot as { scaleId?: string | null; bands?: LevelBandInput[] } | null;
  return scale?.bands ?? [];
}

/**
 * Rebuild the stored result from every grade currently on record, and move the
 * attempt's status to match.
 *
 * Both submitting and marking a single question by hand end here, so there is
 * one place that decides what a result says. The status follows from the same
 * count: while any question is unmarked the result is provisional and the
 * attempt `needs_review`; marking the last one flips both — which is the whole
 * point of teacher marking existing.
 */
async function recomputeResult(attempt: Attempt) {
  const questions = snapshotQuestions(attempt);
  const bands = snapshotBands(attempt);
  const gradeRows = await db
    .select()
    .from(attemptQuestionGrades)
    .where(eq(attemptQuestionGrades.attemptId, attempt.id));

  const { score, ungradedQuestionIds } = scorePersistedGrades(
    questions,
    gradeRows.map(g => ({
      questionId: g.questionId,
      awardedMarks: Number(g.awardedMarks),
      maxMarks: Number(g.maxMarks),
      verdict: g.verdict,
    })),
    bands,
  );

  const isProvisional = ungradedQuestionIds.length > 0;
  const scaleId = (attempt.levelScaleSnapshot as { scaleId?: string | null } | null)?.scaleId ?? null;
  const resultValues = {
    attemptId: attempt.id,
    earnedMarks: score.earnedMarks.toFixed(2),
    totalMarks: score.totalMarks.toFixed(2),
    percent: score.percent.toFixed(2),
    competencyScores: score.competencyScores,
    objectiveScores: score.objectiveScores,
    levelKey: score.levelKey,
    levelScaleId: scaleId,
    isProvisional,
    computedAt: new Date(),
  };
  await db
    .insert(attemptResults)
    .values(resultValues)
    .onConflictDoUpdate({ target: attemptResults.attemptId, set: resultValues });

  const [updatedAttempt] = await db
    .update(attempts)
    .set({
      status: isProvisional ? "needs_review" : "graded",
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(attempts.id, attempt.id))
    .returning();

  const nextSteps = await refreshRecommendations(attempt.id, score);

  return {
    attempt: updatedAttempt!,
    ungradedQuestionIds,
    recommendations: nextSteps,
    result: { ...resultValues, computedAt: resultValues.computedAt.toISOString() },
  };
}

/**
 * Rewrite this attempt's next steps from the marks as they now stand.
 *
 * Replaced rather than appended on every recompute, because a recommendation
 * is a statement about the current marks — leaving yesterday's "reteach this"
 * beside a mark the teacher has since corrected would be advice about a result
 * that no longer exists.
 *
 * Only rule-based rows are cleared. AI enrichment does not exist yet, but when
 * it does it must not lose its work every time a teacher edits one mark.
 */
async function refreshRecommendations(attemptId: string, score: AttemptScore) {
  const objectiveIds = score.objectiveScores.map(o => o.objectiveId);
  const { found } = resolveObjectiveIds(objectiveIds);
  const byId = new Map(found.map(o => [o.id, o]));
  const drafts = recommendationsFor(score, id => {
    const objective = byId.get(id);
    if (!objective) return undefined;
    return {
      title: objective.description ?? "",
      titleAr: objective.descriptionAr || objective.description || "",
    };
  });

  await db
    .delete(recommendations)
    .where(
      and(eq(recommendations.attemptId, attemptId), eq(recommendations.generatedBy, "rule")),
    );
  if (drafts.length === 0) return [];

  return db
    .insert(recommendations)
    .values(
      drafts.map(d => ({
        attemptId,
        kind: d.kind,
        objectiveId: d.objectiveId,
        payload: d.payload,
        generatedBy: "rule" as const,
        // Arithmetic over the teacher's own marks is not a guess. A confidence
        // number here would imply it might be wrong the way an AI call can be.
        confidence: null,
      })),
    )
    .returning();
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

    const questions = snapshotQuestions(owned.attempt);
    if (questions.length === 0) {
      res.status(409).json({ error: "This attempt has no questions" });
      return;
    }

    const bands = snapshotBands(owned.attempt);
    if (bands.length === 0) {
      res.status(409).json({ error: "No level scale was captured for this attempt" });
      return;
    }

    const answerRows = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, owned.attempt.id));
    const answerMap = new Map(answerRows.map(a => [a.questionId, a.response]));

    const existingGrades = await db
      .select({ questionId: attemptQuestionGrades.questionId })
      .from(attemptQuestionGrades)
      .where(
        and(
          eq(attemptQuestionGrades.attemptId, owned.attempt.id),
          eq(attemptQuestionGrades.grader, "teacher"),
        ),
      );
    const handMarked = new Set(existingGrades.map(g => g.questionId));

    const outcome = gradeAttempt(questions, answerMap, bands);
    const machineGrades = outcome.graded.filter(g => !handMarked.has(g.questionId));

    await db
      .delete(attemptQuestionGrades)
      .where(
        and(
          eq(attemptQuestionGrades.attemptId, owned.attempt.id),
          ne(attemptQuestionGrades.grader, "teacher"),
        ),
      );
    if (machineGrades.length > 0) {
      await db.insert(attemptQuestionGrades).values(
        machineGrades.map(g => ({
          attemptId: owned.attempt.id,
          questionId: g.questionId,
          awardedMarks: g.awardedMarks.toFixed(2),
          maxMarks: g.maxMarks.toFixed(2),
          verdict: g.verdict,
          grader: "deterministic" as const,
          needsReview: false,
          rationaleAr: g.rationaleAr,
        })),
      );
    }

    const now = new Date();
    await db
      .update(attempts)
      .set({ submittedAt: owned.attempt.submittedAt ?? now, updatedAt: now })
      .where(eq(attempts.id, owned.attempt.id));

    const recomputed = await recomputeResult(owned.attempt);

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
router.post("/attempts/:id/scan-marks", async (req: AuthenticatedRequest, res) => {
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
