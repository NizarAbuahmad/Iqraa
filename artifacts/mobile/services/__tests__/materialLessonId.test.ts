import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withLessonId, formStateKbScope } from '../materialLessonId.ts';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
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

// A title repeats across grade books (107 Arabic titles). The fallback used to
// ground it with no grade or subject, so a save with no lessonId could land on
// another grade's lesson. gradeIdx / subjectIdx in the saved formState are
// positions in the picker lists and now narrow the lookup.
describe('withLessonId — the saved grade and subject scope a repeated title', () => {
  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const drifting: { gradeIdx: number; subjectIdx: number; lesson: { id: string; titleAr: string }; unscoped: string | undefined }[] = [];
  grades.forEach((g, gradeIdx) => subjects.forEach((s, subjectIdx) => {
    for (const u of getUnitsForSubjectGrade(s.id, g.id)) {
      for (const lesson of getLessonsForUnit(u.id)) {
        const unscoped = generatorLessonId(lesson.titleAr, 'ar');
        if (unscoped && unscoped !== lesson.id) drifting.push({ gradeIdx, subjectIdx, lesson, unscoped });
      }
    }
  }));

  it('precondition: some picker lesson re-grounds to another lesson by title alone', () => {
    assert.ok(drifting.length > 0);
  });

  it('with gradeIdx/subjectIdx a title that is unique in its book resolves to its own lesson', () => {
    // A title that repeats WITHIN one grade+subject (Grade 10 English units all have
    // «المفردات والقواعد») cannot be told apart by scope: only a stored lessonId can.
    let checked = 0;
    for (const d of drifting) {
      const g = getPickerGrades()[d.gradeIdx]!.id;
      const s = getPickerSubjects()[d.subjectIdx]!.id;
      const same = getUnitsForSubjectGrade(s, g).flatMap(u => getLessonsForUnit(u.id)).filter(l => l.titleAr === d.lesson.titleAr);
      if (same.length !== 1) continue;
      checked++;
      const out = withLessonId({ gradeIdx: d.gradeIdx, subjectIdx: d.subjectIdx }, d.lesson.titleAr, 'ar');
      assert.equal(out?.lessonId, d.lesson.id, `${g}/${s} «${d.lesson.titleAr}»`);
    }
    assert.ok(checked > 50, `only ${checked} drifting lessons had a title unique in their book`);
  });

  it('string positions (route params) work the same; out-of-range ones add no limit', () => {
    const d = drifting[0]!;
    const a = withLessonId({ gradeIdx: d.gradeIdx, subjectIdx: d.subjectIdx }, d.lesson.titleAr, 'ar');
    const b = withLessonId({ gradeIdx: String(d.gradeIdx), subjectIdx: String(d.subjectIdx) }, d.lesson.titleAr, 'ar');
    assert.equal(a?.lessonId, b?.lessonId);
    assert.equal(formStateKbScope({ gradeIdx: 999, subjectIdx: 'x' }), undefined);
    assert.equal(formStateKbScope({}), undefined);
  });

  it('a lessonId the screen stored still wins over any scope', () => {
    const d = drifting[0]!;
    assert.equal(withLessonId({ gradeIdx: d.gradeIdx, subjectIdx: d.subjectIdx, lessonId: 'mine' }, d.lesson.titleAr, 'ar')?.lessonId, 'mine');
  });
});
