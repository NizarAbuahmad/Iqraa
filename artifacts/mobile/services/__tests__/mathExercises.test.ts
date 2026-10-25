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
  exerciseGradeOfClass,
  normalizeClassPractice,
  practiceByLesson,
  parseBests,
  practiceByStudent,
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

describe('class practice by lesson', () => {
  const lessons = exerciseUnits(5).flatMap(u => u.lessons);
  const [a, b] = [lessons[0]!.id, lessons[1]!.id];
  const row = (studentId: string, lessonId: string, correct: number, total: number) =>
    ({ studentId, displayName: studentId, lessonId, correct, total, attempts: 1, practicedAt: '' });

  it('lists every covered lesson of the grade in book order, practised or not, with counts and the average', () => {
    const s = practiceByLesson([row('s1', a, 8, 10), row('s2', a, 3, 5), row('s1', b, 1, 4), row('s1', 'not-this-grade', 5, 5)], 5);
    assert.equal(s.totalLessons, lessons.length);
    assert.equal(s.practisedLessons, 2, 'the other-grade row is left out');
    assert.deepEqual(s.units.flatMap(u => u.lessons.map(l => l.lesson.id)), lessons.map(l => l.id));
    const flat = s.units.flatMap(u => u.lessons);
    assert.deepEqual([flat[0]!.practised, flat[0]!.averagePct], [2, 70], 'mean of 80% and 60%');
    assert.deepEqual([flat[1]!.practised, flat[1]!.averagePct], [1, 25]);
    assert.ok(flat.slice(2).every(l => l.practised === 0 && l.averagePct === null));
  });

  it('reads the class grade, and refuses one with no exercises', () => {
    assert.equal(exerciseGradeOfClass('grade-5'), 5);
    assert.equal(exerciseGradeOfClass('grade-10'), 10);
    for (const g of ['grade-11', '', null, undefined, 'kg']) assert.equal(exerciseGradeOfClass(g), null, String(g));
  });
});

describe('class practice (teacher view)', () => {
  it('keeps well-formed rows, drops the rest, and groups by student in server order', () => {
    const rows = normalizeClassPractice([
      { studentId: 's1', displayName: 'سارة', lessonId: 'L1', correct: 4, total: 5, attempts: 3, practicedAt: '2026-10-23T08:00:00.000Z' },
      { studentId: 's1', displayName: 'سارة', lessonId: 'L2', correct: 7, total: 10 },
      { studentId: 's2', displayName: 'نور', lessonId: 'L1', correct: 1, total: 10, attempts: 1 },
      { studentId: '', lessonId: 'L1', correct: 1, total: 2 },
      { studentId: 's3', lessonId: 'L1', correct: 1, total: 0 },
      { studentId: 's3', lessonId: 'L1', correct: '1', total: 2 },
      null,
    ]);
    assert.equal(rows.length, 3);
    assert.equal(rows[1]!.attempts, 1, 'a missing attempt count reads as one');
    assert.deepEqual(
      practiceByStudent(rows).map(s => [s.displayName, s.lessons.map(l => l.lessonId)]),
      [['سارة', ['L1', 'L2']], ['نور', ['L1']]],
    );
    assert.deepEqual(normalizeClassPractice(undefined), []);
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
