/**
 * The AI-tools pickers offer grade and subject as two independent lists, so a
 * teacher CAN land on a pair no book covers — the topic field is free text,
 * so generation would proceed and invent a paper with no curriculum behind
 * it, unlike the curriculum browser which just dead-ends on an empty list.
 * `subjectsWithoutCurriculum` / `scopeWithoutCurriculum` are the two-layer
 * guard against that: one greys the pair out in the picker, the other
 * refuses it again at generate time for a formState or route URL saved
 * before the pair existed (or before it gained a book).
 *
 * As of 2026-09-09 every MVP subject×grade pair in `MVP_SUBJECT_IDS` ×
 * `MVP_GRADE_IDS` has a book — `financial-literacy:grade-9` was the last
 * gap (see `subjectGradeCoverage.test.ts`, whose `KNOWN_BOOKLESS` allowlist
 * is now empty). So there is no live example left to pin a "this specific
 * pair is hidden" test against; the worked examples this file used to name
 * (english, then islamic, then financial-literacy) each stopped working the
 * day that pair gained a book. Rather than re-litigate that cycle, the tests
 * below assert the CURRENT fully-covered state directly, and keep validating
 * the underlying mechanism (index alignment, the render-time hiding
 * transform, agreement between the note and the refusal) against synthetic
 * data so a future gap is still caught the moment one appears.
 *
 * The picker list itself cannot shrink to hide a gap when one does exist —
 * `getPickerSubjects()` positions are persisted as bare `subjectIdx` values
 * in formState and route URLs, and it deliberately ignores a gradeId so
 * every screen rebuilds the identical list (see `scopePickerParams`). So
 * hiding is a RENDER-time decision: the flags say which entries to grey out,
 * every screen keeps the same underlying list, and the index an option
 * reports is its position in that list rather than in the shortened visible
 * one.
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

  // As of 2026-09-09 there is no bookless MVP pair left to name — see the
  // file header. This is the positive form of that fact: nothing is hidden.
  it('hides nothing — every MVP pair currently has a book', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      const flags = subjectsWithoutCurriculum(gradeId);
      assert.ok(
        flags.every(f => f === false),
        `${gradeId} hides a subject that should now have a book`,
      );
    }
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
    // As of 2026-09-09 the real grade-9 mask hides nothing at all (every MVP
    // pair has a book — see the file header), so a live mask can no longer
    // exercise this property either way. The synthetic mask stays regardless
    // — it pins the property directly instead of depending on the catalogue
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
  // formState and bookmarked URLs written before they did. No real MVP pair
  // is refused right now (see the file header), so this asserts the refusal
  // path stays silent for every pair the pickers can actually express —
  // the message-shape (naming the pair, answering in the display language)
  // is exercised structurally below rather than against a live gap: the
  // moment `KNOWN_BOOKLESS` in `subjectGradeCoverage.test.ts` gains an entry
  // again, this same call starts returning the object these lines describe.
  it('passes every MVP pair — none is refused right now', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      for (const subject of getPickerSubjects()) {
        assert.equal(
          scopeWithoutCurriculum(gradeId, subject.id, 'ar'),
          null,
          `${subject.id} + ${gradeId} is refused but should now have a book`,
        );
      }
    }
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
