/**
 * Multiple-choice options are shuffled once, when a paper is generated.
 *
 * Only a matching question's right column used to be reordered (per attempt, in
 * `studentView.ts`). A multiple-choice question went out in the order its writer
 * gave — a model, which tends to put the right answer in the same place — on the
 * screen and on the printed paper alike. Shuffling at generation keeps the
 * stored order, the printed paper and the key in agreement.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shuffleChoices } from "../choiceOrder.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";

/** A deterministic generator, so a failing case can be rerun. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mcq(texts: string[], correct: number[], extra: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  const ids = ["a", "b", "c", "d", "e"].slice(0, texts.length);
  return {
    type: "multiple_choice",
    body: { stem: "؟", multiSelect: correct.length > 1, options: texts.map((text, i) => ({ id: ids[i], text })) },
    expectedAnswer: { optionIds: correct.map(i => ids[i]) },
    rubric: null,
    objectiveId: "o",
    competencyKey: "knowledge",
    difficulty: "standard",
    marks: 1,
    skill: null,
    gradingMode: "auto",
    aiMetadata: { source: "llm" },
    ...extra,
  };
}

const options = (q: GeneratedQuestion) => q.body["options"] as Array<{ id: string; text: string }>;
const correctTexts = (q: GeneratedQuestion) =>
  (q.expectedAnswer["optionIds"] as string[]).map(id => options(q).find(o => o.id === id)!.text).sort();

describe("shuffleChoices", () => {
  it("keeps the key on the same answer", () => {
    const rng = seeded(1);
    for (let i = 0; i < 50; i += 1) {
      const q = mcq(["١", "٢", "٣", "٤"], [0]);
      const [out] = shuffleChoices([q], rng);
      assert.deepEqual(correctTexts(out!), ["١"]);
      assert.deepEqual(options(out!).map(o => o.text).sort(), ["١", "٢", "٣", "٤"]);
    }
  });

  it("keeps a multi-select key on the same answers", () => {
    const [out] = shuffleChoices([mcq(["w", "x", "y", "z"], [1, 3])], seeded(2));
    assert.deepEqual(correctTexts(out!), ["x", "z"]);
  });

  it("keeps the ids in their order, so the labels read a, b, c, d", () => {
    const [out] = shuffleChoices([mcq(["w", "x", "y", "z"], [0])], seeded(3));
    assert.deepEqual(options(out!).map(o => o.id), ["a", "b", "c", "d"]);
  });

  it("spreads a key that was always first across the positions", () => {
    const rng = seeded(4);
    const papers = shuffleChoices(Array.from({ length: 80 }, () => mcq(["p", "q", "r", "s"], [0])), rng);
    const at = [0, 0, 0, 0];
    for (const q of papers) at[options(q).findIndex(o => o.text === "p")]! += 1;
    for (const n of at) assert.ok(n >= 8 && n <= 40, `positions ${at.join("/")}`);
  });

  it("leaves alone options that point at other options", () => {
    for (const texts of [
      ["٢", "٣", "٤", "جميع ما سبق"],
      ["x", "y", "z", "لا شيء مما سبق"],
      ["x", "y", "z", "أ و ب معًا"],
      ["x", "y", "z", "all of the above"],
      ["x", "y", "z", "a and b"],
      ["x", "y", "z", "كلاهما صحيح"],
      ["x", "y", "z", "كلا الخيارين"],
      ["x", "y", "z", "أ أو ب"],
      ["x", "y", "z", "none of these"],
      ["x", "y", "z", "all of these"],
      ["x", "y", "z", "neither"],
    ]) {
      const q = mcq(texts, [3]);
      const [out] = shuffleChoices([q], seeded(5));
      assert.deepEqual(out, q, texts.join(" | "));
    }
  });

  it("marks what it shuffled, so the position check can tell it from what it left", () => {
    const [moved, kept] = shuffleChoices([mcq(["w", "x", "y", "z"], [0]), mcq(["x", "y", "z", "جميع ما سبق"], [3])], seeded(8));
    assert.equal(moved!.aiMetadata["choiceOrder"], "shuffled");
    assert.equal(kept!.aiMetadata["choiceOrder"], undefined);
  });

  it("leaves a textbook item in the book's own order", () => {
    const q = mcq(["w", "x", "y", "z"], [0], { aiMetadata: { generator: "book" } });
    const [out] = shuffleChoices([q], seeded(6));
    assert.deepEqual(out, q);
  });

  it("leaves other types and the input untouched", () => {
    const tf: GeneratedQuestion = { ...mcq(["w", "x"], [0]), type: "true_false", body: { statement: "s" }, expectedAnswer: { value: true } };
    const q = mcq(["w", "x", "y", "z"], [0]);
    const before = structuredClone(q);
    const [a, b] = shuffleChoices([tf, q], seeded(7));
    assert.deepEqual(a, tf);
    assert.deepEqual(q, before);
    assert.notEqual(b, q);
  });
});
