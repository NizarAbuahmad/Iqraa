/**
 * Symbolic verification for generated math questions.
 *
 * Calls the API's /verify/derivative, which proxies the SymPy microservice
 * (artifacts/math-verifier). Today the verifier proves the DERIVATIVE slice
 * only — everything else stays labelled as a reviewed bank item rather than
 * claiming machine verification.
 *
 * Design rules:
 *  • Never block lesson prep. Short timeout, and any failure degrades to the
 *    honest 'bank' label instead of throwing.
 *  • Latin notation only — the verifier rejects Arabic numerals/symbols.
 */
import { apiFetch } from '../apiClient.ts';
import { isDerivativeQuestion, latinExpressionFrom } from './verifyMathGuards.ts';

export { isDerivativeQuestion, latinExpressionFrom };

/** Verification budget per question; class prep must stay responsive. */
const VERIFY_TIMEOUT_MS = 2500;

export type VerifyOutcome = {
  verifiedBy: 'symbolic' | 'bank';
  /**
   * The answer SymPy computed independently. Shown on the class screen as
   * the actual evidence — far stronger than a checkmark, because the teacher
   * sees the machine's own derivation agreeing with the key.
   */
  computedAnswer?: string;
};

const BANK: VerifyOutcome = { verifiedBy: 'bank' };

/**
 * Ask the verifier to prove one question's answer key.
 * Always resolves — failures degrade to the honest bank label.
 */
export async function verifyMathItem(
  question: string,
  answer: string,
  distractors: string[] = [],
): Promise<VerifyOutcome> {
  if (!isDerivativeQuestion(question)) return BANK;
  const expr = latinExpressionFrom(question);
  if (!expr) return BANK;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await apiFetch('/verify/derivative', {
      method: 'POST',
      // The verifier reads distractors as { value }, not { text } — the wrong
      // key silently skipped distractor checking entirely.
      body: JSON.stringify({
        question: expr,
        answer,
        distractors: distractors.map(d => ({ value: d })),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return BANK;
    const data = (await res.json()) as {
      verified?: boolean;
      computed_answer?: string | null;
    };
    if (!data.verified) return BANK;
    return {
      verifiedBy: 'symbolic',
      computedAnswer: data.computed_answer ?? undefined,
    };
  } catch {
    // Offline, asleep, slow, or malformed — never claim what we cannot prove.
    return BANK;
  } finally {
    clearTimeout(timer);
  }
}
