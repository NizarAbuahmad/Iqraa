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
 * 1. **Nothing deletes a question.** The verifier's relation is preserved end
 *    to end and every outcome leaves the question in the paper: `equivalent`
 *    marks it verified, `indeterminate`, `error` and `unsupported_topic` leave
 *    it unverified, and `distinct` flags it `contradicted` for the teacher.
 *    `distinct` used to delete the question. Measured on 2026-10-12 over ~120
 *    generated maths questions, it deleted correct ones far more often than
 *    wrong ones: the model attaches a check for a different question than the
 *    stem asks — «المميِّز» of x² − 4x + 4 = 0 checked as "solve the equation",
 *    the maximum of −x² + 4x + 1 checked as its derivative — so SymPy answers
 *    that other question and disagrees with a key that was right. A disagreement
 *    is a reason for a teacher to look, not for the paper to lose a question.
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
import { linkCheck } from "./keyLinking.ts";
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
/**
 * Why a question ended up verified or not, as a value a UI can switch on.
 *
 * `reason` below is English prose meant for a human reading a log. A screen
 * that string-matched it would break silently the first time anyone reworded a
 * sentence — and the app does need to tell these apart, because they have
 * different fixes: a key nobody could check is a content problem, an
 * unreachable verifier is an outage.
 */
export type KeyVerificationCode =
  | "verified"
  | "no_key"
  | "verifier_unreachable"
  | "undecided"
  /** The verifier derived a different answer than the key. Kept, flagged — see rule 1 above. */
  | "contradicted"
  /** The verifier was not asked: the answer it would have checked is not the answer this question is graded against. */
  | "key_unlinked"
  /** Was verified, then the teacher changed the question — the verdict no longer describes it. */
  | "edited";

export type KeyVerification = {
  verified: boolean;
  source: "sympy" | "unchecked";
  code: KeyVerificationCode;
  /** Present when the verifier ran: what it derived independently. */
  computedAnswer?: string | null;
  /** Why an unverified question was not verified — never a claim about it. */
  reason?: string;
  checkedAt: string;
};

export interface KeyVerificationResult {
  /** Questions to insert, each with the verdict to store beside it. */
  kept: { question: GeneratedQuestion; verification: KeyVerification }[];
  warnings: string[];
  /** How many keys the verifier actually judged — the honest coverage number. */
  checked: number;
  verified: number;
  /** How many keys the verifier disagreed with. Each is in `kept`, coded `contradicted`. */
  contradicted: number;
}

const NOT_CHECKABLE = "no latin answer key to check";

export async function verifyAnswerKeys(
  questions: readonly GeneratedQuestion[],
  relate: RelateKeyFn,
): Promise<KeyVerificationResult> {
  const kept: KeyVerificationResult["kept"] = [];
  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();
  let checked = 0;
  let verified = 0;
  let contradicted = 0;
  let unlinked = 0;
  // Set on the first unreachable answer. Everything after it is kept
  // unverified without another 2.5s wait — thirty questions against a sleeping
  // verifier would otherwise stall a generation for over a minute.
  let verifierDown = false;

  for (const question of questions) {
    const check = question.check;
    if (!check) {
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          code: "no_key",
          reason: NOT_CHECKABLE,
          checkedAt,
        },
      });
      continue;
    }

    // The verifier judges `check.answer`; the grader uses `expectedAnswer`. A
    // verdict on the first says nothing about the second unless they are the
    // same answer — see `keyLinking.ts`.
    const link = linkCheck(question);
    if (!link.linked) {
      unlinked += 1;
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          code: "key_unlinked",
          reason: `the answer that could be checked is not the answer this question is graded against (${link.why})`,
          checkedAt,
        },
      });
      continue;
    }

    if (verifierDown) {
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          code: "verifier_unreachable",
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
          code: "verifier_unreachable",
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
          code: "verified",
          computedAnswer: result.computed_answer,
          checkedAt,
        },
      });
      continue;
    }

    if (result.relation === "distinct") {
      contradicted += 1;
      // The reason names both answers: a teacher asked to look is owed the
      // arithmetic. It may be the key that is wrong, or the check that asked
      // the verifier a different question than the stem — only they can tell.
      kept.push({
        question,
        verification: {
          verified: false,
          source: "unchecked",
          code: "contradicted",
          computedAnswer: result.computed_answer,
          reason:
            `the maths verifier derived "${result.computed_answer ?? "?"}" `
            + `where the answer key says "${check.answer}"`,
          checkedAt,
        },
      });
      continue;
    }

    // indeterminate | error | unsupported_topic — not evidence of anything.
    kept.push({
      question,
      verification: {
        verified: false,
        source: "unchecked",
        code: "undecided",
        computedAnswer: result.computed_answer,
        reason: `the verifier could not decide (${result.relation})`,
        checkedAt,
      },
    });
  }

  if (unlinked > 0) {
    warnings.push(
      `${unlinked} question(s) carry a checked answer that is not their own answer key, ` +
        "so they are not marked verified.",
    );
  }

  if (verifierDown) {
    warnings.push(
      "The maths verifier could not be reached, so no answer key was checked. "
        + "Nothing was removed from this paper.",
    );
  }

  return { kept, warnings, checked, verified, contradicted };
}

/**
 * The warning a teacher reads about the questions the verifier disagreed with,
 * built from the questions that are actually on the paper.
 *
 * Takes the final list rather than being computed inside `verifyAnswerKeys`
 * because the route trims surplus questions afterwards, and a warning that
 * names question 13 on a ten-question paper is worse than none. Numbers are
 * 1-based positions, which is what the review screen shows.
 */
export function contradictionWarning(
  kept: readonly { verification: KeyVerification }[],
): string | null {
  const lines = kept.flatMap((k, i) =>
    k.verification.code === "contradicted" ? [`question ${i + 1}: ${k.verification.reason ?? ""}`] : [],
  );
  if (lines.length === 0) return null;
  return (
    `The maths verifier disagrees with the answer key of ${lines.length} question(s), so they are not marked `
    + `verified. Check them before using the paper — either the key or the check may be wrong. ${lines.join("; ")}.`
  );
}

/**
 * What a question's stored verdict becomes when its body or answer is changed.
 *
 * The verdict was about the question as generated. A teacher who edits the
 * stem or the key has made a different question, and a green «verified» chip on
 * it would be the exact claim this module exists not to make. Questions that
 * were never checked stay as they are.
 */
export function verificationAfterEdit(
  existing: Record<string, unknown> | null,
  now: Date = new Date(),
): KeyVerification | null {
  if (!existing || existing["verified"] !== true) return existing as KeyVerification | null;
  return {
    verified: false,
    source: "unchecked",
    code: "edited",
    reason: "the question was edited after its answer was checked",
    checkedAt: now.toISOString(),
  };
}
