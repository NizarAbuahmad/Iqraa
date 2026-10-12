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
import { bookQuestion, generateMockEvaluation } from "../mockGenerator.ts";
import type { BookItem } from "@workspace/curriculum/bookItems";
import { QUESTION_TYPES } from "../questionTypes.ts";
import { validateGenerated } from "../validator.ts";
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
    assert.ok(drawn(onlyChoice).every(q => q.type === "multiple_choice"));
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

  it("shows students display notation, not typing notation", () => {
    let seen = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const lessonId of [LESSON, "kbl-math-s1-nccd-u1_l2", "kbl-math-s2-nccd-u6_l2"]) {
        const res = generate({ objectives: [objective(lessonId)], count: 10, seed });
        for (const q of fromBook(res)) {
          seen += 1;
          const shown = [
            q.body["prompt"], q.body["stem"],
            ...((q.body["options"] as { text: string }[] | undefined) ?? []).map(o => o.text),
            q.expectedAnswer["modelAnswer"],
            ...((q.expectedAnswer["keyConcepts"] as string[] | undefined) ?? []),
          ].filter((t): t is string => typeof t === "string").join("\n");
          assert.ok(!shown.includes("^"), `a caret reached the screen: ${shown}`);
          assert.ok(!shown.includes("-"), `an ASCII hyphen reached the screen: ${shown}`);
          assert.ok(!/\bf \(/.test(shown), `"f (x)" reached the screen: ${shown}`);
        }
      }
    }
    assert.ok(seen > 0, "no book question was drawn, so this test proves nothing");
  });

  it("still self-marks when the option texts are converted for display", () => {
    const grade = QUESTION_TYPES["multiple_choice"].grade!;
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const res = generate({ assessmentTypes: ["multiple_choice"], count: 6, seed });
      for (const q of fromBook(res)) {
        const draft = { type: q.type, body: q.body, expectedAnswer: q.expectedAnswer, rubric: q.rubric } as never;
        const key = q.expectedAnswer["optionIds"] as string[];
        assert.equal(grade(draft, { optionIds: key }).status, "correct");
        checked += 1;
      }
    }
    assert.ok(checked > 0);
  });

  it("does not repeat an item within a paper", () => {
    const prompts = drawn(generate({ count: 9 })).map(q => String(q.body["prompt"] ?? q.body["stem"]));
    assert.equal(new Set(prompts).size, prompts.length);
  });

  it("is reproducible for a seed", () => {
    assert.ok(drawn(generate({ seed: 21 })).length > 0);
    assert.deepEqual(withoutClock(generate({ seed: 21 })), withoutClock(generate({ seed: 21 })));
  });

  it("never has a book question rejected as a near-duplicate by the validation gate", () => {
    const types = ["multiple_choice", "short_answer"] as const;
    for (const lessonId of [
      "kbl-math-s1-nccd-u1_l1",
      "kbl-math-s1-nccd-u1_l2",
      "kbl-math-s2-nccd-u6_l2",
    ]) {
      let drawnTotal = 0;
      for (let seed = 1; seed <= 12; seed += 1) {
        const res = generate({
          objectives: [objective(lessonId)],
          assessmentTypes: [...types],
          count: 10,
          seed,
        });
        const { rejected } = validateGenerated(res.questions, {
          allowedObjectiveIds: [objective(lessonId).id],
          allowedTypes: [...types],
        });
        drawnTotal += fromBook(res).length;
        const lost = rejected.filter(r => res.questions[r.index]!.aiMetadata["generator"] === "book");
        assert.deepEqual(lost, [], `${lessonId} seed ${seed}: a book question was rejected`);
      }
      assert.ok(drawnTotal > 0, `${lessonId}: no book question drawn, so this proves nothing`);
    }
  });

  it("changes nothing without a lessonId, or for another subject", () => {
    assert.equal(fromBook(generate({ objectives: [objective()] })).length, 0);
    assert.equal(fromBook(generate({ subjectId: "chemistry" })).length, 0);
  });
});

/** A synthetic unit-test short answer: no data file holds one yet. */
const unitTestOpen = (id: string, over: Partial<BookItem> = {}): BookItem => ({
  id,
  lessonId: LESSON,
  source: { sourceId: "math-s1-teacher-guide", page: 47, bookPage: 47, unit: 1, number: 6 },
  kind: "unit-test",
  instruction: "أحل نظام المعادلتين الآتي",
  stem: "y = 4x\ny = 5 - x^2",
  printedAnswer: "(1, 4), (-5, -20)",
  computedAnswer: "(1, 4), (-5, -20)",
  check: null,
  tier: "medium",
  tierSource: "default",
  status: "verified",
  verificationSource: "sympy+book",
  ...over,
});

describe("bookQuestion — the unit-test short-answer kind", () => {
  const draw = (pool: BookItem[], over: Partial<Parameters<typeof bookQuestion>[0]> = {}) =>
    bookQuestion({
      objective: objective(LESSON),
      difficulty: "standard",
      slot: () => ({ competency: "application", marks: 3 }),
      wantChoice: false,
      wantShort: true,
      session: new Set(),
      rng: () => 0,
      accepted: [],
      pool,
      ...over,
    });

  it("builds a short answer with its citation and status, and never a check", () => {
    const q = draw([unitTestOpen("syn-1")]);
    assert.ok(q, "a short-answer request must be able to draw a unit-test item");
    assert.equal(q.type, "short_answer");
    assert.equal(q.check, null);
    assert.equal(q.aiMetadata["generator"], "book");
    assert.equal(q.aiMetadata["bookItemId"], "syn-1");
    assert.equal(q.aiMetadata["bookStatus"], "verified");
    assert.equal(q.aiMetadata["bookCitationAr"], "اختبار نهاية الوحدة ١، س ٦");
    assert.equal(q.aiMetadata["bookCitationEn"], "Unit 1 test, Q6");
    assert.equal((q.body as { prompt: string }).prompt, "أحل نظام المعادلتين الآتي\ny = 4x\ny = 5 − x²");
    assert.deepEqual((q.expectedAnswer as { modelAnswer: string }).modelAnswer, "(1, 4), (−5, −20)");
  });

  it("is drawn alongside exercises when a short answer is wanted, and only then", () => {
    const pool = [unitTestOpen("syn-ut"), unitTestOpen("syn-ex", { kind: "exercise" })];
    const seen = new Set<string>();
    const session = new Set<string>();
    for (let n = 0; n < 2; n++) {
      const q = draw(pool, { session, accepted: [], rng: () => 0 });
      if (q) seen.add(String(q.aiMetadata["bookItemId"]));
    }
    assert.deepEqual([...seen].sort(), ["syn-ex", "syn-ut"]);
    assert.equal(draw([unitTestOpen("syn-ut")], { wantShort: false, wantChoice: true }), null);
  });

  it("receives the item's own kind in the slot function", () => {
    const kinds: string[] = [];
    draw([unitTestOpen("syn-1")], { slot: kind => (kinds.push(kind), { competency: "application", marks: 3 }) });
    assert.deepEqual(kinds, ["unit-test"]);
  });
});
