/**
 * Arabic G10 must be reachable from the curriculum browser in both semesters,
 * and its lessons must stay distinguishable from each other.
 *
 * Every unit in both books runs the same five skills under near-identical
 * titles — «أستمع بانتباهٍ وتركيزٍ» is the first lesson of all ten units — which
 * is exactly the shape CLAUDE.md warns about under "a lesson title does not
 * identify a lesson". So the assertions below pin ids, not titles, and check
 * that a title repeated across units still resolves to ten distinct lessons.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getUnitsForBook,
  isCurriculumBookVisible,
} from '../curriculumData.ts';

const S1 = 'book-arabic-10-s1';
const S2 = 'book-arabic-10-s2';

const lessonsOf = (bookId: string) =>
  getUnitsForBook(bookId).flatMap(u => getLessonsForUnit(u.id));

describe('Arabic G10 — curriculum browser', () => {
  it('offers both semesters, in order, and both are visible', () => {
    const books = getBooksForSubjectGrade('arabic', 'grade-10', 'teacher');
    assert.deepEqual(books.map(b => b.id), [S1, S2]);
    assert.deepEqual(books.map(b => b.semester), [1, 2]);
    assert.equal(isCurriculumBookVisible(S1), true);
    assert.equal(isCurriculumBookVisible(S2), true);
  });

  it('exports S1 units 1-5 in book order', () => {
    const units = getUnitsForBook(S1);
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

  it('exports S2 units 6-10 in book order, continuing S1 numbering', () => {
    const units = getUnitsForBook(S2);
    assert.deepEqual(
      units.map(u => u.nameAr),
      [
        'أَنا والآخَر',
        'الحنينُ إلى الوَطَنِ',
        'شَبَكاتُ التّواصلِ الاجتماعيِّ',
        'مِنَ الأدبِ الوجدانيِّ',
        'مِنْ أدبِ السّيرةِ الغيريّةِ',
      ],
    );
    // The book prints these as units 6-10, so the ids say u6-u10 — not u1-u5
    // restarted under a different semester segment.
    assert.deepEqual(
      units.map(u => u.id),
      ['u6', 'u7', 'u8', 'u9', 'u10'].map(u => `kbu-arabic-s2-nccd-${u}`),
    );
  });

  it('gives all 50 lessons objectives, a duration and a distinct id', () => {
    const lessons = [...lessonsOf(S1), ...lessonsOf(S2)];
    assert.equal(lessons.length, 50);
    for (const l of lessons) {
      assert.ok(l.titleAr.length > 0, `${l.id} has no Arabic title`);
      assert.ok(l.objectives.length > 0, `${l.id} has no objectives`);
      // Neither student book prints حصص counts; one 45-min period is the floor.
      assert.ok(l.estimatedDuration >= 45, `${l.id} has no duration`);
    }
    assert.equal(new Set(lessons.map(l => l.id)).size, 50, 'duplicate lesson ids');
    // The listening lesson repeats verbatim in all ten units — ten rows, one
    // title. Anything that keys a lesson by title collapses them into one.
    const listening = lessons.filter(l => l.titleAr === 'أستمعُ بانتباهٍ وتركيزٍ');
    assert.equal(listening.length, 10);
    assert.equal(new Set(listening.map(l => l.unitId)).size, 10);
  });

  it('shares lesson ids with the knowledge base catalogs', async () => {
    const { findArabicSem1LessonByKbId } = await import('../curriculumG10ArabicSem1.ts');
    const { findArabicSem2LessonByKbId } = await import('../curriculumG10ArabicSem2.ts');
    for (const [find, bookId] of [
      [findArabicSem1LessonByKbId, S1],
      [findArabicSem2LessonByKbId, S2],
    ] as const) {
      for (const l of lessonsOf(bookId)) {
        assert.ok(find(l.id), `browser lesson ${l.id} has no matching KB lesson`);
      }
    }
  });

  it('keeps the two semesters in separate id namespaces', async () => {
    const { findArabicSem1LessonByKbId } = await import('../curriculumG10ArabicSem1.ts');
    // An S1 finder handed an S2 id must answer null, not a same-shaped lesson
    // from its own book — the prefixes are what keep the two apart.
    for (const l of lessonsOf(S2)) {
      assert.equal(findArabicSem1LessonByKbId(l.id), null, `${l.id} leaked into S1`);
    }
  });
});
