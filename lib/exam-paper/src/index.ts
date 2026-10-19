/**
 * What a question paper has in common, whichever generator made it.
 *
 * The quiz (`/ai-tools/quiz`, a paper that stores nothing) and evaluations
 * (rows, a share link, marks) are two systems and stay two. They do share
 * these, which used to be copied by hand: the order a ministry paper puts its
 * question types in, and the inputs of the "one ask reworded" rule. Both the
 * API and the app import them, which is why they live in `lib/`.
 *
 * Not here, on purpose: the two ways of *grouping* repeats (`kindOf` in
 * `generationShape.ts` replaces past a third; `dominantKind` in `validator.ts`
 * warns past a quarter) and anything about prompts. See the spec,
 * `docs/superpowers/specs/2026-10-18-exam-paper-core-design.md`, decision 3.
 */
import { sameKind } from '@workspace/math-practice';

/**
 * The order a ministry exam puts its question types in: choice, then صح/خطأ,
 * matching, complete, then the written answers, then the practical. A type
 * this list does not know sorts last, not first (`inPaperOrder`).
 */
export const EXAM_TYPE_ORDER: readonly string[] = [
  'multiple_choice', 'true_false', 'matching', 'fill_blank',
  'short_answer', 'open_ended', 'problem_solving', 'practical_task',
  'read_aloud', 'dictation',
];

/**
 * The types a quiz can hold. `normalizeQuiz` drops any question whose type is
 * not one of these, so changing this list changes what a quiz keeps.
 */
export const QUIZ_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

/** The quiz's order: the exam order, restricted to the quiz's types. */
export const QUIZ_TYPE_ORDER: readonly QuizType[] = EXAM_TYPE_ORDER.filter(
  (t): t is QuizType => (QUIZ_TYPES as readonly string[]).includes(t),
);

/** Rank of a type; a type this list does not know sorts last rather than first. */
function rank(type: string): number {
  const i = EXAM_TYPE_ORDER.indexOf(type);
  return i === -1 ? EXAM_TYPE_ORDER.length : i;
}

/**
 * A new array grouped into ministry blocks; the input is not touched. Stable
 * within a type, so the generator's own sequence (and which questions a surplus
 * trim dropped) is untouched.
 */
export function inPaperOrder<T>(items: readonly T[], typeOf: (item: T) => string): T[] {
  return items
    .map((item, i) => ({ item, i, r: rank(typeOf(item)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}

/**
 * Words a reworded ask may change, whatever its length. A paper's stems can
 * quote a whole objective, and 37% of thirty words is a different instruction
 * in front of the same quote, so the cap stays at three (see `sameKind`).
 * Measured 2026-10-17.
 */
export const MAX_WORDS_CHANGED = 3;

/** A stem that is only symbols («٣ + ٤ = ؟») has no sentence to share and is not counted as a kind. */
export function hasSentence(frame: string): boolean {
  return /\p{L}/u.test(frame);
}

/** Whether two `stemFrame`s are one ask, reworded or with other numbers, capped at `MAX_WORDS_CHANGED`. */
export function sameAsk(frameA: string, frameB: string): boolean {
  return sameKind(frameA, frameB, MAX_WORDS_CHANGED);
}
