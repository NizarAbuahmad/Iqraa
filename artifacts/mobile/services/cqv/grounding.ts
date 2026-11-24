/**
 * The curriculum fields a content-QA run sends with each request.
 *
 * Apart from `batch.ts` because that module imports `RemoteAIService` at value
 * level, which `node:test` cannot load. The QA lessons are all Grade 10
 * Mathematics (`catalog.ts`), so the topic is grounded in that scope — an
 * unscoped title can land on another grade's lesson (CLAUDE.md, «A lesson title
 * does not identify a lesson») — and when nothing grounds it the API is told
 * not to find a book by the title either (`noLessonField`).
 */
import { noLessonField, resolveGeneratorGrounding } from '../kbContext.ts';

export const CQV_SCOPE = { gradeId: 'grade-10', subjectId: 'mathematics' } as const;

export function cqvGroundingFields(topic: string): { additionalContext: string; grounding?: 'none' } {
  const g = resolveGeneratorGrounding(topic, 'ar', { scope: CQV_SCOPE });
  return {
    additionalContext: g.grounded ? g.context : g.ungroundedNote,
    ...noLessonField(g.grounded),
  };
}
