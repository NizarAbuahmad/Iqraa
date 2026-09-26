/**
 * Which of a draft's questions a regeneration replaces.
 *
 * Regenerating used to soft-delete every live question, so a question the
 * teacher had written by hand vanished the moment they asked for a fresh AI
 * paper. Only generated questions are the generator's to replace — including
 * ones the teacher edited (`ai_edited`), which are still the model's question.
 *
 * Paper-grid rows are `source: "teacher"` too, but they stand for questions
 * printed on paper, not written here; keeping them next to a generated paper
 * would leave blank questions in it.
 */
import { isPaperQuestion } from "./paperExam.ts";

export interface RegenerationRow {
  source: string;
  gradingMode: string;
  body: Record<string, unknown> | null | undefined;
}

export function partitionForRegeneration<T extends RegenerationRow>(
  rows: readonly T[],
): { keep: T[]; replace: T[] } {
  const keep: T[] = [];
  const replace: T[] = [];
  for (const row of rows) {
    (row.source === "teacher" && !isPaperQuestion(row) ? keep : replace).push(row);
  }
  return { keep, replace };
}
