/**
 * Real book items inside a generated evaluation.
 *
 * What these pin:
 *  1. A maths objective whose lesson has book items gets cited book questions,
 *     never more than half the paper, and never a type that was not asked for.
 *  2. Unit-test multiple choice self-marks: its own key grades correct and a
 *     distractor grades incorrect.
 *  3. A `computed` item never reaches the verification pass (`check` is null)
 *     and says so in its metadata — it must not earn «تم التحقق».
 *  4. Students never receive the key.
 *  5. Without a `lessonId`, or for another subject, nothing changes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateMockEvaluation } from "../mockGenerator.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

/** Book lesson 2 of unit 1: systems of equations — it has exercises and a unit-test question. */
const objective = (lessonId?: string): CurriculumObjective =>
  ({
    id: "o-nccd-s1-u1_l1-0",
    description: "حل نظام معادلتين",
    descriptionAr: "حل نظام معادلتين",
    bloomsSource: "defaulted",
    skills: [],
    ...(lessonId ? { lessonId } : {}),
  }) as unknown as CurriculumObjective;

const LESSON = "kbl-math-s1-nccd-u1_l1";
const generate = (over: Partial<Parameters<typeof generateMockEvaluation>[0]> = {}) =>
  generateMockEvaluation({
    objectives: [objective(LESSON)],
    assessmentTypes: ["multiple_choice", "short_answer"],
    count: 6,
    difficulty: "standard",
    subjectId: "mathematics",
    seed: 4,
    ...over,
  });
const fromBook = (res: ReturnType<typeof generate>) =>
  res.questions.filter(q => q.aiMetadata["generator"] === "book");
/** Book questions, asserting there are some: a guard over an empty list passes for the wrong reason. */
const drawn = (res: ReturnType<typeof generate>) => {
  const book = fromBook(res);
  assert.ok(book.length > 0, "no book question was drawn, so this test proves nothing");
  return book;
};
/** Template questions stamp `generatedAt`; two otherwise identical runs differ by the clock. */
const withoutClock = (res: ReturnType<typeof generate>) =>
  res.questions.map(q => ({ ...q, aiMetadata: { ...q.aiMetadata, generatedAt: undefined } }));

describe("evaluation generator — real book items", () => {
  it("draws cited book questions for the objective's own lesson", () => {
    const book = fromBook(generate());
    assert.ok(book.length > 0, "the lesson has book items; none were used");
    for (const q of book) {
      assert.match(String(q.aiMetadata["bookCitationAr"]), /ص|الوحدة/u);
      assert.match(String(q.aiMetadata["note"]), /NCCD/);
    }
  });

  it("fills at most half the paper", () => {
    assert.ok(drawn(generate({ count: 6 })).length <= 3);
    for (const count of [2, 4, 6, 9]) {
      assert.ok(fromBook(generate({ count })).length <= Math.floor(count / 2), `count ${count}`);
    }
  });

  it("only produces the types that were asked for", () => {
    const onlyChoice = generate({ assessmentTypes: ["multiple_choice"], count: 6 });
    assert.ok(onlyChoice.questions.every(q => q.type === "multiple_choice"));
    const onlyShort = generate({ assessmentTypes: ["short_answer"], count: 6 });
    assert.ok(drawn(onlyShort).every(q => q.type === "short_answer"));
  });

  it("emits questions the type modules accept", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      const errors = QUESTION_TYPES[q.type].validate({
        type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric,
      } as never);
      assert.deepEqual(errors, [], `${q.type}: ${errors.join("; ")}`);
    }
  });

  it("self-marks unit-test multiple choice with its own key", () => {
    const choices = fromBook(generate({ assessmentTypes: ["multiple_choice"], count: 6 }))
      .filter(q => q.type === "multiple_choice");
    assert.ok(choices.length > 0, "no unit-test multiple choice was drawn");
    const grade = QUESTION_TYPES["multiple_choice"].grade!;
    for (const q of choices) {
      const draft = { type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric } as never;
      const key = q.expectedAnswer["optionIds"] as string[];
      assert.equal(grade(draft, { optionIds: key }).status, "correct");
      const wrong = (q.body["options"] as { id: string }[]).find(o => o.id !== key[0])!;
      assert.equal(grade(draft, { optionIds: [wrong.id] }).status, "incorrect");
    }
  });

  it("never lets a computed item reach the verification pass", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      assert.equal(q.check ?? null, null, "a computed key must not earn the verified badge");
      assert.equal(q.aiMetadata["bookStatus"], "computed");
      assert.equal(q.aiMetadata["bookLabelAr"], "الحل محسوب من نص السؤال");
    }
  });

  it("keeps the key off the student's copy", () => {
    for (const q of drawn(generate({ count: 8 }))) {
      const student = JSON.stringify(
        QUESTION_TYPES[q.type].sanitizeForStudent({
          type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric,
        } as never),
      );
      assert.ok(!student.includes("optionIds"));
      if (q.type === "short_answer") {
        assert.ok(!student.includes(String(q.expectedAnswer["modelAnswer"])), "the answer leaked");
      }
    }
  });

  it("does not repeat an item within a paper", () => {
    const prompts = drawn(generate({ count: 9 })).map(q => String(q.body["prompt"] ?? q.body["stem"]));
    assert.equal(new Set(prompts).size, prompts.length);
  });

  it("is reproducible for a seed", () => {
    assert.ok(drawn(generate({ seed: 21 })).length > 0);
    assert.deepEqual(withoutClock(generate({ seed: 21 })), withoutClock(generate({ seed: 21 })));
  });

  it("changes nothing without a lessonId, or for another subject", () => {
    assert.equal(fromBook(generate({ objectives: [objective()] })).length, 0);
    assert.equal(fromBook(generate({ subjectId: "chemistry" })).length, 0);
  });
});
