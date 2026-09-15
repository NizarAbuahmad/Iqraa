/**
 * Vocabulary drills built from the lesson's own words.
 *
 * Pure, so `node --test` can load it — the panel that renders these imports
 * `react-native` and therefore cannot be tested at all, which is exactly why
 * every decision worth checking lives here instead.
 *
 * Two rules shape all of it:
 *
 * **Distractors come from the same lesson.** Same topic, same register, same
 * book page — so a wrong option is plausible rather than absurd, and nothing is
 * invented. It is also the reason a lesson with fewer than four words shows no
 * drill: there is nothing to choose between, and padding from another lesson
 * would make "which of these did we just learn?" answerable by vocabulary
 * alone.
 *
 * **The shuffle is seeded by the word.** A student who retries sees the options
 * in the same order rather than a fresh arrangement each render, which is what
 * `Math.random()` would give on every re-render of a React list.
 */
import {
  MIN_DRILL_WORDS,
  vocabularyForLesson,
  type VocabularyWord,
} from '@workspace/curriculum/vocabulary';

/** Four options: enough that guessing is 25%, few enough to read on a phone. */
export const DRILL_OPTIONS = 4;

export type VocabularyDrillKind = 'gap_fill' | 'part_of_speech';

export interface VocabularyDrill {
  kind: VocabularyDrillKind;
  /** The word being asked about — also the stable key for React and for retries. */
  word: string;
  /** Gap-fill: the book sentence with the word replaced by a blank. */
  prompt: string;
  /** The printed page the sentence came from, shown as provenance. */
  page?: number;
  options: string[];
  answerIndex: number;
  ipa: string;
}

/** The blank a student sees in place of the word. */
export const BLANK = '————';

/**
 * A small deterministic hash, so option order is a function of the word.
 *
 * Not security, not distribution quality — only "the same word always shuffles
 * the same way". djb2 because it is four lines and everyone recognises it.
 */
function seedOf(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Fisher-Yates driven by a seeded LCG rather than `Math.random`. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Replace the word with a blank, keeping the rest of the sentence verbatim.
 *
 * Case-insensitive because the word may open the sentence, and bounded by `\b`
 * so "research" does not blank the middle of "researcher".
 */
export function blankOut(sentence: string, word: string): string {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return sentence.replace(re, BLANK);
}

function optionsFor(answer: string, pool: readonly string[], seed: number): string[] {
  const others = pool.filter(w => w.toLowerCase() !== answer.toLowerCase());
  const picked = seededShuffle(others, seed).slice(0, DRILL_OPTIONS - 1);
  return seededShuffle([answer, ...picked], seed + 1);
}

/**
 * Every drill this lesson can offer, in a stable order.
 *
 * Gap-fill first because it teaches the word in use; the part-of-speech items
 * follow for words the book gave a POS but no sentence. A word with neither
 * produces nothing rather than a weaker third drill — a scrambled-letters item
 * tests typing, not English.
 */
export function drillsForLesson(lessonId: string): VocabularyDrill[] {
  const words = vocabularyForLesson(lessonId);
  if (words.length < MIN_DRILL_WORDS) return [];

  const pool = words.map(w => w.word);
  const out: VocabularyDrill[] = [];

  for (const w of words) {
    if (!w.sentence) continue;
    const seed = seedOf(w.word);
    const options = optionsFor(w.word, pool, seed);
    out.push({
      kind: 'gap_fill',
      word: w.word,
      prompt: blankOut(w.sentence, w.word),
      page: w.sentencePage,
      options,
      answerIndex: options.indexOf(w.word),
      ipa: w.ipa,
    });
  }

  const posPool = [...new Set(words.map(w => w.pos).filter((p): p is string => !!p))];
  if (posPool.length >= 2) {
    for (const w of words) {
      if (w.sentence || !w.pos) continue;
      const seed = seedOf(w.word);
      const options = seededShuffle(posPool, seed).slice(0, Math.min(DRILL_OPTIONS, posPool.length));
      if (!options.includes(w.pos)) options[options.length - 1] = w.pos;
      const ordered = seededShuffle(options, seed + 1);
      out.push({
        kind: 'part_of_speech',
        word: w.word,
        prompt: w.word,
        options: ordered,
        answerIndex: ordered.indexOf(w.pos),
        ipa: w.ipa,
      });
    }
  }
  return out;
}

export function isDrillAnswerCorrect(drill: VocabularyDrill, picked: number): boolean {
  return picked === drill.answerIndex;
}

/** Words on this lesson, for the "see the list" half of the panel. */
export function wordListForLesson(lessonId: string): VocabularyWord[] {
  return vocabularyForLesson(lessonId);
}
