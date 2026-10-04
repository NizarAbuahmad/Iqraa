/**
 * POST /feedback validation — a thumb on generated content, or a feature idea.
 *
 * An idea is the same row with `rating: 'idea'` and `materialType:
 * 'feature_request'`, so it lands in the admin dashboard's existing list with
 * no schema change. Unlike a thumb, an idea *is* its comment: an empty one is
 * a tap on a button, not a suggestion, and is refused.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseFeedbackInput } from "../feedbackInput.ts";

describe("parseFeedbackInput", () => {
  it("accepts a thumb with or without a comment", () => {
    assert.deepEqual(parseFeedbackInput({ materialType: " quiz ", toolId: "quiz", rating: "up" }), {
      ok: true,
      value: { materialType: "quiz", toolId: "quiz", rating: "up", comment: "" },
    });
    const down = parseFeedbackInput({ materialType: "lesson", rating: "down", comment: " too long " });
    assert.equal(down.ok && down.value.comment, "too long");
  });

  it("requires materialType and a known rating", () => {
    assert.equal(parseFeedbackInput({ rating: "up" }).ok, false);
    assert.equal(parseFeedbackInput({ materialType: "quiz", rating: "meh" }).ok, false);
    assert.equal(parseFeedbackInput({ materialType: "quiz" }).ok, false);
  });

  it("accepts a feature idea that says something", () => {
    const r = parseFeedbackInput({ materialType: "feature_request", rating: "idea", comment: "تصدير إلى Word" });
    assert.deepEqual(r, {
      ok: true,
      value: { materialType: "feature_request", toolId: "", rating: "idea", comment: "تصدير إلى Word" },
    });
  });

  it("refuses an empty idea", () => {
    for (const comment of [undefined, "", "   "]) {
      assert.equal(parseFeedbackInput({ materialType: "feature_request", rating: "idea", comment }).ok, false, String(comment));
    }
  });

  it("caps a runaway paste at 2000 characters", () => {
    const r = parseFeedbackInput({ materialType: "feature_request", rating: "idea", comment: "x".repeat(5000) });
    assert.equal(r.ok && r.value.comment.length, 2000);
  });

  it("ignores non-string fields rather than throwing", () => {
    assert.equal(parseFeedbackInput({ materialType: 7, rating: "up" }).ok, false);
    assert.equal(parseFeedbackInput(null).ok, false);
  });
});
