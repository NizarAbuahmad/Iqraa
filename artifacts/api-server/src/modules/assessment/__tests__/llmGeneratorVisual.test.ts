/**
 * The exam generator and a question's drawing: offered on maths papers only,
 * gated by `resolveFigure`, tied to the question's `check`, and stored in
 * `body.visual`. A dropped drawing leaves the question standing and is
 * recorded in `visualsDropped` with a reason.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationPrompt, parseGeneratedQuestions, type LlmGenerationRequest } from "../llmGenerator.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

function objective(id: string, subjectId?: string): CurriculumObjective {
  return {
    id,
    description: `Objective ${id}`,
    descriptionAr: `نتاج ${id}`,
    effectiveBloomsLevel: "Apply",
    inferredBloomsLevel: null,
    bloomsSource: "authored",
    lessonTitle: "Lesson",
    lessonTitleAr: "الدرس",
    ...(subjectId ? { subjectId } : {}),
  } as unknown as CurriculumObjective;
}
const req = (subjectId?: string): LlmGenerationRequest => ({
  objectives: [objective("obj-1", subjectId)],
  assessmentTypes: ["multiple_choice"],
  count: 1,
  difficulty: "standard",
  language: "ar",
});
const META = { model: "test-model" };
const graph = { kind: "function-graph", functions: [{ expr: "x^2 - 4", label: "f" }], x: [-3, 3] };
const mcq = (extra: Record<string, unknown> = {}) => ({
  questions: [
    {
      type: "multiple_choice",
      objectiveId: "obj-1",
      competencyKey: "application",
      marks: 2,
      skill: "graphs",
      body: {
        stem: "ما جذرا الاقتران f(س) = س² − ٤؟",
        multiSelect: false,
        options: [
          { id: "a", text: "±٢" },
          { id: "b", text: "٤" },
        ],
      },
      expectedAnswer: { optionIds: ["a"] },
      ...extra,
    },
  ],
});

describe("a question's drawing", () => {
  it("is kept, gated, in body.visual on a maths paper", () => {
    const out = parseGeneratedQuestions(mcq({ visual: { ...graph, junk: 1 } }), req("mathematics"), META);
    assert.deepEqual(out.questions[0]!.body["visual"], graph);
    assert.deepEqual(out.visualsDropped, []);
  });

  it("is dropped, with a reason, when the gate refuses it — the question stays", () => {
    const out = parseGeneratedQuestions(mcq({ visual: { kind: "pie" } }), req("mathematics"), META);
    assert.equal(out.questions.length, 1);
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.equal(out.visualsDropped.length, 1);
  });

  it("is not accepted on a paper that is not maths", () => {
    const out = parseGeneratedQuestions(mcq({ visual: graph }), req("chemistry"), META);
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.equal(out.visualsDropped.length, 1);
  });

  it("is never taken from inside body", () => {
    const q = mcq();
    (q.questions[0]!.body as Record<string, unknown>)["visual"] = graph;
    const out = parseGeneratedQuestions(q, req("mathematics"), META);
    assert.equal("visual" in out.questions[0]!.body, false);
  });

  it("is dropped when the checked function is a different one", () => {
    const check = { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" };
    const out = parseGeneratedQuestions(mcq({ visual: graph, check }), req("mathematics"), META);
    // The check must have been read, or the tie was never applied.
    assert.equal(out.questions[0]!.check?.question, "x^3 - 4x");
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.match(out.visualsDropped[0]!.reason, /check/);
  });

  it("is kept when the checked function is the drawn one", () => {
    const check = { topic: "derivative_polynomial", question: "x^2 - 4", answer: "2x" };
    const out = parseGeneratedQuestions(mcq({ visual: graph, check }), req("mathematics"), META);
    assert.equal(out.questions[0]!.check?.question, "x^2 - 4");
    assert.deepEqual(out.questions[0]!.body["visual"], graph);
    assert.deepEqual(out.visualsDropped, []);
  });

  it("a question with no drawing reports nothing dropped", () => {
    const out = parseGeneratedQuestions(mcq(), req("mathematics"), META);
    assert.deepEqual(out.visualsDropped, []);
  });
});

describe("the prompt", () => {
  const { system, user } = buildGenerationPrompt(req("mathematics"));
  const plain = buildGenerationPrompt(req("chemistry"));

  it("offers a drawing on a maths paper, with the stem-is-sufficient rule", () => {
    assert.match(system, /ONE drawing/);
    assert.match(system, /answerable without it/);
    assert.ok(user.includes('"visual"') && user.includes('"function-graph"') && user.includes('"vectors"'));
  });

  it("does not mention drawings on other papers", () => {
    assert.ok(!plain.system.includes("ONE drawing") && !plain.user.includes('"function-graph"'));
  });

  it("keeps rule 7 about book figures word for word", () => {
    assert.ok(system.includes("Never name or number a specific one"));
  });
});
