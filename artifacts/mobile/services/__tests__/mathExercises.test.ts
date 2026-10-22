/**
 * The Math Corner's exercises: book lessons only, and every item marks itself.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXERCISE_COUNT,
  EXERCISE_GRADES,
  buildExerciseSet,
  exerciseGradeOf,
  exerciseLessonPath,
  exerciseUnits,
  parseBests,
  recordBest,
  resolveExerciseLesson,
} from '../mathExercises.ts';
import { getBookForLesson } from '../knowledgeBase.ts';

describe('exerciseUnits', () => {
  it('lists only the grade\'s own maths lessons', () => {
    for (const g of EXERCISE_GRADES) {
      for (const { lessons } of exerciseUnits(g)) {
        assert.ok(lessons.length > 0);
        for (const l of lessons) {
          const book = getBookForLesson(l);
          assert.equal(book?.subjectId, 'mathematics', l.id);
          assert.equal(book?.gradeId, `grade-${g}`, l.id);
          assert.equal(exerciseGradeOf(l), g, l.id);
        }
      }
    }
  });
  it('has exercises in every grade', () => {
    for (const g of EXERCISE_GRADES) assert.ok(exerciseUnits(g).length > 0, `grade ${g}`);
  });
});

describe('buildExerciseSet', () => {
  it('every item holds its key among distinct options, and no stem repeats', () => {
    for (const g of EXERCISE_GRADES) {
      for (const { lessons } of exerciseUnits(g)) {
        for (const lesson of lessons) {
          for (const lang of ['ar', 'en'] as const) {
            const set = buildExerciseSet(lesson, lang);
            assert.ok(set.length > 0, `${lesson.id} ${lang} is empty`);
            assert.ok(set.length <= EXERCISE_COUNT);
            assert.equal(new Set(set.map(e => e.text)).size, set.length, lesson.id);
            for (const e of set) {
              assert.ok(e.options.includes(e.answer), `${lesson.id}: key not an option`);
              assert.equal(new Set(e.options).size, e.options.length, `${lesson.id}: duplicate option in «${e.text}»`);
            }
          }
        }
      }
    }
  });
});

describe('best scores', () => {
  it('keeps the better score as a fraction, and the longer set on a tie', () => {
    let b = recordBest({}, 'L', { correct: 6, total: 10 });
    assert.deepEqual(b.L, { correct: 6, total: 10 });
    assert.equal(recordBest(b, 'L', { correct: 5, total: 10 }), b, 'a worse score changes nothing');
    b = recordBest(b, 'L', { correct: 4, total: 5 });
    assert.deepEqual(b.L, { correct: 4, total: 5 }, '4/5 beats 6/10');
    b = recordBest(b, 'L', { correct: 8, total: 10 });
    assert.deepEqual(b.L, { correct: 8, total: 10 }, 'a tie keeps the longer set');
    assert.equal(recordBest(b, 'L', { correct: 4, total: 5 }), b, 'a tie with a shorter set changes nothing');
    assert.deepEqual(recordBest(b, 'M', { correct: 0, total: 3 }).L, b.L, 'other lessons are untouched');
  });
  it('round-trips through JSON and drops anything malformed', () => {
    const b = recordBest({}, 'L', { correct: 7, total: 10 });
    assert.deepEqual(parseBests(JSON.stringify(b)), b);
    assert.deepEqual(parseBests(null), {});
    assert.deepEqual(parseBests('not json'), {});
    assert.deepEqual(parseBests('[1,2]'), {});
    assert.deepEqual(
      parseBests(JSON.stringify({ a: { correct: 11, total: 10 }, b: { correct: 1.5, total: 3 }, c: { correct: 0, total: 0 }, d: null, e: { correct: 2, total: 4 } })),
      { e: { correct: 2, total: 4 } },
    );
  });
});

describe('resolveExerciseLesson', () => {
  it('takes a covered lesson id and refuses anything else', () => {
    const lesson = exerciseUnits(5)[0]!.lessons[0]!;
    assert.equal(resolveExerciseLesson(lesson.id)?.id, lesson.id);
    assert.equal(resolveExerciseLesson([lesson.id]), resolveExerciseLesson(lesson.id));
    assert.equal(resolveExerciseLesson('no-such-lesson'), null);
    assert.equal(resolveExerciseLesson(undefined), null);
  });
  it('builds the lesson path under the Math Corner', () => {
    assert.equal(exerciseLessonPath('a b'), '/curriculum/math/exercises/a%20b');
  });
});
