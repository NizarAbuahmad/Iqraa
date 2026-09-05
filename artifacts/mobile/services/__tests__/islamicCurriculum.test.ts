/**
 * Islamic Education G10 must be reachable from the curriculum browser in both
 * semesters, and must keep the one thing that makes it different.
 *
 * It is the only catalog built from a **teacher guide** instead of a student
 * book, which is why it is also the only one with real `periods` — the guide
 * prints «الزمن المقترح لتنفيذ الدرس» on every lesson page. Every other
 * Arabic-side book falls back to a single 45-minute period, so a regression
 * that dropped the guide's counts would look exactly like the rest of the
 * catalog and go unnoticed. The duration assertions below are the guard.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getUnitsForBook,
  isCurriculumBookVisible,
} from '../curriculumData.ts';

const S1 = 'book-islamic-10-s1';
const S2 = 'book-islamic-10-s2';

const lessonsOf = (bookId: string) =>
  getUnitsForBook(bookId).flatMap(u => getLessonsForUnit(u.id));

describe('Islamic Education G10 — curriculum browser', () => {
  it('offers both semesters, in order, and both are visible', () => {
    const books = getBooksForSubjectGrade('islamic', 'grade-10', 'teacher');
    assert.deepEqual(books.map(b => b.id), [S1, S2]);
    assert.deepEqual(books.map(b => b.semester), [1, 2]);
    assert.equal(isCurriculumBookVisible(S1), true);
    assert.equal(isCurriculumBookVisible(S2), true);
  });

  it('numbers units 1-4 in BOTH semesters, because the books do', () => {
    // Unlike Arabic, where S2 continues at unit 6, these two books each start
    // over at الوحدة الأولى. The semester segment is what keeps the ids apart.
    for (const [book, sem] of [[S1, 1], [S2, 2]] as const) {
      assert.deepEqual(
        getUnitsForBook(book).map(u => u.id),
        ['u1', 'u2', 'u3', 'u4'].map(u => `kbu-islamic-s${sem}-nccd-${u}`),
      );
    }
  });

  it('has 24 lessons in S1 and 26 in S2, with S2 unevenly split', () => {
    assert.equal(lessonsOf(S1).length, 24);
    assert.equal(lessonsOf(S2).length, 26);
    assert.deepEqual(getUnitsForBook(S1).map(u => getLessonsForUnit(u.id).length), [6, 6, 6, 6]);
    // The S2 guide really does vary — 7/6/7/6, not a flat 6 like S1.
    assert.deepEqual(getUnitsForBook(S2).map(u => getLessonsForUnit(u.id).length), [7, 6, 7, 6]);
  });

  it('carries the guide\'s real period counts, not the 45-minute floor', () => {
    const lessons = [...lessonsOf(S1), ...lessonsOf(S2)];
    assert.equal(lessons.length, 50);
    for (const l of lessons) {
      assert.ok(l.titleAr.length > 0, `${l.id} has no Arabic title`);
      assert.ok(l.objectives.length > 0, `${l.id} has no objectives`);
      // 1, 2 or 3 حصص × 45 min. Anything else means the guide's count was lost.
      assert.ok(
        [45, 90, 135].includes(l.estimatedDuration),
        `${l.id} has duration ${l.estimatedDuration}, not a whole number of حصص`,
      );
    }
    // If the counts were ever silently replaced by the floor, every lesson
    // would read 45. Most of them are 2 حصص, so this stays true only while the
    // guide's numbers survive.
    assert.ok(
      lessons.filter(l => l.estimatedDuration > 45).length > 30,
      'periods collapsed to the one-period fallback',
    );
    assert.equal(new Set(lessons.map(l => l.id)).size, 50, 'duplicate lesson ids');
  });

  it('shares lesson ids with the knowledge base catalogs, and keeps them apart', async () => {
    const { findIslamicSem1LessonByKbId } = await import('../curriculumG10IslamicSem1.ts');
    const { findIslamicSem2LessonByKbId } = await import('../curriculumG10IslamicSem2.ts');
    for (const [find, bookId] of [
      [findIslamicSem1LessonByKbId, S1],
      [findIslamicSem2LessonByKbId, S2],
    ] as const) {
      for (const l of lessonsOf(bookId)) {
        assert.ok(find(l.id), `browser lesson ${l.id} has no matching KB lesson`);
      }
    }
    // Both books have a u1_l1; only the semester segment separates them.
    for (const l of lessonsOf(S2)) {
      assert.equal(findIslamicSem1LessonByKbId(l.id), null, `${l.id} leaked into S1`);
    }
  });
});
