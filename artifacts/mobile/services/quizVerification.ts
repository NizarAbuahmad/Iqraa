/**
 * Verification provenance for a generated quiz.
 *
 * The quiz tool has never said anything about whether its answer keys were
 * checked. Its Class Mode button passed `verified: false` for the whole deck,
 * so a projected quiz showed no badge at all — while the quick-check path,
 * which does verify, showed one. Same teacher, same maths, two different
 * stories.
 *
 * The unit of truth is the question, not the quiz. A quiz mixes derivative
 * items the verifier can prove with word problems it cannot touch, so a single
 * deck-wide boolean can only be wrong in one direction or the other: `true`
 * vouches for keys nobody checked, `false` hides the ones that were.
 */
import type { QuizOutput } from './ai/AIService.ts';

export type VerifyOutcome = { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string };

/** Injectable so tests never touch the network. */
export type VerifyFn = (
  question: string,
  answer: string,
  distractors: string[],
) => Promise<VerifyOutcome>;

export const BANK_OUTCOME: VerifyOutcome = { verifiedBy: 'bank' };

/**
 * One outcome per question, positionally aligned with `quiz.questions`.
 *
 * Alignment is the contract: the caller indexes into this by question number,
 * so a failed verification must still occupy its slot. Never filter this array.
 */
export async function verifyQuizAnswers(
  quiz: QuizOutput,
  verify: VerifyFn,
): Promise<VerifyOutcome[]> {
  return Promise.all(
    quiz.questions.map(async q => {
      const answer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
      // Nothing to prove a key against — asking would waste a round trip and
      // the honest answer is already known.
      if (!answer) return BANK_OUTCOME;
      const distractors = Array.isArray(q.options)
        ? q.options.filter(o => o !== q.correctAnswer)
        : [];
      try {
        return await verify(q.text, answer, distractors);
      } catch {
        // A verifier that is down must never downgrade into a claim. Falling
        // back to 'bank' says where the answer came from without asserting
        // that anything checked it.
        return BANK_OUTCOME;
      }
    }),
  );
}

export type VerificationSummary = {
  total: number;
  symbolic: number;
  bank: number;
  /** True only when at least one key was actually proved. */
  anySymbolic: boolean;
};

export function summarizeVerification(outcomes: VerifyOutcome[]): VerificationSummary {
  const symbolic = outcomes.filter(o => o.verifiedBy === 'symbolic').length;
  return {
    total: outcomes.length,
    symbolic,
    bank: outcomes.length - symbolic,
    anySymbolic: symbolic > 0,
  };
}
