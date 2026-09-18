/**
 * A subject's label can depend on the grade, and every surface must agree.
 *
 * `SUBJECTS` carries one name per subject, which is correct while every grade's
 * book covers the same ground. Grade 6 creative-arts is where that broke: its
 * book is drawing/colour, design, forming and construction, theatre arts and
 * art-with-computers — art and drama, and no music — while Grade 7 and Grade 8
 * share one NCCD book of all three domains. The combined name promised a
 * teacher a domain the Grade 6 book never covers.
 *
 * The risk in the fix is drift, not correctness: the label is read at roughly a
 * dozen render sites, and a per-grade override that lands on some of them is
 * worse than none — two screens would then disagree about what the same tile is
 * called. So these tests assert the *data* answers per grade, and that the
 * override never touches anything an index depends on.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBJECTS,
  getSubjectsForGrade,
  subjectForGrade,
  MVP_GRADE_IDS,
} from '../catalog.ts';

const ARTS = 'creative-arts';
const COMBINED_AR = 'التربية الفنّيّة والموسيقيّة والمسرحيّة';
const G6_AR = 'التربية الفنية';

describe('per-grade subject labels', () => {
  test('Grade 6 creative-arts does not claim music', () => {
    const subject = getSubjectsForGrade('grade-6').find(s => s.id === ARTS);
    assert.ok(subject, 'grade-6 should offer creative-arts at all');
    assert.equal(subject.nameAr, G6_AR);
    assert.equal(subject.name, 'Art Education');
    // The specific failure: the word «الموسيقيّة» in front of a teacher whose
    // book contains no music.
    assert.ok(!subject.nameAr.includes('الموسيق'), subject.nameAr);
  });

  test('Grades 7 and 8 keep the combined label, whose books do cover all three', () => {
    for (const gradeId of ['grade-7', 'grade-8']) {
      const subject = getSubjectsForGrade(gradeId).find(s => s.id === ARTS);
      assert.ok(subject, `${gradeId} should offer creative-arts`);
      assert.equal(subject.nameAr, COMBINED_AR, gradeId);
    }
  });

  test('subjectForGrade returns the subject untouched when there is no override', () => {
    // Callers map every subject through it unconditionally, so the no-override
    // path has to be identity or it would quietly rewrite unrelated subjects.
    for (const subject of SUBJECTS) {
      for (const gradeId of MVP_GRADE_IDS) {
        const out = subjectForGrade(subject, gradeId);
        if (subject.id === ARTS && gradeId === 'grade-6') continue;
        assert.deepEqual(out, subject, `${subject.id} @ ${gradeId}`);
      }
    }
  });

  test('an override replaces only the labels, never anything index-bearing', () => {
    // `subjectIdx` is persisted as a bare position and screens re-derive the
    // list; if an override could change `id` or `grades`, a relabelled subject
    // would resolve to a different entry than the one the teacher picked.
    const base = SUBJECTS.find(s => s.id === ARTS)!;
    const out = subjectForGrade(base, 'grade-6');
    assert.equal(out.id, base.id);
    assert.deepEqual(out.grades, base.grades);
    assert.equal(out.icon, base.icon);
    assert.equal(out.color, base.color);
    assert.notEqual(out.nameAr, base.nameAr);
  });

  test('a missing gradeId falls back to the shared label rather than throwing', () => {
    // `subjectPickerLabels` passes `string | undefined` straight through.
    const base = SUBJECTS.find(s => s.id === ARTS)!;
    assert.deepEqual(subjectForGrade(base, undefined), base);
  });
});
