/**
 * One row of a signed-in student's «اختباراتي» list, decided without a database.
 *
 * The share link used to be the only door into an exam, and the hand-in
 * screen the only place a result appeared — gone as soon as the tab closed.
 * This decides, per exam, what the list may say and offer:
 *
 * - **A link only while the exam is open.** Published and unexpired, the same
 *   test `evaluationByCode` applies at `/take/:code`; a closed or expired
 *   exam would answer that route as an unknown code, so handing out the code
 *   would hand out a dead end.
 * - **A result only when the student may see it.** `studentResultReady` is
 *   the single rule `/take/attempt/result` already follows — released by the
 *   teacher and no question left unmarked — and `sanitizeResultForStudent`
 *   the single projection. Anything else comes back as `null`, so an
 *   unreleased mark never leaves the server.
 * - **A draft never appears** unless the student already holds a sitting on
 *   it — a paper the teacher typed in for them (`teacher_entry`) belongs to
 *   an exam that may never have been published.
 */
import { sanitizeResultForStudent, studentResultReady, type StudentResult } from "./studentView.ts";
import { examDeadline } from "./studentResponse.ts";

export interface ExamForStudent {
  id: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  status: string;
  shareCode: string | null;
  shareCodeExpiresAt: Date | null;
  timeLimitMin: number | null;
  totalMarks: unknown;
  releaseResultsToStudent: boolean;
  publishedAt: Date | null;
  closedAt: Date | null;
}

export interface SittingForStudent {
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
  /**
   * `teacher_entry` is a paper the teacher is typing in for the student.
   * `/take/:code/claim-self` refuses to resume one, so it is never offered
   * as something the student can continue. Absent reads as `student_link`.
   */
  source?: string;
}

export interface ResultForStudent {
  levelKey: string | null;
  percent: unknown;
  earnedMarks: unknown;
  totalMarks: unknown;
  competencyScores: unknown;
  isProvisional: boolean;
}

/**
 * `available`: open, not started. `in_progress`: started, not handed in, and
 * the exam is still open. `submitted`: handed in, no result to show yet.
 * `result`: handed in and released. `closed`: the exam is over and there is
 * nothing to show — never started, or started and not handed in.
 */
export type StudentExamState = "available" | "in_progress" | "submitted" | "result" | "closed";

export interface StudentExamRow {
  evaluationId: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  totalMarks: number;
  timeLimitMin: number | null;
  publishedAt: string | null;
  state: StudentExamState;
  /** Present only while `/take/:code` would admit the student. */
  shareCode: string | null;
  submittedAt: string | null;
  /** When a sitting already under way runs out, if the exam is timed. */
  deadlineAt: string | null;
  result: StudentResult | null;
}

function linkIsOpen(exam: ExamForStudent, now: Date): boolean {
  if (exam.status !== "published" || !exam.shareCode) return false;
  return !exam.shareCodeExpiresAt || exam.shareCodeExpiresAt.getTime() > now.getTime();
}

export function studentExamRow(
  exam: ExamForStudent,
  sitting: SittingForStudent | null,
  result: ResultForStudent | null,
  now: Date,
): StudentExamRow | null {
  // A draft appears only through a paper already handed in on it — a teacher
  // typing one in for the student, whose exam was never published. An
  // unfinished one would list as «مُغلق» for an exam the student never saw.
  if (exam.status === "draft" && !sitting?.submittedAt) return null;

  const open = linkIsOpen(exam, now);
  const handedIn = Boolean(sitting?.submittedAt);
  const released = handedIn && studentResultReady({ released: exam.releaseResultsToStudent, result: result ?? undefined });

  let state: StudentExamState;
  if (released) state = "result";
  else if (handedIn) state = "submitted";
  else if (!open) state = "closed";
  else state = sitting ? "in_progress" : "available";

  const studentsOwn = !sitting || (sitting.source ?? "student_link") === "student_link";
  const offerLink = open && studentsOwn && (state === "available" || state === "in_progress" || state === "submitted");

  return {
    evaluationId: exam.id,
    title: exam.title,
    titleAr: exam.titleAr,
    subjectId: exam.subjectId,
    gradeId: exam.gradeId,
    totalMarks: Number(exam.totalMarks) || 0,
    timeLimitMin: exam.timeLimitMin,
    publishedAt: exam.publishedAt?.toISOString() ?? null,
    state,
    shareCode: offerLink ? exam.shareCode : null,
    submittedAt: sitting?.submittedAt?.toISOString() ?? null,
    deadlineAt:
      state === "in_progress"
        ? examDeadline(sitting?.startedAt ?? null, exam.timeLimitMin, 0)?.toISOString() ?? null
        : null,
    result: released && result ? sanitizeResultForStudent(result) : null,
  };
}

const STATE_ORDER: Record<StudentExamState, number> = {
  in_progress: 0,
  available: 1,
  submitted: 2,
  result: 2,
  closed: 2,
};

/** What the student can act on first; within that, newest first. */
export function sortStudentExams(rows: readonly StudentExamRow[]): StudentExamRow[] {
  return [...rows].sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (byState !== 0) return byState;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
}
