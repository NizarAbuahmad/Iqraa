/**
 * The English books' vocabulary, per lesson — the words a student is drilled on.
 *
 * Separate subpath, not re-exported from `index.ts`, for the same reason
 * `practice.ts` is: the manifest is safe to hand the client *because* nothing in
 * it grows with the library, and 730 words with example sentences grows.
 *
 * Imported rather than read with `node:fs`. `build.mjs` records what the fs
 * route costs under bundling — `import.meta.url` points at the bundle, the path
 * resolves to a `dist/data` nothing created, and the lookup returns "no words"
 * indistinguishably from a lesson that has none.
 *
 * **The answers are public, on purpose.** A drill built from these records
 * nothing, marks nothing and is retried freely, so there is no result to
 * protect — the same posture `practice_questions.json` takes. That also means
 * this file must never become the source of an exam: what is in the bundle is
 * readable by whoever wants to read it.
 */
import raw from './data/english_vocabulary.json' with { type: 'json' };
import { LESSONS } from './catalog.ts';

export interface VocabularyWord {
  /** The curriculum lesson this word is printed under, from the book's own `WL` marker. */
  lessonId: string;
  word: string;
  /** Part of speech where the book prints one — 545 of 730 do. */
  pos: string | null;
  /** IPA as printed, slashes included. */
  ipa: string;
  /** Verbatim book prose containing the word. Absent for two thirds of them. */
  sentence?: string;
  /** The printed page the sentence came from, so a student can go and read it. */
  sentencePage?: number;
}

export const ENGLISH_VOCABULARY: VocabularyWord[] = (raw as { words: VocabularyWord[] }).words;

/**
 * How many distinct words a drill needs before it can offer plausible options.
 *
 * Distractors come from the same lesson — same topic, same register, nothing
 * invented. Below four there is nothing to choose between, so the drill hides
 * rather than padding the options with words from somewhere else.
 */
export const MIN_DRILL_WORDS = 4;

export function vocabularyForLesson(lessonId: string): VocabularyWord[] {
  if (!lessonId) return [];
  return ENGLISH_VOCABULARY.filter(w => w.lessonId === lessonId);
}

/** Lessons with enough words to drill — what the client asks before rendering. */
export function lessonHasVocabularyDrill(lessonId: string): boolean {
  return vocabularyForLesson(lessonId).length >= MIN_DRILL_WORDS;
}

/**
 * Structural problems, as messages. Same posture as the other validators here:
 * this reports and the caller decides what is fatal.
 */
export function validateEnglishVocabulary(
  words: readonly VocabularyWord[] = ENGLISH_VOCABULARY,
): string[] {
  const errors: string[] = [];
  const lessonIds = new Set(LESSONS.map(l => l.id));
  const seen = new Set<string>();

  for (const w of words) {
    if (!lessonIds.has(w.lessonId)) {
      // The join is by `WL<unit>.<lesson>` against the catalog's own ids. A miss
      // means the book renumbered or the extractor's mapping drifted, and the
      // word would render on no lesson at all.
      errors.push(`${w.word}: names no lesson (${w.lessonId})`);
    }
    const key = `${w.lessonId}|${w.word.toLowerCase()}`;
    if (seen.has(key)) errors.push(`${w.word}: appears twice on ${w.lessonId}`);
    seen.add(key);

    if (!w.word.trim()) errors.push(`${w.lessonId}: a word is empty`);
    if (!w.ipa.startsWith('/') || !w.ipa.endsWith('/')) {
      errors.push(`${w.word}: ipa is not a /…/ transcription`);
    }
    if (w.sentence) {
      // The whole point of the sentence is that it shows the word in use. One
      // that does not contain it produces a gap-fill with no answer in it.
      const re = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!re.test(w.sentence)) errors.push(`${w.word}: its sentence does not contain it`);
      if (w.sentencePage === undefined) errors.push(`${w.word}: has a sentence but no page`);
    }
  }
  return errors;
}
