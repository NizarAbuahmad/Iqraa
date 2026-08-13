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
  students,
} from "@workspace/db";
import type { EvaluationQuestion } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { gradeAttempt, type AttemptQuestionInput } from "../modules/assessment/gradeAttempt";
import type { LevelBandInput } from "../modules/assessment/scoring";

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

    res.json({
      attempt: owned.attempt,
      evaluation: {
        id: owned.evaluation.id,
        title: owned.evaluation.title,
        titleAr: owned.evaluation.titleAr,
      },
      student,
      questions: owned.attempt.questionSnapshot,
      answers,
      grades,
      result: result ?? null,
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
 * result is marked provisional so the dashboard cannot present it as final.
 * Re-submitting recomputes cleanly: existing grades and the result are
 * replaced, not appended to.
 */
router.post("/attempts/:id/submit", async (req: AuthenticatedRequest, res) => {
  try {
    const owned = await ownedAttempt(req.params["id"] as string, req.user!.id);
    if (!owned) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    const snapshot = (owned.attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
    if (snapshot.length === 0) {
      res.status(409).json({ error: "This attempt has no questions" });
      return;
    }

    const scaleSnapshot = owned.attempt.levelScaleSnapshot as
      | { scaleId?: string | null; bands?: LevelBandInput[] }
      | null;
    const bands = scaleSnapshot?.bands ?? [];
    if (bands.length === 0) {
      res.status(409).json({ error: "No level scale was captured for this attempt" });
      return;
    }

    const answerRows = await db
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, owned.attempt.id));
    const answerMap = new Map(answerRows.map(a => [a.questionId, a.response]));

    const questions: AttemptQuestionInput[] = snapshot.map(q => ({
      questionId: q.id,
      type: q.type,
      body: q.body,
      expectedAnswer: q.expectedAnswer,
      competencyKey: q.competencyKey,
      objectiveId: q.objectiveId,
      marks: Number(q.marks),
      difficulty: q.difficulty,
    }));

    const outcome = gradeAttempt(questions, answerMap, bands);

    await db.delete(attemptQuestionGrades).where(eq(attemptQuestionGrades.attemptId, owned.attempt.id));
    if (outcome.graded.length > 0) {
      await db.insert(attemptQuestionGrades).values(
        outcome.graded.map(g => ({
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

    const isProvisional = outcome.ungradedQuestionIds.length > 0;
    const resultValues = {
      attemptId: owned.attempt.id,
      earnedMarks: outcome.score.earnedMarks.toFixed(2),
      totalMarks: outcome.score.totalMarks.toFixed(2),
      percent: outcome.score.percent.toFixed(2),
      competencyScores: outcome.score.competencyScores,
      objectiveScores: outcome.score.objectiveScores,
      levelKey: outcome.score.levelKey,
      levelScaleId: scaleSnapshot?.scaleId ?? null,
      isProvisional,
      computedAt: new Date(),
    };
    await db
      .insert(attemptResults)
      .values(resultValues)
      .onConflictDoUpdate({ target: attemptResults.attemptId, set: resultValues });

    const now = new Date();
    const [updatedAttempt] = await db
      .update(attempts)
      .set({
        status: isProvisional ? "needs_review" : "graded",
        submittedAt: owned.attempt.submittedAt ?? now,
        gradedAt: now,
        updatedAt: now,
      })
      .where(eq(attempts.id, owned.attempt.id))
      .returning();

    res.json({
      attempt: updatedAttempt,
      grades: outcome.graded,
      ungradedQuestionIds: outcome.ungradedQuestionIds,
      result: { ...resultValues, computedAt: resultValues.computedAt.toISOString() },
    });
  } catch (err) {
    logger.error({ err }, "submit attempt failed");
    res.status(500).json({ error: "Failed to submit the attempt" });
  }
});

export default router;
