/**
 * The rules that make an automatic key check safe to run on a teacher's paper.
 *
 * This pass is allowed to DELETE a question, so the interesting cases are all
 * the ones where it must not: an undecidable comparison, an unparseable key, a
 * topic with no solver, a question with no key at all, and — the one that would
 * hurt most in production — a verifier that is simply asleep.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyAnswerKeys, type RelateKeyFn } from "../keyVerification.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import type { KeyRelation } from "../../../lib/mathVerifierClient.ts";

function question(overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    type: "short_answer",
    body: { prompt: "أوجد مشتقة f(x) = x³ − 4x" },
    expectedAnswer: { modelAnswer: "3x^2 - 4", keyConcepts: ["المشتقة"] },
    rubric: null,
    objectiveId: "o-1",
    competencyKey: "application",
    difficulty: "standard",
    marks: 3,
    skill: null,
    gradingMode: "ai_rubric",
    check: { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" },
    aiMetadata: { source: "llm" },
    ...overrides,
  };
}

/** A verifier that always answers the same way. */
function fixed(
  relation: KeyRelation,
  computed: string | null = "3*x**2 - 4",
  error?: string,
): RelateKeyFn {
  return async () => ({ relation, computed_answer: computed, error: error ?? null });
}

describe("a key the verifier confirms", () => {
  it("keeps the question and records SymPy's own answer", async () => {
    const out = await verifyAnswerKeys([question()], fixed("equivalent"));
    assert.equal(out.kept.length, 1);
    assert.equal(out.dropped.length, 0);
    const v = out.kept[0]!.verification;
    assert.equal(v.verified, true);
    assert.equal(v.source, "sympy");
    assert.equal(v.code, "verified");
    assert.equal(v.computedAnswer, "3*x**2 - 4");
    assert.equal(out.checked, 1);
    assert.equal(out.verified, 1);
  });
});

describe("a key the verifier contradicts", () => {
  it("drops the question and says what the maths actually gives", async () => {
    const out = await verifyAnswerKeys([question()], fixed("distinct"));
    assert.equal(out.kept.length, 0);
    assert.equal(out.dropped.length, 1);
    assert.equal(out.dropped[0]!.index, 0);
    // The teacher is owed the arithmetic, not just "removed".
    assert.match(out.dropped[0]!.reason, /3\*x\*\*2 - 4/);
    assert.match(out.dropped[0]!.reason, /3x\^2 - 4/);
    assert.ok(out.warnings.some(w => /removed/i.test(w)));
  });

  it("drops only the contradicted one, never its neighbours", async () => {
    let call = 0;
    const relate: RelateKeyFn = async () => {
      call += 1;
      return call === 2
        ? { relation: "distinct", computed_answer: "2*x", error: "distinct" }
        : { relation: "equivalent", computed_answer: "2*x", error: null };
    };
    const out = await verifyAnswerKeys([question(), question(), question()], relate);
    assert.equal(out.kept.length, 2);
    assert.equal(out.dropped.length, 1);
    assert.equal(out.dropped[0]!.index, 1);
  });
});

describe("verdicts that are not evidence of a wrong key", () => {
  for (const relation of ["indeterminate", "error", "unsupported_topic"] as KeyRelation[]) {
    it(`keeps the question unverified on "${relation}"`, async () => {
      const out = await verifyAnswerKeys([question()], fixed(relation, null));
      assert.equal(out.dropped.length, 0, `"${relation}" must never drop a question`);
      assert.equal(out.kept.length, 1);
      assert.equal(out.kept[0]!.verification.verified, false);
      assert.equal(out.kept[0]!.verification.source, "unchecked");
      assert.equal(out.kept[0]!.verification.code, "undecided");
      assert.match(out.kept[0]!.verification.reason ?? "", new RegExp(relation));
    });
  }
});

describe("a question with no latin key", () => {
  it("passes through unverified without calling the verifier at all", async () => {
    let called = false;
    const relate: RelateKeyFn = async () => {
      called = true;
      return { relation: "equivalent", computed_answer: null, error: null };
    };
    const out = await verifyAnswerKeys([question({ check: null })], relate);
    assert.equal(called, false, "a question with no check must not reach the verifier");
    assert.equal(out.kept.length, 1);
    assert.equal(out.kept[0]!.verification.verified, false);
    assert.equal(out.kept[0]!.verification.code, "no_key");
    assert.equal(out.checked, 0);
  });
});

describe("an unreachable verifier", () => {
  // The verifier is a free-tier service that sleeps. Losing a teacher's
  // questions because it was asleep is far worse than shipping unverified keys.
  it("drops nothing, and says the check did not run", async () => {
    const out = await verifyAnswerKeys(
      [question(), question()],
      fixed("error", null, "timeout"),
    );
    assert.equal(out.dropped.length, 0);
    assert.equal(out.kept.length, 2);
    assert.equal(out.checked, 0, "an unreachable verifier has checked nothing");
    assert.equal(out.verified, 0);
    // The code the UI keys off. "nobody could check this" and "the checker was
    // down" have different fixes and must never arrive as the same value.
    assert.ok(
      out.kept.every(k => k.verification.code === "verifier_unreachable"),
      "an unreachable verifier must not be reported as no_key",
    );
    assert.ok(
      out.warnings.some(w => /could not be reached/i.test(w) && /Nothing was removed/i.test(w)),
      `warning did not say the check was skipped: ${JSON.stringify(out.warnings)}`,
    );
  });

  it("stops calling after the first unreachable answer", async () => {
    let calls = 0;
    const relate: RelateKeyFn = async () => {
      calls += 1;
      return { relation: "error", computed_answer: null, error: "client_error:fetch failed" };
    };
    await verifyAnswerKeys([question(), question(), question()], relate);
    assert.equal(calls, 1, "thirty questions must not mean thirty timeouts");
  });

  it("treats an http_5xx as a verdict-less answer, not as unreachable", async () => {
    // isVerifierUnreachable deliberately excludes http_5xx: the service replied.
    const out = await verifyAnswerKeys([question()], fixed("error", null, "http_500"));
    assert.equal(out.dropped.length, 0);
    assert.equal(out.checked, 1);
  });
});

describe("never claims more than the verifier said", () => {
  it("marks every question unverified when nothing was checked", async () => {
    const out = await verifyAnswerKeys(
      [question({ check: null }), question({ check: null })],
      fixed("equivalent"),
    );
    assert.ok(out.kept.every(k => k.verification.verified === false));
    assert.ok(out.kept.every(k => k.verification.source === "unchecked"));
  });
});
