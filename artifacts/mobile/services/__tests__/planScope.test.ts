/**
 * What this guards: a teaching plan's grade/subject must come from the class
 * it is anchored to, and a plan written before that anchor existed must still
 * show the text its author typed rather than going blank. The two sources are
 * never shown together — a card claiming two different grades is the failure
 * this pins.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { planScopeParts } from '../planScope.ts';

const CLASSES = [
  { id: 'c1', gradeId: 'grade-10', subjectId: 'mathematics' },
  { id: 'c2', gradeId: 'grade-9', subjectId: '' },
];

const NAMING = {
  grade: (id: string) => (id === 'grade-10' ? 'العاشر' : id === 'grade-9' ? 'التاسع' : ''),
  subject: (id: string) => (id === 'mathematics' ? 'الرياضيات' : ''),
};

describe('planScopeParts', () => {
  it('takes grade and subject from the anchored class', () => {
    assert.deepEqual(
      planScopeParts({ classGroupId: 'c1', grades: '' }, CLASSES, NAMING),
      ['العاشر', 'الرياضيات'],
    );
  });

  it('drops a class subject that was never set', () => {
    assert.deepEqual(
      planScopeParts({ classGroupId: 'c2', grades: '' }, CLASSES, NAMING),
      ['التاسع'],
    );
  });

  it('shows legacy free text when the plan has no class', () => {
    assert.deepEqual(
      planScopeParts({ classGroupId: null, grades: 'العاشر الف' }, CLASSES, NAMING),
      ['العاشر الف'],
    );
  });

  it('prefers the class over stale text, never both', () => {
    // The contradiction case: text says التاسع, the attached class says العاشر.
    assert.deepEqual(
      planScopeParts({ classGroupId: 'c1', grades: 'التاسع' }, CLASSES, NAMING),
      ['العاشر', 'الرياضيات'],
    );
  });

  it('is empty when there is neither', () => {
    assert.deepEqual(planScopeParts({ classGroupId: null, grades: '' }, CLASSES, NAMING), []);
  });

  it('falls back to the text when the class is gone', () => {
    // classGroupId is `set null` on delete server-side, but the list this
    // resolves against is a separate best-effort fetch that can be empty.
    assert.deepEqual(
      planScopeParts({ classGroupId: 'c1', grades: 'العاشر الف' }, [], NAMING),
      ['العاشر الف'],
    );
  });
});
