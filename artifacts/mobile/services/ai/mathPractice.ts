/**
 * Concrete math practice — moved to `@workspace/math-practice` on 2026-09-13.
 *
 * The bank now lives in `lib/` because the evaluation generator on the API
 * server needs it: a self-marking question requires a known answer, and a
 * template can only ever produce a question. Everything real is there; this
 * file stays so the app's existing call sites and tests keep their import path.
 *
 * The one thing that could not move is the knowledge-base lookup. The bank
 * takes a lesson's subject id as a parameter now, and resolving it from a
 * `KBLesson` means `getBookForLesson`, which means `knowledgeBase.ts` and the
 * 3,000 lines of catalogs behind it — exactly what the server cannot have. So
 * that resolution happens here, on the side that already pays for it, and
 * `isMathContext` keeps the three-argument shape its callers use.
 */
import { getBookForLesson, type KBLesson } from '../knowledgeBase.ts';
import { isMathContext as isMathContextWithSubject } from '@workspace/math-practice';

export {
  beginMathPracticeSession,
  lessonTextBlob,
  detectMathFamily,
  takeConcreteMath,
  takeConcreteMathBatch,
} from '@workspace/math-practice';

export type { Lang, QType, DiffTier, PracticeWQ, PracticeLesson } from '@workspace/math-practice';

/**
 * Unchanged behaviour: a resolved KB lesson's own subject decides, and only an
 * ungrounded topic falls back to the text heuristic. The subject id is now
 * resolved here and handed to the shared implementation.
 */
export function isMathContext(topic: string, kb: KBLesson | null, subject?: string): boolean {
  return isMathContextWithSubject(
    topic,
    kb,
    subject,
    kb ? getBookForLesson(kb)?.subjectId : undefined,
  );
}
