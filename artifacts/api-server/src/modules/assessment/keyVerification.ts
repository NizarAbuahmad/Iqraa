/**
 * SymPy's verdict on generated answer keys, at authoring time.
 *
 * `evaluationQuestions.verification` has promised this since Phase 3 and
 * nothing wrote it, so a model could key «أوجد مشتقة f(x) = x³ − 4x» as
 * `3x² + 4` and the paper would reach a teacher looking correct — the
 * structural validator checks type, objective, marks and duplication, none of
 * which is arithmetic.
 *
 * Three rules hold this together, and each exists because breaking it is worse
 * than not checking at all:
 *
 * 1. **Only a contradiction drops a question.** The verifier's three-way
 *    relation is preserved end to end: `indeterminate`, `error` and
 *    `unsupported_topic` all leave the question in the paper, unverified. A
 *    check that deletes work must never do so on "I could not tell".
 * 2. **An unreachable verifier changes nothing.** The verifier is a free-tier
 *    service that sleeps. Losing questions because it was asleep would be a far
 *    worse failure than shipping an unverified key, so the first unreachable
 *    answer stops the pass and everything survives.
 * 3. **`verified` is only ever the verifier's own word.** Never inferred, never
 *    defaulted true — the repo shipped that once and served items flagged
 *    verified that nothing had checked.
 *
 * Only questions carrying a latin `check` block are checkable at all. That is
 * deliberate: the stem is Arabic for the student and SymPy cannot read it, and
 * transliterating «ق(س)» into `f(x)` would be inventing the very thing under
 * test. A question with no `check` is simply never verified, which is the
 * common case and costs it nothing.
 */
import type { GeneratedQuestion } from "./mockGenerator.ts";
import { isVerifierUnreachable } from "../../lib/derivativeVerified.ts";
import type { KeyRelationResult } from "../../lib/mathVerifierClient.ts";

/** Injectable so tests drive every branch without a live service. */
export type RelateKeyFn = (
  topic: string,
  question: string,
  answer: string,
) => Promise<KeyRelationResult>;

/**
 * What is written to `evaluationQuestions.verification`.
 *
 * `verified` and `source` are separate for the reason CLAUDE.md gives: a
 * boolean alone cannot distinguish "SymPy agreed" from "nothing looked", and
 * conflating them is what put a verified badge on unchecked content before.
 */
// A type alias, not an interface: the `verification` column is typed
// `Record<string, unknown> | null`, and only an alias gets the implicit index
// signature that makes this assignable to it.
export type KeyVerification = {
  verified: boolean;
  source: "sympy" | "unchecked";
  /** Present when the verifier ran: what it derived independently. */
  computedAnswer?: string | null;
  /** Why an unverified question was not verified — never a claim about it. */
  reason?: string;
  checkedAt: string;
};

export interface KeyVerificationResult {
  /** Questions to insert, each with the verdict to store beside it. */
  kept: { question: GeneratedQuestion; verification: KeyVerification }[];
  /** Dropped for a contradicted key, in the validator's own issue shape. */
  dropped: { index: number; reason: string }[];
  warnings: string[];
  /** How many keys the verifier actually judged — the honest coverage number. */
  checked: number;
  verified: number;
}

const NOT_CHECKABLE = "no latin answer key to check";

export async function verifyAnswerKeys(
  questions: readonly GeneratedQuestion[],
  relate: RelateKeyFn,
): Promise<KeyVerificationResult> {
  const kept: KeyVerificationResult["kept"] = [];
  const dropped: { index: number; reason: string }[] = [];
  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();
  let checked = 0;
  let verified = 0;
  // Set on the first unreachable answer. Everything after it is kept
  // unverified without another 2.5s wait — thirty questions against a sleeping
  // verifier would otherwise stall a generation for over a minute.
  let verifierDown = false;

  for (const [index, question] of questions.entries()) {
    const check = question.check;
    if (!check) {
      kept.push({
        question,
        verification: { verified: false, source: "unchecked", reason: NOT_CHECKABLE, checkedAt },
      });
      continue;
    }

    if (verifierDown) {
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          reason: "the verifier could not be reached",
          checkedAt,
        },
      });
      continue;
    }

    const result = await relate(check.topic, check.question, check.answer);

    if (isVerifierUnreachable(result.error)) {
      verifierDown = true;
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          reason: "the verifier could not be reached",
          checkedAt,
        },
      });
      continue;
    }

    checked += 1;

    if (result.relation === "equivalent") {
      verified += 1;
      kept.push({
        question,
        verification: {
          verified: true,
          source: "sympy",
          computedAnswer: result.computed_answer,
          checkedAt,
        },
      });
      continue;
    }

    if (result.relation === "distinct") {
      // The one verdict that removes a teacher's question, so the reason names
      // both keys: a teacher who asked for 15 and got 14 is owed the arithmetic.
      dropped.push({
        index,
        reason:
          `answer key contradicted by the maths verifier — it derives `
          + `"${result.computed_answer ?? "?"}" where the key says "${check.answer}"`,
      });
      continue;
    }

    // indeterminate | error | unsupported_topic — not evidence of anything.
    kept.push({
      question,
      verification: {
        verified: false,
        source: "unchecked",
        computedAnswer: result.computed_answer,
        reason: `the verifier could not decide (${result.relation})`,
        checkedAt,
      },
    });
  }

  if (verifierDown) {
    warnings.push(
      "The maths verifier could not be reached, so no answer key was checked. "
        + "Nothing was removed from this paper.",
    );
  } else if (dropped.length > 0) {
    warnings.push(
      `${dropped.length} question(s) were removed because the maths verifier `
        + "contradicted their answer key.",
    );
  }

  return { kept, dropped, warnings, checked, verified };
}
