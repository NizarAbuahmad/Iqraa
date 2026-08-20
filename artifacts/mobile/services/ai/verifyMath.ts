/**
 * Symbolic verification for generated math questions.
 *
 * Calls the API's /verify/derivative, which proxies the SymPy microservice
 * (artifacts/math-verifier). The endpoint is named for the slice it started
 * as; `classifyVerifiableTopic` now routes derivatives, derivatives evaluated
 * at a point, single-unknown equations, and a circle's centre or radius.
 * Everything else stays labelled as a reviewed bank item rather than claiming
 * machine verification.
 *
 * Design rules:
 *  • Never block lesson prep. Short timeout, and any failure degrades to the
 *    honest 'bank' label instead of throwing.
 *  • Latin notation only — the verifier rejects Arabic numerals/symbols.
 */
import { apiFetch } from '../apiClient.ts';
import {
  classifyVerifiableTopic,
  isDerivativeQuestion,
  latinExpressionFrom,
} from './verifyMathGuards.ts';

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
 * Wake the verifier ahead of time.
 *
 * On Render's free tier the verifier sleeps after ~15 min idle and takes
 * 30-60s to wake — far beyond VERIFY_TIMEOUT_MS. Without this, the first
 * lesson prep after an idle period silently falls back to the 'bank' label
 * and the symbolic badge never appears: an invisible failure, precisely in
 * the demo where the proof matters most.
 *
 * Fire-and-forget: no timeout, no error surface, no effect on the UI. It
 * simply gives the service a head start.
 */
let warmUpStarted = false;

export function warmUpVerifier(): void {
  if (warmUpStarted) return;
  warmUpStarted = true;
  // Deliberately not awaited — the caller must never block on this.
  void apiFetch('/verify/derivative', {
    method: 'POST',
    body: JSON.stringify({ question: 'x^2', answer: '2*x' }),
  }).catch(() => {
    // Offline or signed out: verification degrades honestly on its own.
  });
}

/**
 * Ask the verifier to prove one question's answer key.
 * Always resolves — failures degrade to the honest bank label.
 */
export async function verifyMathItem(
  question: string,
  answer: string,
  distractors: string[] = [],
): Promise<VerifyOutcome> {
  // Derivatives compare by expression equivalence; equations by solution set.
  // The topic tells the verifier which check to run.
  const match = classifyVerifiableTopic(question);
  if (!match) return BANK;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await apiFetch('/verify/derivative', {
      method: 'POST',
      // The verifier reads distractors as { value }, not { text } — the wrong
      // key silently skipped distractor checking entirely.
      body: JSON.stringify({
        question: match.payload,
        answer,
        topic: match.topic,
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
