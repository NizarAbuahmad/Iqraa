/**
 * The «عنوان الدرس فقط» badge on Grade 5 Arabic follows the content.
 *
 * Both books were flagged title-only by id prefix. Since 2026-11-13 49 of the
 * 50 lessons carry their unit competency page's objectives (and u8_l4 its one
 * word box), so a lesson is flagged only when the catalog holds nothing for it
 * beyond its title. Main ideas stay empty on purpose: the book prints no
 * main-idea box (see the JSONs' known_gaps).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isG5ArabicSem1TitleOnlyLesson, isG5ArabicSem1TitleOnlyUnit, nccdG5ArabicSem1,
  g5ArabicSem1LessonKbId, g5ArabicSem1UnitKbId,
} from '../catalogs/g5ArabicSem1.ts';
import {
  isG5ArabicSem2TitleOnlyLesson, isG5ArabicSem2TitleOnlyUnit, nccdG5ArabicSem2,
  g5ArabicSem2LessonKbId, g5ArabicSem2UnitKbId,
} from '../catalogs/g5ArabicSem2.ts';

const books = [
  { file: nccdG5ArabicSem1, lessonId: g5ArabicSem1LessonKbId, unitId: g5ArabicSem1UnitKbId, isLesson: isG5ArabicSem1TitleOnlyLesson, isUnit: isG5ArabicSem1TitleOnlyUnit },
  { file: nccdG5ArabicSem2, lessonId: g5ArabicSem2LessonKbId, unitId: g5ArabicSem2UnitKbId, isLesson: isG5ArabicSem2TitleOnlyLesson, isUnit: isG5ArabicSem2TitleOnlyUnit },
];
const empty = (l: { main_idea_ar?: string; objectives?: unknown[]; vocabulary?: unknown[] }) =>
  !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length;

test('a Grade 5 Arabic lesson is flagged title-only exactly when it holds nothing but its title', () => {
  for (const b of books) for (const u of b.file.units) {
    for (const l of u.lessons) assert.equal(b.isLesson(b.lessonId(l.id)), empty(l), l.id);
    assert.equal(b.isUnit(b.unitId(u.id)), u.lessons.every(empty), u.id);
  }
});

test('only u8_l5 is still flagged, and no unit is', () => {
  const flagged: string[] = [];
  for (const b of books) for (const u of b.file.units) {
    assert.equal(b.isUnit(b.unitId(u.id)), false, u.id);
    for (const l of u.lessons) if (b.isLesson(b.lessonId(l.id))) flagged.push(l.id);
  }
  assert.deepEqual(flagged, ['u8_l5']);
});

test('ids outside the book are not this book\'s to flag', () => {
  for (const b of books) {
    assert.equal(b.isLesson('kbl-math-s1-nccd-u1_l1'), false);
    assert.equal(b.isUnit('kbu-math-s1-nccd-u1'), false);
  }
});
