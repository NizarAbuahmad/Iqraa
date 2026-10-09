/**
 * Who may throw away a failed sitting and try again. The refusals that matter
 * most are the ones that stop a retake overwriting a mark that should stand:
 * a passed quiz, an unmarked paper, or a real exam that is not a lesson quiz.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_RETAKES, retakeDecision, type RetakeInput } from "../retake.ts";

function input(over: Partial<RetakeInput> = {}): RetakeInput {
  return {
    submitted: true,
    studentSitting: true,
    isProvisional: false,
    percent: "40.00",
    threshold: 80,
    retakesUsed: 0,
    singleLesson: true,
    open: true,
    ...over,
  };
}

describe("retakeDecision", () => {
  it("allows a retake after a failed, final, submitted lesson quiz", () => {
    assert.deepEqual(retakeDecision(input()), { ok: true });
  });

  it("refuses a sitting that was never handed in", () => {
    assert.deepEqual(retakeDecision(input({ submitted: false })), { ok: false, code: "not_submitted" });
  });

  it("refuses a paper the teacher typed in — it is not the student's to throw away", () => {
    assert.deepEqual(retakeDecision(input({ studentSitting: false })), { ok: false, code: "teacher_entry" });
  });

  it("refuses a provisional paper — its mark is not final, so it is not a fail yet", () => {
    assert.deepEqual(retakeDecision(input({ isProvisional: true })), { ok: false, code: "provisional" });
  });

  it("refuses an exam that is not a single-lesson quiz, so a real exam's mark cannot be reset", () => {
    assert.deepEqual(retakeDecision(input({ singleLesson: false })), { ok: false, code: "not_a_quiz" });
  });

  it("refuses once the quiz is closed or its link expired", () => {
    assert.deepEqual(retakeDecision(input({ open: false })), { ok: false, code: "closed" });
  });

  it("refuses a quiz already passed, at the mark exactly", () => {
    assert.deepEqual(retakeDecision(input({ percent: 80 })), { ok: false, code: "already_passed" });
    assert.deepEqual(retakeDecision(input({ percent: 79.99 })), { ok: true });
  });

  it("caps the number of retakes", () => {
    assert.deepEqual(retakeDecision(input({ retakesUsed: MAX_RETAKES - 1 })), { ok: true });
    assert.deepEqual(retakeDecision(input({ retakesUsed: MAX_RETAKES })), { ok: false, code: "limit_reached" });
  });

  it("treats an unreadable percent as a fail, never a pass", () => {
    assert.deepEqual(retakeDecision(input({ percent: null })), { ok: true });
  });
});
