/**
 * Saving a reviewed class scan, through the endpoints a teacher already uses.
 *
 * `startAttempt` is find-or-create and the marking endpoint upserts, so two
 * things that look harmless are not:
 *
 * 1. **Writing into a paper this batch did not create.** If the student already
 *    had a paper, `created` is false, and writing the scan into it would replace
 *    a mark a teacher entered or a student earned. A row in that state is skipped
 *    and nothing is written.
 * 2. **Retrying with `startAttempt` again.** If a save fails half-way, the paper
 *    now exists *because of this batch*; a second `startAttempt` reports
 *    `created: false` and the retry would wrongly skip its own paper. The row
 *    remembers `attemptId` from the first success, and a retry never starts again.
 *
 * Rows are saved one after another: the order is the teacher's, the load on the
 * API is the same as typing the marks, and a failure is easy to attribute.
 */
import { countsAsExisting, parseMark, type ReviewContext, type ReviewRow } from './classScanReview.ts';

export interface SaveDeps {
  startAttempt(evaluationId: string, studentId: string): Promise<{ attemptId: string; created: boolean }>;
  setGrade(attemptId: string, questionId: string, marks: number): Promise<void>;
  submit(attemptId: string): Promise<void>;
}

export async function saveRows(
  evaluationId: string,
  rows: readonly ReviewRow[],
  ctx: ReviewContext,
  deps: SaveDeps,
  onPatch: (key: string, patch: Partial<ReviewRow>) => void,
): Promise<void> {
  for (const row of rows) {
    if (row.state !== 'read' && row.state !== 'save_failed') continue;
    if (!row.studentId) continue;
    if (countsAsExisting(row, ctx)) {
      onPatch(row.key, { state: 'skipped_existing' });
      continue;
    }

    try {
      let attemptId = row.attemptId;
      if (!attemptId) {
        const started = await deps.startAttempt(evaluationId, row.studentId);
        if (!started.created) {
          onPatch(row.key, { state: 'skipped_existing' });
          continue;
        }
        attemptId = started.attemptId;
        onPatch(row.key, { attemptId });
      }

      const written = new Set(row.savedQuestionIds);
      const everWritten = new Set(row.writtenQuestionIds);
      for (const q of ctx.questions) {
        const parsed = parseMark(row.marks[q.id] ?? '', q.maxMarks);
        // A box the reviewer should have blocked fails the row rather than being
        // skipped: a skipped box would still end `saved` with the wrong marks.
        if (parsed.kind === 'invalid') throw new Error('invalid_mark');
        if (parsed.kind === 'blank') {
          // A mark already on the server cannot be removed by this loop, so a
          // box cleared after its write is refused. A never-written blank stays unmarked.
          if (everWritten.has(q.id)) throw new Error('cleared_after_write');
          continue;
        }
        if (written.has(q.id)) continue;
        await deps.setGrade(attemptId, q.id, parsed.value);
        written.add(q.id);
        everWritten.add(q.id);
        onPatch(row.key, { savedQuestionIds: [...written], writtenQuestionIds: [...everWritten] });
      }

      await deps.submit(attemptId);
      onPatch(row.key, { state: 'saved', error: null });
    } catch (err) {
      onPatch(row.key, {
        state: 'save_failed',
        error: err instanceof Error ? err.message : 'save failed',
      });
    }
  }
}
