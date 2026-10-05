/**
 * What the review screen should say about answer-key checking, if anything.
 *
 * Silence used to be the output for three different situations: keys verified,
 * the verifier unreachable, and nothing on the paper being checkable at all. A
 * teacher cannot act on silence, and the three have different fixes — the
 * middle one is an outage worth retrying, the last one is simply what a
 * bearings paper looks like.
 *
 * Derived from the questions themselves rather than from the generate
 * response, so it survives a reload and reads the same after a first
 * generation and after a regenerate.
 */
import { isMathematicsSubject } from '@workspace/math-verify';
import type { EvaluationQuestion } from './evaluations.ts';

export type KeyCheckSummary =
  | { kind: 'verified'; verified: number; total: number }
  | { kind: 'verifier-down' }
  | { kind: 'none-checkable' }
  /** A checkable answer existed, but it was not the answer the question is graded against. */
  | { kind: 'unlinked'; unlinked: number }
  | { kind: 'silent' };

export function summariseKeyChecks(
  questions: readonly EvaluationQuestion[],
  subjectId: string | null | undefined,
): KeyCheckSummary {
  if (questions.length === 0) return { kind: 'silent' };

  // Only the verifier's own confirmations count. Never inferred from a
  // question looking fine.
  const verified = questions.filter(q => q.verification?.verified).length;
  if (verified > 0) return { kind: 'verified', verified, total: questions.length };

  // Checked ahead of "nothing checkable": we only ever call the verifier for a
  // question that *had* a key, so this state proves keys existed and the
  // checker was the thing that failed. Collapsing the two would send a teacher
  // rewriting perfectly good questions over an outage.
  if (questions.some(q => q.verification?.code === 'verifier_unreachable')) {
    return { kind: 'verifier-down' };
  }

  // A checkable answer existed but was not the one the question is graded
  // against. That is a different thing from "nothing was checkable": the
  // teacher can fix it by making the model answer state the checked answer.
  const unlinked = questions.filter(q => q.verification?.code === 'key_unlinked').length;
  if (unlinked > 0) return { kind: 'unlinked', unlinked };

  // Only claim "nothing here was checkable" about a paper we actually looked
  // at. Every question written before key checking existed carries no
  // `verification` at all, and saying it of those would be reporting a finding
  // from a check that never ran.
  const wasChecked = questions.some(q => q.verification != null);
  if (wasChecked && isMathematicsSubject(subjectId)) return { kind: 'none-checkable' };

  return { kind: 'silent' };
}
