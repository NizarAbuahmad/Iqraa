/**
 * Three things a generated paper can get wrong without any one question being
 * wrong, which the validator now says out loud (warnings, never rejections):
 *
 * - a competency with no questions at all on a paper long enough to seed every
 *   one with two (`allocateQuestions` does from 8). The old check only warned
 *   at exactly one question, so a competency the writer skipped entirely was a
 *   blank bar on the dashboard with nothing said before publishing;
 * - true/false statements nearly all true, or all false — the prompt asks for
 *   about half of each, and nothing checked;
 * - the right multiple-choice answer mostly in one position.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { validateGenerated } from "../validator.ts";
import { shuffleChoices } from "../choiceOrder.ts";
import type { CompetencyKey } from "../competency.ts";

let n = 0;
function base(competencyKey: CompetencyKey): Omit<GeneratedQuestion, "type" | "body" | "expectedAnswer"> {
  return {
    rubric: null,
    objectiveId: "o",
    competencyKey,
    difficulty: "standard",
    marks: 1,
    skill: null,
    gradingMode: "auto",
    aiMetadata: {},
  };
}
/** Stems that share nothing, so the duplicate and same-ask checks stay quiet. */
const WORDS = ["الحديد", "النحاس", "الصوديوم", "الكلور", "الأكسجين", "الهيدروجين", "الكربون", "النيتروجين",
  "الفسفور", "الكبريت", "المغنيسيوم", "الألمنيوم", "البوتاسيوم", "الكالسيوم", "الزنك", "الفضة"];
const word = () => `${WORDS[n++ % WORDS.length]} ${n}`;

function tf(value: boolean, competencyKey: CompetencyKey = "knowledge"): GeneratedQuestion {
  return { ...base(competencyKey), type: "true_false", body: { statement: `عنصر ${word()} فلز` }, expectedAnswer: { value } };
}
function mcq(correctAt: number, competencyKey: CompetencyKey = "knowledge"): GeneratedQuestion {
  const options = ["a", "b", "c", "d"].map((id, i) => ({ id, text: `${id}${i}${word()}` }));
  return {
    ...base(competencyKey),
    type: "multiple_choice",
    body: { stem: `ما رمز ${word()}؟`, multiSelect: false, options },
    expectedAnswer: { optionIds: [options[correctAt]!.id] },
  };
}

const OPTS = { allowedObjectiveIds: ["o"], allowedTypes: ["true_false", "multiple_choice"] as const };
const warn = (qs: GeneratedQuestion[]) => validateGenerated(qs, { ...OPTS, allowedTypes: [...OPTS.allowedTypes] }).warnings;
const mixed = (k: number): CompetencyKey[] =>
  Array.from({ length: k }, (_, i) => (["knowledge", "understanding", "application", "critical_thinking"] as const)[i % 4]);

describe("a competency with no questions", () => {
  it("is warned about on a paper of eight or more", () => {
    const paper = ["knowledge", "knowledge", "knowledge", "understanding", "understanding", "application",
      "application", "application"].map((c, i) => mcq(i % 4, c as CompetencyKey));
    assert.ok(warn(paper).some(w => w.includes('"critical_thinking"') && w.includes("no questions")), warn(paper).join(" | "));
  });

  it("is not warned about on a short paper, which cannot seed all four", () => {
    const paper = ["knowledge", "knowledge", "application", "application"].map((c, i) => mcq(i, c as CompetencyKey));
    assert.equal(warn(paper).some(w => w.includes("no questions")), false);
  });
});

describe("true/false balance", () => {
  it("is warned about when nearly every statement is true", () => {
    const comps = mixed(9);
    const paper = [tf(true, comps[0]), tf(true, comps[1]), tf(true, comps[2]), tf(true, comps[3]), tf(true, comps[4]),
      tf(false, comps[5]), mcq(0, comps[6]), mcq(1, comps[7]), mcq(2, comps[8])];
    assert.ok(warn(paper).some(w => w.includes("5 of 6 true/false")), warn(paper).join(" | "));
  });

  it("is quiet when the split is near half", () => {
    const paper = [tf(true), tf(false), tf(true), tf(false), tf(true)];
    assert.equal(warn(paper).some(w => w.includes("true/false")), false);
  });

  it("is quiet below four statements", () => {
    assert.equal(warn([tf(true), tf(true), tf(true)]).some(w => w.includes("true/false")), false);
  });
});

describe("the position of the right answer", () => {
  it("is warned about when more than half sit in one place", () => {
    const paper = [mcq(1), mcq(1), mcq(1), mcq(1), mcq(0), mcq(2)];
    assert.ok(warn(paper).some(w => w.includes("4 of 6 multiple-choice") && w.includes("option 2")), warn(paper).join(" | "));
  });

  it("is quiet when the answers are spread", () => {
    const paper = [mcq(0), mcq(1), mcq(2), mcq(3), mcq(0), mcq(2)];
    assert.equal(warn(paper).some(w => w.includes("multiple-choice")), false);
  });

  it("is never warned about for options the generator shuffled", () => {
    // Five shuffled questions put three keys in one place by chance ~41% of the
    // time; the warning is for what was left in its writer's order.
    for (let seed = 0; seed < 200; seed += 1) {
      let x = seed + 1;
      const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
      const paper = shuffleChoices([mcq(0), mcq(0), mcq(0), mcq(0), mcq(0)], rng);
      assert.equal(warn(paper).some(w => w.includes("multiple-choice")), false, `seed ${seed}`);
    }
  });
});
