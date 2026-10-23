/**
 * Which hub lessons a student can see (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-grammar-only-lessons-design.md):
 * a lesson with words always, a grammar-only lesson only once a teacher has signed its grammar unit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonVisible } from '../englishGrammar.ts';
import { GRAMMAR_ONLY_LESSONS, hubLessonsForGrade } from '../englishHub.ts';

test('a lesson with words is visible, signed or not; an unknown id never is', () => {
  const withWords = hubLessonsForGrade(1)[0].id;
  assert.equal(hubLessonVisible(withWords), true);
  assert.equal(hubLessonVisible(withWords, () => null), true);
  assert.equal(hubLessonVisible('kbl-no-such-lesson'), false);
});

test('a grammar-only lesson is invisible until its unit is signed', () => {
  for (const id of GRAMMAR_ONLY_LESSONS) {
    assert.equal(hubLessonVisible(id), false, `${id} must be hidden in the committed data`);
    assert.equal(hubLessonVisible(id, () => null), false, id);
    assert.equal(hubLessonVisible(id, () => [{}]), true, id);
  }
});
