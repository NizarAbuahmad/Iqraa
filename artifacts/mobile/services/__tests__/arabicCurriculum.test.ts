/**
 * Arabic G10 S1 must be reachable from the curriculum browser, and its lessons
 * must stay distinguishable from each other.
 *
 * Every unit runs the same five skills under near-identical titles («أستمع
 * بانتباهٍ وتركيزٍ» is the first lesson of all five units), which is exactly the
 * shape CLAUDE.md warns about under "a lesson title does not identify a
 * lesson". So the assertions below pin ids, not titles, and check that a title
 * repeated across units still resolves to five distinct lessons.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getUnitsForBook,
  isCurriculumBookVisible,
} from '../curriculumData.ts';

const ARABIC_BOOK = 'book-arabic-10-s1';

describe('Arabic G10 S1 — curriculum browser', () => {
  it('offers semester 1 only, and it is visible', () => {
    const books = getBooksForSubjectGrade('arabic', 'grade-10', 'teacher');
    assert.deepEqual(books.map(b => b.id), [ARABIC_BOOK]);
    assert.equal(books[0].semester, 1);
    assert.equal(isCurriculumBookVisible(ARABIC_BOOK), true);
  });

  it('exports all five units in book order', () => {
    const units = getUnitsForBook(ARABIC_BOOK);
    assert.deepEqual(
      units.map(u => u.nameAr),
      [
        'مِنْ أَدَبِ الاِعْتِذار',
        'يَرْحَلونَ ونَبْقى',
        'مُختاراتٌ مِنَ الأَدَبِ المُتَرْجَم',
        'مِنَ السّيرةِ الذّاتيّةِ',
        'مِنَ الأدبِ القَديمِ',
      ],
    );
    assert.ok(units.every(u => u.id.startsWith('kbu-arabic-s1-nccd-')));
  });

  it('gives all 25 lessons objectives, a duration and a distinct id', () => {
    const lessons = getUnitsForBook(ARABIC_BOOK).flatMap(u => getLessonsForUnit(u.id));
    assert.equal(lessons.length, 25);
    for (const l of lessons) {
      assert.ok(l.titleAr.length > 0, `${l.id} has no Arabic title`);
      assert.ok(l.objectives.length > 0, `${l.id} has no objectives`);
      // The student book prints no حصص counts; one 45-min period is the floor.
      assert.ok(l.estimatedDuration >= 45, `${l.id} has no duration`);
    }
    assert.equal(new Set(lessons.map(l => l.id)).size, 25, 'duplicate lesson ids');
    // The listening lesson repeats verbatim in all five units — five rows, one
    // title. Anything that keys a lesson by title collapses them into one.
    const listening = lessons.filter(l => l.titleAr === 'أستمعُ بانتباهٍ وتركيزٍ');
    assert.equal(listening.length, 5);
    assert.equal(new Set(listening.map(l => l.unitId)).size, 5);
  });

  it('shares lesson ids with the knowledge base catalog', async () => {
    const { findArabicSem1LessonByKbId } = await import('../curriculumG10ArabicSem1.ts');
    const lessons = getUnitsForBook(ARABIC_BOOK).flatMap(u => getLessonsForUnit(u.id));
    for (const l of lessons) {
      assert.ok(
        findArabicSem1LessonByKbId(l.id),
        `browser lesson ${l.id} has no matching KB lesson`,
      );
    }
  });
});
