/**
 * Grade-range picker tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/pickerGrades.test.ts
 *
 * The pickers widened from [G10] to grades 7–12 while the browsable curriculum
 * stayed G10-only. Two compatibility properties carry all the risk, and both
 * are index-shaped:
 *
 *  1. Every formState saved before the widening holds `gradeIdx: 0` from a
 *     single-entry list. Restores must land on Grade 10, never Grade 7.
 *  2. Legacy `subjectIdx` values 0/1/2 were written against
 *     [mathematics, chemistry, financial-literacy]. Grade 10's subject list
 *     must keep exactly that prefix or old saves restore to the wrong subject.
 *
 * Plus the honesty gate: a grade the KB has no books for must never ground —
 * a G9 teacher's «المعادلات» must not be claimed as anchored to the G10 book.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultPickerGradeIndex,
  getPickerGrades,
  getPickerSubjects,
  getVisibleGrades,
  resolveSavedGradeIndex,
} from '../curriculumData.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';

// A topic that provably grounds today (asserted below, so if the KB ever
// drops this lesson the test fails loudly instead of vacuously passing).
const GROUNDED_TOPIC = 'حل المعادلة الأسية';

describe('picker grade range', () => {
  it('offers grades 7 through 12, in order', () => {
    assert.deepEqual(getPickerGrades().map(g => g.level), [7, 8, 9, 10, 11, 12]);
  });

  it('starts on Grade 10 — the grade with curriculum behind it', () => {
    const grades = getPickerGrades();
    assert.equal(grades[getDefaultPickerGradeIndex()].id, 'grade-10');
  });

  it('leaves the browsable curriculum at Grade 10 only', () => {
    // The tools degrade honestly on a bookless grade; the curriculum tab
    // dead-ends on one. Widening must not leak into getVisibleGrades.
    assert.deepEqual(getVisibleGrades().map(g => g.id), ['grade-10']);
  });
});

describe('legacy restore', () => {
  it('maps an absent gradeId to Grade 10 — every legacy save was G10', () => {
    const grades = getPickerGrades();
    assert.equal(grades[resolveSavedGradeIndex(undefined)].id, 'grade-10');
  });

  it('maps an unknown gradeId to Grade 10 rather than row zero', () => {
    const grades = getPickerGrades();
    assert.equal(grades[resolveSavedGradeIndex('grade-99')].id, 'grade-10');
  });

  it('resolves a real gradeId to its own row', () => {
    const grades = getPickerGrades();
    assert.equal(grades[resolveSavedGradeIndex('grade-9')].id, 'grade-9');
    assert.equal(grades[resolveSavedGradeIndex('grade-12')].id, 'grade-12');
  });
});

describe('subjects per grade', () => {
  it('keeps the legacy [math, chem, finlit] prefix for Grade 10', () => {
    // subjectIdx 0/1/2 in old saves indexes into exactly this prefix.
    const ids = getPickerSubjects('grade-10').map(s => s.id);
    assert.deepEqual(ids.slice(0, 3), ['mathematics', 'chemistry', 'financial-literacy']);
  });

  it('gives Grade 10 the secondary sciences but not basic-stage subjects', () => {
    const ids = getPickerSubjects('grade-10').map(s => s.id);
    assert.ok(ids.includes('physics'));
    assert.ok(ids.includes('biology'));
    assert.equal(ids.includes('science'), false);
    assert.equal(ids.includes('social'), false);
  });

  it('gives Grade 7 basic-stage subjects and none of the secondary split', () => {
    const ids = getPickerSubjects('grade-7').map(s => s.id);
    assert.ok(ids.includes('science'));
    assert.ok(ids.includes('mathematics'));
    for (const secondary of ['physics', 'chemistry', 'biology', 'financial-literacy']) {
      assert.equal(ids.includes(secondary), false, `${secondary} leaked into grade 7`);
    }
  });

  it('keeps the no-arg legacy shape: exactly the MVP three, in order', () => {
    assert.deepEqual(
      getPickerSubjects().map(s => s.id),
      ['mathematics', 'chemistry', 'financial-literacy'],
    );
  });
});

describe('grounding gate', () => {
  it('grounds the control topic for Grade 10 mathematics', () => {
    const g = resolveGeneratorGrounding(GROUNDED_TOPIC, 'ar', {
      gradeId: 'grade-10', subjectId: 'mathematics',
    });
    assert.equal(g.grounded, true);
  });

  it('refuses to ground the same topic for a grade the KB has no books for', () => {
    const g = resolveGeneratorGrounding(GROUNDED_TOPIC, 'ar', {
      gradeId: 'grade-9', subjectId: 'mathematics',
    });
    assert.equal(g.grounded, false);
    assert.equal(g.lesson, null);
    // The model must be told not to claim textbook grounding.
    assert.ok(g.ungroundedNote.length > 0);
  });

  it('refuses to ground across subjects within Grade 10', () => {
    // Same grade, but a subject with no KB books — an English teacher's topic
    // must not be anchored to a math lesson that happens to share words.
    const g = resolveGeneratorGrounding(GROUNDED_TOPIC, 'ar', {
      gradeId: 'grade-10', subjectId: 'english',
    });
    assert.equal(g.grounded, false);
  });

  it('keeps the old behaviour when no gate is supplied (chat has no picker)', () => {
    const g = resolveGeneratorGrounding(GROUNDED_TOPIC, 'ar');
    assert.equal(g.grounded, true);
  });
});
