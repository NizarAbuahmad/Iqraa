/**
 * What a student may write through `PUT /take/attempt/answers/:questionId`.
 *
 * The route used to accept any JSON object for any question. Two of the
 * assertions below are the reason it no longer does: a read-aloud answer is
 * composed by the server (audio key, transcript, take count), so a client that
 * can write one can grade itself and reset the paid take counter.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  acceptStudentResponse,
  examDeadline,
  isPastDeadline,
  MAX_TEXT_CHARS,
} from "../studentResponse.ts";

function accepted(type: string, raw: unknown) {
  const r = acceptStudentResponse(type, raw);
  assert.equal(r.ok, true, `expected ${type} to accept ${JSON.stringify(raw)}: ${JSON.stringify(r)}`);
  return (r as { ok: true; response: Record<string, unknown> }).response;
}

function refused(type: string, raw: unknown) {
  const r = acceptStudentResponse(type, raw);
  assert.equal(r.ok, false, `expected ${type} to refuse ${JSON.stringify(raw)}`);
  return r as { ok: false; status: number; code: string };
}

describe("acceptStudentResponse", () => {
  it("refuses any write to a read-aloud question", () => {
    const r = refused("read_aloud", { audioKey: "x", transcript: "the whole passage", takes: 0 });
    assert.equal(r.status, 400);
    assert.equal(r.code, "not_writable");
  });

  it("refuses a non-object", () => {
    assert.equal(refused("short_answer", "hello").code, "bad_response");
    assert.equal(refused("short_answer", null).code, "bad_response");
    assert.equal(refused("short_answer", ["a"]).code, "bad_response");
  });

  it("projects multiple choice to string option ids only", () => {
    const r = accepted("multiple_choice", { optionIds: ["a", 7, "b"], transcript: "no" });
    assert.deepEqual(r, { optionIds: ["a", "b"] });
  });

  it("projects true/false to a boolean value only", () => {
    assert.deepEqual(accepted("true_false", { value: false, text: "x" }), { value: false });
    assert.deepEqual(accepted("true_false", { value: "true" }), {});
  });

  it("projects matching to id pairs", () => {
    const r = accepted("matching", { pairs: [{ left: "l1", right: "r2" }, { left: 1, right: "r" }, "x"] });
    assert.deepEqual(r, { pairs: [{ left: "l1", right: "r2" }] });
  });

  it("projects fill-blank to a string array and keeps its positions", () => {
    assert.deepEqual(accepted("fill_blank", { blanks: ["", "seven", 3] }), { blanks: ["", "seven", ""] });
  });

  it("keeps the dictation fields the grader and the play counter read", () => {
    assert.deepEqual(
      accepted("dictation", { text: "مدرسة", optionIds: ["o1"], played: 2, transcript: "x" }),
      { text: "مدرسة", optionIds: ["o1"], played: 2 },
    );
  });

  it("keeps free text for the written types and drops everything else", () => {
    for (const type of ["short_answer", "open_ended", "problem_solving", "practical_task"]) {
      assert.deepEqual(accepted(type, { text: " 42 ", audioKey: "k" }), { text: " 42 " });
    }
  });

  it("caps free text rather than storing a megabyte per keystroke", () => {
    const r = refused("open_ended", { text: "x".repeat(MAX_TEXT_CHARS + 1) });
    assert.equal(r.status, 413);
    assert.equal(r.code, "too_long");
  });

  it("treats an unknown type as free text, never as pass-through", () => {
    assert.deepEqual(accepted("something_new", { text: "a", transcript: "b" }), { text: "a" });
  });
});

describe("examDeadline", () => {
  const started = new Date("2026-10-02T08:00:00Z");

  it("is null when the exam has no time limit", () => {
    assert.equal(examDeadline(started, null), null);
    assert.equal(examDeadline(started, 0), null);
  });

  it("is null when the attempt has not started", () => {
    assert.equal(examDeadline(null, 20), null);
  });

  it("is start plus the limit, with a grace period for the last save", () => {
    const d = examDeadline(started, 20, 60_000)!;
    assert.equal(d.toISOString(), "2026-10-02T08:21:00.000Z");
  });

  it("isPastDeadline is false with no deadline and strict after it", () => {
    assert.equal(isPastDeadline(null, new Date()), false);
    const d = examDeadline(started, 20, 0)!;
    assert.equal(isPastDeadline(d, new Date("2026-10-02T08:19:59Z")), false);
    assert.equal(isPastDeadline(d, new Date("2026-10-02T08:20:00Z")), false);
    assert.equal(isPastDeadline(d, new Date("2026-10-02T08:20:01Z")), true);
  });
});
