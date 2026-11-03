import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bodyAfterEdit, studentVisual } from "../questionVisual.ts";

const visual = { kind: "vectors", vectors: [{ from: [0, 0], to: [3, 2], label: "u" }] };
const base = { stem: "ما طول المتجه u = ⟨3, 2⟩؟", options: [{ id: "a", text: "√13" }] };

describe("studentVisual", () => {
  it("passes a gated figure, normalised", () => {
    assert.deepEqual(studentVisual({ visual: { ...visual, junk: 1 } }), visual);
  });
  it("refuses anything else", () => {
    for (const v of [undefined, null, 7, { kind: "vectors", vectors: [] }, { ...visual, vectors: [{ from: [0, 0], to: [3, 2], label: "x=3" }] }]) {
      assert.equal(studentVisual({ visual: v }), null, JSON.stringify(v));
    }
    assert.equal(studentVisual({}), null);
  });
});

describe("bodyAfterEdit", () => {
  const existing = { body: { ...base, visual }, expectedAnswer: { optionIds: ["a"] } };

  it("keeps the drawing when nothing the student reads changed (marks, objective, rubric edits)", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, visual }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
  });

  it("takes the drawing from the stored question, never from the client", () => {
    const forged = { kind: "vectors", vectors: [{ from: [0, 0], to: [9, 9], label: "w" }] };
    const out = bodyAfterEdit(existing, { body: { ...base, visual: forged }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
  });

  it("drops it when the text changes", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, stem: "ما طول u؟", visual }, expectedAnswer: { optionIds: ["a"] } });
    assert.equal("visual" in out, false);
  });

  it("drops it when the key changes", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, visual }, expectedAnswer: { optionIds: ["b"] } });
    assert.equal("visual" in out, false);
  });

  it("does not let a client add a drawing to a question that had none", () => {
    const out = bodyAfterEdit({ body: base, expectedAnswer: {} }, { body: { ...base, visual }, expectedAnswer: {} });
    assert.equal("visual" in out, false);
  });

  it("ignores the book figure and key order when deciding whether the text changed", () => {
    const fig = { uri: "u", caption: "c" };
    const out = bodyAfterEdit(existing, { body: { visual, figure: fig, options: base.options, stem: base.stem }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
    assert.deepEqual(out["figure"], fig);
  });

  it("drops a stored drawing that no longer passes the gate", () => {
    const bad = { body: { ...base, visual: { kind: "pie" } }, expectedAnswer: {} };
    const out = bodyAfterEdit(bad, { body: { ...base, visual: { kind: "pie" } }, expectedAnswer: {} });
    assert.equal("visual" in out, false);
  });
});
