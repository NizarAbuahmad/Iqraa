/**
 * Self-marking questions without a model.
 *
 * A quick evaluation asks for the four types that mark themselves. Until the
 * concrete maths bank moved into `lib/`, this generator could produce none of
 * them — `pickType` only ever returns open-response types — so a quick
 * evaluation came back empty every time live AI was off, which is most of the
 * time locally and all of the time once the spend cap trips.
 *
 * What these pin:
 *  1. Maths + multiple_choice alone now yields real questions.
 *  2. They are shaped so `questionTypes.multipleChoice.validate` accepts them,
 *     and so its `grade()` marks the right option correct — a generator that
 *     emitted a plausible-looking but wrong `optionIds` would mark a correct
 *     student answer wrong, silently, for a whole class.
 *  3. Chemistry does the same since 2026-09-16, from its own bank.
 *  4. A subject with NO bank is unchanged: no fabricated distractors.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateMockEvaluation } from "../mockGenerator.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

const objective = (id: string, descriptionAr: string): CurriculumObjective =>
  ({
    id,
    description: descriptionAr,
    descriptionAr,
    bloomsSource: "defaulted",
  }) as unknown as CurriculumObjective;

/** A maths objective the bank has a family for. */
const MATHS = [objective("obj-exp", "حل معادلات أسية")];

describe("mock generator — bank-backed multiple choice", () => {
  it("produces self-marking questions for maths with no model", () => {
    const res = generateMockEvaluation({
      objectives: MATHS,
      assessmentTypes: ["multiple_choice"],
      count: 3,
      difficulty: "standard",
      subjectId: "mathematics",
      seed: 7,
    });

    assert.ok(res.questions.length > 0, "maths must yield questions from the bank");
    for (const q of res.questions) {
      assert.equal(q.type, "multiple_choice");
      assert.equal(q.gradingMode, "deterministic", "must not need a teacher to mark");
    }
  });

  it("emits bodies the type module accepts", () => {
    const res = generateMockEvaluation({
      objectives: MATHS,
      assessmentTypes: ["multiple_choice"],
      count: 4,
      difficulty: "standard",
      subjectId: "mathematics",
      seed: 11,
    });

    for (const q of res.questions) {
      const errors = QUESTION_TYPES["multiple_choice"].validate({
        type: q.type,
        body: q.body,
        expectedAnswer: q.expectedAnswer,
        rubric: q.rubric,
      } as never);
      assert.deepEqual(errors, [], `validator rejected a generated question: ${errors.join("; ")}`);
    }
  });

  it("marks the option it nominated as correct, and only that one", () => {
    // The failure this guards against does not look like a bug from outside:
    // the paper generates, the students sit it, and the right answer scores
    // zero. Grade each question with its own key and assert full marks.
    const res = generateMockEvaluation({
      objectives: MATHS,
      assessmentTypes: ["multiple_choice"],
      count: 4,
      difficulty: "standard",
      subjectId: "mathematics",
      seed: 3,
    });
    assert.ok(res.questions.length > 0);

    const grade = QUESTION_TYPES["multiple_choice"].grade!;
    for (const q of res.questions) {
      const draft = {
        type: q.type,
        body: q.body,
        expectedAnswer: q.expectedAnswer,
        rubric: q.rubric,
      } as never;

      const correctIds = q.expectedAnswer["optionIds"] as string[];
      assert.equal(correctIds.length, 1, "single-answer question needs exactly one key");
      assert.equal(grade(draft, { optionIds: correctIds }).status, "correct");

      const options = q.body["options"] as { id: string }[];
      const wrong = options.find(o => o.id !== correctIds[0]);
      assert.ok(wrong, "a distractor must exist to be wrong with");
      assert.equal(grade(draft, { optionIds: [wrong.id] }).status, "incorrect");
    }
  });

  it("does not repeat a bank item within one paper", () => {
    const res = generateMockEvaluation({
      objectives: MATHS,
      assessmentTypes: ["multiple_choice"],
      count: 5,
      difficulty: "standard",
      subjectId: "mathematics",
      seed: 5,
    });
    const stems = res.questions.map(q => String(q.body["stem"]));
    assert.equal(new Set(stems).size, stems.length, "the same item was used twice");
  });

  it("produces self-marking questions for chemistry too", () => {
    // This test asserted the opposite until 2026-09-16 — «Chemistry has no
    // bank» — which was true and was the bug: a chemistry evaluation came back
    // empty for the same reason a maths one used to.
    const res = generateMockEvaluation({
      objectives: [objective("obj-chem", "تعرُّف أنواع الروابط الكيميائية")],
      assessmentTypes: ["multiple_choice"],
      count: 3,
      difficulty: "standard",
      subjectId: "chemistry",
      seed: 9,
    });

    assert.equal(res.questions.length, 3);
    assert.ok(!res.unavailableTypes.includes("multiple_choice"));

    // Same marking guarantee as the maths case: the key must be one of the
    // options, or the paper marks a correct answer wrong for a whole class.
    for (const q of res.questions) {
      const options = q.body["options"] as Array<{ id: string; text: string }>;
      const keys = (q.expectedAnswer as { optionIds: string[] }).optionIds;
      assert.equal(keys.length, 1);
      assert.ok(options.some(o => o.id === keys[0]), "the key names no option");
    }
  });

  it("draws chemistry from the chemistry bank, never from the maths one", () => {
    const res = generateMockEvaluation({
      objectives: [objective("obj-chem2", "حساب الكتلة المولية للمركبات")],
      assessmentTypes: ["multiple_choice"],
      count: 3,
      difficulty: "standard",
      subjectId: "chemistry",
      seed: 11,
    });

    const stems = res.questions.map(q => String(q.body["stem"])).join(" | ");
    // «الكتلة المولية» also matches the maths family detector through «معادل»
    // and «أسس» in neighbouring objectives, so this pins that the subject —
    // not the objective text — chooses the bank.
    assert.ok(!/f\(x\)|المشتقة|أوجد حل المعادلة|بسّط المقدار/.test(stems), stems);
  });

  it("leaves a subject with no bank exactly as it was", () => {
    // Biology has no bank. Asking for multiple choice must still decline
    // rather than invent distractors.
    const res = generateMockEvaluation({
      objectives: [objective("obj-bio", "تعرُّف تركيب الخلية النباتية")],
      assessmentTypes: ["multiple_choice"],
      count: 3,
      difficulty: "standard",
      subjectId: "biology",
      seed: 9,
    });

    assert.equal(res.questions.length, 0);
    assert.ok(res.unavailableTypes.includes("multiple_choice"));
  });

  it("a paper with no subject behaves as before the bank existed", () => {
    const res = generateMockEvaluation({
      objectives: MATHS,
      assessmentTypes: ["multiple_choice"],
      count: 3,
      difficulty: "standard",
      seed: 13,
    });
    assert.equal(res.questions.length, 0, "the bank must be opt-in via subjectId");
  });

  it("does not drain across generations — a second teacher gets a paper too", () => {
    // The bank's used-set is module state. If the server shared it, the first
    // request would spend the items and every later one would come back empty.
    const run = (seed: number) =>
      generateMockEvaluation({
        objectives: MATHS,
        assessmentTypes: ["multiple_choice"],
        count: 4,
        difficulty: "standard",
        subjectId: "mathematics",
        seed,
      }).questions.length;

    const first = run(21);
    assert.ok(first > 0);
    for (let i = 0; i < 5; i += 1) {
      assert.equal(run(22 + i), first, "a later generation got fewer questions");
    }
  });
});
