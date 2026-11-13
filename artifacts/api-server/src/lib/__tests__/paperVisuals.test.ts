import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PAPER_VISUALS, isPhysicsRequest, physicsVisualClauseAr, physicsVisualClauseEn, settlePaperVisuals,
} from "../paperVisuals.ts";

const PROJ = { kind: "projectile", launch: "ground", angle: 30, speed: { n: 20, unit: "m/s" }, marks: ["v0", "H", "R"] };
const STEM = "قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.";
const physics = { subject: "Physics" };
const q = (text: string, visual?: unknown) => ({ id: "q", type: "short_answer", text, ...(visual !== undefined ? { visual } : {}) });

describe("isPhysicsRequest", () => {
  it("reads the subject id or the subject's name, in either language", () => {
    assert.equal(isPhysicsRequest({ subject: "Physics" }), true);
    assert.equal(isPhysicsRequest({ subject: "الفيزياء" }), true);
    assert.equal(isPhysicsRequest({ subjectId: "physics" }), true);
    assert.equal(isPhysicsRequest({ subject: "Chemistry" }), false);
    assert.equal(isPhysicsRequest({ subject: "Mathematics" }), false);
    assert.equal(isPhysicsRequest({}), false);
    assert.equal(isPhysicsRequest(undefined), false);
  });
});

describe("the prompt clause", () => {
  it("is empty for every subject but physics", () => {
    for (const subject of ["Mathematics", "Chemistry", "Biology", "Science", "Arabic", "English", "", "Unknown"]) {
      assert.equal(physicsVisualClauseAr({ subject }), "");
      assert.equal(physicsVisualClauseEn({ subject }), "");
    }
  });
  it("for physics: starts on a new line, names the field and the cap, forbids pointing at the drawing", () => {
    const en = physicsVisualClauseEn(physics);
    const ar = physicsVisualClauseAr(physics);
    assert.ok(en.startsWith("\n") && ar.startsWith("\n"));
    assert.match(en, /"visual"/);
    assert.match(ar, /"visual"/);
    assert.ok(en.includes(`At most ${MAX_PAPER_VISUALS} drawings`));
    assert.ok(ar.includes(`${MAX_PAPER_VISUALS} رسوم على الأكثر`));
    assert.match(en, /never refer to it/);
    assert.match(ar, /وألّا يشير إليه/);
  });
});

describe("settlePaperVisuals", () => {
  it("ignores kinds that are not papers", () => {
    assert.equal(settlePaperVisuals("lesson-plan", { questions: [q(STEM, PROJ)] }, physics), null);
  });

  it("keeps a valid drawing on a physics quiz, rebuilt from the gate", () => {
    const paper = { questions: [q(STEM, { ...PROJ, extra: "x" })] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: 1 }, dropped: {} });
    assert.deepEqual(paper.questions[0]!.visual, PROJ);
  });

  it("removes every drawing from a paper that is not physics", () => {
    const paper = { questions: [q(STEM, PROJ), q("x")] };
    const s = settlePaperVisuals("quiz", paper, { subject: "Chemistry" })!;
    assert.deepEqual(s, { physics: false, kept: {}, dropped: { "not-physics": 1 } });
    assert.ok(!("visual" in paper.questions[0]!));
  });

  it("drops a drawing the gate refuses, and keeps its question", () => {
    const paper = { questions: [q(STEM, { ...PROJ, angle: 85 })] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s.dropped, { gate: 1 });
    assert.equal(paper.questions.length, 1);
    assert.ok(!("visual" in paper.questions[0]!));
  });

  it("drops a drawing that shows a number the question does not state", () => {
    const paper = { questions: [q("قُذفت كرة بزاوية 30°. احسب سرعتها الابتدائية.", PROJ)] };
    assert.deepEqual(settlePaperVisuals("quiz", paper, physics)!.dropped, { numbers: 1 });
  });

  it("reads only the stem: a number in the options or the answer does not count", () => {
    const paper = { questions: [{ ...q("قُذفت كرة بزاوية 30°. ما سرعتها؟", PROJ), options: ["20 م/ث", "10 م/ث"], correctAnswer: "20 م/ث" }] };
    assert.deepEqual(settlePaperVisuals("quiz", paper, physics)!.dropped, { numbers: 1 });
  });

  it(`keeps the first ${MAX_PAPER_VISUALS} in paper order on a worksheet, across sections`, () => {
    const sec = (n: number) => ({ title: "s", questions: Array.from({ length: n }, () => q(STEM, PROJ)) });
    const paper = { sections: [sec(4), sec(4)] };
    const s = settlePaperVisuals("worksheet", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: MAX_PAPER_VISUALS }, dropped: { cap: 8 - MAX_PAPER_VISUALS } });
    const flags = paper.sections.flatMap(x => x.questions.map(y => "visual" in y));
    assert.deepEqual(flags, [true, true, true, true, true, true, false, false]);
  });

  it("caps after the other checks: a refused drawing frees its slot, and the last one is capped", () => {
    const paper = { questions: Array.from({ length: 8 }, (_, i) => q(i === 1 ? "قُذفت كرة بزاوية 30°. احسب سرعتها." : STEM, PROJ)) };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: 6 }, dropped: { numbers: 1, cap: 1 } });
    const flags = paper.questions.map(x => "visual" in x);
    assert.deepEqual(flags, [true, false, true, true, true, true, true, false]);
  });

  it("removes a visual outside the questions, uncounted: the paper root, a section, an answerKey row", () => {
    const paper = {
      title: "t",
      visual: PROJ,
      sections: [{ title: "s", visual: PROJ, questions: [q(STEM, PROJ)] }],
      answerKey: [{ id: "q", answer: "x", visual: PROJ }],
    };
    const s = settlePaperVisuals("worksheet", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: 1 }, dropped: {} });
    const hasVisual = (o: object) => Object.hasOwn(o, "visual");
    assert.ok(!hasVisual(paper));
    assert.ok(!hasVisual(paper.sections[0]!));
    assert.ok(!hasVisual(paper.answerKey[0]!));
    assert.ok(hasVisual(paper.sections[0]!.questions[0]!));
  });

  it("removes an explicit null and a drawing on a question with no text", () => {
    const paper = { questions: [q(STEM, null), { id: "q2", type: "short_answer", visual: PROJ }] };
    const s = settlePaperVisuals("homework", { sections: [{ questions: paper.questions }] }, physics)!;
    assert.deepEqual(s.dropped, { gate: 1, numbers: 1 });
  });

  it("accepts physics vectors, and refuses a function graph on a physics paper", () => {
    const vec = { kind: "vectors", vectors: [{ from: [0, 0], to: [3, 0], label: "A" }, { from: [0, 0], to: [0, 4], label: "B" }] };
    const graph = { kind: "function-graph", functions: [{ expr: "x^2", label: "f" }], x: [-2, 2] };
    const paper = { questions: [q("A = 3 N و B = 4 N متعامدتان", vec), q("x", graph)] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { vectors: 1 }, dropped: { gate: 1 } });
  });

  it("never throws on a malformed paper", () => {
    for (const p of [null, 1, "x", [], { questions: "x" }, { sections: [null, { questions: [null, 1] }] }]) {
      assert.doesNotThrow(() => settlePaperVisuals("quiz", p, physics));
      assert.doesNotThrow(() => settlePaperVisuals("worksheet", p, physics));
    }
  });
});
