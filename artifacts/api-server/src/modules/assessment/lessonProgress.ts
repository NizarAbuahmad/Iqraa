/**
 * Which lessons a student has passed, decided without a database.
 *
 * The mastery gate unlocks lesson N+1 once lesson N has been passed. Three
 * rules keep "passed" from meaning more than it can:
 *
 * - **A provisional paper never counts.** A sitting with an open-ended
 *   question still unmarked has a percent nobody has confirmed — the same
 *   reason `studentResultReady` keeps it from the student.
 * - **An exam counts for a lesson only if it covers exactly that lesson.**
 *   An exam is scoped by `objectiveIds`; `evaluations.lessonId` is always
 *   null (see `lessonIdsForObjectiveIds`). A term test spanning six lessons
 *   proves none of them, so it is skipped rather than credited to all six.
 * - **Best sitting wins.** A student who failed and later passed has passed.
 *
 * Only lesson ids come back, never a percent: the teacher may not have
 * released the marks, and "unlocked" is all the gate needs to say.
 */

/** Pass mark, in percent. */
// ponytail: one constant for the pilot; per-class threshold when phase 3 lands.
export const MASTERY_PASS_PERCENT = 80;

export interface SittingForProgress {
  /** The exam's `objectiveIds`; the lesson is derived from these. */
  objectiveIds: readonly string[] | null | undefined;
  percent: unknown;
  isProvisional: boolean;
}

/**
 * @param lessonsOf maps objective ids to the lesson ids they cover, in
 *   practice `lessonIdsForObjectiveIds`. Injected so this stays free of the
 *   curriculum bundle and testable with plain arrays.
 */
/**
 * The lessons that have a quiz a student can sit now — the only lessons the
 * gate may hold anyone behind. A lesson with no open quiz must never lock the
 * next one, or the few lessons that have quizzes would dead-end the rest.
 * Same single-lesson rule as `passedLessonIds`, for the same reason.
 */
export function quizLessonIds(
  exams: readonly { objectiveIds: readonly string[] | null | undefined }[],
  lessonsOf: (objectiveIds: readonly string[] | null | undefined) => string[],
): string[] {
  const out = new Set<string>();
  for (const e of exams) {
    const lessons = lessonsOf(e.objectiveIds);
    if (lessons.length === 1) out.add(lessons[0]!);
  }
  return [...out];
}

/**
 * Lessons a teacher has let a student through, counted as passed. A teacher's
 * unlock is the way out for a student the quiz cannot move on — out of
 * retakes, or a quiz with a bad question — so it must count exactly like a pass.
 */
export function withUnlocks(passed: readonly string[], unlocked: readonly string[]): string[] {
  return [...new Set([...passed, ...unlocked])];
}

/**
 * What a teacher's results row offers for one student's quiz: `available` to
 * unlock the lesson, `granted` once they have (so it can be undone), `none`
 * when there is nothing to offer — the gate is off, the exam is not a
 * one-lesson quiz, or the student already passed on their own.
 */
export function unlockState(i: {
  gateOn: boolean;
  /** The single lesson the exam covers, or null if it covers none or several. */
  lessonId: string | null;
  passed: boolean;
  granted: boolean;
}): "none" | "available" | "granted" {
  if (!i.gateOn || !i.lessonId) return "none";
  if (i.granted) return "granted";
  return i.passed ? "none" : "available";
}

export function passedLessonIds(
  sittings: readonly SittingForProgress[],
  lessonsOf: (objectiveIds: readonly string[] | null | undefined) => string[],
  threshold: number = MASTERY_PASS_PERCENT,
): string[] {
  const passed = new Set<string>();
  for (const s of sittings) {
    if (s.isProvisional) continue;
    const percent = Number(s.percent);
    if (!Number.isFinite(percent) || percent < threshold) continue;
    const lessons = lessonsOf(s.objectiveIds);
    if (lessons.length === 1) passed.add(lessons[0]!);
  }
  return [...passed];
}
