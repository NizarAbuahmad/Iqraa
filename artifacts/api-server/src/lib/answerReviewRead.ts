/**
 * Loading one «راجع إجاباتك» paper, for the student who sat it and for their parent.
 *
 * Both routes (`GET /student/exams/:id/review` and `GET /parent/exams/:id/review`)
 * decide WHICH roster rows the caller stands for and then ask this for the paper
 * one of those rows handed in. What may be shown is decided in one place
 * (modules/assessment/answerReview.ts), in two modes:
 * - **"full"** (`studentReviewReady`): the exam is closed, the teacher released its
 *   results and turned «اعرض الإجابات» on — every question with the answer given, the
 *   correct one and the worked steps (`reviewItems`);
 * - **"feedback"** (`feedbackReady`, since 2026-11-26): short of that, the teacher's
 *   «تغذية راجعة فورية» is on and the results are released — right and wrong, the
 *   answer given and the marks, with no key and no steps (`feedbackItems`).
 * The full review wins when both hold. A parent (`fullOnly`) gets the full review only,
 * exactly as the child sees it and never earlier; the feedback mode runs while
 * classmates may still be sitting the exam, and its switch speaks of students only.
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
 * only for the full review (feedback shows no steps), only after its gate holds, only
 * for the question ids in the caller's own sitting, and only the steps column.
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
import {
  feedbackItems,
  feedbackReady,
  reviewItems,
  studentReviewReady,
  type ReviewItem,
  type ReviewQuestion,
} from "../modules/assessment/answerReview.ts";

export interface AnswerReview {
  evaluationId: string;
  title: string;
  titleAr: string;
  subjectId: string;
  /** "full": with the answers and steps. "feedback": right and wrong only; the answers come once the exam closes. */
  mode: "full" | "feedback";
  items: ReviewItem[];
}

export async function loadAnswerReview(
  studentIds: readonly string[],
  evaluationId: string,
  opts: { fullOnly?: boolean } = {},
): Promise<AnswerReview | null> {
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
  if (!row) return null;
  const full = studentReviewReady({
    status: row.evaluation.status,
    released: row.evaluation.releaseResultsToStudent,
    solutionsShown: row.evaluation.showSolutionsToStudent,
    result: row.result ?? undefined,
  });
  const feedback =
    !full &&
    !opts.fullOnly &&
    feedbackReady({
      instantFeedback: row.evaluation.instantFeedback,
      released: row.evaluation.releaseResultsToStudent,
      submitted: true,
    });
  if (!full && !feedback) return null;

  const snapshot = (row.attempt.questionSnapshot as ReviewQuestion[]) ?? [];
  const [answers, grades, live] = await Promise.all([
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, row.attempt.id)),
    db.select().from(attemptQuestionGrades).where(eq(attemptQuestionGrades.attemptId, row.attempt.id)),
    full && snapshot.length
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

  const input = {
    snapshot,
    answers,
    grades,
    stepsById: new Map(live.map(q => [q.id, q.workedSteps])),
    isAr: row.evaluation.language !== "en",
  };
  return {
    evaluationId,
    title: row.evaluation.title,
    titleAr: row.evaluation.titleAr,
    subjectId: row.evaluation.subjectId,
    mode: full ? "full" : "feedback",
    items: full ? reviewItems(input) : feedbackItems({ ...input, attemptId: row.attempt.id }),
  };
}
