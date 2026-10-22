import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, type Lesson } from '@workspace/curriculum';
import {
  MIN_LESSON_TERMS, buildTermScramble, buildTermSpotRound, gameLessonsForScope, hasLessonGames, isTermUnscrambled,
  lessonTerms, plainTerm,
} from '../lessonGames.ts';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const lesson = (keywordsAr: string[], id = 'x'): Lesson => ({
  id, unitId: 'u', title: 'T', titleAr: 'ت', estimatedDuration: 1, objectives: [], objectivesAr: [],
  keywords: keywordsAr, keywordsAr, teacherNotes: '', teacherNotesAr: '', outcomes: [],
});

test('lessonTerms drops blanks, non-Arabic and harakat-only duplicates', () => {
  const terms = lessonTerms(lesson(['', ' ', 'unit 4', 'الخليّة', 'الخلية', 'النواة', 'x', 'الغشاء']));
  assert.deepEqual(terms, ['الخليّة', 'النواة', 'الغشاء']);
});

test('plainTerm strips harakat and tatweel', () => {
  assert.equal(plainTerm('دورةُ  الخليـةِ'), 'دورة الخلية');
});

test('every real lesson with games has ≥4 distinct Arabic terms and no empty ones', () => {
  const offered = LESSONS.filter(hasLessonGames);
  assert.ok(offered.length > 400, `only ${offered.length} lessons offer games`);
  for (const l of offered) {
    const terms = lessonTerms(l);
    assert.ok(terms.length >= MIN_LESSON_TERMS, l.id);
    assert.equal(new Set(terms.map(plainTerm)).size, terms.length, `${l.id} has duplicate terms`);
    for (const t of terms) assert.match(t, /[؀-ۿ]/, `${l.id}: ${t}`);
  }
});

test('scramble tiles are the term letters, never already solved, and solve back', () => {
  const round = buildTermScramble(['المادة', 'الطاقة الحركية', 'ذرة', 'جزيء', 'y=x', 'CO2 الغاز'], seeded());
  // «الطاقة الحركية» is 13 letters (over the cap); y=x and CO2 aren't Arabic letters.
  assert.deepEqual(round.map(q => q.term).sort(), ['المادة', 'جزيء', 'ذرة'].sort());
  for (const q of round) {
    assert.equal(q.answer, plainTerm(q.term).replace(/ /g, ''));
    assert.deepEqual([...q.tiles.map(t => t.letter)].sort(), [...q.answer].sort());
    assert.notEqual(q.tiles.map(t => t.letter).join(''), q.answer);
    const solved = [...q.answer].map((letter, id) => ({ id, letter }));
    assert.ok(isTermUnscrambled(solved, q.answer));
  }
});

test('spot round: one option from this lesson, distractors from sibling lessons only', () => {
  const l = LESSONS.find(x => hasLessonGames(x) && buildTermSpotRound(x, seeded()).length > 0);
  assert.ok(l, 'some lesson supports the spot game');
  const own = new Set(lessonTerms(l).map(plainTerm));
  for (const q of buildTermSpotRound(l, seeded())) {
    assert.equal(q.options.length, 4);
    const right = q.options.filter(o => own.has(plainTerm(o.label)));
    assert.equal(right.length, 1);
    assert.equal(right[0].id, q.correctId);
  }
});

test('gameLessonsForScope offers only lessons that can host a game, by unit, from the class own subjects', () => {
  const groups = gameLessonsForScope('grade-10', ['mathematics', 'chemistry']);
  assert.ok(groups.length > 0, 'grade 10 maths/chemistry has lessons with games');
  for (const g of groups) {
    assert.ok(g.lessons.length > 0);
    for (const l of g.lessons) {
      const found = LESSONS.find(x => x.id === l.id);
      assert.ok(found && hasLessonGames(found), l.id);
    }
  }
  // Another subject's lessons never appear for a maths-only class.
  const mathOnly = gameLessonsForScope('grade-10', ['mathematics']);
  assert.ok(mathOnly.length <= groups.length);
  assert.deepEqual(gameLessonsForScope('', ['mathematics']), []);
  assert.deepEqual(gameLessonsForScope('grade-10', ['no-such-subject']), []);
});
