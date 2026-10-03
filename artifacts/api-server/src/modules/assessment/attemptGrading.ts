/**
 * Grading a sitting, shared by the two routes that hand one in.
 *
 * The teacher's `POST /attempts/:id/submit` has always graded; the student's
 * `POST /take/attempt/submit` used to stamp `submittedAt` and stop, on the
 * reasoning that grading "is not repeated here" — which left every
 * student-link paper ungraded until the teacher opened it and pressed the
 * button once per child. Thirty papers, thirty taps, and «تحقّق من النتيجة»
 * answering "not yet" the whole time. One function, called from both, is how
 * the two stop disagreeing about the same sitting.
 *
 * Grading on the student side is safe because nothing here releases a mark:
 * `/take/attempt/result` still gates on `releaseResultsToStudent` and on the
 * paper having no question left unmarked.
 */
import { db } from "@workspace/db";
import {
  attemptAnswers,
  attemptQuestionGrades,
  attemptResults,
  attempts,
  recommendations,
} from "@workspace/db";
import type { Attempt, EvaluationQuestion } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { resolveObjectiveIds } from "@workspace/curriculum";
import {
  gradeAttempt,
  scorePersistedGrades,
  type AttemptQuestionInput,
} from "./gradeAttempt.ts";
import type { AttemptScore, LevelBandInput } from "./scoring.ts";
import { recommendationsFor } from "./recommend.ts";

/** The snapshot, in the shape the scoring modules take. */
export function snapshotQuestions(attempt: Attempt): AttemptQuestionInput[] {
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

export function snapshotBands(attempt: Attempt): LevelBandInput[] {
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
export async function recomputeResult(attempt: Attempt) {
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
export async function refreshRecommendations(attemptId: string, score: AttemptScore) {
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


/**
 * Machine-grade every answer on record, keep any mark the teacher already
 * wrote by hand, stamp `submittedAt` if this is the first hand-in, and rebuild
 * the result. Returns the machine grades it wrote beside the recomputed
 * result, which is what the teacher route has always answered with.
 */
export async function gradeSubmission(attempt: Attempt) {
  const questions = snapshotQuestions(attempt);
  if (questions.length === 0) {
    return { ok: false as const, error: "This attempt has no questions" };
  }
  const bands = snapshotBands(attempt);
  if (bands.length === 0) {
    return { ok: false as const, error: "No level scale was captured for this attempt" };
  }

  const answerRows = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));
  const answerMap = new Map(answerRows.map(a => [a.questionId, a.response]));

  const existingGrades = await db
    .select({ questionId: attemptQuestionGrades.questionId })
    .from(attemptQuestionGrades)
    .where(
      and(
        eq(attemptQuestionGrades.attemptId, attempt.id),
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
        eq(attemptQuestionGrades.attemptId, attempt.id),
        ne(attemptQuestionGrades.grader, "teacher"),
      ),
    );
  if (machineGrades.length > 0) {
    await db.insert(attemptQuestionGrades).values(
      machineGrades.map(g => ({
        attemptId: attempt.id,
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
    .update(attemptAnswers)
    .set({ isFinal: true, updatedAt: now })
    .where(eq(attemptAnswers.attemptId, attempt.id));
  await db
    .update(attempts)
    .set({ submittedAt: attempt.submittedAt ?? now, updatedAt: now })
    .where(eq(attempts.id, attempt.id));

  const recomputed = await recomputeResult(attempt);
  return { ok: true as const, machineGrades, recomputed };
}
