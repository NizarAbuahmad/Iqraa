/**
 * Verification provenance for generated quizzes and worksheets.
 *
 * Neither tool used to say anything about whether its answer keys were
 * checked. Class Mode passed `verified: false` for the whole deck, so a
 * projected quiz or worksheet showed no badge at all — while the quick-check
 * path, which does verify, showed one. Same teacher, same maths, different
 * stories depending on which tool built the material.
 *
 * The unit of truth is the question, not the material. Both mix derivative
 * items the verifier can prove with word problems it cannot touch, so a
 * single whole-deck boolean can only be wrong in one direction or the other:
 * `true` vouches for keys nobody checked, `false` hides the ones that were.
 */
import type { QuizOutput, WorksheetOutput } from './ai/AIService.ts';

export type VerifyOutcome = { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string };

/** Injectable so tests never touch the network. */
export type VerifyFn = (
  question: string,
  answer: string,
  distractors: string[],
) => Promise<VerifyOutcome>;

export const BANK_OUTCOME: VerifyOutcome = { verifiedBy: 'bank' };

type VerifiableItem = { text: string; answer: string; options?: string[] | undefined };

/**
 * One outcome per item, positionally aligned with the input array.
 *
 * Alignment is the contract: callers index into the result by question
 * number, so a failed verification must still occupy its slot. Never filter
 * the result.
 */
async function verifyItems(items: VerifiableItem[], verify: VerifyFn): Promise<VerifyOutcome[]> {
  return Promise.all(
    items.map(async item => {
      const answer = item.answer.trim();
      // Nothing to prove a key against — asking would waste a round trip and
      // the honest answer is already known.
      if (!answer) return BANK_OUTCOME;
      const distractors = Array.isArray(item.options)
        ? item.options.filter(o => o !== item.answer)
        : [];
      try {
        return await verify(item.text, answer, distractors);
      } catch {
        // A verifier that is down must never downgrade into a claim. Falling
        // back to 'bank' says where the answer came from without asserting
        // that anything checked it.
        return BANK_OUTCOME;
      }
    }),
  );
}

export async function verifyQuizAnswers(
  quiz: QuizOutput,
  verify: VerifyFn,
): Promise<VerifyOutcome[]> {
  return verifyItems(
    quiz.questions.map(q => ({
      text: q.text,
      answer: typeof q.correctAnswer === 'string' ? q.correctAnswer : '',
      options: q.options,
    })),
    verify,
  );
}

/**
 * One outcome per question, positionally aligned with the *flattened*
 * `sections[].questions[]` list (section order, then question order within
 * each section) — the same order the answer key and Class Mode already use.
 *
 * A worksheet question doesn't carry its own answer field — the generator
 * only ever fills in the top-level `answerKey`, keyed by 1-based position
 * (`num`) across that flattened list. Match by position, not by trusting a
 * per-question `answer` field that's never actually populated.
 */
export async function verifyWorksheetAnswers(
  worksheet: WorksheetOutput,
  verify: VerifyFn,
): Promise<VerifyOutcome[]> {
  const answerByPosition = new Map(worksheet.answerKey.map(a => [a.num, a.answer]));
  const flatQuestions = worksheet.sections.flatMap(s => s.questions);
  return verifyItems(
    flatQuestions.map((q, i) => ({
      text: q.text,
      answer: answerByPosition.get(i + 1) ?? '',
      options: q.options,
    })),
    verify,
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
