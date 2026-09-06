/**
 * Exercise-reference tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/bookExercises.test.ts
 *
 * The join here is ARITHMETIC — the curriculum's `u{n}_l{m}` is the number the
 * book prints, with unit 1 shifted by one. Arithmetic is cheap and it is also
 * exactly how you end up citing a confidently wrong page, so the load-bearing
 * test is the one that walks every derived id and checks the curriculum's own
 * title for it against the title the exercise book prints.
 *
 * These assert against the REAL extracted data, not fixtures. A fixture would
 * agree with itself while the books disagreed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  curriculumLessonId,
  exerciseReference,
  exercisesForLesson,
  lessonsWithExercises,
} from '../bookExercises.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readIndex = (sourceId: string) =>
  JSON.parse(
    readFileSync(
      path.join(HERE, `../../../../knowledge-base/grade-10-math/exercises/${sourceId}/index.json`),
      'utf8',
    ),
  ) as { sourceId: string; lessons: { unit: number; lesson: number; titleEn: string | null; titleAr: string | null; exerciseCount: number; exercisesTrusted: boolean }[] };

/**
 * Compare Arabic or English titles ignoring what PDF extraction mangles:
 * diacritics, the alef family (which the lam-alef ligature reorders), case,
 * and punctuation including the `0°` / `0º` split between the two books.
 */
function skeleton(text: string | null | undefined): string {
  if (!text) return '';
  return text
    // A parenthetical gloss is the curriculum's, not the book's: «الاتجاه من
    // الشمال (Bearing)» is the same lesson as «الاتجاه من الشمال». Dropping
    // brackets is exact and targeted, where relaxing to a similarity score
    // would start accepting genuinely different lessons — the 0.67 match that
    // nearly filed a figure under the wrong lesson came from doing that.
    .replace(/\([^)]*\)/g, '')
    .replace(/[ً-ْـٰ]/g, '')
    .replace(/[أإآا]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

describe('curriculumLessonId', () => {
  it('passes units 2-8 straight through', () => {
    assert.equal(curriculumLessonId('s1', 2, 4), 'kbl-math-s1-nccd-u2_l4');
    assert.equal(curriculumLessonId('s2', 8, 5), 'kbl-math-s2-nccd-u8_l5');
  });

  it('shifts unit 1 down by one, and drops the book-only opener', () => {
    // The books teach «حل معادلات خاصة» as unit 1 lesson 1; the curriculum
    // deliberately does not carry it, so its exercises belong to no lesson.
    assert.equal(curriculumLessonId('s1', 1, 1), null);
    assert.equal(curriculumLessonId('s1', 1, 2), 'kbl-math-s1-nccd-u1_l1');
    assert.equal(curriculumLessonId('s1', 1, 3), 'kbl-math-s1-nccd-u1_l2');
  });

  it('has nothing to say about a row with no unit or lesson', () => {
    assert.equal(curriculumLessonId('s1', null, 3), null);
    assert.equal(curriculumLessonId('s1', 2, null), null);
  });
});

/**
 * Lessons whose two ministry documents word the title differently enough that
 * no exact comparison can pass, listed one by one rather than hidden behind a
 * similarity threshold.
 *
 * `u4_l3` — the exercise book prints «قانون جيوب التمام», the curriculum
 * «قانون جيب التمام». Both are real Arabic names for the Law of Cosines, and
 * the curriculum happens to carry Arabic in its `titleEn` too, so there is no
 * second field to fall back on. Unit and lesson number agree, and so does the
 * exercise book's own English line ("Law of Cosines").
 *
 * Keep this list short. An entry here is a claim that a human compared the two
 * titles and found them to name the same lesson; growing it to paper over a
 * systematic mismatch would defeat the check entirely.
 */
const WORDING_VARIANTS = new Set(['kbl-math-s1-nccd-u4_l3']);

describe('the derived join, checked against the curriculum', () => {
  it('names a lesson that exists, with a matching title, for every book row', () => {
    const byId = new Map(KB_LESSONS.map(l => [l.id, l]));
    let checked = 0;
    for (const sourceId of ['math-s1-exercise-book', 'math-s2-exercise-book']) {
      const index = readIndex(sourceId);
      const semester = sourceId.includes('-s1-') ? 's1' : 's2';
      for (const row of index.lessons) {
        const id = curriculumLessonId(semester, row.unit, row.lesson);
        if (id === null) continue;
        const lesson = byId.get(id);
        assert.ok(lesson, `${sourceId} U${row.unit}L${row.lesson} → ${id}, which does not exist`);
        // Identity has to be confirmed by EITHER title, because the two
        // ministry documents word each language slightly differently and not
        // always in the same place:
        //
        //   u1_l1  Arabic agrees; English is "…System of Linear…" in the book
        //          against "…System: Linear…" in the curriculum.
        //   u4_l3  English agrees ("Law of Cosines"); the Arabic is «قانون
        //          جيوب التمام» in the book against «قانون جيب التمام» in the
        //          curriculum — both real names for the same law.
        //
        // Requiring an exact skeleton match on one of the two keeps this a
        // real check. Relaxing to a similarity score across both is what
        // produced the 0.67 near-miss that almost filed a figure under the
        // wrong lesson.
        // Equal, or the book's title contained in the curriculum's. The
        // curriculum merges lessons the books keep apart — its «قسمة كثيرات
        // الحدود والاقترانات النسبية» is one lesson covering the book's
        // «الاقترانات النسبية» and more. Containment states that relationship
        // exactly; a similarity score would only approximate it, and would
        // also start accepting lessons that merely sound alike.
        const covers = (book: string | null, kb: string | null | undefined) => {
          const b = skeleton(book);
          const k = skeleton(kb);
          return b !== '' && (b === k || k.includes(b));
        };
        const arMatch = covers(row.titleAr, lesson!.titleAr);
        const enMatch = covers(row.titleEn, lesson!.titleEn);
        assert.ok(
          arMatch || enMatch || WORDING_VARIANTS.has(id),
          `${id}: book says ${row.titleAr} / ${row.titleEn}, `
            + `curriculum says ${lesson!.titleAr} / ${lesson!.titleEn}`,
        );
        checked += 1;
      }
    }
    assert.equal(checked, 31, 'every book lesson but the curriculum-less one');
  });
});

describe('exercisesForLesson', () => {
  it('gives the systems lesson the page the book really prints it on', () => {
    // Page 11, not 10: page 10 is «حل معادلات خاصة», the lesson the curriculum
    // does not carry. Citing page 10 here is exactly the failure this exists
    // to prevent.
    const ex = exercisesForLesson('kbl-math-s1-nccd-u1_l1');
    assert.ok(ex);
    assert.equal(ex!.page, 11);
    assert.equal(ex!.sourceId, 'math-s1-exercise-book');
    assert.ok(ex!.exerciseCount > 0);
  });

  it('has nothing for the lessons the exercise book does not carry', () => {
    // The two exponent lessons are in the curriculum and the teacher guide but
    // not in the 2026 exercise book. Silence is the correct answer.
    assert.equal(exercisesForLesson('kbl-math-s1-nccd-u1_l3'), null);
    assert.equal(exercisesForLesson('kbl-math-s1-nccd-u1_l4'), null);
    assert.equal(exercisesForLesson('kbl-chem-s1-nccd-u1_l1'), null);
    assert.equal(exercisesForLesson('no-such-lesson'), null);
    assert.equal(exercisesForLesson(null), null);
    assert.equal(exercisesForLesson(undefined), null);
  });

  it('draws each semester from its own exercise book', () => {
    for (const id of lessonsWithExercises()) {
      const expected = id.includes('-s1-') ? 'math-s1-exercise-book' : 'math-s2-exercise-book';
      assert.equal(exercisesForLesson(id)!.sourceId, expected, id);
    }
  });

  it('never reports a count it could not read cleanly', () => {
    for (const id of lessonsWithExercises()) {
      const ex = exercisesForLesson(id)!;
      assert.ok(Number.isInteger(ex.exerciseCount) && ex.exerciseCount > 0, id);
      assert.ok(Number.isInteger(ex.page) && ex.page > 0, id);
    }
  });
});

describe('exerciseReference', () => {
  const ex = {
    sourceId: 'math-s1-exercise-book', page: 11, unit: 1, lesson: 2, exerciseCount: 17,
  };

  it('reads as a teacher would write it, in Arabic digits', () => {
    assert.equal(exerciseReference(ex, true), 'تمارين ١-١٧، صفحة ١١');
  });

  it('stays latin in English', () => {
    assert.equal(exerciseReference(ex, false), 'Exercises 1-17, page 11');
  });

  it('does not write a range for a single exercise', () => {
    assert.equal(exerciseReference({ ...ex, exerciseCount: 1 }, false), 'Exercises 1, page 11');
  });
});
