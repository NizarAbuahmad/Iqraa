/**
 * Concrete chemistry practice — the mobile side of `@workspace/math-practice`.
 *
 * Mirrors `mathPractice.ts` exactly, and for the same reason: the bank cannot
 * import the knowledge base (3,000 lines of catalogs the API server has no way
 * to carry), so resolving a lesson's subject id from a `KBLesson` happens here,
 * on the side that already pays for `getBookForLesson`.
 */
import { getBookForLesson, type KBLesson } from '../knowledgeBase.ts';
import {
  isChemContext as isChemContextWithSubject,
  lessonTextBlob,
} from '@workspace/math-practice';

export { takeConcreteChem, takeConcreteChemBatch, detectChemFamily } from '@workspace/math-practice';

/**
 * Same precedence as `isMathContext`: the lesson's own subject wins, the
 * caller's `subject` string is the fallback for an ungrounded topic, and the
 * text heuristic runs only when neither says anything. The blob is built here
 * so the heuristic sees the lesson's title and key concepts, not just the
 * free-text topic.
 */
export function isChemContext(topic: string, kb: KBLesson | null, subject?: string): boolean {
  return isChemContextWithSubject(
    topic,
    kb,
    subject,
    kb ? getBookForLesson(kb)?.subjectId : undefined,
    lessonTextBlob(topic, kb),
  );
}
