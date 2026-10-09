/**
 * May this student throw away a failed sitting and try the quiz again?
 *
 * The mastery gate holds a student behind a lesson's quiz until they pass it,
 * and a student who fails once would otherwise stay locked for good: `attempts`
 * allows one sitting per student per exam. Decided without a database so the
 * refusals can be tested one by one.
 *
 * What it must never do is let a retake overwrite a mark that should stand,
 * which is why each refusal exists:
 * - **`not_a_quiz`** — only an exam covering exactly one lesson is a lesson
 *   quiz. A term test spanning six lessons is the teacher's record, not the
 *   student's to reset.
 * - **`not_released`** — until the teacher releases the exam's results the
 *   student is told neither pass nor fail, and a retake offered now would say
 *   "failed" as plainly as the mark would. Checked before every refusal that
 *   depends on the mark, so the refusal code cannot leak it either.
 * - **`provisional`** — a paper with an unmarked open-ended question has no
 *   final mark yet, so there is nothing to call a fail.
 * - **`already_passed`** — a pass stands.
 * - **`teacher_entry`** — a paper the teacher typed in is the teacher's record,
 *   not the student's sitting (resume refuses it for the same reason).
 */

/** ponytail: a flat cap, no cooldown; add a wait between tries if guessing shows up. */
export const MAX_RETAKES = 3;

export interface RetakeInput {
  submitted: boolean;
  /** The student sat it through their own link, not a teacher-typed paper. */
  studentSitting: boolean;
  /** The teacher released this exam's results (`releaseResultsToStudent`). */
  released: boolean;
  isProvisional: boolean;
  percent: unknown;
  threshold: number;
  retakesUsed: number;
  /** The exam's objectives map to exactly one lesson. */
  singleLesson: boolean;
  /** Published, with a share link that has not expired. */
  open: boolean;
}

export type RetakeRefusal =
  | "not_submitted"
  | "teacher_entry"
  | "not_released"
  | "provisional"
  | "not_a_quiz"
  | "closed"
  | "already_passed"
  | "limit_reached";

export function retakeDecision(i: RetakeInput): { ok: true } | { ok: false; code: RetakeRefusal } {
  if (!i.submitted) return { ok: false, code: "not_submitted" };
  if (!i.studentSitting) return { ok: false, code: "teacher_entry" };
  if (!i.released) return { ok: false, code: "not_released" };
  if (i.isProvisional) return { ok: false, code: "provisional" };
  if (!i.singleLesson) return { ok: false, code: "not_a_quiz" };
  if (!i.open) return { ok: false, code: "closed" };
  const percent = Number(i.percent);
  if (Number.isFinite(percent) && percent >= i.threshold) return { ok: false, code: "already_passed" };
  if (i.retakesUsed >= MAX_RETAKES) return { ok: false, code: "limit_reached" };
  return { ok: true };
}
