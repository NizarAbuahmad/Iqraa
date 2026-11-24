/**
 * The «عنوان الدرس فقط» badge on Grade 5 digital skills follows the content.
 *
 * The book was flagged title-only by id prefix. Since 2026-11-13 15 of its 26
 * tasks and projects carry objectives or a main idea from the activity book,
 * so a lesson is flagged only when the catalog holds nothing beyond its title.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isG5DigitalSem1TitleOnlyLesson, isG5DigitalSem1TitleOnlyUnit, nccdG5DigitalSem1,
  g5DigitalSem1LessonKbId, g5DigitalSem1UnitKbId,
} from '../catalogs/g5DigitalSem1.ts';

const books = [
  { file: nccdG5DigitalSem1, lessonId: g5DigitalSem1LessonKbId, unitId: g5DigitalSem1UnitKbId, isLesson: isG5DigitalSem1TitleOnlyLesson, isUnit: isG5DigitalSem1TitleOnlyUnit },
];
const empty = (l: { main_idea_ar?: string; objectives?: unknown[]; vocabulary?: unknown[] }) =>
  !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length;

test('a Grade 5 digital lesson is flagged title-only exactly when it holds nothing but its title', () => {
  for (const b of books) for (const u of b.file.units) {
    for (const l of u.lessons) assert.equal(b.isLesson(b.lessonId(l.id)), empty(l), l.id);
    assert.equal(b.isUnit(b.unitId(u.id)), u.lessons.every(empty), u.id);
  }
});

test('the 15 lessons with content are not flagged', () => {
  let unflagged = 0;
  for (const b of books) for (const u of b.file.units) for (const l of u.lessons) if (!b.isLesson(b.lessonId(l.id))) unflagged++;
  assert.equal(unflagged, 15);
});

test('ids outside the book are not this book\'s to flag', () => {
  for (const b of books) {
    assert.equal(b.isLesson('kbl-math-s1-nccd-u1_l1'), false);
    assert.equal(b.isUnit('kbu-math-s1-nccd-u1'), false);
  }
});
