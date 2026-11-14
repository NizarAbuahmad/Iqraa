/**
 * Which question types the new-evaluation picker offers, by the book's grade.
 *
 * A Grade 1 paper takes only what a six-year-old learning to read can answer
 * (`FIRST_GRADE_EVALUATION_TYPES` in `@workspace/exam-paper`, which the API
 * enforces too); every other grade is offered the full list. Kept out of the
 * screen so `node --test` can load it.
 */
import { FIRST_GRADE_DEFAULT_TYPES, evaluationTypesForGrade } from '@workspace/exam-paper';
import type { QuestionType } from './evaluations';

/** The types to list for a book of this grade, in the order given. */
export function typesOffered(gradeId: string | null | undefined, all: readonly QuestionType[]): QuestionType[] {
  return evaluationTypesForGrade(gradeId, all);
}

/**
 * The ticked types once the book's grade is known: for Grade 1 the ones still
 * allowed, or choice and صح/خطأ when none is (the screen's default ticks
 * short answer, which Grade 1 does not take). The same set, unchanged, otherwise.
 */
export function selectionForGrade(gradeId: string | null | undefined, selected: ReadonlySet<QuestionType>): Set<QuestionType> {
  if (gradeId !== 'grade-1') return new Set(selected);
  const kept = evaluationTypesForGrade(gradeId, [...selected]);
  return new Set(kept.length > 0 ? kept : FIRST_GRADE_DEFAULT_TYPES as readonly QuestionType[]);
}
