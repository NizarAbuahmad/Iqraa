/**
 * The quick-check preset.
 *
 * A full evaluation is a ceremony: pick a book, pick objectives, pick types and
 * a count, generate, review, publish, attach a class, share the code. That is
 * the right shape for an exam, and the wrong shape for the three questions a
 * teacher wants to ask at the end of a lesson — which is the thing the evidence
 * on retrieval practice says actually moves learning.
 *
 * So this is not a new feature so much as a set of answers: everything the full
 * screen asks, answered in advance, leaving the teacher one decision (which
 * objective) and one judgement (are these three questions any good).
 *
 * Split into its own module with no `react-native` import so `node --test` can
 * load it — see CLAUDE.md on the mobile runner. `QuestionType` is imported as a
 * type only, which is erased at runtime, so this file stays loadable even
 * though `evaluations.ts` reaches the network.
 */
import type { QuestionType } from './evaluations.ts';

/**
 * Only types that mark themselves.
 *
 * This is the whole premise. `short_answer`, `open_ended`, `problem_solving`
 * and `practical_task` have no deterministic grader on the server — the API's
 * `gradeAttempt` leaves them out entirely and waits for a teacher — so a quick
 * check containing one is not quick, it is an exam with a small question count
 * and an evening of marking attached.
 *
 * `read_aloud` self-marks too but is deliberately absent: it cannot be
 * generated (its passage has to be vetted English at a controlled reading
 * level, and the server refuses the type), so it could never arrive here.
 *
 * `miniEval.test.ts` pins this list, and the API's own
 * `miniEvalGraders.test.ts` pins that all four still have a grader. Adding a
 * richer type here to make quick evaluations "better" is the exact change that would
 * silently put hand-marking back, so both tests exist to make it loud.
 */
export const MINI_EVAL_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
];

/**
 * Three, not five.
 *
 * **A quick evaluation reports an objective score, not competency scores**, and
 * that is the honest outcome rather than a shortfall. `allocateQuestions`
 * spreads a paper across the four competencies, so three questions land one
 * apiece — below `MIN_QUESTIONS_PER_COMPETENCY` (2) — and `scoring.ts`
 * correctly answers "not enough evidence" for each. Measured, not assumed: a
 * 3-question run warns on knowledge, understanding and application.
 *
 * That costs nothing that matters here. All three questions sit on the one
 * objective the teacher picked, so the objective score is well evidenced, and
 * the objective is what the class mastery rollup aggregates. Four dimensions of
 * competency inferred from three questions would be noise, and the floor exists
 * to refuse exactly that.
 *
 * Raising the count to satisfy the competency floor would be the wrong trade —
 * it buys a number nobody asked for by spending the lesson time the whole
 * feature exists to protect.
 */
export const MINI_EVAL_COUNT = 3;

export const MINI_EVAL_DIFFICULTY = 'standard' as const;

/** Every type in a quick check must be one that marks itself. */
export function isSelfMarking(type: QuestionType): boolean {
  return MINI_EVAL_TYPES.includes(type);
}

/** What an objective already carries about where it sits in the book. */
export interface ObjectiveLessonInfo {
  lessonId: string;
  lessonTitle: string;
  lessonTitleAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
}

export interface LessonGroup<T extends ObjectiveLessonInfo> {
  lessonId: string;
  lessonTitle: string;
  lessonTitleAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
  objectives: T[];
}

/**
 * A book's objectives, grouped under the lesson each belongs to.
 *
 * The picker used to be one flat list, so a teacher choosing "an objective"
 * could not see which lesson the quiz would be for — and the lesson is what the
 * mastery gate unlocks (it is derived from the objective, never chosen). Groups
 * come out in first-seen order, which for `getObjectivesForBook` is catalog
 * order (unit, then lesson, then objective); a lesson that reappears later in the
 * list joins its first group rather than splitting, so every objective is
 * listed exactly once.
 */
export function groupObjectivesByLesson<T extends ObjectiveLessonInfo>(
  objectives: readonly T[],
): LessonGroup<T>[] {
  const groups = new Map<string, LessonGroup<T>>();
  for (const o of objectives) {
    let g = groups.get(o.lessonId);
    if (!g) {
      g = {
        lessonId: o.lessonId,
        lessonTitle: o.lessonTitle,
        lessonTitleAr: o.lessonTitleAr,
        unitId: o.unitId,
        unitName: o.unitName,
        unitNameAr: o.unitNameAr,
        objectives: [],
      };
      groups.set(o.lessonId, g);
    }
    g.objectives.push(o);
  }
  return [...groups.values()];
}

/**
 * The student record's «تحقق سريع» opens here with an objective already chosen.
 * Only when its book is among the ones offered: a preset the screen cannot show
 * would leave a selected objective the teacher cannot see.
 */
export function miniEvalPreset(
  objectiveId: string | undefined,
  bookIds: readonly string[],
  lookup: (id: string) => { bookId: string } | undefined,
): { bookId: string; objectiveId: string } | null {
  if (!objectiveId) return null;
  const objective = lookup(objectiveId);
  if (!objective || !bookIds.includes(objective.bookId)) return null;
  return { bookId: objective.bookId, objectiveId };
}
