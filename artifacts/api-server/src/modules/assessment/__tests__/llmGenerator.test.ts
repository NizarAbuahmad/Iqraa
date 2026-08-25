/**
 * Turning a model's JSON into questions.
 *
 * The parser's job is to assume carelessness. Every case here is something a
 * model actually does — inventing an objective id, returning a type nobody
 * asked for, omitting marks, wrapping the array in the wrong key — and the
 * question is always the same: does it get dropped with a reason a human can
 * read, or does it reach the database?
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENERATION_PROMPT_VERSION,
  buildGenerationPrompt,
  parseGeneratedQuestions,
  type LlmGenerationRequest,
} from "../llmGenerator.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

function objective(id: string, blooms = "Apply"): CurriculumObjective {
  return {
    id,
    description: `Objective ${id}`,
    descriptionAr: `نتاج ${id}`,
    effectiveBloomsLevel: blooms,
    inferredBloomsLevel: null,
    bloomsSource: "authored",
    lessonTitle: "Lesson",
    lessonTitleAr: "الدرس",
  } as unknown as CurriculumObjective;
}

const REQ: LlmGenerationRequest = {
  objectives: [objective("obj-1"), objective("obj-2", "Remember")],
  assessmentTypes: ["multiple_choice", "true_false"],
  count: 4,
  difficulty: "standard",
  language: "ar",
};

const META = { model: "test-model" };

const goodMcq = {
  type: "multiple_choice",
  objectiveId: "obj-1",
  competencyKey: "application",
  marks: 3,
  skill: "solving systems",
  body: {
    stem: "ما عدد الحلول؟",
    multiSelect: false,
    options: [
      { id: "a", text: "صفر" },
      { id: "b", text: "واحد" },
      { id: "c", text: "اثنان" },
    ],
  },
  expectedAnswer: { optionIds: ["c"] },
};

describe("buildGenerationPrompt", () => {
  it("names the objective ids the model must use verbatim", () => {
    const { user } = buildGenerationPrompt(REQ);
    assert.ok(user.includes('id "obj-1"'));
    assert.ok(user.includes('id "obj-2"'));
  });

  it("only describes the types that were requested", () => {
    const { user } = buildGenerationPrompt(REQ);
    assert.ok(user.includes("multiple_choice"));
    assert.ok(user.includes("true_false"));
    // Asking for a type the teacher did not choose wastes tokens and produces
    // questions the validator will throw away.
    assert.equal(user.includes("practical_task"), false);
  });

  it("asks for Arabic unless the evaluation is in English", () => {
    assert.ok(buildGenerationPrompt(REQ).system.includes("Arabic"));
    assert.ok(
      buildGenerationPrompt({ ...REQ, language: "en" }).system.includes("clear English"),
    );
  });

  it("carries the book's own pages when there are any", () => {
    // The whole point of the exam path being live. Without this the model
    // writes multiple-choice distractors from an objective's *title*, which is
    // the same information the mock generator refused to guess from.
    const excerpts = "=== نص حرفي من الكتاب المدرسي الرسمي ===\n[1] كتاب الطالب — صفحة 34\nالوترُ قطعةٌ مستقيمةٌ طرفاها على الدائرةِ.";
    const { user } = buildGenerationPrompt({ ...REQ, bookExcerpts: excerpts });
    assert.ok(user.includes(excerpts), "the excerpts did not reach the prompt");
    assert.ok(user.includes("Prefer the book's own worked values"));
    // Before the JSON contracts: a model that reads the shape first writes to
    // the shape and treats the content as decoration.
    assert.ok(user.indexOf(excerpts) < user.indexOf("Allowed types"));
  });

  it("says nothing about a book when there is none", () => {
    // Most of the curriculum: six of the bank's 78 documents have been read.
    // An empty "textbook" heading invites the model to fill it in.
    const { user } = buildGenerationPrompt(REQ);
    assert.equal(user.includes("Prefer the book's own"), false);
    assert.equal(user.includes("الكتاب المدرسي"), false);
  });

  it("tells the model that a question's demand is not its objective's", () => {
    // competency.ts is explicit that inheriting flattens the breakdown. If the
    // prompt does not say so, every question comes back as its objective's level.
    const { user } = buildGenerationPrompt(REQ);
    assert.ok(user.includes("not the same as its objective"));
  });
});

describe("parseGeneratedQuestions", () => {
  it("keeps a well-formed question and stamps its provenance", () => {
    const { questions, discarded } = parseGeneratedQuestions(
      { questions: [goodMcq] },
      REQ,
      META,
    );
    assert.equal(discarded.length, 0);
    assert.equal(questions.length, 1);
    const q = questions[0]!;
    assert.equal(q.type, "multiple_choice");
    assert.equal(q.objectiveId, "obj-1");
    assert.equal(q.competencyKey, "application");
    assert.equal(q.marks, 3);
    assert.equal(q.skill, "solving systems");
    assert.equal(q.aiMetadata["model"], "test-model");
    assert.equal(q.aiMetadata["promptVersion"], GENERATION_PROMPT_VERSION);
    assert.equal(q.aiMetadata["source"], "llm");
  });

  it("takes the grading mode from the type registry, not from the model", () => {
    // A model claiming its own question is deterministic would be deciding how
    // it gets marked.
    const { questions } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, gradingMode: "manual" }] },
      REQ,
      META,
    );
    assert.equal(questions[0]!.gradingMode, "deterministic");
  });

  it("drops a question about an objective nobody selected", () => {
    const { questions, discarded } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, objectiveId: "obj-invented" }] },
      REQ,
      META,
    );
    assert.equal(questions.length, 0);
    assert.match(discarded[0]!.reason, /obj-invented/);
  });

  it("drops a type that was not requested", () => {
    const { questions, discarded } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, type: "practical_task" }] },
      REQ,
      META,
    );
    assert.equal(questions.length, 0);
    assert.match(discarded[0]!.reason, /not requested/);
  });

  it("drops questions with no marks, zero marks or nonsense marks", () => {
    for (const marks of [undefined, 0, -2, "many"]) {
      const { questions } = parseGeneratedQuestions(
        { questions: [{ ...goodMcq, marks }] },
        REQ,
        META,
      );
      assert.equal(questions.length, 0, `marks=${String(marks)} should be dropped`);
    }
  });

  it("drops a question with no body rather than storing an empty one", () => {
    const { questions, discarded } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, body: undefined }] },
      REQ,
      META,
    );
    assert.equal(questions.length, 0);
    assert.match(discarded[0]!.reason, /body/);
  });

  it("falls back to the objective's level when the competency is missing or invented", () => {
    for (const competencyKey of [undefined, "", "recall", 7]) {
      const { questions } = parseGeneratedQuestions(
        { questions: [{ ...goodMcq, competencyKey }] },
        REQ,
        META,
      );
      assert.equal(questions.length, 1);
      // obj-1 is Apply -> application
      assert.equal(questions[0]!.competencyKey, "application");
    }
    // obj-2 is Remember -> knowledge, so the fallback follows the objective
    const { questions } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, objectiveId: "obj-2", competencyKey: null }] },
      REQ,
      META,
    );
    assert.equal(questions[0]!.competencyKey, "knowledge");
  });

  it("survives a response that is not the shape we asked for", () => {
    for (const raw of [null, undefined, "", 42, [], { items: [] }, { questions: "no" }]) {
      const res = parseGeneratedQuestions(raw, REQ, META);
      assert.deepEqual(res.questions, [], `raw=${JSON.stringify(raw)}`);
    }
  });

  it("keeps the good ones when only some are malformed, and says which", () => {
    const { questions, discarded } = parseGeneratedQuestions(
      { questions: [goodMcq, { type: "true_false" }, { ...goodMcq, marks: 2 }] },
      REQ,
      META,
    );
    assert.equal(questions.length, 2);
    assert.equal(discarded.length, 1);
    // Index is the model's own numbering, so the note can point at one item.
    assert.equal(discarded[0]!.index, 1);
  });

  it("rounds marks to two decimals", () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, marks: 2.345 }] },
      REQ,
      META,
    );
    assert.equal(questions[0]!.marks, 2.35);
  });

  it("does not carry a model-supplied rubric for a type that has no use for one", () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [{ ...goodMcq, rubric: "not an object" }] },
      REQ,
      META,
    );
    assert.equal(questions[0]!.rubric, null);
  });
});
