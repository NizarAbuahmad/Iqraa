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

import { scopeFromParams, topicForScope } from '../lessonPrep.ts';
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

  describe('with a teacher selection', () => {
    // A teacher who picked only Grade 10 (index 0). The mask is index-aligned
    // with the picker list, exactly as `useTeacherScope` builds it.
    const gradeHidden = grades.map((_, i) => i !== 0);
    const subjectHiddenFor = () => subjects.map((_, i) => i !== 0);
    const selection = { gradeHidden, subjectHiddenFor };
    const grade1Idx = grades.findIndex(g => g.id === 'grade-1');

    it('falls back to the selected grade when the route names a hidden one', () => {
      // The reported URL: a Grade 1 lesson, for a teacher who never picked it.
      // The picker used to open on الصف الأول although it is not in the dropdown.
      const scope = scopeFromParams(
        { topic: 'المَوْقِعُ وَالإِتّجاهَ', gradeIdx: String(grade1Idx), subjectIdx: '0' },
        'ar',
        { gradeIdx: 0, subjectIdx: 0 },
        selection,
      );
      assert.equal(scope.gradeIdx, 0);
    });

    it('does not take a hidden grade from the grounded topic either', () => {
      const scope = scopeFromParams(
        { topic: SCIENCE_TOPIC },
        'ar',
        { gradeIdx: 0, subjectIdx: 0 },
        selection,
      );
      assert.equal(scope.gradeIdx, 0, 'topic is grade-3; the teacher does not teach it');
    });

    it('falls back to a shown subject when the route names a hidden one', () => {
      const scope = scopeFromParams(
        { gradeIdx: '0', subjectIdx: '1' },
        'ar',
        { gradeIdx: 0, subjectIdx: 0 },
        selection,
      );
      assert.deepEqual(scope, { gradeIdx: 0, subjectIdx: 0 });
    });

    it('keeps a route scope that is inside the selection', () => {
      const scope = scopeFromParams(
        { gradeIdx: '0', subjectIdx: '0' },
        'ar',
        { gradeIdx: 0, subjectIdx: 0 },
        selection,
      );
      assert.deepEqual(scope, { gradeIdx: 0, subjectIdx: 0 });
    });

    it('is unchanged when nothing is hidden', () => {
      const none = { gradeHidden: grades.map(() => false), subjectHiddenFor: () => subjects.map(() => false) };
      const scope = scopeFromParams(
        { gradeIdx: String(grade1Idx), subjectIdx: '0' },
        'ar',
        { gradeIdx: 0, subjectIdx: 0 },
        none,
      );
      assert.equal(scope.gradeIdx, grade1Idx);
    });
  });

  describe('topicForScope', () => {
    const gradeHidden = grades.map((_, i) => i !== 0);
    const subjectHiddenFor = () => subjects.map((_, i) => i !== 0);
    const selection = { gradeHidden, subjectHiddenFor };
    const fallback = { gradeIdx: 0, subjectIdx: 0 };
    const grade1Idx = grades.findIndex(g => g.id === 'grade-1');
    const GRADE1_TOPIC = 'المَوْقِعُ وَالإِتّجاهَ';

    it('clears a topic whose grade the selection hides', () => {
      const params = { topic: GRADE1_TOPIC, gradeIdx: String(grade1Idx), subjectIdx: '0' };
      assert.equal(topicForScope(params, 'ar', fallback, selection), '');
    });

    it('clears a topic whose grade was only inferred from the topic', () => {
      assert.equal(topicForScope({ topic: SCIENCE_TOPIC }, 'ar', fallback, selection), '');
    });

    it('clears a topic when only the subject fell back', () => {
      const params = { topic: SCIENCE_TOPIC, gradeIdx: '0', subjectIdx: '1' };
      assert.equal(topicForScope(params, 'ar', fallback, selection), '');
    });

    it('keeps a topic that sits inside the selection', () => {
      const params = { topic: SCIENCE_TOPIC, gradeIdx: '0', subjectIdx: '0' };
      assert.equal(topicForScope(params, 'ar', fallback, selection), SCIENCE_TOPIC);
    });

    it('keeps the topic when no selection is given', () => {
      const params = { topic: GRADE1_TOPIC, gradeIdx: String(grade1Idx), subjectIdx: '0' };
      assert.equal(topicForScope(params, 'ar', fallback), GRADE1_TOPIC);
    });

    it('returns an empty string when there is no topic', () => {
      assert.equal(topicForScope({}, 'ar', fallback, selection), '');
    });
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
