/**
 * A generated evaluation asks different things, not one thing several times.
 *
 * Measured 2026-10-15 over every lesson's objectives: the template generator
 * filled a 20-question paper on a one-objective lesson by restating that
 * objective in every phrasing it had — «اذكر المفاهيم… المتعلقة بـ X» and «ما
 * المفاهيم الأساسية التي يقوم عليها X؟ اذكرها» are one question to a student,
 * and at a Jaccard of ~0.55 they sailed under the 0.85 duplicate gate. The
 * validator now also says when one sentence carries much of a paper, which is
 * how a live model repeats itself without repeating any one question.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAllObjectives, type CurriculumObjective } from "@workspace/curriculum";
import { generateMockEvaluation, type GeneratedQuestion } from "../mockGenerator.ts";
import { DUPLICATE_THRESHOLD, promptOf, stemSimilarity, validateGenerated } from "../validator.ts";

function byLesson(): CurriculumObjective[][] {
  const lessons = new Map<string, CurriculumObjective[]>();
  for (const o of getAllObjectives()) lessons.set(o.lessonId, [...(lessons.get(o.lessonId) ?? []), o]);
  return [...lessons.values()];
}

const isTemplate = (q: GeneratedQuestion) =>
  q.aiMetadata["generator"] === "mock" && String(q.aiMetadata["note"]).startsWith("template");

describe("the template generator", () => {
  const papers = byLesson().map(objectives =>
    generateMockEvaluation({
      objectives,
      assessmentTypes: ["short_answer", "open_ended", "problem_solving"],
      count: 20,
      difficulty: "standard",
      seed: 11,
    }));

  it("asks about an objective once per competency", () => {
    for (const paper of papers) {
      const asked = paper.questions.filter(isTemplate).map(q => `${q.objectiveId}|${q.competencyKey}`);
      const twice = asked.filter((k, i) => asked.indexOf(k) !== i);
      assert.deepEqual(twice, [], `asked again: ${twice.join(", ")}`);
    }
  });

  it("says why the paper is short when it stopped rather than restate", () => {
    const short = papers.filter(p => p.questions.length < 20);
    assert.ok(short.length > 0, "every lesson filled 20 — the case under test never arose");
    for (const paper of short) {
      assert.ok(
        paper.notes.some(n => n.includes("same objective at the same level")),
        paper.notes.join(" | "),
      );
    }
  });

  it("does not print the objective's full stop in the middle of a sentence", () => {
    for (const paper of papers) {
      for (const q of paper.questions.filter(isTemplate)) {
        const text = [promptOf(q), String(q.expectedAnswer["modelAnswer"] ?? "")].join(" ");
        // Where the objective's own last mark meets the template's.
        assert.doesNotMatch(text, /[.?؟!]\s*[؟،]/u, text);
      }
    }
  });
});

describe("the validator's warning when one sentence carries the paper", () => {
  const objectiveId = "obj-1";
  const q = (prompt: string): GeneratedQuestion => ({
    type: "short_answer",
    body: { prompt },
    expectedAnswer: { modelAnswer: "١", keyConcepts: ["التحليل"] },
    rubric: null,
    objectiveId,
    competencyKey: "application",
    difficulty: "standard",
    marks: 1,
    skill: null,
    gradingMode: "exact",
    aiMetadata: {},
  });
  const validate = (prompts: string[]) =>
    validateGenerated(prompts.map(q), { allowedObjectiveIds: [objectiveId], allowedTypes: ["short_answer"] });
  const sameSentence = (w: string[]) => w.find(x => x.includes("same sentence"));

  it("names the sentence and how many questions use it", () => {
    const result = validate([
      "حلّ المعادلة x² + 3x − 18 = 0 بالتحليل.",
      "حلّ المعادلة x² − 11x + 28 = 0 بالتحليل.",
      "حلّ المعادلة x² + 5x − 14 = 0 بالتحليل.",
      "حلّ المعادلة x² − 2x − 3 = 0 بالتحليل.",
      "أوجد مميز المعادلة x² + 4x + 1 = 0.",
      "اكتب معادلة تربيعية جذراها 2 و 5.",
    ]);
    assert.equal(result.accepted.length, 6);
    const warning = sameSentence(result.warnings);
    assert.ok(warning, result.warnings.join(" | "));
    assert.match(warning!, /4 of 6/);
  });

  it("stays quiet when the questions ask different things", () => {
    const result = validate([
      "حلّ المعادلة x² + 3x − 18 = 0 بالتحليل.",
      "حلّ المعادلة x² − 11x + 28 = 0 بالتحليل.",
      "أوجد مميز المعادلة x² + 4x + 1 = 0.",
      "اكتب معادلة تربيعية جذراها 2 و 5.",
      "ما عدد حلول المعادلة x² + 1 = 0 في الأعداد الحقيقية؟ علّل.",
      "حلّل المقدار x² − 9 إلى عوامله.",
    ]);
    assert.equal(sameSentence(result.warnings), undefined, result.warnings.join(" | "));
  });

  it("does not count stems that are only symbols as one sentence", () => {
    const result = validate(["٣ + ٤ = ؟", "٥ × ٢ = ؟", "٩ − ٦ = ؟", "٨ ÷ ٢ = ؟"]);
    assert.equal(sameSentence(result.warnings), undefined, result.warnings.join(" | "));
  });
});

describe("the duplicate gate", () => {
  const duplicate = (a: string, b: string) => stemSimilarity(a, b) > DUPLICATE_THRESHOLD;

  it("does not call two different equations one question", () => {
    // Every token of these but two used to be dropped as "short", so they scored 1.0.
    assert.equal(duplicate("حلّ المعادلة x² + 3x − 18 = 0 بالتحليل.", "حلّ المعادلة x² − 11x + 28 = 0 بالتحليل."), false);
    assert.equal(duplicate("أوجد ناتج: 2 × 8", "أوجد ناتج: 2 × 7"), false);
  });

  it("still catches the same question asked twice", () => {
    assert.equal(duplicate("حلّ المعادلة x² + 3x − 18 = 0 بالتحليل.", "حلّ المعادلة x² + 3x − 18 = 0 بالتحليل"), true);
    assert.equal(duplicate("ما المقصود بالرابطة الأيونية؟", "ما المقصود بالرابطة الأيونيّة"), true);
  });
});
