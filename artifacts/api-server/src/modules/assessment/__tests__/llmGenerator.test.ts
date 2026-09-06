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
  TYPE_CONTRACTS,
  buildGenerationPrompt,
  paperIsMathematics,
  parseGeneratedQuestions,
  type LlmGenerationRequest,
} from "../llmGenerator.ts";
import { validateGenerated } from "../validator.ts";
import type { QuestionType } from "@workspace/db";
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

/** Same fixture, carrying the subject the prompt now branches on. */
function subjectObjective(id: string, subjectId: string): CurriculumObjective {
  return { ...objective(id), subjectId } as CurriculumObjective;
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

/**
 * The prompt tells the model one shape per type (`TYPE_CONTRACTS` in
 * llmGenerator.ts, verbatim — every "…" in it is already a valid JSON string
 * value, so the contract text parses as-is once the trailing "  — explanation"
 * is stripped); `validateGenerated` enforces a shape per type independently
 * (each `QUESTION_TYPES[type].validate()`, in questionTypes.ts). Nothing ties
 * those two together at compile time, so this builds each test's example
 * *from the real contract string* rather than from a hand-written object that
 * merely looks right — otherwise this test would have passed on the original
 * bug too, the same way a hand-written example can agree with a wrong
 * assumption instead of the actual prompt text.
 *
 * That bug was real: four contracts (short_answer, open_ended,
 * problem_solving, practical_task) never asked the model for fields their own
 * validator requires unconditionally — `modelAnswer` and `keyConcepts` for
 * the three ai_rubric types, `successCriteria` for practical_task — so a
 * model that followed the prompt exactly still had every open-response
 * question it wrote rejected.
 */
/** Every "…" placeholder replaced by its own distinct value, recursively. */
function distinguishPlaceholders(value: unknown, counter: { n: number }): unknown {
  if (Array.isArray(value)) return value.map(v => distinguishPlaceholders(v, counter));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, distinguishPlaceholders(v, counter)]),
    );
  }
  return value === "…" ? `value-${++counter.n}` : value;
}

function contractShape(type: QuestionType): Record<string, unknown> {
  const raw = TYPE_CONTRACTS[type];
  assert.ok(raw, `no TYPE_CONTRACTS entry for ${type}`);
  // The JSON object comes first; some entries add "  <em-dash> explanation"
  // after it for the model to read as prose, not as part of the JSON.
  const jsonPart = raw.split(/ {2}—/)[0]!.trim();
  const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
  // Every "…" in the raw text is the same literal placeholder, so a type with
  // more than one (multiple_choice's four options) parses to duplicate
  // content — a real model would never write the same option text four
  // times, so distinguishing them here tests the *shape* the contract
  // promises, not an artifact of one placeholder standing for "some text".
  const distinguished = distinguishPlaceholders(parsed, { n: 0 }) as Record<string, unknown>;

  // `matching`'s contract illustrates one left/right pair — the shape of a
  // row, not literally "one pair is enough"; `matching.validate()` requires
  // at least two on each side. Duplicating the one example pair (with a
  // distinct id) tests the field names the contract promises without
  // hard-coding "2" from the validator's own rule into this test.
  if (type === "matching") {
    const body = distinguished["body"] as { left: { id: string }[]; right: { id: string }[] };
    const expectedAnswer = distinguished["expectedAnswer"] as { pairs: { left: string; right: string }[] };
    const left1 = body.left[0]!, right1 = body.right[0]!, pair1 = expectedAnswer.pairs[0]!;
    body.left.push({ ...left1, id: `${left1.id}-2` });
    body.right.push({ ...right1, id: `${right1.id}-2` });
    expectedAnswer.pairs.push({ left: `${left1.id}-2`, right: `${right1.id}-2` });
  }

  return distinguished;
}

describe("every TYPE_CONTRACTS shape actually survives validateGenerated", () => {
  const allTypes: QuestionType[] = [
    "multiple_choice", "true_false", "matching", "fill_blank",
    "short_answer", "open_ended", "problem_solving", "practical_task",
  ];

  for (const type of allTypes) {
    it(`${type}'s literal contract text survives validation`, () => {
      const question = {
        ...contractShape(type),
        objectiveId: "obj-1",
        competencyKey: "application",
        marks: 4,
        skill: "test skill",
      };

      const req: LlmGenerationRequest = { ...REQ, assessmentTypes: [type] };
      const { questions, discarded } = parseGeneratedQuestions(
        { questions: [question] },
        req,
        META,
      );
      assert.equal(discarded.length, 0, `parse stage dropped it: ${JSON.stringify(discarded)}`);

      const { accepted, rejected } = validateGenerated(questions, {
        allowedObjectiveIds: ["obj-1", "obj-2"],
        allowedTypes: [type],
      });
      assert.equal(
        rejected.length, 0,
        `validateGenerated rejected the ${type} contract's own example: ${JSON.stringify(rejected)}`,
      );
      assert.equal(accepted.length, 1);
    });
  }
});

describe("paperIsMathematics", () => {
  // Matched on the id, never the display name — CLAUDE.md records name
  // matching (`isMathContext`) as a repeat offender in this repo.
  it("is true when any objective belongs to mathematics", () => {
    assert.equal(paperIsMathematics([subjectObjective("o1", "mathematics")]), true);
  });

  it("is false for chemistry, and for an objective carrying no subject at all", () => {
    assert.equal(paperIsMathematics([subjectObjective("o1", "chemistry")]), false);
    assert.equal(paperIsMathematics([objective("o1")]), false);
    assert.equal(paperIsMathematics([]), false);
  });

  it("does not match the subject's display name", () => {
    // "Mathematics" is what a picker shows; the id is "mathematics". A helper
    // that accepted the label would re-create the bug it exists to avoid.
    assert.equal(paperIsMathematics([subjectObjective("o1", "Mathematics")]), false);
  });
});

describe("buildGenerationPrompt — pressing for a checkable key", () => {
  const mathsReq: LlmGenerationRequest = {
    ...REQ,
    objectives: [subjectObjective("obj-1", "mathematics")],
  };
  const chemReq: LlmGenerationRequest = {
    ...REQ,
    objectives: [subjectObjective("obj-1", "chemistry")],
  };

  it("scopes the Arabic-notation rule to what a student reads", () => {
    // The two instructions used to compete: "use Arabic notation" unscoped,
    // then "the check must be Latin". A model resolving that toward Arabic
    // produces a check the parser correctly throws away.
    const { system } = buildGenerationPrompt(mathsReq);
    assert.match(system, /in the text a student reads/);
    assert.match(system, /never shown to a student/);
    assert.match(system, /always Latin/);
  });

  it("asks for the check as an obligation, not an option", () => {
    const { user } = buildGenerationPrompt(mathsReq);
    assert.equal(user.includes("Optionally"), false);
    assert.match(user, /When the answer is something a computer algebra system can check, include/);
  });

  it("tells a maths paper that most of its questions need one", () => {
    assert.match(buildGenerationPrompt(mathsReq).system, /This is a mathematics paper/);
  });

  it("says nothing of the sort to a chemistry paper", () => {
    // The verifier proves derivatives, circles and equations. Pressing a
    // chemistry paper for a check would only produce keys it must refuse.
    const { system, user } = buildGenerationPrompt(chemReq);
    assert.equal(system.includes("This is a mathematics paper"), false);
    assert.equal(user.includes("A complete example of a maths question"), false);
  });

  it("shows one complete worked example, Arabic stem beside a Latin check", () => {
    const { user } = buildGenerationPrompt(mathsReq);
    assert.match(user, /A complete example of a maths question/);
    // The stem is Arabic…
    assert.match(user, /أوجد مشتقة/);
    // …and the check beside it is Latin.
    assert.match(user, /"check":\{"topic":"derivative_polynomial","question":"x\^3 - 4x","answer":"3x\^2 - 4"\}/);
  });

  it("the example never models the mistake it exists to prevent", () => {
    // An example carrying Arabic inside `check` would teach exactly the
    // failure this whole change is trying to remove.
    const { user } = buildGenerationPrompt(mathsReq);
    const example = user.slice(user.indexOf('{"type":"short_answer"'));
    const check = example.slice(example.indexOf('"check"'));
    assert.equal(
      /[\u0600-\u06FF]/.test(check),
      false,
      `the worked example's check contains Arabic: ${check}`,
    );
  });
});
