/**
 * The class mark book for a quick paper exam (one paper question worth N):
 * one typed total per student becomes a real result.
 *
 * Each row goes through the same code as typing a mark on the student's own
 * page (lib/teacherEntry.ts) and is then handed in with `gradeSubmission` —
 * the only TEACHER-side stamper of `submittedAt` (the student's link hand-in at
 * routes/studentAttempt.ts:969 is the other), so the only way a family ever
 * sees the mark, and only after the teacher releases results. Rows are
 * independent: one bad row is reported, the others are saved — and they are
 * saved one after another, never in parallel: find-or-create has a
 * unique-violation race that a concurrent loop would turn into a failure.
 *
 * Ownership is this file's job, not `writeTeacherMark`'s or
 * `findOrStartTeacherEntry`'s: the caller (the route) proves the teacher owns
 * the exam; the member query below proves each student is a live student of
 * THIS exam's class and this teacher's.
 */
import { db, attemptAnswers, attempts, classMemberships, students } from "@workspace/db";
import type { Attempt, Evaluation, EvaluationQuestion } from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { findLiveClass } from "./classOwnership.ts";
import { logger } from "./logger.ts";
import { findOrStartTeacherEntry, loadAttemptTemplate, writeTeacherMark, type AttemptTemplate } from "./teacherEntry.ts";
import { inAudience } from "../modules/assessment/audience.ts";
import { gradeSubmission } from "../modules/assessment/attemptGrading.ts";
import { deriveVerdict, normalizeManualMarks } from "../modules/assessment/manualGrade.ts";
import { isPaperQuestion, isQuickPaperExam } from "../modules/assessment/paperExam.ts";
import {
  clearDecision,
  type PaperTotalErrorCode,
  type PaperTotalInput,
  type PaperTotalResult,
  type PaperTotalsRefusal,
} from "../modules/assessment/paperTotals.ts";

export type PaperTotalsOutcome =
  | { ok: true; maxMarks: number; results: PaperTotalResult[] }
  | { ok: false; code: PaperTotalsRefusal };

interface Context {
  evaluation: Evaluation;
  teacherId: string;
  template: AttemptTemplate;
  question: EvaluationQuestion;
  members: Set<string>;
  attemptByStudent: Map<string, Attempt>;
  withAnswers: Set<string>;
}

const refused = (studentId: string, code: PaperTotalErrorCode): PaperTotalResult => ({ studentId, status: "error", code });

/** A plain decimal: digits with an optional point. Not hex, an exponent, "Infinity" or non-latin digits. */
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * The parser lets any non-blank string through; this is where a string either
 * is a mark or is not. `normalizeManualMarks` does the range and the rounding,
 * so a total is read exactly as a single typed mark is — but `Number("0x10")`
 * is 16 and `Number("1e1")` is 10, which are not things a teacher typed as a mark.
 */
function readMarks(raw: number | string, maxMarks: number): number | null {
  if (typeof raw === "string" && !PLAIN_NUMBER.test(raw.trim())) return null;
  return normalizeManualMarks(raw, maxMarks);
}

/** The one paper question a sitting was frozen with, or null if it is not a quick paper. */
function snapshotQuestion(attempt: Attempt): EvaluationQuestion | null {
  const snapshot = (attempt.questionSnapshot as EvaluationQuestion[]) ?? [];
  return snapshot.length === 1 && isPaperQuestion(snapshot[0]!) ? snapshot[0]! : null;
}

async function saveOne(row: PaperTotalInput, ctx: Context): Promise<PaperTotalResult> {
  const { studentId } = row;
  if (!ctx.members.has(studentId)) return refused(studentId, "not_in_class");
  if (!inAudience(ctx.template.audience, studentId)) return refused(studentId, "not_in_group");
  const existing = ctx.attemptByStudent.get(studentId) ?? null;

  if (row.marks === null) {
    const decision = clearDecision(existing && { source: existing.source, hasAnswers: ctx.withAnswers.has(existing.id) });
    if (decision === "keep") return refused(studentId, "kept_student_work");
    // Cascades to its grades, result, audit rows and recommendations: the paper was never entered.
    if (decision === "delete") await db.delete(attempts).where(eq(attempts.id, existing!.id));
    return { studentId, status: "cleared", marks: null };
  }

  const question = existing ? snapshotQuestion(existing) : ctx.question;
  if (!question) return refused(studentId, "not_quick_paper");
  const maxMarks = Number(question.marks);
  const awarded = readMarks(row.marks, maxMarks);
  if (awarded === null) return refused(studentId, "marks_out_of_range");

  let attempt = existing;
  if (!attempt) {
    const started = await findOrStartTeacherEntry({
      evaluation: ctx.evaluation,
      studentId,
      teacherId: ctx.teacherId,
      template: ctx.template,
    });
    if (!started.ok) return refused(studentId, started.code === "not_in_group" ? "not_in_group" : "failed");
    attempt = started.attempt;
  }

  const { changed } = await writeTeacherMark({
    attemptId: attempt.id,
    questionId: question.id,
    awardedMarks: awarded,
    maxMarks,
    verdict: deriveVerdict(awarded, maxMarks),
    teacherId: ctx.teacherId,
    skipIfUnchanged: true,
  });
  if (!changed && attempt.submittedAt) return { studentId, status: "unchanged", marks: awarded };

  const graded = await gradeSubmission(attempt);
  if (!graded.ok) return refused(studentId, "failed");
  return { studentId, status: "saved", marks: awarded };
}

export async function savePaperTotals(input: {
  evaluation: Evaluation;
  teacherId: string;
  rows: PaperTotalInput[];
}): Promise<PaperTotalsOutcome> {
  const { evaluation, teacherId, rows } = input;
  const classId = evaluation.classGroupId;
  if (!classId || !(await findLiveClass(classId, teacherId))) return { ok: false, code: "no_class" };

  const template = await loadAttemptTemplate(evaluation);
  if (!isQuickPaperExam(template.questions)) return { ok: false, code: "not_quick_paper" };
  if (template.bands.length === 0) return { ok: false, code: "no_level_scale" };

  const ids = rows.map(r => r.studentId);
  // Live members of THIS exam's class, owned by this teacher — never "any student of theirs".
  const members = new Set(
    (
      await db
        .select({ id: students.id })
        .from(classMemberships)
        .innerJoin(students, eq(students.id, classMemberships.studentId))
        .where(
          and(
            eq(classMemberships.classGroupId, classId),
            inArray(students.id, ids),
            eq(students.teacherId, teacherId),
            isNull(students.archivedAt),
          ),
        )
    ).map(r => r.id),
  );
  const held = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.evaluationId, evaluation.id), inArray(attempts.studentId, ids)));
  const withAnswers = held.length
    ? new Set(
        (
          await db
            .selectDistinct({ attemptId: attemptAnswers.attemptId })
            .from(attemptAnswers)
            .where(inArray(attemptAnswers.attemptId, held.map(a => a.id)))
        ).map(r => r.attemptId),
      )
    : new Set<string>();

  const ctx: Context = {
    evaluation,
    teacherId,
    template,
    question: template.questions[0]!,
    members,
    attemptByStudent: new Map(held.map(a => [a.studentId, a])),
    withAnswers,
  };

  const results: PaperTotalResult[] = [];
  for (const row of rows) {
    try {
      results.push(await saveOne(row, ctx));
    } catch (err) {
      logger.error({ err, evaluationId: evaluation.id, studentId: row.studentId }, "paper total failed");
      results.push(refused(row.studentId, "failed"));
    }
  }
  return { ok: true, maxMarks: Number(ctx.question.marks), results };
}
