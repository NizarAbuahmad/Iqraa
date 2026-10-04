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
