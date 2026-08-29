/**
 * Picker order is persisted state, not presentation.
 *
 * Generator screens store `gradeIdx` / `subjectIdx` — bare positions into
 * `getPickerGrades()` / `getPickerSubjects()` — in saved-material formState
 * and in route URLs, and fall back to index 0 when a param is absent. So the
 * order of these lists is an implicit schema: when enabling English in the
 * MVP set *inserted* it at the front (SUBJECTS declaration order), index 0
 * silently became English, and a bookmarked `/ai-tools/quiz?topic=<math
 * lesson>` opened as «اختبار في اللغة الإنجليزية» over math questions.
 *
 * The MVP pickers therefore follow MVP_GRADE_IDS / MVP_SUBJECT_IDS order, and
 * new entries are APPENDED to those arrays. These tests pin the positions
 * that existing stored indices rely on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPickerGrades,
  getPickerSubjects,
  getSubjectsForGrade,
  INVESTOR_MVP_CURRICULUM,
  MVP_GRADE_IDS,
  MVP_SUBJECT_IDS,
} from '../catalog.ts';

describe('picker order under the MVP lock', () => {
  it('subjects follow MVP_SUBJECT_IDS order — mathematics stays index 0', () => {
    if (!INVESTOR_MVP_CURRICULUM) return;
    assert.deepEqual(
      getPickerSubjects().map(s => s.id),
      [...MVP_SUBJECT_IDS],
    );
    // The positions stored indices depend on, pinned literally: these are the
    // pre-English positions, so every formState saved before English joined
    // still points at the subject the teacher chose.
    assert.equal(getPickerSubjects()[0]!.id, 'mathematics');
    assert.equal(getPickerSubjects()[1]!.id, 'chemistry');
    assert.equal(getPickerSubjects()[2]!.id, 'financial-literacy');
  });

  it('grades follow MVP_GRADE_IDS order — grade-10 stays index 0', () => {
    if (!INVESTOR_MVP_CURRICULUM) return;
    assert.deepEqual(
      getPickerGrades().map(g => g.id),
      [...MVP_GRADE_IDS],
    );
    assert.equal(getPickerGrades()[0]!.id, 'grade-10');
  });

  it('new MVP entries are appended, never inserted', () => {
    // If either of these fails, an entry was added before an existing one and
    // every stored picker index after it now points one entry off. Append to
    // the end of the MVP array instead.
    assert.equal(MVP_SUBJECT_IDS.indexOf('mathematics'), 0);
    assert.equal(MVP_GRADE_IDS.indexOf('grade-10'), 0);
  });

  it('getSubjectsForGrade agrees with the picker order', () => {
    if (!INVESTOR_MVP_CURRICULUM) return;
    for (const gradeId of MVP_GRADE_IDS) {
      const ids = getSubjectsForGrade(gradeId).map(s => s.id);
      const pickerIds = getPickerSubjects().map(s => s.id).filter(id => ids.includes(id));
      assert.deepEqual(ids, pickerIds, `subject order for ${gradeId} diverges from the picker`);
    }
  });
});
