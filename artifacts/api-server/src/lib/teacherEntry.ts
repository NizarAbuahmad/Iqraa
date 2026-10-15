/**
 * Teacher entry, shared: starting the paper a teacher types in for a student,
 * and writing one hand mark. These were the bodies of
 * `POST /evaluations/:id/attempts` and `PUT /attempts/:id/grades`; the class
 * mark book (`lib/paperTotals.ts`) needs exactly the same behaviour, so it
 * lives once, here. `teacherEntry.db.test.ts` pinned it before it moved.
 */
import { db, attemptQuestionGrades, attempts, evaluationQuestions, gradeOverrides, levelBands } from "@workspace/db";
import type { Attempt, AttemptQuestionGrade, Evaluation, EvaluationQuestion, LevelBand, Verdict } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { inAudience, type Audience } from "../modules/assessment/audience.ts";
import { evaluationAudience } from "./evaluationAudience.ts";

/** What a new sitting is frozen from — loaded once per exam, not once per student. */
export interface AttemptTemplate {
  questions: EvaluationQuestion[];
  bands: LevelBand[];
  audience: Audience;
}

export async function loadAttemptTemplate(evaluation: Pick<Evaluation, "id" | "levelScaleId">): Promise<AttemptTemplate> {
  const questions = await db
    .select()
    .from(evaluationQuestions)
    .where(and(eq(evaluationQuestions.evaluationId, evaluation.id), isNull(evaluationQuestions.deletedAt)))
    .orderBy(asc(evaluationQuestions.orderIndex));
  const bands = evaluation.levelScaleId
    ? await db.select().from(levelBands).where(eq(levelBands.scaleId, evaluation.levelScaleId)).orderBy(asc(levelBands.sortOrder))
    : [];
  return { questions, bands, audience: await evaluationAudience(evaluation.id) };
}

export type StartOutcome =
  | { ok: true; attempt: Attempt; created: boolean }
  | { ok: false; code: "not_in_group" | "no_questions" | "no_level_scale" };

/**
 * Find-or-create. Any existing sitting is returned whatever its source: the
 * schema allows one per student per exam, so a student who sat via the link
 * has the only paper there will be. (Filtering on source once made the insert
 * hit that constraint and answer 500, with no way for the teacher to open the
 * paper.) Ownership of the exam and the student, and "published", are the
 * caller's checks.
 */
export async function findOrStartTeacherEntry(input: {
  evaluation: Pick<Evaluation, "id" | "levelScaleId">;
  studentId: string;
  teacherId: string;
  template?: AttemptTemplate;
}): Promise<StartOutcome> {
  const [existing] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.evaluationId, input.evaluation.id), eq(attempts.studentId, input.studentId)))
    .limit(1);
  if (existing) return { ok: true, attempt: existing, created: false };

  const template = input.template ?? (await loadAttemptTemplate(input.evaluation));
  // A group check is for its group only — the same rule the share link and
  // the student's own list apply (audience.ts).
  if (!inAudience(template.audience, input.studentId)) return { ok: false, code: "not_in_group" };
  if (template.questions.length === 0) return { ok: false, code: "no_questions" };
  if (template.bands.length === 0) return { ok: false, code: "no_level_scale" };

  // Frozen at start: a later edit to the evaluation or the scale must not
  // retroactively change what this attempt is graded against.
  const [row] = await db
    .insert(attempts)
    .values({
      evaluationId: input.evaluation.id,
      studentId: input.studentId,
      source: "teacher_entry",
      enteredBy: input.teacherId,
      status: "in_progress",
      startedAt: new Date(),
      questionSnapshot: template.questions,
      levelScaleSnapshot: { scaleId: input.evaluation.levelScaleId, bands: template.bands },
    })
    .returning();
  return { ok: true, attempt: row!, created: true };
}

/**
 * Write one hand mark as a normal grade row (`grader: 'teacher'`), appending to
 * `grade_overrides` when a mark already existed — the evidence for "the machine
 * said 2, the teacher said 3". A first mark writes no override: nothing was
 * overridden, and recording an invented "was 0, unanswered" would put a claim
 * about the student into an audit trail. Recomputing the result is the
 * caller's next step.
 */
export async function writeTeacherMark(input: {
  attemptId: string;
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  verdict: Verdict;
  teacherId: string;
  /** The comment on this answer. Undefined keeps the one already stored ("" if none). */
  note?: string;
  /** Write nothing (no grade, no audit row) when the stored teacher mark and verdict already match. */
  skipIfUnchanged?: boolean;
}): Promise<{ changed: boolean; grade: AttemptQuestionGrade }> {
  const [previous] = await db
    .select()
    .from(attemptQuestionGrades)
    .where(and(eq(attemptQuestionGrades.attemptId, input.attemptId), eq(attemptQuestionGrades.questionId, input.questionId)))
    .limit(1);

  const awarded = input.awardedMarks.toFixed(2);
  if (
    input.skipIfUnchanged &&
    previous &&
    previous.grader === "teacher" &&
    Number(previous.awardedMarks).toFixed(2) === awarded &&
    previous.verdict === input.verdict
  ) {
    return { changed: false, grade: previous };
  }

  const note = input.note ?? previous?.rationaleAr ?? "";
  const values = {
    attemptId: input.attemptId,
    questionId: input.questionId,
    awardedMarks: awarded,
    maxMarks: input.maxMarks.toFixed(2),
    verdict: input.verdict,
    grader: "teacher" as const,
    // A teacher's mark is not a guess: no confidence, never queued for review.
    confidence: null,
    needsReview: false,
    // The teacher's comment replaces the machine's rationale: its verdict no longer stands.
    rationaleAr: note,
    gradedAt: new Date(),
  };
  const [grade] = await db
    .insert(attemptQuestionGrades)
    .values(values)
    .onConflictDoUpdate({ target: [attemptQuestionGrades.attemptId, attemptQuestionGrades.questionId], set: values })
    .returning();

  if (previous) {
    await db.insert(gradeOverrides).values({
      attemptId: input.attemptId,
      questionId: input.questionId,
      teacherId: input.teacherId,
      oldMarks: previous.awardedMarks,
      newMarks: values.awardedMarks,
      oldVerdict: previous.verdict,
      newVerdict: input.verdict,
      note,
    });
  }
  return { changed: true, grade: grade! };
}
