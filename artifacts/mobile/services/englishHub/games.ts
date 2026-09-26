/**
 * The English hub's four activities, as pure functions over a lesson's words.
 *
 * Pure so `node --test` can load it — the components that render these import
 * `react-native`. Every choice worth checking (what counts as a wrong option,
 * what counts as a correct spelling, how stars and streaks add up) lives here.
 *
 * Practice records nothing on the server (see `@workspace/curriculum/englishHub`);
 * the only memory is the student's own device, through `progress.ts`.
 */
import type { HubWord } from '@workspace/curriculum/englishHub';
import { sample, shuffle } from '../publicGames/rng.ts';

export type HubActivity = 'flashcards' | 'listen' | 'match' | 'spell' | 'scramble';
export const HUB_ACTIVITIES: HubActivity[] = ['flashcards', 'listen', 'match', 'spell', 'scramble'];

/** Enough to guess at 25%, few enough for a six-year-old to read. */
export const LISTEN_OPTIONS = 4;
/** Six pairs = twelve cards, which still fits a phone without scrolling. */
export const MATCH_PAIRS = 6;
/** A round is short on purpose: finishing is the reward at this age. */
export const ROUND_LENGTH = 8;

export interface ListenQuestion {
  word: HubWord;
  /** English words, one of which is `word.en`. */
  options: string[];
  answerIndex: number;
}

/**
 * Hear a word, pick it from four. Distractors come from the same lesson — the
 * same reason `vocabularyDrill.ts` gives: plausible, and nothing invented.
 */
export function buildListenRound(words: readonly HubWord[], rng: () => number = Math.random): ListenQuestion[] {
  return sample([...words], ROUND_LENGTH, rng).map(word => {
    const others = words.filter(w => w.en.toLowerCase() !== word.en.toLowerCase()).map(w => w.en);
    const options = shuffle([word.en, ...sample(others, LISTEN_OPTIONS - 1, rng)], rng);
    return { word, options, answerIndex: options.indexOf(word.en) };
  });
}

export interface MatchCard {
  id: string;
  text: string;
  lang: 'en' | 'ar';
  pairId: number;
}

/** English face-up against its Arabic meaning — the memory game, with words. */
export function buildMatchDeck(words: readonly HubWord[], rng: () => number = Math.random): MatchCard[] {
  const picked = sample([...words], MATCH_PAIRS, rng);
  const cards = picked.flatMap((w, pairId): MatchCard[] => [
    { id: `${pairId}-en`, text: w.en, lang: 'en', pairId },
    { id: `${pairId}-ar`, text: w.ar, lang: 'ar', pairId },
  ]);
  return shuffle(cards, rng);
}

export function isMatchPair(a: MatchCard, b: MatchCard): boolean {
  return a.id !== b.id && a.pairId === b.pairId;
}

/**
 * Words usable for a single-word round: no "put litter in the bin", which
 * tests typing a sentence, not a word. Shared by spelling and scrambling —
 * both fall back to the full lesson if too few single words survive the filter.
 */
function singleWordPool(words: readonly HubWord[]): HubWord[] {
  const single = words.filter(w => !w.en.trim().includes(' '));
  return single.length >= 4 ? single : [...words];
}

export function buildSpellRound(words: readonly HubWord[], rng: () => number = Math.random): HubWord[] {
  return sample(singleWordPool(words), ROUND_LENGTH, rng);
}

/**
 * Letters only, lower-cased. Capitals, spaces and the hyphen in "T-shirt" are
 * not what a Grade 2 spelling round is checking.
 */
export function normaliseSpelling(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, '');
}

export function isSpeltCorrectly(typed: string, word: string): boolean {
  const t = normaliseSpelling(typed);
  return t.length > 0 && t === normaliseSpelling(word);
}

// ─── Word scramble ──────────────────────────────────────────────────────────

export interface ScrambleTile {
  /** A stable key for React — index in the scrambled order, not the letter,
   *  since a word can repeat a letter ("puzzle" has two z's... no, but
   *  "little" has two t's and two l's). */
  id: number;
  letter: string;
}

export interface ScrambleQuestion {
  word: HubWord;
  /** The letters of `word.en` (lower-cased, hyphen/space stripped — same
   *  alphabet `normaliseSpelling` checks against), shuffled into tiles. */
  tiles: ScrambleTile[];
}

/**
 * A shuffle that is never already the answer. A one-letter or two-letter word
 * has few enough permutations that "shuffle until different" could spin for a
 * while, so it retries a bounded number of times and accepts the last attempt
 * rather than loop forever on "a" or "an" — a scramble of a single letter has
 * no wrong order anyway.
 */
function shuffledLetters(letters: string[], rng: () => number): string[] {
  const original = letters.join('');
  let attempt = letters;
  for (let i = 0; i < 8 && (attempt.join('') === original || attempt.length < 2); i += 1) {
    attempt = shuffle(letters, rng);
  }
  return attempt;
}

export function buildScrambleRound(words: readonly HubWord[], rng: () => number = Math.random): ScrambleQuestion[] {
  return sample(singleWordPool(words), ROUND_LENGTH, rng).map(word => {
    const letters = normaliseSpelling(word.en).split('');
    const scrambled = shuffledLetters(letters, rng);
    return { word, tiles: scrambled.map((letter, id) => ({ id, letter })) };
  });
}

/** Tiles read back in their current order, compared the same way typing is. */
export function isScrambleSolved(tiles: readonly ScrambleTile[], word: string): boolean {
  return isSpeltCorrectly(tiles.map(t => t.letter).join(''), word);
}

/** 3 stars at 90%+, 2 at 60%+, 1 for finishing at all. */
export function starsFor(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const r = correct / total;
  if (r >= 0.9) return 3;
  if (r >= 0.6) return 2;
  return 1;
}

// ─── Progress (device-local) ────────────────────────────────────────────────

export interface HubProgress {
  /** `${lessonId}|${activity}` → best stars ever. */
  stars: Record<string, number>;
  /** Consecutive days with at least one finished activity. */
  streak: number;
  /** Local calendar day (YYYY-MM-DD) of the last finished activity. */
  lastDay: string | null;
}

export const EMPTY_PROGRESS: HubProgress = { stars: {}, streak: 0, lastDay: null };

export function progressKey(lessonId: string, activity: HubActivity): string {
  return `${lessonId}|${activity}`;
}

/** Local date, not UTC: a streak breaks at the student's midnight, not London's. */
export function dayOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Keep the best stars, and extend, keep or restart the streak. */
export function recordResult(
  p: HubProgress,
  lessonId: string,
  activity: HubActivity,
  stars: number,
  today: string,
): HubProgress {
  const key = progressKey(lessonId, activity);
  const gap = p.lastDay ? daysBetween(p.lastDay, today) : null;
  const streak = gap === 0 ? p.streak : gap === 1 ? p.streak + 1 : 1;
  return {
    stars: { ...p.stars, [key]: Math.max(p.stars[key] ?? 0, stars) },
    streak,
    lastDay: today,
  };
}

/** The streak as shown: yesterday's still counts until today ends. */
export function currentStreak(p: HubProgress, today: string): number {
  if (!p.lastDay) return 0;
  return daysBetween(p.lastDay, today) <= 1 ? p.streak : 0;
}

/** Stars earned on a lesson across its activities (flashcards give none — nothing is tested). */
export function lessonStars(p: HubProgress, lessonId: string): number {
  return (['listen', 'match', 'spell', 'scramble'] as const).reduce((s, a) => s + (p.stars[progressKey(lessonId, a)] ?? 0), 0);
}

/** Tolerant parse: storage is the student's device, and old or corrupt data must not crash the hub. */
export function parseProgress(raw: string | null): HubProgress {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return EMPTY_PROGRESS;
    return {
      stars: v.stars && typeof v.stars === 'object' ? v.stars : {},
      streak: Number.isInteger(v.streak) && v.streak > 0 ? v.streak : 0,
      lastDay: typeof v.lastDay === 'string' ? v.lastDay : null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}
