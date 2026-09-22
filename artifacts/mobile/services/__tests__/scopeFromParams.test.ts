/**
 * A generator screen's opening grade/subject comes from its route params, and
 * getting it wrong is not cosmetic: the request carries
 * `subjects[subjectIdx].name`, `isMathContext` branches on that string, and a
 * mislabelled scope produces a maths paper under another subject's title.
 *
 * The bug these pin: an index the picker list could not honour was coerced to
 * 0 — Mathematics — and was then indistinguishable from no index at all, so
 * the topic was never ground for a better answer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { scopeFromParams } from '../lessonPrep.ts';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';

const subjects = getPickerSubjects();
const grades = getPickerGrades();
const idOf = (i: number) => subjects[i]?.id;

// A real grade-3 science lesson title, as the catalogs spell it.
const SCIENCE_TOPIC = 'تَكاثُرُ الْكائِناتِ الْحَيَّةِ وَدَوْراتُ حَياتِها';

describe('scopeFromParams', () => {
  it('uses both route indices when the list can honour them', () => {
    const scope = scopeFromParams(
      { topic: SCIENCE_TOPIC, gradeIdx: '0', subjectIdx: '0' },
      'ar',
    );
    assert.deepEqual(scope, { gradeIdx: 0, subjectIdx: 0 });
  });

  it('grounds the topic when an index names no entry in the list', () => {
    // The reported URL: a science topic, a subject index past the end of the
    // list, and no grade index at all. This used to open Grade 10 Mathematics.
    const scope = scopeFromParams(
      { topic: SCIENCE_TOPIC, subjectIdx: String(subjects.length + 5) },
      'ar',
    );
    assert.equal(idOf(scope.subjectIdx), 'science');
    assert.equal(grades[scope.gradeIdx]?.id, 'grade-3');
  });

  it('grounds the topic when the indices are simply absent', () => {
    const scope = scopeFromParams({ topic: SCIENCE_TOPIC }, 'ar');
    assert.equal(idOf(scope.subjectIdx), 'science');
    assert.equal(grades[scope.gradeIdx]?.id, 'grade-3');
  });

  it('keeps a usable index and grounds only the missing one', () => {
    const scope = scopeFromParams(
      { topic: SCIENCE_TOPIC, gradeIdx: '0' },
      'ar',
    );
    assert.equal(scope.gradeIdx, 0, 'an explicit, usable grade must still win');
    assert.equal(idOf(scope.subjectIdx), 'science');
  });

  it('treats a non-numeric or negative index as absent', () => {
    for (const bad of ['abc', '-1', '']) {
      const scope = scopeFromParams({ topic: SCIENCE_TOPIC, subjectIdx: bad }, 'ar');
      assert.equal(idOf(scope.subjectIdx), 'science', `not grounded for: "${bad}"`);
    }
  });

  it('falls back to index 0 when the topic grounds to nothing', () => {
    // Unchanged behaviour — with no topic to learn from there is nothing
    // better than the default, and the screen's own pickers take over.
    const scope = scopeFromParams(
      { topic: 'موضوع لا وجود له في المنهاج', subjectIdx: '999' },
      'ar',
    );
    assert.deepEqual(scope, { gradeIdx: 0, subjectIdx: 0 });
    assert.deepEqual(scopeFromParams({}, 'ar'), { gradeIdx: 0, subjectIdx: 0 });
  });
});
