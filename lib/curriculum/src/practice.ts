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
