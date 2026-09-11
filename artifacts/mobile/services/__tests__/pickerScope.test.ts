/**
 * The AI-tools pickers offer grade and subject as two independent lists, so a
 * teacher can land on a pair no book covers — الصف العاشر + التربية الرياضية،
 * حيث joined physical-education MVP_SUBJECT_IDS on 2026-09-09 as a brand-new
 * subject with only a Grade 9 book behind it, so SUBJECTS scopes it to
 * grade-9 only but the picker still offers it against every MVP grade.
 * Unlike the curriculum browser, that pair does not dead-end on an empty
 * list: the topic field is free text, so generation would proceed and invent
 * a Grade 10 paper with no curriculum behind it.
 *
 * The worked example has moved before — english, then islamic, then
 * financial-literacy, then geography, then history, then civic education
 * (each retired the same week its Grade 10 book arrived — see
 * `subjectGradeCoverage.test.ts`'s `KNOWN_BOOKLESS`). That churn is the
 * allowlist doing its job — a pair gaining a book is meant to fail a test and
 * make someone look, and each subject losing this slot the day its Grade 10
 * book arrives is expected, not a regression.
 *
 * The list itself cannot shrink to fix this — `getPickerSubjects()` positions
 * are persisted as bare `subjectIdx` values in formState and route URLs, and
 * it deliberately ignores a gradeId so every screen rebuilds the identical
 * list (see `scopePickerParams`). So the bookless entries are dropped at
 * RENDER time only: the flags below say which, every screen keeps the same
 * underlying list, and the index an option reports is its position in that
 * list rather than in the shortened visible one. Generation re-checks anyway,
 * for URLs saved before any of this existed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MVP_GRADE_IDS,
  getBooksForSubjectGrade,
  getPickerSubjects,
  hasCurriculumForSubjectGrade,
} from '../curriculumData.ts';
import { scopeWithoutCurriculum, subjectsWithoutCurriculum } from '../lessonPrep.ts';

describe('picker scope — grade/subject pairs with no book', () => {
  // A short array would silently hide the wrong rows: `hidden[i]` is read
  // against `subjects[i]`, so a length mismatch mislabels every entry past it.
  it('flags are index-aligned with the picker list, for every MVP grade', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      assert.equal(
        subjectsWithoutCurriculum(gradeId).length,
        getPickerSubjects().length,
        `flags for ${gradeId} do not line up with getPickerSubjects()`,
      );
    }
  });

  it('leaves nothing pickable that has no book behind it', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      const flags = subjectsWithoutCurriculum(gradeId);
      getPickerSubjects().forEach((subject, i) => {
        if (flags[i]) return; // greyed out, not pickable
        assert.ok(
          getBooksForSubjectGrade(subject.id, gradeId, 'teacher').length > 0,
          `subject "${subject.id}" stays pickable for ${gradeId} with no book`,
        );
      });
    }
  });

  // The reported case, pinned by name: it is the PAIR that fails, so the same
  // subject must stay pickable on the grade whose book does exist.
  it('hides physical education for grade-10 but not for grade-9', () => {
    const idx = getPickerSubjects().findIndex(s => s.id === 'physical-education');
    assert.ok(idx >= 0, 'physical-education is expected in the MVP picker list');
    assert.equal(subjectsWithoutCurriculum('grade-10')[idx], true);
    assert.equal(subjectsWithoutCurriculum('grade-9')[idx], false);
  });

  it('leaves the grades own subjects alone', () => {
    const idx = getPickerSubjects().findIndex(s => s.id === 'mathematics');
    assert.equal(subjectsWithoutCurriculum('grade-9')[idx], false);
    assert.equal(subjectsWithoutCurriculum('grade-10')[idx], false);
  });

  // The hazard hiding introduces, and the reason the flags are index-aligned
  // rather than the callers pre-filtering `subjects`. Every visible option must
  // still report its position in the FULL picker list, never its position in
  // the shortened visible one — otherwise choosing the second visible subject
  // for grade-9 would store the index of whatever sits second in the full list,
  // and a saved formState or route URL would reopen on a different subject.
  //
  // This is the exact transform the PillSelector call sites perform, and the
  // one PickerField and the lesson-flow chip row mirror internally by carrying
  // `i` through their filter. There is no renderer in this suite, so the data
  // shape is what gets pinned.
  it('hiding never shifts the index an option reports', () => {
    const subjects = getPickerSubjects();
    assert.ok(subjects.length >= 3, 'need a few subjects for this to mean anything');

    // The mask is synthetic on purpose. When this was written, real data hid
    // only a TRAILING run — grade-9 kept mathematics at index 0 and dropped
    // everything after it — so a catalogue mask could not tell a
    // position-preserving filter from one that re-indexes 0..n: both produce
    // [0]. Hiding the FIRST entry is the case that separates them.
    //
    // As of 2026-09-10 the real bookless mask still lives on grade-10 rather
    // than grade-9, though the gaps there keep closing — geography, history
    // and civic education all gained Grade 10 books. The synthetic mask
    // stays regardless —
    // it pins the property directly instead of depending on the catalogue
    // continuing to supply an interesting shape.
    const hidden = subjects.map((_, i) => i === 0);
    const visible = subjects
      .map((s, i) => ({ value: i, id: s.id }))
      .filter(o => !hidden[o.value]);

    assert.equal(visible.length, subjects.length - 1);
    assert.equal(
      visible[0]!.value, 1,
      'the first visible option must report index 1 — its position in the full list, not in the visible one',
    );
    for (const option of visible) {
      assert.equal(
        subjects[option.value]!.id,
        option.id,
        `option "${option.id}" reports index ${option.value}, which is "${subjects[option.value]?.id}" in the full list`,
      );
    }
  });

  // The live masks, which the synthetic one above cannot stand in for.
  it('never hides every subject a grade has', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      const flags = subjectsWithoutCurriculum(gradeId);
      assert.ok(
        flags.some(f => !f),
        `${gradeId} would render an empty subject picker — every entry is hidden`,
      );
    }
  });

  it('agrees with hasCurriculumForSubjectGrade', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      const flags = subjectsWithoutCurriculum(gradeId);
      getPickerSubjects().forEach((s, i) => {
        assert.equal(flags[i], !hasCurriculumForSubjectGrade(s.id, gradeId));
      });
    }
  });
});

describe('picker scope — the generate-time backstop', () => {
  // The pickers grey the pair out, but gradeIdx/subjectIdx also arrive from
  // formState and bookmarked URLs written before they did.
  it('names the offending pair so the message can say which', () => {
    const scope = scopeWithoutCurriculum('grade-10', 'physical-education', 'ar');
    assert.ok(scope, 'grade-10 + physical-education must be refused');
    assert.equal(scope.subject, 'التربية الرياضية');
    assert.equal(scope.grade, 'الصف العاشر');
  });

  it('answers in the display language', () => {
    const scope = scopeWithoutCurriculum('grade-10', 'physical-education', 'en');
    assert.ok(scope);
    assert.equal(scope.subject, 'Physical Education');
  });

  it('passes a pair that has a book', () => {
    assert.equal(scopeWithoutCurriculum('grade-9', 'physical-education', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-10', 'geography', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-10', 'history', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-10', 'civic-education', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-10', 'mathematics', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-9', 'mathematics', 'ar'), null);
  });

  // `StrandedSelectionNote` renders off `subjectsWithoutCurriculum`, generation
  // refuses off `scopeWithoutCurriculum`. They have to answer identically for
  // every pair the pickers can express: a note with no refusal cries wolf, and
  // a refusal with no note is exactly the silent dead end that dropping the
  // entries reintroduced and the note exists to close.
  it('notes on screen exactly the selections generation refuses', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      const flags = subjectsWithoutCurriculum(gradeId);
      getPickerSubjects().forEach((s, subjectIdx) => {
        const noted = flags[subjectIdx] === true;
        const refused = scopeWithoutCurriculum(gradeId, s.id, 'ar') !== null;
        assert.equal(
          noted,
          refused,
          `${s.id} + ${gradeId}: note shown=${noted} but generation refuses=${refused}`,
        );
      });
    }
  });

  // Never block on something the pickers cannot even express — an unknown id
  // is a routing bug, and refusing it here would only mask it.
  it('stays out of the way for ids the pickers do not carry', () => {
    assert.equal(scopeWithoutCurriculum('grade-99', 'islamic', 'ar'), null);
    assert.equal(scopeWithoutCurriculum('grade-10', 'not-a-subject', 'ar'), null);
  });
});
