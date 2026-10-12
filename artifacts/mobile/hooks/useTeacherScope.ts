/**
 * The grade/subject pickers' view of what this teacher teaches.
 *
 * `/setup-subjects` records a teacher's grades and per-grade subjects, but
 * only the curriculum browser narrowed to them — every generator, the chat
 * context sheet, home and the class sheets still offered all twelve grades.
 * This is the one place those screens read the teacher's selection from.
 *
 * Masks rather than shortened lists: picker positions are persisted as bare
 * indices (see `PickerField`'s `hidden`). Non-teachers and teachers who have
 * not set up yet get no masking — `hiddenOutsideSelection` falls back to
 * showing everything.
 */
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { subjectsWithoutCurriculum } from '@/services/lessonPrep';
import { hiddenOutsideSelection, hiddenSubjectsForGrade, subjectHideReason } from '@/services/teacherCatalogFilter';

export function useTeacherScope() {
  const { user } = useAuth();
  const teacher = isTeacherRole(user?.role);
  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  const gradeHidden = hiddenOutsideSelection(grades, teacher ? user?.gradeIds : undefined);

  /** Per-subject masks under `gradeId`, kept apart so the reason can be told. */
  const subjectMasks = (gradeId: string) => {
    const noBook = subjectsWithoutCurriculum(gradeId);
    const notTaught = teacher
      ? hiddenSubjectsForGrade(subjects, gradeId, user?.teachingAssignments, user?.subjectIds)
      : noBook.map(() => false);
    return { noBook, notTaught };
  };

  /** Subjects to hide under `gradeId`: not taught by this teacher there, or no book for it. */
  const subjectHiddenFor = (gradeId: string): boolean[] => {
    const { noBook, notTaught } = subjectMasks(gradeId);
    return noBook.map((hidden, i) => hidden || notTaught[i]);
  };

  /**
   * The i18n key for the note under the grade picker when the picked subject is
   * hidden: «no book» and «you don't teach it here» are different facts with
   * different ways out, and the note used to say the first for both.
   */
  const strandedNoteKey = (gradeId: string, subjectIdx: number) => {
    const { noBook, notTaught } = subjectMasks(gradeId);
    return subjectHideReason(noBook, notTaught, subjectIdx) === 'notTaught'
      ? 'scopeNotTaughtHint'
      : 'scopeNoCurriculumHint';
  };

  // Where a picker should open when nothing (route, topic, saved form) says
  // otherwise: the teacher's first grade and its first taught subject,
  // instead of index 0 — a grade they may not teach at all.
  const gradeIdx = Math.max(0, gradeHidden.indexOf(false));
  const subjectIdx = Math.max(0, subjectHiddenFor(grades[gradeIdx]?.id ?? '').indexOf(false));

  // Id-based siblings, for the screens that hold ids rather than indices
  // (home, the chat sheet, classes).
  const isGradeShown = (gradeId: string) => !gradeHidden[grades.findIndex(g => g.id === gradeId)];
  const isSubjectShown = (subjectId: string, gradeId: string) =>
    !subjectHiddenFor(gradeId)[subjects.findIndex(s => s.id === subjectId)];

  return {
    gradeHidden,
    subjectHiddenFor,
    strandedNoteKey,
    isGradeShown,
    isSubjectShown,
    defaultScope: { gradeIdx, subjectIdx },
    defaultIds: { gradeId: grades[gradeIdx]?.id ?? '', subjectId: subjects[subjectIdx]?.id ?? '' },
  };
}
