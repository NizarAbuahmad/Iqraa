/**
 * The English hub's activities, as pure functions over a lesson's words.
 *
 * Pure so `node --test` can load it — the components that render these import
 * `react-native`. Every choice worth checking (what counts as a wrong option,
 * what counts as a correct spelling, how stars and streaks add up) lives here.
 *
 * Practice records nothing on the server (see `@workspace/curriculum/englishHub`);
 * the only memory is the student's own device, through `progress.ts`.
 */
import type { GrammarMarker, GrammarSentence } from '@workspace/curriculum/englishGrammar';
import type { HubWord } from '@workspace/curriculum/englishHub';
import { firstSound } from '@workspace/curriculum/englishReading';
import { isPicturable, wordPicture } from '@workspace/curriculum/englishPictures';
import { sample, shuffle } from '../publicGames/rng.ts';

export { isPicturable, wordPicture };

export type HubActivity =
  | 'flashcards' | 'listen' | 'match' | 'spell' | 'scramble' | 'picture' | 'speaking'
  | 'grammar-choose' | 'grammar-build' | 'grammar-true' | 'grammar-yesno'
  | 'read-find' | 'first-letter' | 'starts-with';
/** The vocabulary activities, offered on every lesson. */
export const HUB_ACTIVITIES: HubActivity[] = ['flashcards', 'listen', 'match', 'spell', 'scramble', 'picture', 'speaking'];
/** The grammar activities, offered only on a lesson whose unit a teacher has reviewed (`offeredGrammar`). */
export const GRAMMAR_ACTIVITIES: HubActivity[] = ['grammar-choose', 'grammar-build', 'grammar-true', 'grammar-yesno'];
/** The reading activities, offered only on a Grade 1 lesson whose unit a teacher has reviewed (`offeredReading`). */
export const READING_ACTIVITIES: HubActivity[] = ['read-find', 'first-letter', 'starts-with'];

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

export interface MatchColumns {
  en: MatchCard[];
  ar: MatchCard[];
}

/**
 * Two columns of cards, each in its own random order, where no row faces its
 * own match. Both matching games use it: one mixed grid confused Grade 1
 * pupils (a teacher's review, 2026-10-15), and a column per side says which
 * side a card belongs to before the child has read it.
 *
 * Two independent shuffles will sometimes put a pair on the same row, and side
 * by side that is the answer handed over. So: reshuffle the right column a few
 * times, and if that keeps failing fall back to the left order rotated by one,
 * which cannot line up for two or more pairs. Lessons always have at least
 * `MIN_HUB_WORDS`.
 */
function columnsWithNoGiveaway<T extends { pairId: number }>(
  leftCards: T[],
  rightCards: T[],
  rng: () => number,
): { left: T[]; right: T[] } {
  const left = shuffle(leftCards, rng);
  const faced = (right: T[]) => right.some((c, row) => c.pairId === left[row].pairId);
  let right = shuffle(rightCards, rng);
  for (let tries = 0; tries < 20 && faced(right); tries += 1) right = shuffle(rightCards, rng);
  if (faced(right) && left.length > 1) {
    const byPair = new Map(rightCards.map(c => [c.pairId, c]));
    right = left.map((_, row) => byPair.get(left[(row + 1) % left.length].pairId)!);
  }
  return { left, right };
}

/**
 * English in one column, its Arabic meanings in the other — "match the
 * meaning" as a student expects to read it. (This was a single shuffled grid,
 * memory-game style, so a word's two halves could land in either column.)
 */
export function buildMatchColumns(words: readonly HubWord[], rng: () => number = Math.random): MatchColumns {
  const picked = sample([...words], MATCH_PAIRS, rng);
  const { left, right } = columnsWithNoGiveaway(
    picked.map((w, pairId): MatchCard => ({ id: `${pairId}-en`, text: w.en, lang: 'en', pairId })),
    picked.map((w, pairId): MatchCard => ({ id: `${pairId}-ar`, text: w.ar, lang: 'ar', pairId })),
    rng,
  );
  return { en: left, ar: right };
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

// ─── Picture matching ───────────────────────────────────────────────────────

// The curated pictures (`wordPicture`) live in `@workspace/curriculum/englishPictures`,
// so the grammar generator and its teacher's sheet use the same ones.

const MIN_PICTURE_WORDS = 4;


export interface PictureCard {
  id: string;
  /** Which face is shown — the emoji, or the English word it stands for. */
  kind: 'emoji' | 'word';
  text: string;
  pairId: number;
}

/** Same layout as `buildMatchColumns`: pictures in one column, English words in the other. */
export function buildPictureBoard(words: readonly HubWord[], rng: () => number = Math.random): { pictures: PictureCard[]; words: PictureCard[] } {
  const picturable = words.filter(w => isPicturable(w.en));
  const picked = sample(picturable, MATCH_PAIRS, rng);
  const { left, right } = columnsWithNoGiveaway(
    picked.map((w, pairId): PictureCard => ({ id: `${pairId}-emoji`, kind: 'emoji', text: wordPicture(w.en)!, pairId })),
    picked.map((w, pairId): PictureCard => ({ id: `${pairId}-word`, kind: 'word', text: w.en, pairId })),
    rng,
  );
  return { pictures: left, words: right };
}

export function isPictureMatch(a: PictureCard, b: PictureCard): boolean {
  return a.id !== b.id && a.pairId === b.pairId;
}

/** Whether a lesson has enough picturable words to offer this activity at all. */
export function lessonHasPictureMatch(words: readonly HubWord[]): boolean {
  return words.filter(w => isPicturable(w.en)).length >= MIN_PICTURE_WORDS;
}

// ─── Speaking ───────────────────────────────────────────────────────────────

/**
 * Same word pool as spelling — single words only, since a sentence is a
 * Story Time concern, not a vocabulary-drill one. Kept as its own named
 * function (not an alias for `buildSpellRound`) because the two are only
 * coincidentally the same selection today; a future reason to diverge
 * (skip words that are hard to hear the difference on when spoken, say)
 * shouldn't have to un-couple them from a shared name first.
 */
export function buildSpeakingRound(words: readonly HubWord[], rng: () => number = Math.random): HubWord[] {
  return sample(singleWordPool(words), ROUND_LENGTH, rng);
}

// ─── Grammar (Grade 1) ──────────────────────────────────────────────────────
//
// The sentences come from `@workspace/curriculum/englishGrammar`, generated from
// the book's patterns. These builders do not gate on a teacher's review — the
// lesson screen asks `offeredGrammar`, which returns nothing for an unreviewed unit.

/** A sentence of more tiles than this is too long for a Grade 1 child to order. */
export const MAX_BUILD_TILES = 7;
/** Below this many usable sentences a round would repeat itself; the card is not shown. */
const MIN_GRAMMAR_SENTENCES = 4;

export interface ChooseQuestion {
  sentence: GrammarSentence;
  /** The right option and its contrast, in a random order. */
  options: string[];
  answerIndex: number;
}

export function buildChooseRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): ChooseQuestion[] {
  return sample(sentences.filter(s => s.choose), ROUND_LENGTH, rng).map(sentence => {
    const { right, wrong } = sentence.choose!;
    const answerIndex = rng() < 0.5 ? 0 : 1;
    return { sentence, options: answerIndex === 0 ? [right, wrong] : [wrong, right], answerIndex };
  });
}

export interface BuildTile {
  /** Position in the shuffled tray — a sentence can repeat a word, so the text is not a key. */
  id: number;
  text: string;
}

export interface BuildQuestion {
  sentence: GrammarSentence;
  tiles: BuildTile[];
}

/** `shuffledLetters` for words: a shuffle that is not already the sentence, when it can be. */
function shuffledTokens(tokens: readonly string[], rng: () => number): string[] {
  const original = tokens.join(' ');
  let attempt = [...tokens];
  for (let i = 0; i < 8 && (attempt.join(' ') === original && tokens.length >= 2); i += 1) {
    attempt = shuffle([...tokens], rng);
  }
  return attempt;
}

function buildable(s: GrammarSentence): boolean {
  return s.tokens.length >= 2 && s.tokens.length <= MAX_BUILD_TILES;
}

export function buildSentenceRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): BuildQuestion[] {
  return sample(sentences.filter(buildable), ROUND_LENGTH, rng).map(sentence => ({
    sentence,
    tiles: shuffledTokens(sentence.tokens, rng).map((text, id) => ({ id, text })),
  }));
}

/** The tiles placed so far, read in order, are the whole sentence. */
export function isSentenceBuilt(tiles: readonly { text: string }[], sentence: GrammarSentence): boolean {
  return tiles.map(t => t.text).join(' ') === sentence.text;
}

export interface TrueFalseQuestion {
  sentence: GrammarSentence;
  /** The word whose picture is shown — the sentence's own, or another of the same slot. */
  pictureWord: string;
  isTrue: boolean;
}

function judgeable(s: GrammarSentence): boolean {
  return Boolean(s.picture && s.falsePicture);
}

/** Half the round (rounded up) is true, the rest false, then the order is shuffled. */
export function buildTrueFalseRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): TrueFalseQuestion[] {
  const picked = sample(sentences.filter(judgeable), ROUND_LENGTH, rng);
  const trueCount = Math.ceil(picked.length / 2);
  return shuffle(
    picked.map((sentence, i): TrueFalseQuestion => {
      const isTrue = i < trueCount;
      return { sentence, isTrue, pictureWord: isTrue ? sentence.picture!.word : sentence.falsePicture! };
    }),
    rng,
  );
}

// ─── Yes or No (Grade 2) ────────────────────────────────────────────────────

export interface YesNoQuestion {
  sentence: GrammarSentence;
  picture: { word: string; count: 1 | 2 };
  marker: GrammarMarker | null;
  kind: 'match' | 'marker';
  /** What the child is asked, in English. */
  question: string;
  /** True when the right answer is «yes». */
  answer: boolean;
  yes: string;
  no: string;
}

function yesNoUsable(s: GrammarSentence): boolean {
  return s.yesNo !== null && s.picture !== null;
}

function yesNoItem(s: GrammarSentence, question: string, answer: boolean): YesNoQuestion {
  const y = s.yesNo!;
  return { sentence: s, picture: s.picture!, marker: s.marker, kind: y.kind, question, answer, yes: y.yes, no: y.no };
}

/** The whole exchange, spoken once the child has answered: a string `allGrammarSpoken` lists. */
export function yesNoExchange(q: YesNoQuestion): string {
  return `${q.question} ${q.answer ? q.yes : q.no}`;
}

/**
 * Half the round (rounded up) answers «yes», the rest «no», then shuffled. A `match` sentence gives
 * a Yes item (the question names its picture) and a No item (it names the next pictured word); a
 * `marker` sentence gives the one item its ✅ / ❌ decides. The same picture is not asked twice
 * (cheese ✅ and cheese ❌ would be two questions about one picture).
 */
export function buildYesNoRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): YesNoQuestion[] {
  const yesItems: YesNoQuestion[] = [];
  const noItems: YesNoQuestion[] = [];
  for (const s of sentences.filter(yesNoUsable)) {
    const y = s.yesNo!;
    if (y.kind === 'match') {
      yesItems.push(yesNoItem(s, y.question, true));
      if (y.otherQuestion) noItems.push(yesNoItem(s, y.otherQuestion, false));
    } else {
      (y.answer ? yesItems : noItems).push(yesNoItem(s, y.question, y.answer));
    }
  }
  const wantYes = Math.ceil(ROUND_LENGTH / 2);
  const wantNo = ROUND_LENGTH - wantYes;
  const yes = sample(yesItems, wantYes, rng);
  const taken = new Set(yes.map(q => q.picture.word));
  const fresh = noItems.filter(q => !taken.has(q.picture.word));
  const no = sample(fresh.length >= wantNo ? fresh : noItems, wantNo, rng);
  return shuffle([...yes, ...no], rng);
}

export function isYesNoRight(q: YesNoQuestion, saidYes: boolean): boolean {
  return saidYes === q.answer;
}

export function grammarActivityAvailable(activity: HubActivity, sentences: readonly GrammarSentence[]): boolean {
  const usable =
    activity === 'grammar-choose' ? sentences.filter(s => s.choose)
      : activity === 'grammar-build' ? sentences.filter(buildable)
        : activity === 'grammar-true' ? sentences.filter(judgeable)
          : activity === 'grammar-yesno' ? sentences.filter(yesNoUsable)
            : [];
  return usable.length >= MIN_GRAMMAR_SENTENCES;
}

// ─── Reading (Grade 1) ──────────────────────────────────────────────────────
//
// The words are the lesson's own. These builders do not gate on a teacher's
// review — the lesson screen asks `offeredReading`. A word's first sound comes
// from `firstSound` in `@workspace/curriculum/englishReading`, never from here.

/** Three, not four: a six-year-old reading, not guessing. */
export const READING_OPTIONS = 3;
/** Letters a First letter question is padded with when its lesson has too few of its own. */
const PAD_LETTERS = ['b', 'd', 'f', 'h', 'l', 'm', 'n', 'p', 'r', 's', 't'];
/** Shapes a six-year-old confuses: side by side they test eyesight, not hearing. */
const MIRROR: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };
const MIN_FIRST_SOUND_WORDS = 4;
const MIN_STARTS_WITH_LETTERS = 3;

export interface ReadFindQuestion {
  word: HubWord;
  /** English words, each with its own picture; one is `word.en`. */
  options: string[];
  answerIndex: number;
}

/** Read the printed word, tap its picture. Pictures are distinct, so no option shows the answer's. */
export function buildReadFindRound(words: readonly HubWord[], rng: () => number = Math.random): ReadFindQuestion[] {
  const pool = words.filter(w => isPicturable(w.en));
  return sample(pool, ROUND_LENGTH, rng).map(word => {
    const others = pool.filter(w => wordPicture(w.en) !== wordPicture(word.en)).map(w => w.en);
    const options = shuffle([word.en, ...sample(others, READING_OPTIONS - 1, rng)], rng);
    return { word, options, answerIndex: options.indexOf(word.en) };
  });
}

export interface FirstLetterQuestion {
  word: HubWord;
  /** Single lower-case letters; one is the word's first sound. */
  options: string[];
  answerIndex: number;
}

/** The two wrong letters: the lesson's own first letters first, then the pad — never a mirror of one already chosen. */
function letterDistractors(answer: string, lessonLetters: readonly string[], rng: () => number): string[] {
  const picked = [answer];
  for (const c of [...shuffle([...lessonLetters], rng), ...shuffle(PAD_LETTERS, rng)]) {
    if (picked.length === READING_OPTIONS) break;
    if (!picked.includes(c) && !picked.includes(MIRROR[c])) picked.push(c);
  }
  return picked.slice(1);
}

/** Hear the word (and see its picture, when it has one), tap the letter it starts with. */
export function buildFirstLetterRound(words: readonly HubWord[], rng: () => number = Math.random): FirstLetterQuestion[] {
  const pool = words.filter(w => firstSound(w.en));
  const lessonLetters = [...new Set(pool.map(w => firstSound(w.en)!))];
  return sample(pool, ROUND_LENGTH, rng).map(word => {
    const answer = firstSound(word.en)!;
    const options = shuffle([answer, ...letterDistractors(answer, lessonLetters, rng)], rng);
    return { word, options, answerIndex: options.indexOf(answer) };
  });
}

export interface StartsWithQuestion {
  /** The letter shown, lower-case — `firstSound(word.en)`. */
  letter: string;
  word: HubWord;
  /** English words, each pictured; no two start with the same sound. */
  options: string[];
  answerIndex: number;
}

function startsWithPool(words: readonly HubWord[]): HubWord[] {
  return words.filter(w => isPicturable(w.en) && firstSound(w.en));
}

/** See a letter, tap the picture whose word starts with it. Exactly one option does. */
export function buildStartsWithRound(words: readonly HubWord[], rng: () => number = Math.random): StartsWithQuestion[] {
  const pool = startsWithPool(words);
  return sample(pool, ROUND_LENGTH, rng).flatMap(word => {
    const letter = firstSound(word.en)!;
    const seen = [letter];
    const chosen: HubWord[] = [];
    for (const w of shuffle(pool, rng)) {
      if (chosen.length === READING_OPTIONS - 1) break;
      const l = firstSound(w.en)!;
      if (!seen.includes(l)) {
        seen.push(l);
        chosen.push(w);
      }
    }
    // Unreachable while `readingActivityAvailable` holds: three letters leave two others for any answer.
    if (chosen.length < READING_OPTIONS - 1) return [];
    const options = shuffle([word.en, ...chosen.map(c => c.en)], rng);
    return [{ letter, word, options, answerIndex: options.indexOf(word.en) }];
  });
}

export function readingActivityAvailable(activity: HubActivity, words: readonly HubWord[]): boolean {
  if (activity === 'read-find') return lessonHasPictureMatch(words);
  if (activity === 'first-letter') return words.filter(w => firstSound(w.en)).length >= MIN_FIRST_SOUND_WORDS;
  if (activity === 'starts-with') return new Set(startsWithPool(words).map(w => firstSound(w.en))).size >= MIN_STARTS_WITH_LETTERS;
  return false;
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
  /** Consecutive days with at least one finished activity. Resets on a missed day. */
  streak: number;
  /** The highest `streak` ever reached — never decreases. What streak badges check:
   *  an achievement earned once must survive a later missed day, unlike the display streak. */
  bestStreak: number;
  /** Local calendar day (YYYY-MM-DD) of the last finished activity. */
  lastDay: string | null;
}

export const EMPTY_PROGRESS: HubProgress = { stars: {}, streak: 0, bestStreak: 0, lastDay: null };

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
    bestStreak: Math.max(p.bestStreak, streak),
    lastDay: today,
  };
}

/** The streak as shown: yesterday's still counts until today ends. */
export function currentStreak(p: HubProgress, today: string): number {
  if (!p.lastDay) return 0;
  return daysBetween(p.lastDay, today) <= 1 ? p.streak : 0;
}

/** Every activity a finished round can earn stars on — flashcards and speaking give none (nothing is scored). */
const SCORED_ACTIVITIES = [
  'listen', 'match', 'spell', 'scramble', 'picture', 'grammar-choose', 'grammar-build', 'grammar-true', 'grammar-yesno',
  'read-find', 'first-letter', 'starts-with',
] as const;

/** Stars earned on a lesson across its activities. */
export function lessonStars(p: HubProgress, lessonId: string): number {
  return SCORED_ACTIVITIES.reduce((s, a) => s + (p.stars[progressKey(lessonId, a)] ?? 0), 0);
}

/** Tolerant parse: storage is the student's device, and old or corrupt data must not crash the hub. */
export function parseProgress(raw: string | null): HubProgress {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return EMPTY_PROGRESS;
    const streak = Number.isInteger(v.streak) && v.streak > 0 ? v.streak : 0;
    // `bestStreak` is new: a device with an older stored record has no field to
    // read, so its current streak is the best lower bound we can assume — never
    // invents a badge that wasn't actually earned, at worst under-credits by one
    // read (the very next `recordResult` catches it back up to `streak`).
    const storedBest = Number.isInteger(v.bestStreak) && v.bestStreak > 0 ? v.bestStreak : 0;
    return {
      stars: v.stars && typeof v.stars === 'object' ? v.stars : {},
      streak,
      bestStreak: Math.max(storedBest, streak),
      lastDay: typeof v.lastDay === 'string' ? v.lastDay : null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

// ─── Badges ──────────────────────────────────────────────────────────────────

/**
 * Every badge is a threshold over `HubProgress` alone — no new storage, and
 * nothing a badge checks is specific to today's set of activities. Adding a
 * sixth or seventh activity later changes nothing here: `totalStars`/
 * `lessonsTouched` sum over whatever keys exist, not a hardcoded count, so a
 * badge earned today stays earned and a new activity doesn't need its own
 * badge threshold rewritten in.
 */
export type BadgeId =
  | 'first_star'
  | 'perfect_round'
  | 'three_day_streak'
  | 'week_streak'
  | 'ten_stars'
  | 'fifty_stars'
  | 'five_lessons';

/** Display order, easiest first — matches the order a student is likely to earn them in. */
export const BADGE_IDS: BadgeId[] = [
  'first_star', 'perfect_round', 'ten_stars', 'three_day_streak', 'five_lessons', 'week_streak', 'fifty_stars',
];

function totalStars(p: HubProgress): number {
  return Object.values(p.stars).reduce((sum, s) => sum + s, 0);
}

/** Distinct lessons with any progress at all, regardless of which activity. */
function lessonsTouched(p: HubProgress): number {
  return new Set(Object.keys(p.stars).map(k => k.split('|')[0])).size;
}

/**
 * Badges once earned never disappear — the streak badges check `bestStreak`,
 * never `streak` (which resets on a missed day) or `currentStreak`'s decayed
 * display value. A missed day should cost the streak display, not retroactively
 * un-earn an achievement.
 */
export function badgesEarned(p: HubProgress): BadgeId[] {
  const earned: BadgeId[] = [];
  if (Object.keys(p.stars).length > 0) earned.push('first_star');
  if (Object.values(p.stars).some(s => s >= 3)) earned.push('perfect_round');
  if (totalStars(p) >= 10) earned.push('ten_stars');
  if (p.bestStreak >= 3) earned.push('three_day_streak');
  if (lessonsTouched(p) >= 5) earned.push('five_lessons');
  if (p.bestStreak >= 7) earned.push('week_streak');
  if (totalStars(p) >= 50) earned.push('fifty_stars');
  return earned;
}

/** What a finish just unlocked — the diff, not the full set, so the UI can celebrate only what's new. */
export function newlyEarnedBadges(before: HubProgress, after: HubProgress): BadgeId[] {
  const had = new Set(badgesEarned(before));
  return badgesEarned(after).filter(b => !had.has(b));
}
