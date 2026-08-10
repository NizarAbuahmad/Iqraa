/**
 * What these guard: an item may only claim it was verified if the verifier
 * actually verified it.
 *
 * This is not hypothetical. The hosted demo ran from 2026-08-07 with the
 * verifier never deployed, and the template path answered `verified: true`
 * anyway — the API returned a stream of items flagged verified that nothing had
 * checked. The failure is silent by construction: an unreachable verifier and a
 * confirmed answer produced identical output.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// No OPENAI_API_KEY is set here on purpose. The module must be loadable without
// one — its template path and helpers never touch a model, and requiring a key
// to import them is what previously stopped the API booting on a key-less
// deploy. If someone reintroduces a module-scope OpenAI import, this import
// throws and every test below fails.
delete process.env.OPENAI_API_KEY;

const {
  generateTemplateItem,
  generateBatch,
  isVerifierUnreachable,
  DERIVATIVE_TOPIC,
} = await import("../derivativeVerified.ts");

type VerifyResult = Awaited<ReturnType<typeof import("../mathVerifierClient.ts").verifyDerivative>>;

/** Verifier that is not there at all — what production has been doing. */
const unreachable = async (): Promise<VerifyResult> => ({
  verified: false,
  computed_answer: null,
  error: "client_error:fetch failed",
});

/** Verifier that is there but slow enough to trip the client's abort. */
const timingOut = async (): Promise<VerifyResult> => ({
  verified: false,
  computed_answer: null,
  error: "timeout",
});

/** Verifier that is there and agrees. */
const confirming = async (
  _q: string,
  answer: string,
): Promise<VerifyResult> => ({
  verified: true,
  computed_answer: answer,
  error: null,
});

/** Verifier that is there and disagrees — a genuinely wrong key. */
const disagreeing = async (): Promise<VerifyResult> => ({
  verified: false,
  computed_answer: "something else",
  error: "answer_mismatch",
});

describe("isVerifierUnreachable", () => {
  it("treats transport failures as unreachable", () => {
    assert.equal(isVerifierUnreachable("timeout"), true);
    assert.equal(isVerifierUnreachable("client_error:fetch failed"), true);
    assert.equal(isVerifierUnreachable("client_error:ECONNREFUSED"), true);
  });

  it("does not treat disagreement as unreachable", () => {
    // The distinction the whole fix rests on: a verifier that says "wrong" is
    // working. Collapsing this into "unreachable" would restore the fail-open.
    assert.equal(isVerifierUnreachable("answer_mismatch"), false);
    assert.equal(isVerifierUnreachable("bad_distractor"), false);
  });

  it("handles absent errors", () => {
    assert.equal(isVerifierUnreachable(null), false);
    assert.equal(isVerifierUnreachable(undefined), false);
  });
});

describe("generateTemplateItem", () => {
  it("claims verification only when the verifier confirmed it", async () => {
    const item = await generateTemplateItem(confirming);
    assert.equal(item.verified, true);
    assert.equal(item.verificationSource, "sympy");
    assert.equal(item.topic, DERIVATIVE_TOPIC);
  });

  it("does not claim verification when the verifier is unreachable", async () => {
    const item = await generateTemplateItem(unreachable);
    assert.equal(item.verified, false);
    assert.equal(item.verificationSource, "code_template");
  });

  it("does not claim verification when the verifier times out", async () => {
    const item = await generateTemplateItem(timingOut);
    assert.equal(item.verified, false);
    assert.equal(item.verificationSource, "code_template");
  });

  it("still returns a usable item when the verifier is unreachable", async () => {
    // The key comes from the power rule in code, not from a model, so it is
    // worth serving. Only the claim about it changes, not its availability.
    const item = await generateTemplateItem(unreachable);
    assert.ok(item.question.length > 0);
    assert.ok(item.answer.length > 0);
    assert.ok(item.distractors.length > 0);
    assert.ok(item.display.question.includes("س"));
  });

  it("gives up rather than serve a key the verifier rejected", async () => {
    await assert.rejects(
      () => generateTemplateItem(disagreeing),
      /Template generation failed/,
    );
  });
});

describe("generateBatch", () => {
  it("counts an unreachable verifier as unverified, not as clean", async () => {
    const result = await generateBatch({ template: 3, ai: 0 }, unreachable);
    assert.equal(result.items.length, 3);
    assert.equal(result.wrong, 0, "nothing was checked, so nothing is wrong");
    assert.equal(result.unverified, 3, "and nothing may be counted as verified");
    assert.ok(result.items.every((i) => i.verified === false));
  });

  it("reports a clean run when the verifier confirms every item", async () => {
    const result = await generateBatch({ template: 3, ai: 0 }, confirming);
    assert.equal(result.wrong, 0);
    assert.equal(result.unverified, 0);
    assert.ok(result.items.every((i) => i.verificationSource === "sympy"));
  });
});
