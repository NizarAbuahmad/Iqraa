import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LabItem } from '@workspace/curriculum/lab';
import { initialLabGrade, keepLabSubject, labGradeIds, labSubjectIds } from '../labFilters.ts';

const item = (id: string, gradeId: string, subjectId: string): LabItem => ({
  id,
  kind: 'external',
  externalId: id,
  gradeId,
  subjectId,
  lessonId: `kbl-${id}`,
  titleAr: id,
  titleEn: id,
});

const ITEMS: LabItem[] = [
  item('a', 'grade-10', 'physics'),
  item('b', 'grade-10', 'chemistry'),
  item('c', 'grade-5', 'science'),
  item('d', 'grade-10', 'physics'),
];
const ORDER = ['grade-10', 'grade-9', 'grade-8', 'grade-5'];

describe('labGradeIds', () => {
  it('lists only grades with items, in display order', () => {
    assert.deepEqual(labGradeIds(ITEMS, ORDER), ['grade-10', 'grade-5']);
  });
  it('drops a grade the display order does not show', () => {
    assert.deepEqual(labGradeIds(ITEMS, ['grade-10']), ['grade-10']);
  });
});

describe('initialLabGrade', () => {
  const grades = ['grade-10', 'grade-5'];
  it('opens on the user\'s own grade when it has items', () => {
    assert.equal(initialLabGrade(grades, ['grade-5']), 'grade-5');
  });
  it('takes the first in display order when the user teaches several', () => {
    assert.equal(initialLabGrade(grades, ['grade-5', 'grade-10']), 'grade-10');
  });
  it('opens on all grades when none of the user\'s grades has items', () => {
    assert.equal(initialLabGrade(grades, ['grade-7']), null);
  });
  it('opens on all grades with no grades picked yet', () => {
    assert.equal(initialLabGrade(grades, undefined), null);
    assert.equal(initialLabGrade(grades, []), null);
  });
});

describe('labSubjectIds', () => {
  it('lists the grade\'s subjects once each, in manifest order', () => {
    assert.deepEqual(labSubjectIds(ITEMS, 'grade-10'), ['physics', 'chemistry']);
    assert.deepEqual(labSubjectIds(ITEMS, 'grade-5'), ['science']);
  });
  it('lists every subject for all grades', () => {
    assert.deepEqual(labSubjectIds(ITEMS, null), ['physics', 'chemistry', 'science']);
  });
});

describe('keepLabSubject', () => {
  it('keeps a subject the grade still offers', () => {
    assert.equal(keepLabSubject('physics', ['physics', 'chemistry']), 'physics');
  });
  it('falls back to all subjects when the grade has none of it', () => {
    assert.equal(keepLabSubject('physics', ['science']), null);
  });
  it('keeps all subjects as all subjects', () => {
    assert.equal(keepLabSubject(null, ['science']), null);
  });
});
