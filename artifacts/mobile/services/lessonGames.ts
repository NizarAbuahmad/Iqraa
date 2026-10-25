/**
 * Lesson games — built from a lesson's own key terms (`keywordsAr`), so no AI
 * and no new content. Only ~15% of lessons carry ≥4 terms, and the English
 * `keywords` list is almost always the Arabic copied (2026-10-22 survey), so
 * every term game here is Arabic-term-only and offered only where a lesson has
 * `MIN_LESSON_TERMS`. Four games:
 *  - memory: flip pairs of the lesson's terms;
 *  - scramble: rebuild a term from its shuffled letters;
 *  - spot: pick the term that belongs to this lesson among terms from other
 *    lessons of the same book;
 *  - meaning: read the book's own printed definition, pick its term — offered
 *    only where the book's glossary (or a teacher-signed draft) defines the
 *    lesson's terms, and needs no minimum of 4 key terms of its own.
 */
import {
  getBooksForSubjectGrade, getLessonsForUnit, getSubjectsForGrade, getUnitById, getUnitsForBook, type Lesson,
} from '@workspace/curriculum';
import { sample, shuffle } from './publicGames/rng.ts';
import type { TriviaOption } from './publicGames/countries.ts';
import type { TranslationKey } from './i18n.ts';
import type { HomeworkGameName } from './homework.ts';
import { resolveExerciseLesson } from './mathExercises.ts';
import { bareWords, findGlossaryEntry, glossaryForBook, glossaryKey, type GlossaryEntry } from '@workspace/curriculum/glossary';

export const MIN_LESSON_TERMS = 4;
export const LESSON_GAME_ROUND = 6;
export type LessonGame = 'memory' | 'scramble' | 'spot' | 'meaning';
export const LESSON_GAMES: LessonGame[] = ['memory', 'scramble', 'spot', 'meaning'];
export const LESSON_GAME_TITLE_KEY: Record<LessonGame, TranslationKey> = {
  memory: 'lessonGameMemoryTitle',
  scramble: 'lessonGameScrambleTitle',
  spot: 'lessonGameSpotTitle',
  meaning: 'lessonGameMeaningTitle',
};
/** What a homework attachment is called: the lesson games, plus the Math Corner's exercises. */
export const HOMEWORK_GAME_TITLE_KEY: Record<HomeworkGameName, TranslationKey> = {
  ...LESSON_GAME_TITLE_KEY,
  exercises: 'mathPracticeTitle',
};

/** A maths lesson the Math Corner has exercises for — set as homework like a game. */
function hasExercises(lessonId: string): boolean {
  return resolveExerciseLesson(lessonId) !== null;
}

/** What a teacher can attach for this lesson: its games, then its exercises if it is a covered maths lesson. */
export function homeworkGamesFor(lesson: Lesson): HomeworkGameName[] {
  return [...availableLessonGames(lesson), ...(hasExercises(lesson.id) ? (['exercises'] as const) : [])];
}

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
  return lessonTerms(lesson).length >= MIN_LESSON_TERMS || hasMeaningGame(lesson);
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

// ─── What does this term mean? ──────────────────────────────────────────────

/** A question needs this many entries of the book for its three wrong terms. */
export const MIN_MEANING_POOL = 4;

export interface MeaningQuestion {
  /** The definition, shown as the prompt. */
  definition: string;
  /** Whose it is: the book's printed one, or a model's draft a teacher has signed off. */
  source: GlossaryEntry['source'];
  options: TriviaOption[];
  correctId: string;
}

/**
 * The definitions this lesson can ask about, ordered by how directly they belong
 * to it: the entries for the lesson's own key terms first, then those of the
 * other lessons of its unit. A book's printed glossary does not say which lesson
 * a term is from, so the lesson is found through its key terms; `own` is what the
 * lesson itself lists. Only served entries (the book's, or a teacher-signed
 * draft) are ever here — see `@workspace/curriculum/glossary`.
 */
export function lessonMeanings(lesson: Lesson): { own: GlossaryEntry[]; unit: GlossaryEntry[]; bookId: string } {
  const unit = getUnitById(lesson.unitId);
  const bookId = unit?.bookId ?? '';
  const seen = new Set<string>();
  const take = (l: Lesson): GlossaryEntry[] => {
    const out: GlossaryEntry[] = [];
    for (const term of lessonTerms(l)) {
      const entry = findGlossaryEntry(bookId, term);
      const key = entry ? glossaryKey(entry.ar) : '';
      // A definition that contains its own term gives the answer away: it can still be a wrong answer, never a question.
      if (!entry || seen.has(key) || bareWords(entry.definitionAr).includes(bareWords(entry.ar))) continue;
      seen.add(key);
      out.push(entry);
    }
    return out;
  };
  const own = bookId ? take(lesson) : [];
  const mates = bookId && own.length > 0 && unit
    ? getLessonsForUnit(unit.id).filter(l => l.id !== lesson.id).flatMap(take)
    : [];
  return { own, unit: mates, bookId };
}

/** At least one definition that is this lesson's own, and enough to make a round. */
export function hasMeaningGame(lesson: Lesson): boolean {
  const { own, unit, bookId } = lessonMeanings(lesson);
  return own.length > 0 && own.length + unit.length >= MIN_MEANING_POOL && glossaryForBook(bookId).length >= MIN_MEANING_POOL;
}

/** Empty when the lesson has no served definitions or its book too few terms for wrong answers. */
export function buildMeaningRound(lesson: Lesson, rng: () => number = Math.random): MeaningQuestion[] {
  const { own, unit, bookId } = lessonMeanings(lesson);
  const book = glossaryForBook(bookId);
  if (own.length === 0 || book.length < MIN_MEANING_POOL) return [];
  const picked = [...shuffle(own, rng), ...shuffle(unit, rng)].slice(0, LESSON_GAME_ROUND);
  return shuffle(picked, rng).map((entry, q) => {
    const key = glossaryKey(entry.ar);
    // A wrong term must not be the answer under another spelling.
    const wrong = sample(book.filter(e => glossaryKey(e.ar) !== key), 3, rng);
    const options = shuffle(
      [entry, ...wrong].map((e, i) => ({ id: `${q}-${i}`, label: e.ar })),
      rng,
    );
    return { definition: entry.definitionAr, source: entry.source, options, correctId: `${q}-0` };
  });
}

/** The games this lesson can actually offer. */
export function availableLessonGames(lesson: Lesson): LessonGame[] {
  const terms = lessonTerms(lesson);
  const hasTerms = terms.length >= MIN_LESSON_TERMS;
  return LESSON_GAMES.filter(g =>
    g === 'meaning' ? hasMeaningGame(lesson)
    : !hasTerms ? false
    : g === 'scramble' ? buildTermScramble(terms).length >= 3
    : g === 'spot' ? siblingTerms(lesson).length >= 3
    : true,
  );
}

export interface GameLessonGroup {
  unitId: string;
  /** Unit name, Arabic. */
  unitTitle: string;
  bookTitle: string;
  lessons: { id: string; title: string }[];
}

/**
 * The lessons a teacher can set a game from, by unit: the books of the class's
 * grade and subjects (no subjects = every subject of the grade), keeping only
 * lessons with enough terms or with Math Corner exercises. Which games each
 * offers is asked per lesson (`homeworkGamesFor`) once one is opened — it builds
 * a scramble round.
 */
export function gameLessonsForScope(gradeId: string, subjectIds: readonly string[]): GameLessonGroup[] {
  if (!gradeId) return [];
  const subjects = subjectIds.length > 0 ? subjectIds : getSubjectsForGrade(gradeId).map(s => s.id);
  const out: GameLessonGroup[] = [];
  for (const subjectId of subjects) {
    for (const book of getBooksForSubjectGrade(subjectId, gradeId, 'teacher')) {
      for (const unit of getUnitsForBook(book.id)) {
        const lessons = getLessonsForUnit(unit.id)
          .filter(l => hasLessonGames(l) || hasExercises(l.id))
          .map(l => ({ id: l.id, title: l.titleAr || l.title }));
        if (lessons.length > 0) out.push({ unitId: unit.id, unitTitle: unit.nameAr || unit.name, bookTitle: book.titleAr || book.title, lessons });
      }
    }
  }
  return out;
}
