import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, getUnitById } from '@workspace/curriculum';
import { bareWords, glossaryForBook, glossaryKey } from '@workspace/curriculum/glossary';
import {
  LESSON_GAME_ROUND, MIN_LESSON_TERMS, availableLessonGames, buildMeaningRound, hasLessonGames, hasMeaningGame,
  homeworkGamesFor, lessonMeanings, lessonTerms,
} from '../lessonGames.ts';

const seeded = (seed = 11) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const withMeaning = LESSONS.filter(hasMeaningGame);

test('the printed glossary gives real lessons a meaning game (the reach we claim)', () => {
  assert.ok(withMeaning.length >= 40, `only ${withMeaning.length} lessons have a meaning game`);
  // It also reaches lessons that have too few key terms for the other three games.
  const meaningOnly = withMeaning.filter(l => lessonTerms(l).length < MIN_LESSON_TERMS);
  for (const l of meaningOnly) assert.deepEqual(availableLessonGames(l), ['meaning'], l.id);
});

test('a meaning game is offered only with a served definition of the lesson\'s own term', () => {
  for (const l of withMeaning) {
    const { own, unit, bookId } = lessonMeanings(l);
    assert.ok(own.length > 0 && own.length + unit.length >= 4, l.id);
    assert.ok(own.every(e => e.bookId === bookId) && unit.every(e => e.bookId === bookId), l.id);
    assert.ok(availableLessonGames(l).includes('meaning'), l.id);
    assert.ok(hasLessonGames(l) && homeworkGamesFor(l).includes('meaning'), l.id);
  }
  // …and never without one.
  for (const l of LESSONS.filter(x => !hasMeaningGame(x))) assert.ok(!availableLessonGames(l).includes('meaning'), l.id);
});

test('every question asks for the term the book defines, with three other terms of that book', () => {
  for (const l of withMeaning) {
    const bookId = getUnitById(l.unitId)!.bookId;
    const book = glossaryForBook(bookId);
    const byTerm = new Map(book.map(e => [e.ar, e]));
    for (let run = 1; run <= 3; run++) {
      const round = buildMeaningRound(l, seeded(run));
      assert.ok(round.length >= 1 && round.length <= LESSON_GAME_ROUND, l.id);
      const asked = new Set<string>();
      for (const q of round) {
        assert.equal(q.options.length, 4, l.id);
        assert.equal(new Set(q.options.map(o => glossaryKey(o.label))).size, 4, `${l.id}: two options are one term`);
        const right = q.options.find(o => o.id === q.correctId)!;
        assert.equal(byTerm.get(right.label)?.definitionAr, q.definition, `${l.id}: wrong term for «${q.definition}»`);
        for (const o of q.options) assert.ok(byTerm.has(o.label), `${l.id}: «${o.label}» is not a term of ${bookId}`);
        assert.ok(!asked.has(q.definition), `${l.id}: a definition twice in one round`);
        asked.add(q.definition);
      }
    }
  }
});

test('no question gives its answer away, and each says whose definition it is', () => {
  for (const l of withMeaning) {
    for (const q of buildMeaningRound(l, seeded(5))) {
      const right = q.options.find(o => o.id === q.correctId)!;
      assert.ok(!bareWords(q.definition).includes(bareWords(right.label)), `${l.id}: «${right.label}» is in its own definition`);
      assert.equal(q.source, 'book-glossary', l.id); // no draft is signed off yet
    }
  }
});

test('the lesson\'s own terms come first in a round', () => {
  const l = withMeaning.find(x => lessonMeanings(x).own.length >= LESSON_GAME_ROUND && lessonMeanings(x).unit.length > 0);
  if (!l) return; // no lesson has more own terms than a round on this data: nothing to order
  const own = new Set(lessonMeanings(l).own.map(e => e.definitionAr));
  assert.ok(buildMeaningRound(l, seeded()).every(q => own.has(q.definition)));
});

test('an unsigned draft definition is never asked', () => {
  // Grade 10 chemistry S1 has only drafts; until a teacher signs one off it has no meaning game.
  const chem = LESSONS.filter(l => getUnitById(l.unitId)?.bookId === 'book-chem-10');
  assert.ok(chem.length > 0);
  for (const l of chem) {
    assert.equal(hasMeaningGame(l), false, l.id);
    assert.deepEqual(buildMeaningRound(l), [], l.id);
  }
});

test('a lesson with no served definition has an empty round, not a crash', () => {
  const none = LESSONS.find(l => !hasMeaningGame(l))!;
  assert.deepEqual(buildMeaningRound(none), []);
});
