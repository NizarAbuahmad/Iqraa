/**
 * Read-aloud practice passages — the words a student is asked to read.
 *
 * Separate from the resource manifest on purpose. `external.ts` is metadata:
 * ids, licences, credits, R2 keys, and it is re-exported from `index.ts`
 * *because* nothing in it grows with the size of the library. Passage prose is
 * content, so it lives here, behind its own subpath, the way `passages.ts`
 * keeps the extracted book text out of the app bundle.
 *
 * Unlike `passages.ts` this imports its JSON rather than reading it with
 * `node:fs`. That is deliberate: `build.mjs` records what happens when a
 * bundled module computes a data path from `import.meta.url` — esbuild
 * collapses every module into one file, the path resolves to a `dist/data`
 * that nothing created, and the lookup fails `existsSync` and returns "no
 * text" in a way indistinguishable from a source that genuinely has none.
 * An import is inlined at build time and cannot drift that way.
 *
 * **Every passage must be reproducible.** A practice passage is displayed in
 * full and read aloud, so the licence has to permit reproduction — checked
 * twice: `validateExternalResources` refuses the `readAloudPractice` flag on
 * anything `usePolicy` does not call quotable, and `validatePracticePassages`
 * below refuses a passage whose resource is missing or unflagged.
 */
import raw from './data/practice_passages.json' with { type: 'json' };
import rawQuestions from './data/practice_questions.json' with { type: 'json' };
import { EXTERNAL_RESOURCES, getExternalResource } from './external.ts';

/**
 * Word bounds for a passage.
 *
 * The ceiling is set by the recording limit, not by taste: the upload route
 * stops a recording at 120 seconds, and read-aloud speech runs about 130
 * words a minute, so anything past ~150 words guarantees a student is cut off
 * mid-passage and scored on a fragment. The floor is where a single
 * mispronounced word stops swinging the percentage wildly.
 *
 * Note the three VOA articles already in the manifest run 375, 900 and 1100
 * words — full articles are reference material, not practice passages. An
 * excerpt has to be chosen.
 */
export const MIN_PRACTICE_WORDS = 60;
export const MAX_PRACTICE_WORDS = 150;

export interface PracticePassage {
  /** The `ExternalResource` this came from; carries the licence and credit. */
  resourceId: string;
  /** The words on screen, verbatim from a source that permits reproduction. */
  passage: string;
  /** CEFR band, stated by the curator rather than inferred. */
  level?: 'a1' | 'a2' | 'b1' | 'b2' | 'c1';
}

export const PRACTICE_PASSAGES: PracticePassage[] = raw.passages as PracticePassage[];

export function countPassageWords(passage: string): number {
  return passage.trim().split(/\s+/).filter(Boolean).length;
}

export function getPracticePassage(resourceId: string): PracticePassage | undefined {
  return PRACTICE_PASSAGES.find(p => p.resourceId === resourceId);
}

/** Every passage curated onto one lesson, via its resource. */
export function practicePassagesForLesson(lessonId: string): PracticePassage[] {
  if (!lessonId) return [];
  return PRACTICE_PASSAGES.filter(p => {
    const resource = getExternalResource(p.resourceId);
    return Boolean(resource?.lessonIds.includes(lessonId));
  });
}

/**
 * Structural problems that make a passage unusable, as messages.
 *
 * Same posture as `validateExternalResources`: this reports and the caller
 * decides what is fatal.
 */
export function validatePracticePassages(
  passages: readonly PracticePassage[] = PRACTICE_PASSAGES,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const p of passages) {
    if (seen.has(p.resourceId)) errors.push(`${p.resourceId}: two passages for one resource`);
    seen.add(p.resourceId);

    const resource = getExternalResource(p.resourceId);
    if (!resource) {
      // An orphan passage renders with no credit at all, which is the one
      // thing every licence here requires.
      errors.push(`${p.resourceId}: names no resource, so it has no licence or attribution`);
      continue;
    }
    if (!resource.readAloudPractice) {
      errors.push(`${p.resourceId}: has a passage but the resource is not flagged readAloudPractice`);
    }

    const words = countPassageWords(p.passage);
    if (words < MIN_PRACTICE_WORDS || words > MAX_PRACTICE_WORDS) {
      errors.push(
        `${p.resourceId}: ${words} words, outside ${MIN_PRACTICE_WORDS}–${MAX_PRACTICE_WORDS}`,
      );
    }
  }

  // The other direction, and the one that actually bites: a resource flagged
  // for practice with no passage behind it puts a card on the lesson page that
  // opens onto nothing. The flag and the prose live in two files, so they can
  // only be kept in step by checking.
  for (const r of EXTERNAL_RESOURCES) {
    if (r.readAloudPractice && !passages.some(p => p.resourceId === r.id)) {
      errors.push(`${r.id}: flagged readAloudPractice but no passage exists`);
    }
  }
  return errors;
}

/**
 * Comprehension questions on a practice passage.
 *
 * **The answers ship to the client, deliberately.** Practice records nothing —
 * no attempt row, no mark, no competency — so a visible key corrupts no result;
 * a student who reads it instead of the passage has skipped their own practice
 * and nothing else. That is only true *because* nothing is recorded, which is
 * why these items must never source an exam: an answer key reaching a client is
 * exactly what `sanitizeForStudent` in the api-server's `questionTypes.ts`
 * exists to prevent.
 *
 * Graded here rather than by `QUESTION_TYPES`. For these two kinds the check is
 * an equality test, so a route would buy no correctness — and it would buy
 * nothing at all in practice, because the API cannot currently deploy: the
 * revision serving production predates `/practice/read-aloud`, which is why
 * read-aloud practice renders and does not work. A drill graded in the browser
 * ships over the air with everything else.
 */
export type PracticeQuestionKind = 'multiple_choice' | 'true_false';

export interface PracticeQuestion {
  /** The passage this asks about; also carries the licence and the credit. */
  resourceId: string;
  kind: PracticeQuestionKind;
  stem: string;
  /** Multiple choice only. At least three, all distinct. */
  options?: string[];
  /** Multiple choice only: index into `options`. */
  answerIndex?: number;
  /** True/false only. */
  answer?: boolean;
}

/** Below this a "multiple" choice is a coin toss. Matches the api-server's rule. */
const MIN_OPTIONS = 3;

export const PRACTICE_QUESTIONS: PracticeQuestion[] =
  rawQuestions.questions as PracticeQuestion[];

export function practiceQuestionsForResource(resourceId: string): PracticeQuestion[] {
  if (!resourceId) return [];
  return PRACTICE_QUESTIONS.filter(q => q.resourceId === resourceId);
}

/** True when the given answer is the right one. `picked` is an index, or a boolean. */
export function isPracticeAnswerCorrect(
  question: PracticeQuestion,
  picked: number | boolean,
): boolean {
  return question.kind === 'true_false'
    ? typeof picked === 'boolean' && picked === question.answer
    : typeof picked === 'number' && picked === question.answerIndex;
}

/**
 * Structural problems that make a question unusable, as messages.
 *
 * Same posture as the passage validator: reports, and the caller decides what
 * is fatal.
 */
export function validatePracticeQuestions(
  questions: readonly PracticeQuestion[] = PRACTICE_QUESTIONS,
  passages: readonly PracticePassage[] = PRACTICE_PASSAGES,
): string[] {
  const errors: string[] = [];

  for (const [i, q] of questions.entries()) {
    const at = `question ${i + 1} (${q.resourceId})`;
    if (!q.stem.trim()) errors.push(`${at}: empty stem`);

    // A question may only exist where the words it asks about are on screen. No
    // passage means the student is being asked about text they cannot see, and
    // an unflagged resource means the licence was never checked for showing it.
    const resource = getExternalResource(q.resourceId);
    if (!resource) {
      errors.push(`${at}: names no resource`);
    } else if (!resource.readAloudPractice) {
      errors.push(`${at}: resource is not flagged readAloudPractice`);
    }
    if (!passages.some(p => p.resourceId === q.resourceId)) {
      errors.push(`${at}: no passage, so the answer is not on screen`);
    }

    if (q.kind === 'multiple_choice') {
      const options = q.options ?? [];
      if (options.length < MIN_OPTIONS) errors.push(`${at}: ${options.length} options, needs ${MIN_OPTIONS}`);
      if (options.some(o => !o.trim())) errors.push(`${at}: an option is empty`);
      if (new Set(options).size !== options.length) errors.push(`${at}: duplicate options`);
      if (q.answerIndex === undefined || q.answerIndex < 0 || q.answerIndex >= options.length) {
        errors.push(`${at}: answerIndex ${q.answerIndex} is outside the options`);
      }
      if (q.answer !== undefined) errors.push(`${at}: multiple choice carries a true/false answer`);
    } else {
      if (typeof q.answer !== 'boolean') errors.push(`${at}: true/false answer is not a boolean`);
      if (q.options !== undefined) errors.push(`${at}: true/false carries options`);
    }
  }
  return errors;
}
