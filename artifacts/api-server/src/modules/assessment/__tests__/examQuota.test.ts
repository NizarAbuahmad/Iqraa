/**
 * The live exam prompt states the competency mix and the marks, and the parser
 * holds the model to the marks.
 *
 * Before this, a paper with no textbook share (every production paper while
 * `BOOK_ITEMS_LIVE` is off) told the model only "a balanced paper: some recall,
 * most application" and "marks: a positive number". The class dashboard needs at
 * least two questions per competency, and the competency level is marks-weighted
 * on the 1/2/3/4 scale the offline generator uses — so a live paper could leave a
 * competency empty and carry marks on a scale nothing else used.
 *
 * Without `quota` the request is what it always was (pinned byte for byte in
 * `llmGeneratorPromptPin.test.ts`); the route always passes one now.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CurriculumObjective } from "@workspace/curriculum";
import {
  buildGenerationPrompt,
  generationPromptVersion,
  parseGeneratedQuestions,
  type LlmGenerationRequest,
} from "../llmGenerator.ts";

const objective = (id: string) =>
  ({
    id,
    description: `Objective ${id}`,
    descriptionAr: `نتاج ${id}`,
    effectiveBloomsLevel: "Apply",
    subjectId: "chemistry",
  }) as unknown as CurriculumObjective;

const QUOTA = { knowledge: 2, understanding: 3, application: 3, critical_thinking: 2 };

const REQ: LlmGenerationRequest = {
  objectives: [objective("obj-1")],
  assessmentTypes: ["multiple_choice", "short_answer"],
  count: 10,
  difficulty: "standard",
  language: "ar",
  quota: QUOTA,
};

const mcq = (competencyKey: string, marks: unknown) => ({
  type: "multiple_choice",
  objectiveId: "obj-1",
  competencyKey,
  marks,
  body: {
    stem: "أيّ التفاعلات الآتية طارد للطاقة؟",
    multiSelect: false,
    options: [
      { id: "a", text: "التمثيل الضوئي" },
      { id: "b", text: "احتراق الميثان" },
      { id: "c", text: "تحلل الماء كهربائيًا" },
    ],
  },
  expectedAnswer: { optionIds: ["b"] },
});

describe("the competency quota in the live exam prompt", () => {
  it("tells the model how many questions of each competency to write", () => {
    const { user } = buildGenerationPrompt(REQ);
    assert.match(user, /knowledge 2, understanding 3, application 3, critical_thinking 2/);
  });

  it("states the fixed marks per competency instead of asking the model to choose", () => {
    const { user } = buildGenerationPrompt(REQ);
    assert.match(user, /knowledge 1, understanding 2, application 3, critical_thinking 4/);
    assert.equal(user.includes("larger for questions that demand more work"), false);
  });

  it("refuses a quota that does not add up to the count", () => {
    assert.throws(() => buildGenerationPrompt({ ...REQ, quota: { ...QUOTA, knowledge: 5 } }));
  });

  it("leaves the quota sentence to the book block when the book supplies questions", () => {
    const { user } = buildGenerationPrompt({
      ...REQ,
      supplied: {
        count: 2,
        paperTotal: 12,
        byType: { multiple_choice: 2 },
        byCompetency: { application: 2 },
        marks: 6,
        newByCompetency: QUOTA,
      },
    });
    // The book block already says "write about: …"; the quota is not said twice.
    assert.equal(user.match(/knowledge 2, understanding 3, application 3, critical_thinking 2/g)?.length, 1);
  });

  it("records a new prompt version for a paper asked with a quota", () => {
    assert.equal(generationPromptVersion({}), "exam-gen-8");
    assert.equal(generationPromptVersion({ quota: QUOTA }), "exam-gen-9");
    assert.equal(
      generationPromptVersion({
        quota: QUOTA,
        supplied: { count: 2, paperTotal: 12, byType: {}, byCompetency: {}, marks: 0, newByCompetency: QUOTA },
      }),
      "exam-gen-9+book",
    );
  });
});

describe("marks on a paper asked with a quota", () => {
  it("are the competency's own marks, whatever the model wrote", () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [mcq("knowledge", 5), mcq("critical_thinking", 1)] },
      REQ,
      { model: "m" },
    );
    assert.deepEqual(questions.map(q => q.marks), [1, 4]);
  });

  it("do not cost a question its place when the model left them out", () => {
    const { questions } = parseGeneratedQuestions(
      { questions: [mcq("application", undefined)] },
      REQ,
      { model: "m" },
    );
    assert.equal(questions.length, 1);
    assert.equal(questions[0]!.marks, 3);
  });

  it("move the model's rubric onto the fixed marks", () => {
    const short = {
      type: "short_answer",
      objectiveId: "obj-1",
      competencyKey: "critical_thinking",
      marks: 2,
      body: { prompt: "علّل: الاحتراق طارد للطاقة." },
      expectedAnswer: { modelAnswer: "لأن…", keyConcepts: ["الروابط", "الطاقة"] },
      rubric: { criteria: [{ label: "التعليل", marks: 2 }] },
    };
    const { questions } = parseGeneratedQuestions({ questions: [short] }, { ...REQ, assessmentTypes: ["short_answer"] }, { model: "m" });
    assert.equal(questions[0]!.marks, 4);
    assert.deepEqual((questions[0]!.rubric as { criteria: { marks: number }[] }).criteria.map(c => c.marks), [4]);
  });

  it("are said to bind the rubric too", () => {
    assert.match(buildGenerationPrompt(REQ).user, /criteria marks add up to the question's marks/);
  });
});
