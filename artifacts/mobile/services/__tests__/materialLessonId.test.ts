import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withLessonId } from '../materialLessonId.ts';
import { generatorLessonId } from '../kbContext.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import { scopeFormState } from '../wideScopeRequest.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

// A wide paper's topic is its scope LABEL (a unit title). Grounding that text
// without a grade limit finds a lesson in some other grade, and the workspace
// used to stamp that lesson's id on the saved material.
const units = getUnitsForSubjectGrade('mathematics', 'grade-10');
const unitSel = (unitId: string): ScopeSelection => ({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId });

describe('withLessonId — wide papers', () => {
  it('precondition: some grade-10 unit label re-grounds to a lesson (the stamp used to happen)', () => {
    assert.ok(units.some(u => generatorLessonId(u.titleAr, 'ar')));
  });

  it('a unit-wide save stores no lessonId, whatever the label grounds to', () => {
    for (const u of units) {
      const fs = { ...scopeFormState(unitSel(u.id), 'balanced') };
      const out = withLessonId(fs, u.titleAr, 'ar');
      assert.equal(out?.lessonId, undefined, `unit ${u.id} «${u.titleAr}» must not be stamped`);
      assert.equal(out, fs, 'formState is returned untouched');
    }
  });

  it('semester and book scopes are not stamped either', () => {
    const sels: ScopeSelection[] = [
      { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 },
      { kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics' },
    ];
    for (const sel of sels) {
      for (const u of units) {
        const out = withLessonId(scopeFormState(sel, 'random'), u.titleAr, 'ar');
        assert.equal(out?.lessonId, undefined);
      }
    }
  });
});

describe('withLessonId — a single lesson is unchanged', () => {
  const lesson = units.flatMap(u => getLessonsForUnit(u.id)).find(l => generatorLessonId(l.titleAr, 'ar'));
  const title = lesson?.titleAr ?? '';
  const expected = generatorLessonId(title, 'ar');

  it('stamps the grounded lesson id when none is set', () => {
    assert.ok(title && expected);
    assert.deepEqual(withLessonId({ a: 1 }, title, 'ar'), { a: 1, lessonId: expected });
  });

  it('a lesson-scope formState (scopeFormState records nothing) behaves as before', () => {
    const lessonSel: ScopeSelection = { kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId: lesson!.id };
    const fs = scopeFormState(lessonSel, 'balanced');
    assert.deepEqual(fs, {});
    assert.deepEqual(withLessonId(fs, title, 'ar'), { lessonId: expected });
    // an explicit lesson-kind scope key is a lesson too
    assert.equal(withLessonId({ scope: JSON.stringify(lessonSel) }, title, 'ar')?.lessonId, expected);
  });

  it('an id the caller set wins; no topic or no formState passes through', () => {
    assert.equal(withLessonId({ lessonId: 'mine' }, title, 'ar')?.lessonId, 'mine');
    assert.equal(withLessonId(undefined, title, 'ar'), undefined);
    const fs = {};
    assert.equal(withLessonId(fs, '  ', 'ar'), fs);
  });

  it('a malformed saved scope is not a wide scope', () => {
    assert.equal(withLessonId({ scope: '{not json' }, title, 'ar')?.lessonId, expected);
  });
});
