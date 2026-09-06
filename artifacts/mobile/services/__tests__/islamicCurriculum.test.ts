/**
 * Islamic Education G10 must be reachable from the curriculum browser in both
 * semesters, and must keep the one thing that makes it different.
 *
 * Its outcomes and periods come from the **teacher guides**, which is why it
 * has real `periods` at all — the guides print «الزمن المقترح لتنفيذ الدرس» on
 * every lesson page. A regression that dropped those counts would leave every
 * lesson at the 45-minute floor and look exactly like every other book, so the
 * duration assertions below are the guard.
 *
 * Its lesson titles come from the **student books**, extracted later; where the
 * two sources disagreed the book won, and the five S1 titles that moved are
 * pinned below so a re-import from the guide alone cannot quietly undo them.
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

  it('uses the student book’s lesson titles where it differs from the guide', () => {
    // The catalogue was first built from the teacher guides alone. Extracting
    // the student books on 2026-09-05 found five S1 titles that genuinely
    // differ; the book wins, and each of the five is printed in two
    // independent places in it (the فهرس and its unit's «دروس الوحدة» page).
    const byId = new Map(lessonsOf(S1).map(l => [l.id.replace(/^.*nccd-/, ''), l.titleAr]));
    const expected: Record<string, string> = {
      u1_l2: 'البيعُ في الفقهِ الإسلاميِّ',
      u2_l5: 'مِنْ مقاصدِ الشريعةِ الإسلاميّةِ (حفظُ الدّين)',
      u3_l2: 'موقفُ الشريعةِ الإسلاميّةِ مِنَ الرِّبا',
      u3_l3: 'القدسُ والمسجدُ الأقصى المبارك',
      u4_l3: 'موقفُ الشريعةِ الإسلاميّةِ مِنَ القمار',
    };
    for (const [id, title] of Object.entries(expected)) {
      assert.equal(byId.get(id), title, `${id} should use the student book's title`);
    }
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
