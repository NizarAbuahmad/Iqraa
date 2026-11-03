/**
 * The verifier's verdict on a lesson explanation's worked example and practice.
 *
 * Every wrong answer below was found by a person reading the first two prefill
 * runs of student lesson explanations (2026-11-01): a key of 5 cm for 5.77 cm, a
 * mean of 4.8 for 5.2, (9, 63) for (9, 135). The verifier itself is a fake here
 * (the real one is SymPy, covered by `math-verifier/test_equations.py`); what is
 * pinned is what the route does with each verdict.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PROMPT_EXAMPLE_CHECKS,
  annotateVerification,
  correctionBlock,
  problemsOf,
  settleTeaching,
  verifyLessonTeaching,
  type TeachingVerification,
} from "../lessonTeachingChecks.ts";
import type { KeyRelationResult } from "../mathVerifierClient.ts";

const relation = (relation: KeyRelationResult["relation"], computed: string | null = null, error: string | null = null): KeyRelationResult =>
  ({ relation, computed_answer: computed, error });

/** A verifier that answers the same for every call, and records what it was asked. */
function fake(result: KeyRelationResult | ((topic: string, q: string, a: string) => KeyRelationResult)) {
  const calls: Array<{ topic: string; question: string; answer: string }> = [];
  const fn = async (topic: string, question: string, answer: string) => {
    calls.push({ topic, question, answer });
    return typeof result === "function" ? result(topic, question, answer) : result;
  };
  return { fn, calls };
}

const EVALUATE = { topic: "evaluate", question: "10*sin(30°)/sin(60°)", answer: "5.77" };

const content = (over: Record<string, unknown> = {}) => ({
  workedExample: { problem: "p", steps: ["s"], answer: "b ≈ 5.77 cm", check: EVALUATE },
  practice: { problem: "q", hint: "h", answer: "5.77", check: EVALUATE },
  ...over,
});

describe("verifyLessonTeaching", () => {
  it("is verified only when the verifier agrees AND the prose states the checked answer", async () => {
    const { fn } = fake(relation("equivalent", "10*sqrt(3)/3 ≈ 5.7735027"));
    const v = await verifyLessonTeaching(content(), fn);
    assert.equal(v.workedExample.code, "verified");
    assert.equal(v.practice.code, "verified");
  });

  it("sends the check, not the prose, to the verifier", async () => {
    const { fn, calls } = fake(relation("equivalent"));
    await verifyLessonTeaching(content(), fn);
    assert.deepEqual(calls[0], EVALUATE);
  });

  it("reads a Latin unit on the prose answer as a unit, not as part of the number", async () => {
    const { fn } = fake(relation("equivalent"));
    for (const answer of ["5.77 cm", "b = 5.77 cm", "5.77cm", "≈ 5.77 cm²"]) {
      const v = await verifyLessonTeaching(content({ workedExample: { problem: "p", steps: ["s"], answer, check: EVALUATE } }), fn);
      assert.equal(v.workedExample.code, "verified", answer);
    }
  });

  it("flags a check the verifier says is distinct, whatever the prose says", async () => {
    // The model wrote 5.77 in its check and 5 in its answer; or wrote 4.8 in both.
    const { fn } = fake(relation("distinct", "5.2", "answer_mismatch"));
    const v = await verifyLessonTeaching(
      content({ practice: { problem: "q", answer: "4.8", check: { topic: "evaluate", question: "(1*1+4*4+5*7)/10", answer: "4.8" } } }),
      fn,
    );
    assert.equal(v.practice.code, "contradicted");
    assert.equal(v.practice.computed, "5.2");
    assert.equal(v.practice.stated, "4.8");
  });

  it("flags a prose answer that is not the answer the model checked, even if the check is right", async () => {
    // check says 5.77 and is right; the prose a student reads says 5 cm.
    const { fn } = fake(relation("equivalent", "5.7735"));
    const v = await verifyLessonTeaching(
      content({ workedExample: { problem: "p", steps: ["s"], answer: "5 cm", check: EVALUATE } }),
      fn,
    );
    assert.equal(v.workedExample.code, "unlinked");
  });

  it("does not link «5» inside «15» or «5.77» inside «15.77»", async () => {
    const { fn } = fake(relation("equivalent"));
    const v = await verifyLessonTeaching(
      content({ workedExample: { problem: "p", steps: ["s"], answer: "15.77 cm", check: EVALUATE } }),
      fn,
    );
    assert.equal(v.workedExample.code, "unlinked");
  });

  it("links a list of points written with Arabic «و» to the Latin check", async () => {
    const { fn } = fake(relation("equivalent"));
    const check = { topic: "system_solutions", question: "y = x^2 + 6x; y = -x^2 + 24x", answer: "(0, 0), (9, 135)" };
    const v = await verifyLessonTeaching(
      content({ practice: { problem: "q", answer: "(0, 0) و (9, 135)", check } }),
      fn,
    );
    assert.equal(v.practice.code, "verified");
  });

  it("is undecided, never contradicted, when the verifier could not tell", async () => {
    for (const r of [relation("indeterminate"), relation("error", null, "answer_parse_error"), relation("unsupported_topic")]) {
      const v = await verifyLessonTeaching(content(), fake(r).fn);
      assert.equal(v.workedExample.code, "undecided", r.relation);
      assert.deepEqual(problemsOf(v), []);
    }
  });

  it("has no_check for an item without one, and calls nothing", async () => {
    const { fn, calls } = fake(relation("equivalent"));
    const v = await verifyLessonTeaching(
      content({ workedExample: { problem: "p", steps: ["s"], answer: "a" }, practice: { problem: "q", answer: "b", check: { topic: "", question: "", answer: "" } } }),
      fn,
    );
    assert.equal(v.workedExample.code, "no_check");
    assert.equal(v.practice.code, "no_check");
    assert.equal(calls.length, 0);
  });

  it("stops at the first unreachable answer and leaves everything else undecided", async () => {
    const { fn, calls } = fake(relation("error", null, "timeout"));
    const v = await verifyLessonTeaching(content(), fn);
    assert.equal(v.workedExample.code, "unreachable");
    assert.equal(v.practice.code, "unreachable");
    assert.equal(calls.length, 1);
    assert.deepEqual(problemsOf(v), []);
  });

  it("survives content that is not an object", async () => {
    const { fn } = fake(relation("equivalent"));
    for (const bad of [null, undefined, "x", 3, [], { workedExample: "text", practice: null }]) {
      const v = await verifyLessonTeaching(bad, fn);
      assert.equal(v.workedExample.code, "no_check");
    }
  });

  it("never throws when the verifier call does", async () => {
    const v = await verifyLessonTeaching(content(), async () => { throw new Error("boom"); });
    assert.equal(v.workedExample.code, "undecided");
  });
});

// From the third prefill review (2026-11-03). The first version of the linking
// refused real answers and passed fake ones: a unit after «)» or «π» was not a
// unit («8√3 cm» ≠ «8√3»), the prompt's own example check was copied into
// chemistry lessons, and an answer with no number in it was compared with a
// number anyway, wasting a retry on each.
describe("linking, the third review's findings", () => {
  const ok = fake(relation("equivalent"));
  const verdict = async (answer: string, check: { topic: string; question: string; answer: string }) =>
    (await verifyLessonTeaching({ workedExample: { problem: "p", steps: ["s"], answer, check } }, ok.fn)).workedExample.code;

  it("reads a unit after a bracket, a root or π as a unit", async () => {
    const e = { topic: "evaluate", question: "8*sqrt(3)", answer: "8*sqrt(3)" };
    for (const a of ["8sqrt(3) cm", "8√3 cm", "8*sqrt(3) cm", "8√3 cm²", "8sqrt(3) cm^2"]) {
      assert.equal(await verdict(a, e), "verified", a);
    }
    assert.equal(await verdict("10sqrt(3) + 10 cm", { topic: "evaluate", question: "10*sqrt(3)+10", answer: "10*sqrt(3)+10" }), "verified");
    assert.equal(await verdict("9π cm²", { topic: "evaluate", question: "9*pi", answer: "9*pi" }), "verified");
    assert.equal(await verdict("طول القوس = 3π cm", { topic: "evaluate", question: "3*pi", answer: "3*pi" }), "verified");
  });

  it("still tells π from 3π: a unit is stripped, a coefficient is not", async () => {
    // The model keyed «π cm» for an arc that is 3π; its own check said 3π.
    assert.equal(await verdict("طول القوس = π cm", { topic: "evaluate", question: "3*pi", answer: "3*pi" }), "unlinked");
    assert.equal(await verdict("5 cm", { topic: "evaluate", question: "10*sqrt(3)/3", answer: "5.77" }), "unlinked");
    assert.equal(await verdict("√2 cm", { topic: "evaluate", question: "sqrt(3)", answer: "sqrt(3)" }), "unlinked", "a root with no digit is still a value");
  });

  it("does not strip a letter that is a variable or part of the answer", async () => {
    assert.equal(await verdict("x = 3", { topic: "equation_linear", question: "2x = 6", answer: "x = 3" }), "verified");
    assert.equal(await verdict("3x^2 - 4", { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" }), "verified");
  });

  it("calls a copy of the prompt's own example no check, and does not ask the verifier", async () => {
    const calls: unknown[] = [];
    const counting = async (t: string, q: string, a: string) => { calls.push([t, q, a]); return relation("equivalent"); };
    for (const example of [PROMPT_EXAMPLE_CHECKS.evaluate, PROMPT_EXAMPLE_CHECKS.system]) {
      const v = await verifyLessonTeaching(
        { workedExample: { problem: "p", steps: ["s"], answer: example.answer, check: example } },
        counting,
      );
      assert.equal(v.workedExample.code, "no_check", example.topic);
    }
    assert.equal(calls.length, 0);
  });

  it("calls an answer with no number in it no check: a description is not compared with a value", async () => {
    const calls: unknown[] = [];
    const counting = async (t: string, q: string, a: string) => { calls.push([t, q, a]); return relation("equivalent"); };
    for (const answer of [
      "يدل هذا الضوء على أن الذرّة كانت مثارة.",
      "المركب الأيوني هو الذي يُتوقع أن يكون صلبًا",
    ]) {
      const v = await verifyLessonTeaching(
        { practice: { problem: "p", answer, check: { topic: "evaluate", question: "2*3", answer: "6" } } },
        counting,
      );
      assert.equal(v.practice.code, "no_check", answer);
    }
    assert.equal(calls.length, 0);
  });

  it("keeps checking an answer that has a number and words together", async () => {
    assert.equal(
      await verdict("x = 1 قيمة عظمى محلية، وx = 3 قيمة صغرى محلية.", { topic: "equation_quadratic", question: "x^2 - 4x + 3 = 0", answer: "x = 1, x = 3" }),
      "verified",
    );
  });
});

describe("annotateVerification", () => {
  it("writes the verdicts onto the content and nothing else", () => {
    const c: Record<string, unknown> = { hook: { question: "q" } };
    const v: TeachingVerification = { workedExample: { code: "verified" }, practice: { code: "no_check" } };
    annotateVerification(c, v);
    assert.deepEqual(c.verification, v);
    assert.deepEqual(c.hook, { question: "q" });
  });
});

describe("correctionBlock", () => {
  const v: TeachingVerification = {
    workedExample: { code: "verified" },
    practice: { code: "contradicted", computed: "5.2", stated: "4.8" },
  };
  const c = content({ practice: { problem: "q", answer: "4.8", check: { topic: "evaluate", question: "(1*1+4*4+5*7)/10", answer: "4.8" } } });

  it("names the item, what the verifier computed and what the explanation says", () => {
    const ar = correctionBlock(true, v, c);
    assert.match(ar, /5\.2/);
    assert.match(ar, /4\.8/);
    assert.match(ar, /\(1\*1\+4\*4\+5\*7\)\/10/);
    const en = correctionBlock(false, v, c);
    assert.match(en, /practice/i);
    assert.match(en, /5\.2/);
  });

  it("does not mention an item that passed", () => {
    assert.doesNotMatch(correctionBlock(false, v, c), /worked example/i);
  });

  it("an unlinked item says the answer must equal the check", () => {
    const u: TeachingVerification = { workedExample: { code: "unlinked" }, practice: { code: "no_check" } };
    assert.match(correctionBlock(false, u, content()), /same/i);
  });
});

describe("problemsOf", () => {
  it("lists contradicted and unlinked items only", () => {
    const v: TeachingVerification = { workedExample: { code: "unlinked" }, practice: { code: "contradicted" } };
    assert.deepEqual(problemsOf(v).map(p => p.item), ["workedExample", "practice"]);
    assert.deepEqual(problemsOf({ workedExample: { code: "verified" }, practice: { code: "undecided" } }), []);
  });
});

describe("settleTeaching", () => {
  type Attempt = { parsed: Record<string, unknown>; tag: string };
  const good = (tag: string): Attempt => ({ tag, parsed: content() as Record<string, unknown> });
  const bad = (tag: string): Attempt => ({ tag, parsed: content() as Record<string, unknown> });

  /** Verdicts by attempt: the verifier is told the attempt through the answer it is asked about. */
  const bySequence = (...relations: KeyRelationResult["relation"][]) => {
    let i = 0;
    return async () => relation(relations[Math.min(i++, relations.length - 1)]!, "5.2");
  };

  it("keeps the first attempt and asks nothing when it is clean", async () => {
    let asked = 0;
    const r = await settleTeaching(good("first"), async () => { asked++; return good("second"); }, fake(relation("equivalent")).fn);
    assert.equal(asked, 0);
    assert.equal(r.chosen.tag, "first");
    assert.equal(r.discarded, undefined);
    assert.equal(r.chosen.parsed.verification !== undefined, true);
  });

  it("asks once with the correction, and keeps the second when it is clean", async () => {
    const blocks: string[] = [];
    // two items on the first attempt (both distinct), two on the second (both equivalent)
    const r = await settleTeaching(
      bad("first"),
      async (block) => { blocks.push(block); return good("second"); },
      bySequence("distinct", "distinct", "equivalent", "equivalent"),
    );
    assert.equal(blocks.length, 1);
    assert.match(blocks[0]!, /5\.2/);
    assert.equal(r.chosen.tag, "second");
    assert.equal(r.discarded?.tag, "first");
    assert.deepEqual((r.chosen.parsed.verification as TeachingVerification).practice.code, "verified");
  });

  it("keeps the second attempt, flagged, when it is no better — and the first when it is worse", async () => {
    const same = await settleTeaching(bad("first"), async () => bad("second"), bySequence("distinct", "distinct", "distinct", "distinct"));
    assert.equal(same.chosen.tag, "second");
    assert.equal((same.chosen.parsed.verification as TeachingVerification).practice.code, "contradicted");

    const worse = await settleTeaching(
      { tag: "first", parsed: content({ practice: { problem: "q", answer: "5.77", check: EVALUATE } }) as Record<string, unknown> },
      async () => bad("second"),
      bySequence("distinct", "equivalent", "distinct", "distinct", "distinct"),
    );
    assert.equal(worse.chosen.tag, "first");
    assert.equal(worse.discarded?.tag, "second");
  });

  it("asks in the language of the explanation", async () => {
    const blocks: string[] = [];
    await settleTeaching(bad("a"), async (b) => { blocks.push(b); return good("b"); }, bySequence("distinct", "distinct", "equivalent", "equivalent"), false);
    await settleTeaching(bad("a"), async (b) => { blocks.push(b); return good("b"); }, bySequence("distinct", "distinct", "equivalent", "equivalent"), true);
    assert.match(blocks[0]!, /Correction required/);
    assert.match(blocks[1]!, /تصحيح مطلوب/);
  });

  it("keeps the first attempt when the second call fails", async () => {
    const r = await settleTeaching(bad("first"), async () => { throw new Error("model down"); }, bySequence("distinct", "distinct"));
    assert.equal(r.chosen.tag, "first");
    assert.equal(r.discarded, undefined);
    assert.equal((r.chosen.parsed.verification as TeachingVerification).practice.code, "contradicted");
  });

  it("does not retry because the verifier was unreachable or undecided", async () => {
    let asked = 0;
    for (const r of [relation("error", null, "timeout"), relation("indeterminate"), relation("unsupported_topic")]) {
      await settleTeaching(good("first"), async () => { asked++; return good("second"); }, fake(r).fn);
    }
    assert.equal(asked, 0);
  });

  it("leaves content that is not an object unannotated instead of throwing", async () => {
    const r = await settleTeaching({ tag: "x", parsed: null as unknown as Record<string, unknown> }, async () => good("y"), fake(relation("equivalent")).fn);
    assert.equal(r.chosen.tag, "x");
  });
});
