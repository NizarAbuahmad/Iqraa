/**
 * Narrows a catalog list (GRADES or SUBJECTS from `@workspace/curriculum`) to
 * what a teacher picked on `/setup-subjects`, for `app/curriculum/browse.tsx`.
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

/**
 * `narrowToSelection` as an index-aligned hide mask, for the pickers whose
 * positions are persisted as bare indices (`PickerField`'s `hidden` prop) and
 * so cannot be handed a shortened list. Same fallback: nothing hidden when
 * narrowing would leave nothing.
 */
export function hiddenOutsideSelection<T extends { id: string }>(all: T[], selectedIds: string[] | undefined): boolean[] {
  const kept = new Set(narrowToSelection(all, selectedIds).map(item => item.id));
  return all.map(item => !kept.has(item.id));
}

/** `narrowSubjectsForGrade` as an index-aligned hide mask — see above. */
export function hiddenSubjectsForGrade<T extends { id: string }>(
  all: T[],
  gradeId: string,
  teachingAssignments: { gradeId: string; subjectIds: string[] }[] | undefined,
  legacySubjectIds: string[] | undefined,
): boolean[] {
  const assignment = teachingAssignments?.find(a => a.gradeId === gradeId);
  return hiddenOutsideSelection(all, assignment ? assignment.subjectIds : legacySubjectIds);
}

/**
 * Keeps a single-select picker's id valid as its list changes underneath it.
 *
 * The new-class sheet's subject row is rebuilt by `narrowSubjectsForGrade`
 * every time the grade changes, so the subject picked for the previous grade
 * can be absent from the new list — and that stale id is what `createClass`
 * would otherwise persist. Derived on render rather than reconciled in an
 * effect, so there is no frame where the two disagree.
 */
export function resolveSelectedId<T extends { id: string }>(
  options: readonly T[],
  selectedId: string,
): string {
  return options.some(o => o.id === selectedId) ? selectedId : (options[0]?.id ?? '');
}

/**
 * The grade a student's screen should open on: the first of the student's
 * own grades that the catalog shows. `undefined` when none is shown, so the
 * caller keeps its usual default. Unlike `narrowToSelection` this never
 * narrows — a student may still browse other grades — it only picks where
 * to start.
 */
export function preferredGrade<T extends { id: string }>(all: readonly T[], preferredIds: readonly string[]): T | undefined {
  for (const id of preferredIds) {
    const hit = all.find(g => g.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Narrows books to the grade + subject pairs a teacher set up on
 * `/setup-subjects`. `teachingAssignments` carries the real pairing; the flat
 * `gradeIds`/`subjectIds` are the fallback for accounts that predate it.
 * Same fallback as the helpers above: if narrowing would leave nothing, return
 * everything rather than an unexplained empty list.
 */
export function narrowBooksToTeacher<T extends { gradeId: string; subjectId: string }>(
  books: T[],
  gradeIds: string[] | undefined,
  subjectIds: string[] | undefined,
  teachingAssignments: { gradeId: string; subjectIds: string[] }[] | undefined,
): T[] {
  const narrowed = teachingAssignments?.length
    ? books.filter(b =>
        teachingAssignments.some(a => a.gradeId === b.gradeId && a.subjectIds.includes(b.subjectId)),
      )
    : books.filter(
        b =>
          (!gradeIds?.length || gradeIds.includes(b.gradeId)) &&
          (!subjectIds?.length || subjectIds.includes(b.subjectId)),
      );
  return narrowed.length > 0 ? narrowed : books;
}
