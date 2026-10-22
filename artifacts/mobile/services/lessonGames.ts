/**
 * Lesson games — built from a lesson's own key terms (`keywordsAr`), so no AI
 * and no new content. Only ~15% of lessons carry ≥4 terms, and the English
 * `keywords` list is almost always the Arabic copied (2026-10-22 survey), so
 * every game here is Arabic-term-only and offered only where a lesson has
 * `MIN_LESSON_TERMS`. Three games:
 *  - memory: flip pairs of the lesson's terms;
 *  - scramble: rebuild a term from its shuffled letters;
 *  - spot: pick the term that belongs to this lesson among terms from other
 *    lessons of the same book.
 */
import { getLessonsForUnit, getUnitById, getUnitsForBook, type Lesson } from '@workspace/curriculum';
import { sample, shuffle } from './publicGames/rng.ts';
import type { TriviaOption } from './publicGames/countries.ts';

export const MIN_LESSON_TERMS = 4;
export const LESSON_GAME_ROUND = 6;
export type LessonGame = 'memory' | 'scramble' | 'spot';
export const LESSON_GAMES: LessonGame[] = ['memory', 'scramble', 'spot'];

const HARAKAT = /[ً-ْٰـ]/g;
const ARABIC = /[؀-ۿ]/;
const ARABIC_LETTERS = /^[ء-ي]+$/;
/** Longer terms make a tile tray too wide to read on a phone. */
const MAX_SCRAMBLE_LETTERS = 12;

/** A term without harakat/tatweel and with single spaces — what "the same term" means. */
export function plainTerm(term: string): string {
  return term.replace(HARAKAT, '').replace(/\s+/g, ' ').trim();
}

/** The lesson's distinct Arabic key terms, as printed (harakat kept for display). */
export function lessonTerms(lesson: Lesson): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lesson.keywordsAr ?? []) {
    const term = raw.trim();
    const key = plainTerm(term);
    if (key.length < 2 || !ARABIC.test(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export function hasLessonGames(lesson: Lesson): boolean {
  return lessonTerms(lesson).length >= MIN_LESSON_TERMS;
}

// ─── Scramble ───────────────────────────────────────────────────────────────

export interface TermTile { id: number; letter: string }
export interface TermScramble {
  /** As printed, shown once solved. */
  term: string;
  /** The letters in order, no harakat, no spaces — what the tiles must spell. */
  answer: string;
  tiles: TermTile[];
}

export function buildTermScramble(terms: readonly string[], rng: () => number = Math.random): TermScramble[] {
  // Arabic letters only: a term with a digit, Latin letter or punctuation
  // would deal a tile for it.
  const pool = terms.filter(t => {
    const letters = plainTerm(t).replace(/ /g, '');
    return letters.length >= 3 && letters.length <= MAX_SCRAMBLE_LETTERS && ARABIC_LETTERS.test(letters);
  });
  return sample(pool, LESSON_GAME_ROUND, rng).map(term => {
    const answer = plainTerm(term).replace(/ /g, '');
    const letters = [...answer];
    // Bounded: a term like «ددد» has no order that isn't the answer.
    let order = shuffle(letters, rng);
    for (let i = 0; i < 8 && order.join('') === answer; i++) order = shuffle(letters, rng);
    return { term, answer, tiles: order.map((letter, id) => ({ id, letter })) };
  });
}

export function isTermUnscrambled(tiles: readonly TermTile[], answer: string): boolean {
  return tiles.map(t => t.letter).join('') === answer;
}

// ─── Spot the lesson's term ─────────────────────────────────────────────────

export interface TermSpotQuestion { options: TriviaOption[]; correctId: string }

/** Terms from the other lessons of the same book that this lesson doesn't also use. */
function siblingTerms(lesson: Lesson): string[] {
  const bookId = getUnitById(lesson.unitId)?.bookId;
  if (!bookId) return [];
  const own = new Set(lessonTerms(lesson).map(plainTerm));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const unit of getUnitsForBook(bookId)) {
    for (const other of getLessonsForUnit(unit.id)) {
      if (other.id === lesson.id) continue;
      for (const term of lessonTerms(other)) {
        const key = plainTerm(term);
        if (own.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(term);
      }
    }
  }
  return out;
}

/** Empty when the book has fewer than 3 other terms to mix in. */
export function buildTermSpotRound(lesson: Lesson, rng: () => number = Math.random): TermSpotQuestion[] {
  const others = siblingTerms(lesson);
  if (others.length < 3) return [];
  return sample(lessonTerms(lesson), LESSON_GAME_ROUND, rng).map((term, q) => {
    const options = shuffle(
      [term, ...sample(others, 3, rng)].map((label, i) => ({ id: `${q}-${i}`, label })),
      rng,
    );
    return { options, correctId: `${q}-0` };
  });
}

/** The games this lesson can actually offer. */
export function availableLessonGames(lesson: Lesson): LessonGame[] {
  if (!hasLessonGames(lesson)) return [];
  const terms = lessonTerms(lesson);
  return LESSON_GAMES.filter(g =>
    g === 'scramble' ? buildTermScramble(terms).length >= 3
    : g === 'spot' ? siblingTerms(lesson).length >= 3
    : true,
  );
}
