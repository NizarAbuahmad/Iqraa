/**
 * The grade and subject a saved board is filed under.
 *
 * The board is opened three ways, and each says where it came from differently:
 *  - from a running presentation, which passes the activity's own `subject` and
 *    `grade` as names;
 *  - from Today or the Tools tab, which pass the lesson's picker positions
 *    (`gradeIdx`, `subjectIdx`, the same ones every generator screen takes) with the
 *    `topic`, and no names;
 *  - from «ملفاتي», which reopens a saved board and never saves under a new scope.
 *
 * Until 2026-11-21 only the first reached `saveItem`, so a board opened from Today was
 * filed with an empty subject and grade and did not turn up under its lesson's filters.
 *
 * A name that is passed wins. An index counts only if it names an entry (`pickerIndexOrNull`:
 * an out-of-range position is absent, never index 0, which is Mathematics). Grade and subject
 * resolve independently, so a route carrying only one still files under that one. The topic is
 * never searched for a scope: a bare topic leaves both empty, as before.
 *
 * Pure (no React Native), so `node --test` can load it.
 */
import { getPickerGrades, getPickerSubjects, pickerIndexOrNull } from './curriculumData.ts';

export type BoardScopeParams = { subject?: string; grade?: string; gradeIdx?: string; subjectIdx?: string };

const named = (v: string | undefined): string => (typeof v === 'string' ? v.trim() : '');

export function boardScope(params: BoardScopeParams): { subject: string; grade: string } {
  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeAt = pickerIndexOrNull(params.gradeIdx, grades.length);
  const subjectAt = pickerIndexOrNull(params.subjectIdx, subjects.length);
  return {
    subject: named(params.subject) || (subjectAt != null ? subjects[subjectAt]!.name : ''),
    grade: named(params.grade) || (gradeAt != null ? grades[gradeAt]!.name : ''),
  };
}
