/**
 * What a teaching plan's grade and subject are, and where they come from.
 *
 * A plan used to carry `grades` as free text — a teacher typed "العاشر الف"
 * and nothing in the app could read it. A plan is now anchored to a class,
 * and a class already knows its `gradeId` and `subjectId`, so the plan
 * inherits both rather than asking a second time. This is the step that lets
 * a later change put real lesson ids on a plan: lesson ids are only
 * meaningful against a known grade and subject.
 *
 * Kept free of `@workspace/curriculum` on purpose — callers pass their own
 * id→name lookups, the same shape `narrowSubjectsForGrade` takes its catalog
 * in. That keeps this loadable by the bare `node --test` runner, which has no
 * React Native transform (see CLAUDE.md on `services/__tests__`).
 */

export interface PlanClass {
  id: string;
  gradeId: string;
  subjectId: string;
}

export interface PlanScopeSource {
  classGroupId: string | null;
  /** Legacy free text from plans made before the class anchor existed. */
  grades: string;
}

export interface ScopeNaming {
  grade: (gradeId: string) => string;
  subject: (subjectId: string) => string;
}

/**
 * The scope line for a plan — class-derived when it is anchored, the legacy
 * free text when it is not.
 *
 * Deliberately one or the other, never merged: a plan written before the
 * anchor can hold text that contradicts the class later attached to it, and a
 * card claiming two different grades is worse than a card showing the stale
 * one. The class wins, because it is the value the rest of the app can act on.
 */
export function planScopeParts(
  plan: PlanScopeSource,
  classes: readonly PlanClass[],
  naming: ScopeNaming,
): string[] {
  const linked = plan.classGroupId
    ? classes.find(c => c.id === plan.classGroupId)
    : undefined;
  if (!linked) return plan.grades ? [plan.grades] : [];
  return [naming.grade(linked.gradeId), naming.subject(linked.subjectId)].filter(Boolean);
}
