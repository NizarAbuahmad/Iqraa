/**
 * Loading one «راجع إجاباتك» paper, for the student who sat it and for their parent.
 *
 * Both routes (`GET /student/exams/:id/review` and `GET /parent/exams/:id/review`)
 * decide WHICH roster rows the caller stands for and then ask this for the paper
 * one of those rows handed in. Whether the paper may be shown is the one rule in
 * `studentReviewReady` (modules/assessment/answerReview.ts): the exam is closed, the
 * teacher released its results and turned the review on. A parent sees exactly what
 * the child sees, under the same switch, and never earlier.
 *
 * `null` is every way to fail (no sitting, not handed in, not ready), so a route
 * answers one 404 and says nothing about how far along the teacher is.
 *
 * The sitting, the answers and the grades are read on the caller's own connection:
 * row-level security lets a `self` or `guardian` account see the attempts of its
 * roster rows (`app_sees_attempt`). The worked steps cannot be: they sit on
 * `evaluation_questions`, which the policies keep teacher-only because that table
 * also holds the answer key. On the caller's connection the steps came back empty
 * under `RLS_ENFORCE`, with no error. So that one read runs on the owner connection,
 * only after the gate above holds, only for the question ids in the caller's own
 * sitting, and only the steps column.
 */
import {
  attemptAnswers,
  attemptQuestionGrades,
  attemptResults,
  attempts,
  db,
  evaluationQuestions,
  evaluations,
  systemDb,
} from "@workspace/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { reviewItems, studentReviewReady, type ReviewItem, type ReviewQuestion } from "../modules/assessment/answerReview.ts";

export interface AnswerReview {
  evaluationId: string;
  title: string;
  titleAr: string;
  subjectId: string;
  items: ReviewItem[];
}

export async function loadAnswerReview(studentIds: readonly string[], evaluationId: string): Promise<AnswerReview | null> {
  if (studentIds.length === 0) return null;

  const [row] = await db
    .select({ attempt: attempts, evaluation: evaluations, result: attemptResults })
    .from(attempts)
    .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
    .leftJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
    .where(
      and(
        eq(attempts.evaluationId, evaluationId),
        inArray(attempts.studentId, [...studentIds]),
        isNotNull(attempts.submittedAt),
      ),
    )
    .limit(1);
  if (
    !row ||
    !studentReviewReady({
      status: row.evaluation.status,
      released: row.evaluation.releaseResultsToStudent,
      solutionsShown: row.evaluation.showSolutionsToStudent,
      result: row.result ?? undefined,
    })
  ) {
    return null;
  }

  const snapshot = (row.attempt.questionSnapshot as ReviewQuestion[]) ?? [];
  const [answers, grades, live] = await Promise.all([
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, row.attempt.id)),
    db.select().from(attemptQuestionGrades).where(eq(attemptQuestionGrades.attemptId, row.attempt.id)),
    snapshot.length
      ? systemDb
          .select({ id: evaluationQuestions.id, workedSteps: evaluationQuestions.workedSteps })
          .from(evaluationQuestions)
          .where(
            and(
              eq(evaluationQuestions.evaluationId, evaluationId),
              inArray(evaluationQuestions.id, snapshot.map(q => q.id)),
            ),
          )
      : Promise.resolve([]),
  ]);

  return {
    evaluationId,
    title: row.evaluation.title,
    titleAr: row.evaluation.titleAr,
    subjectId: row.evaluation.subjectId,
    items: reviewItems({
      snapshot,
      answers,
      grades,
      stepsById: new Map(live.map(q => [q.id, q.workedSteps])),
      isAr: row.evaluation.language !== "en",
    }),
  };
}
