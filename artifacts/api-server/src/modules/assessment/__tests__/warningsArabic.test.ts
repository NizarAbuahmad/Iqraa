/**
 * Every warning a generated exam comes back with has an Arabic twin.
 *
 * The review screen printed the generator's warnings exactly as the API sent
 * them, and the API wrote them in English, so an Arabic teacher read «3 of 12
 * questions ask the same thing…» in English under an Arabic paper. Each warning
 * is now written in both languages where it is made, and each producer returns
 * `…Ar` beside its English list, the same length and in the same order, so the
 * app can show one or the other.
 *
 * "Arabic" here means: Arabic letters, and no English word left in it. Embedded
 * content that is already the teacher's (a question's own stem) is Arabic in
 * these fixtures; a verifier's English reason is left out of the Arabic text.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { validateGenerated } from "../validator.ts";
import {
  contradictionWarning,
  contradictionWarningAr,
  verifyAnswerKeys,
  type RelateKeyFn,
} from "../keyVerification.ts";
import { fitToTotal } from "../marksTotal.ts";
import type { CompetencyKey } from "../competency.ts";
import { generateMockEvaluation } from "../mockGenerator.ts";
import { generateWithModel } from "../llmGenerator.ts";
import * as routeNotes from "../generationNotes.ts";
import { getAllObjectives, getObjectivesForLesson } from "@workspace/curriculum";

/** Arabic letters present, and no run of four or more Latin letters. */
export function assertArabic(text: string, context: string): void {
  assert.match(text, /[ء-ي]/, `no Arabic in ${context}: ${text}`);
  assert.doesNotMatch(text, /[A-Za-z]{4,}/, `English left in ${context}: ${text}`);
}

export function assertTwins(en: readonly string[], ar: readonly string[] | undefined, context: string): void {
  assert.ok(ar, `${context} returned no Arabic list`);
  assert.equal(ar!.length, en.length, `${context}: ${en.length} English, ${ar!.length} Arabic`);
  ar!.forEach((text, i) => assertArabic(text, `${context} #${i + 1} (English: ${en[i]})`));
}

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

describe("the validator's warnings", () => {
  it("come in Arabic too, one for each English warning", () => {
    // Uncovered objective, a lone competency, a missing competency, all-true
    // statements, keys bunched at one position, and one ask repeated.
    const paper = [
      tf(true), tf(true), tf(true), tf(true), tf(true, "understanding"),
      mcq(1, "understanding"), mcq(1, "application"), mcq(1, "application"), mcq(1), mcq(1),
      repeat(1), repeat(2), repeat(3), repeat(4),
    ];
    const out = validateGenerated(paper, {
      allowedObjectiveIds: ["o1", "o2"],
      allowedTypes: ["true_false", "multiple_choice", "short_answer"],
    });
    assert.ok(out.warnings.length >= 5, `fixture raised only: ${out.warnings.join(" | ")}`);
    assertTwins(out.warnings, out.warningsAr, "validateGenerated");
  });

  it("name the competency in Arabic", () => {
    const paper = [mcq(0), mcq(1), mcq(2), mcq(3), mcq(0), mcq(1), mcq(2), mcq(3, "understanding")];
    const out = validateGenerated(paper, { allowedObjectiveIds: ["o1"], allowedTypes: ["multiple_choice"] });
    assert.ok(out.warningsAr.some(w => w.includes("التفكير الناقد")), out.warningsAr.join(" | "));
  });
});

describe("the key check's warnings", () => {
  const q = (): GeneratedQuestion => ({
    ...base("application"),
    type: "short_answer",
    body: { prompt: "أوجد مشتقة الاقتران" },
    expectedAnswer: { modelAnswer: "3x^2 - 4", keyConcepts: ["المشتقة"] },
    gradingMode: "ai_rubric",
    check: { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" },
  });
  const verifier = (relation: string, error: string | null = null): RelateKeyFn =>
    async () => ({ relation, computed_answer: null, error }) as never;

  it("say in Arabic that the verifier was down", async () => {
    const out = await verifyAnswerKeys([q()], verifier("error", "timeout"));
    assertTwins(out.warnings, out.warningsAr, "verifyAnswerKeys (down)");
  });

  it("say in Arabic which questions the verifier disagreed with", async () => {
    const out = await verifyAnswerKeys([q(), q()], verifier("distinct", "distinct"));
    assert.ok(contradictionWarning(out.kept), "fixture raised no contradiction");
    const ar = contradictionWarningAr(out.kept)!;
    assertArabic(ar, "contradictionWarningAr");
    assert.match(ar, /١، ٢|١ و٢/, ar);
    assert.equal(contradictionWarningAr(out.kept.slice(0, 0)), null);
  });
});

describe("the total's notes", () => {
  it("say in Arabic why a total was not met, or that a short paper shares it", () => {
    for (const out of [fitToTotal([1, 2, 3, 4], 18, 20), fitToTotal([1, 2, 3], 0, 20, 10)]) {
      assert.ok(out.note, "fixture raised no note");
      assertArabic(out.noteAr ?? "", "fitToTotal");
    }
    assert.equal(fitToTotal([1, 2], 0, 10).noteAr, undefined);
  });
});

describe("the offline generator's notes", () => {
  it("come in Arabic too: skipped types, the library pointer, a short paper, left-out restatements", () => {
    const objectives = getObjectivesForLesson("kbl-math-s1-nccd-u2_l2");
    const out = generateMockEvaluation({
      objectives,
      assessmentTypes: ["true_false", "fill_blank", "short_answer", "problem_solving"],
      count: 20,
      difficulty: "standard",
      seed: 3,
      subjectId: "mathematics",
      gradeId: "grade-10",
    });
    assert.ok(out.notes.length >= 3, `fixture raised only: ${out.notes.join(" | ")}`);
    assertTwins(out.notes, out.notesAr, "generateMockEvaluation");
  });

  it("say in Arabic when nothing could be made", () => {
    const none = generateMockEvaluation({ objectives: [], assessmentTypes: ["short_answer"], count: 5, difficulty: "basic", seed: 1 });
    assertTwins(none.notes, none.notesAr, "no objectives");
    const objectives = getAllObjectives().filter(o => o.subjectId === "chemistry").slice(0, 2);
    const declined = generateMockEvaluation({ objectives, assessmentTypes: ["matching"], count: 5, difficulty: "basic", seed: 1, subjectId: "chemistry" });
    assertTwins(declined.notes, declined.notesAr, "every type declined");
  });
});

describe("the model's discard note", () => {
  it("comes in Arabic too, with the count and not the English reasons", async () => {
    const objective = { id: "o1", description: "x", descriptionAr: "س", effectiveBloomsLevel: "Apply", subjectId: "chemistry" } as never;
    const out = await generateWithModel(
      { objectives: [objective], assessmentTypes: ["short_answer"], count: 2, difficulty: "standard", language: "ar" },
      async () => ({ parsed: { questions: [{ type: "essay" }, { type: "short_answer", objectiveId: "nope" }] }, model: "m" }),
    );
    assert.ok(out.notes.length === 1, out.notes.join(" | "));
    assertTwins(out.notes, out.notesAr, "generateWithModel");
    assert.match(out.notesAr[0]!, /٢/);
  });
});

describe("the route's notes", () => {
  it("each come in both languages", () => {
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
    for (const note of notes) {
      assert.ok(note.en.length > 0);
      assertArabic(note.ar, `route note (English: ${note.en})`);
    }
    assert.match(routeNotes.groundedOn([{ titleAr: "كتاب", page: 42 }]).ar, /٤٢/);
  });
});
