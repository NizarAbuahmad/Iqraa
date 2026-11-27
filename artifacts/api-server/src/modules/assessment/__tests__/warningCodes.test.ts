/**
 * Every warning a generated exam comes back with also comes as a code.
 *
 * The app printed whatever sentence the API sent, carried through the
 * `/evaluations/[id]` URL, so a teacher read «Produced 3 of 5 requested
 * questions» under an Arabic paper (seen 2026-11-27 on a local build). The API
 * now sends `warningCodes` — a code and its parameters, from
 * `@workspace/exam-paper` — one for one with `warnings`, and the app words each
 * one from `services/i18n.ts` at display time.
 *
 * These tests drive each producer into its warnings and check that its codes
 * line up with its sentences, and, across all of them, that every code in the
 * shared list is raised by something (a code nothing raises is a key in
 * i18n.ts nobody can see).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENERATION_WARNING_CODES,
  isGenerationWarning,
  type GenerationWarning,
  type GenerationWarningCode,
} from "@workspace/exam-paper";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { generateMockEvaluation } from "../mockGenerator.ts";
import { validateGenerated } from "../validator.ts";
import { contradictionWarning, contradictionWarningCode, verifyAnswerKeys, type RelateKeyFn } from "../keyVerification.ts";
import { fitToTotal } from "../marksTotal.ts";
import { generateWithModel } from "../llmGenerator.ts";
import * as routeNotes from "../generationNotes.ts";
import type { CompetencyKey } from "../competency.ts";
import { getAllObjectives, getObjectivesForLesson } from "@workspace/curriculum";

const raised = new Set<GenerationWarningCode>();

/** `codes` lines up with `sentences`, and every entry is a well-formed warning. */
function assertCodes(sentences: readonly string[], codes: readonly GenerationWarning[] | undefined, context: string): void {
  assert.ok(codes, `${context} returned no codes`);
  assert.equal(codes!.length, sentences.length, `${context}: ${sentences.length} sentences, ${codes!.length} codes`);
  codes!.forEach((c, i) => {
    assert.ok(isGenerationWarning(c), `${context} #${i + 1} is not a known warning: ${JSON.stringify(c)}`);
    raised.add(c.code);
  });
}
const codesOf = (codes: readonly GenerationWarning[]) => codes.map(c => c.code);

let n = 0;
const WORDS = ["الحديد", "النحاس", "الصوديوم", "الكلور", "الأكسجين", "الهيدروجين", "الكربون", "النيتروجين"];
function base(competencyKey: CompetencyKey, objectiveId = "o1"): Omit<GeneratedQuestion, "type" | "body" | "expectedAnswer"> {
  return { rubric: null, objectiveId, competencyKey, difficulty: "standard", marks: 1, skill: null, gradingMode: "auto", aiMetadata: {} };
}
const tf = (value: boolean, c: CompetencyKey = "knowledge"): GeneratedQuestion => ({
  ...base(c), type: "true_false", body: { statement: `عنصر ${WORDS[n++ % WORDS.length]} ${n} فلز` }, expectedAnswer: { value },
});
const mcq = (at: number, c: CompetencyKey = "knowledge"): GeneratedQuestion => {
  const options = ["a", "b", "c", "d"].map((id, i) => ({ id, text: `${id}${i}${n++}` }));
  return { ...base(c), type: "multiple_choice", body: { stem: `ما رمز ${WORDS[n % WORDS.length]} ${n}؟`, multiSelect: false, options }, expectedAnswer: { optionIds: [options[at]!.id] } };
};
const repeat = (k: number): GeneratedQuestion => ({
  ...base("application"), type: "short_answer", body: { prompt: `أوجد الكتلة المولية لغاز رقم ${k}` },
  expectedAnswer: { modelAnswer: "٣٢", keyConcepts: ["الكتلة"] }, rubric: { criteria: [{ label: "الحل", marks: 1 }] }, gradingMode: "ai_rubric",
});

describe("the validator's warning codes", () => {
  it("line up with its sentences and carry the numbers, not the wording", () => {
    const paper = [
      tf(true), tf(true), tf(true), tf(true), tf(true, "understanding"),
      mcq(1, "understanding"), mcq(1, "application"), mcq(1, "application"), mcq(1), mcq(1),
      repeat(1), repeat(2), repeat(3), repeat(4),
    ];
    const out = validateGenerated(paper, {
      allowedObjectiveIds: ["o1", "o2"],
      allowedTypes: ["true_false", "multiple_choice", "short_answer"],
    });
    assertCodes(out.warnings, out.warningCodes, "validateGenerated");
    const byCode = new Map(out.warningCodes.map(c => [c.code, c]));
    assert.deepEqual(byCode.get("objectives_uncovered")?.params, { count: 1, ids: ["o2"] });
    assert.deepEqual(byCode.get("true_false_one_sided")?.params, { count: 5, total: 5, value: true });
    // Option b, 0-based — the app letters it (ب / option 2).
    assert.deepEqual(byCode.get("choice_position_bunched")?.params, { count: 5, total: 5, position: 1 });
    const same = byCode.get("same_ask");
    assert.ok(same?.code === "same_ask" && same.params.total === paper.length && same.params.example.length > 0, JSON.stringify(same));
    assert.ok(codesOf(out.warningCodes).includes("competency_missing"), codesOf(out.warningCodes).join(", "));
  });

  it("name a lone competency by its key", () => {
    const paper = [mcq(0), mcq(1), mcq(2), mcq(3), mcq(0), mcq(1), mcq(2), mcq(3, "understanding")];
    const out = validateGenerated(paper, { allowedObjectiveIds: ["o1"], allowedTypes: ["multiple_choice"] });
    assertCodes(out.warnings, out.warningCodes, "validateGenerated (lone competency)");
    assert.ok(
      out.warningCodes.some(c => c.code === "competency_single" && c.params.competency === "understanding"),
      JSON.stringify(out.warningCodes),
    );
  });
});

describe("the key check's warning codes", () => {
  const q = (answer = "3x^2 - 4"): GeneratedQuestion => ({
    ...base("application"),
    type: "short_answer",
    body: { prompt: "أوجد مشتقة الاقتران" },
    expectedAnswer: { modelAnswer: answer, keyConcepts: ["المشتقة"] },
    gradingMode: "ai_rubric",
    check: { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" },
  });
  const verifier = (relation: string, error: string | null = null, computed: string | null = null): RelateKeyFn =>
    async () => ({ relation, computed_answer: computed, error }) as never;

  it("say the verifier was down", async () => {
    const out = await verifyAnswerKeys([q()], verifier("error", "timeout"));
    assertCodes(out.warnings, out.warningCodes, "verifyAnswerKeys (down)");
    assert.deepEqual(codesOf(out.warningCodes), ["verifier_unreachable"]);
  });

  it("count the questions whose checked answer is not their key", async () => {
    const out = await verifyAnswerKeys([q("7"), q("8")], verifier("equivalent"));
    assertCodes(out.warnings, out.warningCodes, "verifyAnswerKeys (unlinked)");
    assert.deepEqual(out.warningCodes, [{ code: "keys_unlinked", params: { count: 2 } }]);
  });

  it("name the contradicted questions by position, as the sentence does", async () => {
    const out = await verifyAnswerKeys([q(), q()], verifier("distinct", null, "3x^2"));
    assert.ok(contradictionWarning(out.kept));
    const code = contradictionWarningCode(out.kept);
    assert.deepEqual(code, {
      code: "keys_contradicted",
      params: {
        questions: [1, 2],
        details: [1, 2].map(question => ({ question, derived: "3x^2", key: "3x^2 - 4" })),
      },
    });
    raised.add(code!.code);
    assert.equal(contradictionWarningCode([]), null);
  });
});

describe("the total's note codes", () => {
  it("come with the note, and only with it", () => {
    const unreachable = fitToTotal([1, 2, 3, 4], 18, 20);
    assert.deepEqual(unreachable.noteCode, { code: "marks_total_unreachable", params: { target: 20, questions: 4, kept: 18 } });
    const short = fitToTotal([1, 2, 3], 0, 20, 10);
    assert.deepEqual(short.noteCode, { code: "marks_shared_short", params: { written: 3, requested: 10, marks: 20, target: 20 } });
    for (const out of [unreachable, short]) raised.add(out.noteCode!.code);
    assert.equal(fitToTotal([1, 2], 0, 10).noteCode, undefined);
  });
});

describe("the offline generator's note codes", () => {
  it("line up with its notes: skipped types, the library pointer, a short paper, left-out restatements", () => {
    const out = generateMockEvaluation({
      objectives: getObjectivesForLesson("kbl-math-s1-nccd-u2_l2"),
      assessmentTypes: ["true_false", "fill_blank", "short_answer", "problem_solving"],
      count: 20,
      difficulty: "standard",
      seed: 3,
      subjectId: "mathematics",
      gradeId: "grade-10",
    });
    assertCodes(out.notes, out.noteCodes, "generateMockEvaluation");
    const short = out.noteCodes.find(c => c.code === "shortfall");
    assert.deepEqual(short?.params, { made: 20 - out.shortfall, requested: 20 });
  });

  it("line up when nothing could be made", () => {
    const none = generateMockEvaluation({ objectives: [], assessmentTypes: ["short_answer"], count: 5, difficulty: "basic", seed: 1 });
    assertCodes(none.notes, none.noteCodes, "no objectives");
    assert.deepEqual(codesOf(none.noteCodes), ["no_objectives"]);
    const objectives = getAllObjectives().filter(o => o.subjectId === "chemistry").slice(0, 2);
    const declined = generateMockEvaluation({ objectives, assessmentTypes: ["matching"], count: 5, difficulty: "basic", seed: 1, subjectId: "chemistry" });
    assertCodes(declined.notes, declined.noteCodes, "every type declined");
    assert.equal(declined.noteCodes[0]?.code, "no_type_producible");
  });
});

describe("the model's discard code", () => {
  it("carries the count", async () => {
    const objective = { id: "o1", description: "x", descriptionAr: "س", effectiveBloomsLevel: "Apply", subjectId: "chemistry" } as never;
    const out = await generateWithModel(
      { objectives: [objective], assessmentTypes: ["short_answer"], count: 2, difficulty: "standard", language: "ar" },
      async () => ({ parsed: { questions: [{ type: "essay" }, { type: "short_answer", objectiveId: "nope" }] }, model: "m" }),
    );
    assertCodes(out.notes, out.noteCodes, "generateWithModel");
    assert.deepEqual(out.noteCodes, [{ code: "model_discarded", params: { count: 2 } }]);
  });
});

describe("the route's notes", () => {
  it("each carry a code", () => {
    const notes = [
      routeNotes.firstGradeTypesDropped(["multiple_choice", "matching"], ["short_answer"]),
      routeNotes.groundedOn([{ titleAr: "الرياضيات - الفصل الأول", page: 42 }]),
      routeNotes.notGrounded(),
      routeNotes.modelSurplusTrimmed(2, 10),
      routeNotes.bookItemsDrawn(3),
      routeNotes.bookItemsShort(1, 3),
      routeNotes.surplusTrimmed(1, 15),
      routeNotes.noKeyChecked(),
    ];
    assertCodes(notes.map(n => n.en), notes.map(n => n.code!), "route notes");
    assert.deepEqual(notes[1]!.code, { code: "grounded_on", params: { sources: [{ title: "الرياضيات - الفصل الأول", page: 42 }] } });
  });

  it("are sent as three lists, one for one, with null where a producer fell out of step", () => {
    const zipped = routeNotes.zipNotes(["A", "B"], ["أ"], [{ code: "no_objectives", params: {} }]);
    // A short Arabic list or code list is not trusted to line up: English, no code.
    assert.deepEqual(zipped, [{ en: "A", ar: "A" }, { en: "B", ar: "B" }]);
    const lists = routeNotes.warningLists([
      ...routeNotes.zipNotes(["A"], ["أ"], [{ code: "shortfall", params: { made: 3, requested: 5 } }]),
      { en: "C", ar: "ج" },
    ]);
    assert.deepEqual(lists, {
      warnings: ["A", "C"],
      warningsAr: ["أ", "ج"],
      warningCodes: [{ code: "shortfall", params: { made: 3, requested: 5 } }, null],
    });
  });
});

describe("the shared list of codes", () => {
  it("has no code that nothing above raised", () => {
    const silent = GENERATION_WARNING_CODES.filter(c => !raised.has(c));
    assert.deepEqual(silent, [], `codes no producer raised: ${silent.join(", ")}`);
  });

  it("rejects what is not a known warning", () => {
    assert.equal(isGenerationWarning({ code: "shortfall", params: { made: 1, requested: 2 } }), true);
    for (const bad of [null, "shortfall", { code: "nope", params: {} }, { code: "shortfall" }, { code: "shortfall", params: [] }, { code: "toString", params: {} }]) {
      assert.equal(isGenerationWarning(bad), false, JSON.stringify(bad));
    }
  });
});
