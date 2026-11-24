/**
 * The «عنوان الدرس فقط» badge on Grade 5 social studies follows the content.
 *
 * Until 2026-11-13 both books were flagged title-only by id prefix, because
 * their text layer was thought unreadable. It is readable once each line is
 * reversed, and every lesson now carries its book's main idea, objectives and
 * terms, so a teacher must not be told the lesson is only a title.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isG5SocialSem1TitleOnlyLesson, isG5SocialSem1TitleOnlyUnit, nccdG5SocialSem1,
  g5SocialSem1LessonKbId, g5SocialSem1UnitKbId,
} from '../catalogs/g5SocialSem1.ts';
import {
  isG5SocialSem2TitleOnlyLesson, isG5SocialSem2TitleOnlyUnit, nccdG5SocialSem2,
  g5SocialSem2LessonKbId, g5SocialSem2UnitKbId,
} from '../catalogs/g5SocialSem2.ts';

const books = [
  { file: nccdG5SocialSem1, lessonId: g5SocialSem1LessonKbId, unitId: g5SocialSem1UnitKbId, isLesson: isG5SocialSem1TitleOnlyLesson, isUnit: isG5SocialSem1TitleOnlyUnit },
  { file: nccdG5SocialSem2, lessonId: g5SocialSem2LessonKbId, unitId: g5SocialSem2UnitKbId, isLesson: isG5SocialSem2TitleOnlyLesson, isUnit: isG5SocialSem2TitleOnlyUnit },
];

test('a Grade 5 social lesson with content is not flagged title-only', () => {
  for (const b of books) for (const u of b.file.units) {
    for (const l of u.lessons) {
      const hasContent = !!l.main_idea_ar || (l.objectives ?? []).length > 0 || (l.vocabulary ?? []).length > 0;
      assert.equal(b.isLesson(b.lessonId(l.id)), !hasContent, `${l.id}`);
    }
    const allEmpty = u.lessons.every(l => !l.main_idea_ar && !(l.objectives ?? []).length && !(l.vocabulary ?? []).length);
    assert.equal(b.isUnit(b.unitId(u.id)), allEmpty, `${u.id}`);
  }
});

test('every Grade 5 social lesson now has content, so none is flagged', () => {
  for (const b of books) for (const u of b.file.units) {
    assert.equal(b.isUnit(b.unitId(u.id)), false, u.id);
    for (const l of u.lessons) assert.equal(b.isLesson(b.lessonId(l.id)), false, l.id);
  }
});

test('ids outside the book are not this book\'s to flag', () => {
  for (const b of books) {
    assert.equal(b.isLesson('kbl-math-s1-nccd-u1_l1'), false);
    assert.equal(b.isUnit('kbu-math-s1-nccd-u1'), false);
  }
});
