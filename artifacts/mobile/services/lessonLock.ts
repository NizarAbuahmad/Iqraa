/**
 * Which lessons of a unit a student sees locked, decided from
 * `GET /student/progress` (what "passed" means is `passedLessonIds` on the
 * server). Pure and free of React Native, so it runs under the bare runner.
 *
 * The rule: lessons are read in order, and everything *after* the first lesson
 * whose open quiz has not been passed is locked. That lesson itself stays
 * open — a student has to be able to read it to sit its quiz.
 *
 * **Fails open everywhere.** A lesson with no open quiz never holds anyone
 * back, and a gate that is off or a request that failed locks nothing: a lock
 * is the one thing here that can stop a child, so any doubt means unlocked.
 */
export interface MasteryProgress {
  enabled: boolean;
  passedLessonIds: string[];
  /**
   * Lessons whose quiz is handed in but whose result the teacher has not
   * released: neither passed nor failed yet, as far as the student is told.
   */
  awaitingLessonIds: string[];
  /** Lessons with a quiz the student can sit now; only these can block. */
  quizLessonIds: string[];
  /** Failed quizzes the student may throw away and sit again. */
  retakeEvaluationIds: string[];
}

/** What a failed or disabled lookup stands for: nothing is locked. */
export const NO_PROGRESS: MasteryProgress = {
  enabled: false,
  passedLessonIds: [],
  awaitingLessonIds: [],
  quizLessonIds: [],
  retakeEvaluationIds: [],
};

export interface LockState {
  locked: Set<string>;
  /** The lesson whose quiz is holding the rest back, for the explanation. */
  blockedBy: string | null;
  /**
   * The blocking quiz is handed in and waiting for the teacher's release, so
   * the explanation says "waiting for your teacher", not "pass the quiz".
   */
  awaiting: boolean;
}

export function lockState(orderedLessonIds: readonly string[], progress: MasteryProgress): LockState {
  const locked = new Set<string>();
  if (!progress.enabled) return { locked, blockedBy: null, awaiting: false };

  const quiz = new Set(progress.quizLessonIds);
  const passed = new Set(progress.passedLessonIds);
  let blockedBy: string | null = null;
  for (const id of orderedLessonIds) {
    if (blockedBy) locked.add(id);
    else if (quiz.has(id) && !passed.has(id)) blockedBy = id;
  }
  if (locked.size === 0) return { locked, blockedBy: null, awaiting: false };
  return { locked, blockedBy, awaiting: progress.awaitingLessonIds.includes(blockedBy!) };
}
