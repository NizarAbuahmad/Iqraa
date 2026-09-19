/**
 * Narrows a catalog list (GRADES or SUBJECTS from `@workspace/curriculum`) to
 * what a teacher picked on `/setup-subjects`, for `app/(tabs)/curriculum.tsx`.
 *
 * Split out of that screen — same reason routeGating.ts is split out of
 * `_layout.tsx` — so this pure filter can be unit-tested without loading
 * expo-router/react-native at module scope.
 *
 * Falls back to the full list whenever narrowing would leave nothing to show:
 * no selection yet (parents/students, or a teacher on a stale cached user),
 * and the edge case where every picked id has since dropped out of the
 * catalog (MVP_GRADE_IDS/MVP_SUBJECT_IDS shrinking) would otherwise render an
 * unexplained empty screen instead of the honest "here's everything" default.
 */
export function narrowToSelection<T extends { id: string }>(all: T[], selectedIds: string[] | undefined): T[] {
  if (!selectedIds?.length) return all;
  const narrowed = all.filter(item => selectedIds.includes(item.id));
  return narrowed.length > 0 ? narrowed : all;
}

/**
 * The subjects narrowing above should have used all along for a *specific*
 * grade: `narrowToSelection(SUBJECTS, user.subjectIds)` narrows to every
 * subject the teacher picked for *any* grade, so a teacher who set up Math
 * for grade 7 and only Science for grade 8 still saw Math offered under
 * grade 8. `teachingAssignments` (set by `/setup-subjects`) carries the real
 * pairing; this reads the one entry for `gradeId` and narrows to just its
 * subjects.
 *
 * Falls back to the flat `legacySubjectIds` narrowing when there is no
 * matching assignment — an account set up before `teachingAssignments`
 * existed, or (defensively) a grade somehow selected outside the teacher's
 * picked set.
 */
export function narrowSubjectsForGrade<T extends { id: string }>(
  all: T[],
  gradeId: string,
  teachingAssignments: { gradeId: string; subjectIds: string[] }[] | undefined,
  legacySubjectIds: string[] | undefined,
): T[] {
  const assignment = teachingAssignments?.find(a => a.gradeId === gradeId);
  return narrowToSelection(all, assignment ? assignment.subjectIds : legacySubjectIds);
}
