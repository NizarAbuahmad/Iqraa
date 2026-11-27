/**
 * What the Science Lab offers to filter by, and where it opens. Pure, so
 * `node --test` can pin it without loading react-native; the screen
 * (`app/curriculum/lab/index.tsx`) only wires it.
 *
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §1.
 */
import type { LabItem } from '@workspace/curriculum/lab';

/** Grade ids that have at least one item, in `gradeOrder` (the app's visible-grade order). */
export function labGradeIds(items: readonly LabItem[], gradeOrder: readonly string[]): string[] {
  const have = new Set(items.map(i => i.gradeId));
  return gradeOrder.filter(id => have.has(id));
}

/**
 * The grade the Lab opens on: the first of `labGrades` the user has picked, so
 * a teacher of Grades 9 and 10 opens on the one shown first. `null` means all
 * grades — no grade picked yet, or none of the user's grades has lab items.
 */
export function initialLabGrade(labGrades: readonly string[], userGradeIds: readonly string[] | undefined): string | null {
  if (!userGradeIds?.length) return null;
  return labGrades.find(id => userGradeIds.includes(id)) ?? null;
}

/** Subject ids with items in `gradeId` (every grade when `null`), each once, in manifest order. */
export function labSubjectIds(items: readonly LabItem[], gradeId: string | null): string[] {
  const out: string[] = [];
  for (const i of items) {
    if (gradeId !== null && i.gradeId !== gradeId) continue;
    if (!out.includes(i.subjectId)) out.push(i.subjectId);
  }
  return out;
}

/** The picked subject if the grade still offers it, else `null` (all subjects) — never an empty list. */
export function keepLabSubject(subjectId: string | null, available: readonly string[]): string | null {
  return subjectId !== null && available.includes(subjectId) ? subjectId : null;
}
