/**
 * What a teaching plan's grade and subject are, and where they come from.
 *
 * A plan used to carry `grades` as free text — a teacher typed "العاشر الف"
 * and nothing in the app could read it. A plan is now anchored to a class,
 * and a class already knows its `gradeId` and `subjectId`, so the plan
 * inherits both rather than asking a second time. A class that takes several
 * subjects is the exception: there the plan says which one it is for. This is the step that lets
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
  /** The class's primary subject — `subjectIds[0]`. */
  subjectId: string;
  /** Every subject the class takes; absent from a server older than the field. */
  subjectIds?: readonly string[];
}

export interface PlanScopeSource {
  classGroupId: string | null;
  /** Which of the class's subjects this plan covers; '' or absent = the class's primary subject. */
  subjectId?: string;
  /** Legacy free text from plans made before the class anchor existed. */
  grades: string;
}

/**
 * The subjects a plan for this class can cover. Same fallback as
 * `classSubjectIds` (services/classSubjects.ts), restated here because that
 * module imports the curriculum and this one must not.
 */
export function planClassSubjects(cls: PlanClass | undefined): string[] {
  if (!cls) return [];
  const list = (cls.subjectIds ?? []).filter(Boolean);
  if (list.length > 0) return [...new Set(list)];
  return cls.subjectId ? [cls.subjectId] : [];
}

/**
 * The subject a plan's lessons come from. A plan names its own once the class
 * takes several; one that names none (every plan written before plans had a
 * subject) means the class's primary subject, which is what it meant then.
 *
 * Kept even if the class later drops that subject: the plan's lessons are
 * still that subject's lessons, and relabelling them with whatever the class
 * now lists first would be the mislabel this exists to prevent.
 */
export function planSubjectId(plan: { subjectId?: string }, cls: PlanClass | undefined): string {
  if (plan.subjectId) return plan.subjectId;
  return cls?.subjectId ?? '';
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
  return [naming.grade(linked.gradeId), naming.subject(planSubjectId(plan, linked))].filter(Boolean);
}
