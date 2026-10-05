/**
 * The route params a class hands to the AI tools when the teacher taps
 * «أنشئ مادة جديدة» from its الموارد tab.
 *
 * Runs with Node's built-in test runner via `pnpm test` in artifacts/mobile.
 *
 * Two things must hold. The class id travels, so the tool can file the saved
 * material straight into it. And the class's own grade/subject travel as picker
 * indices, because every `/ai-tools/*` screen defaults `subjectIdx` to 0 and 0
 * is Mathematics — a chemistry class would otherwise open a maths worksheet
 * (the trap CLAUDE.md records under "Generators branch on the subject NAME").
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classToolParams, classIdFromParam, classToolParamsFromRoute } from '../classToolParams.ts';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';

describe('classToolParams', () => {
  it('carries the class id and picker indices into the lists the tools rebuild', () => {
    const params = classToolParams({ id: 'c1', gradeId: 'grade-10', subjectId: 'chemistry' });
    assert.equal(params.classId, 'c1');
    assert.equal(getPickerGrades()[Number(params.gradeIdx)]!.id, 'grade-10');
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'chemistry');
  });

  it('does not leave a chemistry class on subject index 0 (Mathematics)', () => {
    const params = classToolParams({ id: 'c1', gradeId: 'grade-10', subjectId: 'chemistry' });
    assert.notEqual(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'mathematics');
  });

  it('sends only the class id when the scope is unknown, never a fabricated index', () => {
    // A class made before subjects were stored has an empty subjectId.
    assert.deepEqual(classToolParams({ id: 'c1', gradeId: 'grade-10', subjectId: '' }), { classId: 'c1' });
    assert.deepEqual(classToolParams({ id: 'c1', gradeId: 'grade-11', subjectId: 'mathematics' }), { classId: 'c1' });
    assert.deepEqual(classToolParams({ id: 'c1', gradeId: 'grade-10', subjectId: 'no-such-subject' }), { classId: 'c1' });
  });
});

describe('classIdFromParam', () => {
  it('accepts a plain id', () => {
    assert.equal(classIdFromParam('c1'), 'c1');
  });

  it('takes the first of a repeated param', () => {
    // expo-router hands back string[] when a query key repeats.
    assert.equal(classIdFromParam(['c1', 'c2']), 'c1');
  });

  it('treats absent, empty and blank as no class', () => {
    assert.equal(classIdFromParam(undefined), null);
    assert.equal(classIdFromParam(''), null);
    assert.equal(classIdFromParam('   '), null);
    assert.equal(classIdFromParam([]), null);
  });
});

describe('classToolParamsFromRoute', () => {
  // The hub receives these from the class screen and forwards them to the tool
  // the teacher picks — it must hand on exactly what it was given, or nothing.
  it('forwards the class id and the picker indices it was given', () => {
    assert.deepEqual(
      classToolParamsFromRoute({ classId: 'c1', gradeIdx: '9', subjectIdx: '2' }),
      { classId: 'c1', gradeIdx: '9', subjectIdx: '2' },
    );
  });

  it('is null without a class, so the hub keeps its ordinary behaviour', () => {
    assert.equal(classToolParamsFromRoute({}), null);
    assert.equal(classToolParamsFromRoute({ gradeIdx: '9', subjectIdx: '2' }), null);
    assert.equal(classToolParamsFromRoute({ classId: ' ' }), null);
  });

  it('drops indices that are blank or not whole numbers instead of passing them on', () => {
    // A bare "NaN"/"" reaching a tool becomes index 0 — Mathematics.
    assert.deepEqual(
      classToolParamsFromRoute({ classId: 'c1', gradeIdx: '', subjectIdx: 'abc' }),
      { classId: 'c1' },
    );
    assert.deepEqual(
      classToolParamsFromRoute({ classId: 'c1', gradeIdx: ['9', '3'], subjectIdx: '-1' }),
      { classId: 'c1', gradeIdx: '9' },
    );
  });
});
