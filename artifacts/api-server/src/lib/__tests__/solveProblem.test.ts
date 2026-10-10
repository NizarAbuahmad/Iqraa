import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSolution } from "@workspace/math-verify";
import { solveProblem, type SolveDeps } from "../solveProblem.ts";
import { UnusableGenerationError } from "../generationShape.ts";
import type { KeyRelationResult } from "../mathVerifierClient.ts";

const PROBLEM = "حل المعادلة 2x+5=13";

const reply = (over: Record<string, unknown> = {}) => ({
  steps: ["2x + 5 = 13", "2x = 8", "x = 4"],
  answer: "x = 4",
  check: { topic: "equation_linear", question: "2x+5=13", answer: "x = 4" },
  ...over,
});

const equivalent = (): KeyRelationResult => ({ relation: "equivalent", computed_answer: "x = 4" });

function harness(replies: unknown[], results: KeyRelationResult[]) {
  const prompts: string[] = [];
  const relateCalls: Array<[string, string, string]> = [];
  const deps: SolveDeps = {
    complete: async (p) => {
      prompts.push(p);
      const r = replies[prompts.length - 1];
      if (r === undefined) throw new Error("unexpected extra model call");
      return r;
    },
    relate: async (topic, question, answer) => {
      relateCalls.push([topic, question, answer]);
      const r = results[relateCalls.length - 1];
      if (!r) throw new Error("unexpected extra verifier call");
      return r;
    },
  };
  return { deps, prompts, relateCalls };
}

const shown = async (problem: string, replies: unknown[], results: KeyRelationResult[]) => {
  const h = harness(replies, results);
  const out = await solveProblem(problem, true, h.deps);
  assert.equal(out.ok, true);
  if (!out.ok) throw new Error("unreachable");
  return { ...h, result: out.result };
};

describe("solveProblem — verified", () => {
  it("is verified only when the verifier says equivalent, and says what it checked", async () => {
    const { result, relateCalls } = await shown(PROBLEM, [reply()], [equivalent()]);
    assert.deepEqual(relateCalls, [["equation_linear", "2x+5=13", "x = 4"]]);
    assert.equal(result.verification.verified, true);
    assert.equal(result.verification.source, "sympy");
    assert.equal(result.verification.code, "verified");
    assert.equal(result.verification.understoodAs, "2x+5=13");
  });

  it("shows the TYPED problem, not whatever the model restated", async () => {
    const { result } = await shown(PROBLEM, [reply({ problem: "something else entirely" })], [equivalent()]);
    assert.equal(result.problem, PROBLEM);
  });

  it("returns only problem, steps, answer and verification — and is itself a valid Solution", async () => {
    const { result } = await shown(PROBLEM, [reply()], [equivalent()]);
    assert.deepEqual(Object.keys(result).sort(), ["answer", "problem", "steps", "verification"]);
    assert.ok(parseSolution(result));
  });

  it("an unclassifiable (English) problem can still be verified, and understoodAs is what tells the teacher", async () => {
    const { result } = await shown("solve 2x + 5 = 13", [reply()], [equivalent()]);
    assert.equal(result.verification.verified, true);
    assert.equal(result.verification.understoodAs, "2x+5=13");
  });
});

describe("solveProblem — never claims what nothing checked", () => {
  it("ignores every model-claimed verification", async () => {
    const claims = {
      check: undefined,
      verified: true,
      verifiedBy: "sympy",
      computedAnswer: "x = 4",
      verification: { verified: true, source: "sympy", code: "verified" },
    };
    const { result, relateCalls } = await shown(PROBLEM, [reply(claims)], []);
    assert.equal(relateCalls.length, 0);
    assert.deepEqual(Object.keys(result).sort(), ["answer", "problem", "steps", "verification"]);
    assert.equal(result.verification.verified, false);
    assert.equal(result.verification.source, "unchecked");
    assert.equal(result.verification.code, "no_check");
  });

  it("a present but unusable check is 'unsupported'; the verifier is not asked", async () => {
    for (const check of [
      { topic: "integral", question: "x", answer: "x" },
      { topic: "equation_linear", question: "2x+5=13", answer: "س = ٤" },
      "not an object",
    ]) {
      const { result, relateCalls } = await shown(PROBLEM, [reply({ check })], []);
      assert.equal(relateCalls.length, 0);
      assert.equal(result.verification.code, "unsupported");
      assert.equal(result.verification.verified, false);
    }
  });

  it("unlinked: a checked answer that is not the displayed answer is never verified", async () => {
    const { result, relateCalls } = await shown(
      PROBLEM,
      [reply({ answer: "x = 4", check: { topic: "equation_linear", question: "2x+5=13", answer: "4" } })],
      [],
    );
    assert.equal(relateCalls.length, 0);
    assert.equal(result.verification.code, "unlinked");
    assert.equal(result.verification.verified, false);
  });

  it("unlinked ignores only whitespace", async () => {
    const { result } = await shown(
      PROBLEM,
      [reply({ answer: "x=4", check: { topic: "equation_linear", question: "2x+5=13", answer: "x = 4" } })],
      [equivalent()],
    );
    assert.equal(result.verification.verified, true);
  });

  it("restated: a check about a different problem than the one typed is never verified", async () => {
    const { result, relateCalls } = await shown(
      PROBLEM,
      [reply({ check: { topic: "equation_linear", question: "2x+5=14", answer: "x = 4" } })],
      [],
    );
    assert.equal(relateCalls.length, 0);
    assert.equal(result.verification.code, "restated");
    assert.equal(result.verification.verified, false);
  });

  it("restated: a different topic for the same payload is also refused", async () => {
    const { result } = await shown(
      PROBLEM,
      [reply({ check: { topic: "equation_quadratic", question: "2x+5=13", answer: "x = 4" } })],
      [],
    );
    assert.equal(result.verification.code, "restated");
  });

  it("indeterminate / error / unsupported_topic keep the solution, unchecked", async () => {
    const cases: Array<[KeyRelationResult, string]> = [
      [{ relation: "indeterminate", computed_answer: null }, "undecided"],
      [{ relation: "error", computed_answer: null, error: "http_500" }, "undecided"],
      [{ relation: "unsupported_topic", computed_answer: null }, "unsupported"],
    ];
    for (const [r, code] of cases) {
      const { result, prompts } = await shown(PROBLEM, [reply()], [r]);
      assert.equal(prompts.length, 1);
      assert.equal(result.verification.code, code);
      assert.equal(result.verification.verified, false);
      assert.deepEqual(result.steps, reply().steps);
    }
  });

  it("an unreachable verifier loses nothing", async () => {
    for (const error of ["timeout", "client_error:boom"]) {
      const { result } = await shown(PROBLEM, [reply()], [{ relation: "error", computed_answer: null, error }]);
      assert.equal(result.verification.code, "verifier_unreachable");
      assert.equal(result.verification.verified, false);
      assert.equal(result.answer, "x = 4");
    }
  });
});

describe("solveProblem — a contradiction", () => {
  const wrong = reply({
    steps: ["2x + 5 = 13", "2x = 10", "x = 5"],
    answer: "x = 5",
    check: { topic: "equation_linear", question: "2x+5=13", answer: "x = 5" },
  });
  const distinct: KeyRelationResult = { relation: "distinct", computed_answer: "x = 4" };

  it("retries once with the verifier's answer, and shows the retry when it verifies", async () => {
    const { result, prompts, relateCalls } = await shown(PROBLEM, [wrong, reply()], [distinct, equivalent()]);
    assert.equal(prompts.length, 2);
    assert.equal(relateCalls.length, 2);
    assert.ok(!prompts[0]!.includes("computer algebra system solved"));
    assert.ok(prompts[1]!.includes("computer algebra system solved"));
    assert.ok(prompts[1]!.includes("x = 4"));
    assert.equal(result.answer, "x = 4");
    assert.equal(result.verification.verified, true);
  });

  it("a second contradiction is no solution", async () => {
    const out = await solveProblem(PROBLEM, true, harness([wrong, wrong], [distinct, distinct]).deps);
    assert.deepEqual(out, { ok: false, reason: "no_solution" });
  });

  it("a retry that is merely unchecked is also no solution — the first answer was contradicted", async () => {
    for (const second of [
      { relation: "indeterminate", computed_answer: null },
      { relation: "error", computed_answer: null, error: "timeout" },
    ] as KeyRelationResult[]) {
      const out = await solveProblem(PROBLEM, true, harness([wrong, reply()], [distinct, second]).deps);
      assert.deepEqual(out, { ok: false, reason: "no_solution" });
    }
    const noCheck = await solveProblem(PROBLEM, true, harness([wrong, reply({ check: undefined })], [distinct]).deps);
    assert.deepEqual(noCheck, { ok: false, reason: "no_solution" });
  });

  it("no usable computed answer means no retry and no solution", async () => {
    for (const computed_answer of [null, "", "x\u0000y"]) {
      const h = harness([wrong], [{ relation: "distinct", computed_answer }]);
      const out = await solveProblem(PROBLEM, true, h.deps);
      assert.deepEqual(out, { ok: false, reason: "no_solution" });
      assert.equal(h.prompts.length, 1);
    }
  });
});

describe("solveProblem — an unusable reply", () => {
  it("throws UnusableGenerationError for missing steps or answer", async () => {
    for (const bad of [{ answer: "x = 4" }, { steps: [], answer: "x" }, { steps: ["a"] }, null, "text"]) {
      await assert.rejects(solveProblem(PROBLEM, true, harness([bad], []).deps), UnusableGenerationError);
    }
  });
});
