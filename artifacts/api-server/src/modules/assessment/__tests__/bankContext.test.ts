/**
 * The generator's refusal should end with somewhere to look.
 *
 * `mockGenerator` declines four of the eight question types on purpose — it
 * will not invent distractors. That refusal used to be the end of the reply.
 * The bank knows there are question banks and past papers on file for most of
 * these units, so it can name them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getObjectivesForUnit, getAllObjectives } from "@workspace/curriculum";
import { bankContextFor, generateMockEvaluation } from "../mockGenerator.ts";

/** الدائرة — the unit with the most material on file. */
const CIRCLE_UNIT = "kbu-math-s1-nccd-u2";

describe("bankContextFor", () => {
  it("is empty for no objectives, rather than the whole bank", () => {
    const ctx = bankContextFor([]);
    assert.equal(ctx.total, 0);
    assert.equal(ctx.suggested.length, 0);
    assert.deepEqual(ctx.byKind, {});
  });

  it("finds the material for a unit that has some", () => {
    const ctx = bankContextFor(getObjectivesForUnit(CIRCLE_UNIT));
    assert.ok(ctx.total > 0, "no bank material for الدائرة");
    assert.ok((ctx.byKind.worksheet ?? 0) > 0);
    assert.ok((ctx.byKind["question-bank"] ?? 0) > 0);
  });

  it("suggests only kinds that could supply a real item", () => {
    const ctx = bankContextFor(getObjectivesForUnit(CIRCLE_UNIT));
    assert.ok(ctx.suggested.length > 0);
    for (const s of ctx.suggested) {
      assert.ok(["question-bank", "exam", "answer-key"].includes(s.kind), s.kind);
    }
    // Question banks first — they are collections of items, which is what the
    // declined types need. A past paper is one paper.
    assert.equal(ctx.suggested[0]!.kind, "question-bank");
  });

  it("carries the use policy on every suggestion", () => {
    const ctx = bankContextFor(getObjectivesForUnit(CIRCLE_UNIT));
    for (const s of ctx.suggested) {
      assert.ok(s.usePolicy === "quotable" || s.usePolicy === "reference-only");
      // Everything teacher-written is reference-only, and most of this is.
      if (s.authorAr) assert.equal(s.usePolicy, "reference-only", s.id);
    }
    assert.ok(ctx.suggested.some(s => s.usePolicy === "reference-only"));
  });

  it("says how much of it nothing has been read from", () => {
    // The distance between this and real retrieval. A caller must not read
    // `total` as "items we could serve".
    const ctx = bankContextFor(getObjectivesForUnit(CIRCLE_UNIT));
    assert.ok(ctx.pending > 0);
    assert.ok(ctx.pending <= ctx.total);
  });

  it("counts a document shared by two units once", () => {
    const two = [
      ...getObjectivesForUnit("kbu-math-s1-nccd-u1"),
      ...getObjectivesForUnit(CIRCLE_UNIT),
    ];
    const ctx = bankContextFor(two);
    const summed = Object.values(ctx.byKind).reduce((a, b) => a + b, 0);
    assert.equal(summed, ctx.total);
  });

  it("returns an empty context for a unit with nothing on file", () => {
    // Grade 8 science is in the hand-authored catalog and has no bank material
    // and no NCCD-shaped unit id. Empty is the right answer, not a crash.
    const science = getAllObjectives().filter(o => o.subjectId === "science");
    if (!science.length) return;
    assert.equal(bankContextFor(science).total, 0);
  });
});

describe("generateMockEvaluation carries the context", () => {
  const objectives = getObjectivesForUnit(CIRCLE_UNIT).slice(0, 3);

  it("points somewhere when it declines every requested type", () => {
    const result = generateMockEvaluation({
      objectives,
      assessmentTypes: ["multiple_choice", "true_false"],
      count: 5,
      difficulty: "standard",
    });
    assert.equal(result.questions.length, 0);
    assert.deepEqual(result.unavailableTypes, ["multiple_choice", "true_false"]);
    assert.ok(result.bankContext.total > 0);
    // The refusal is no longer a dead end.
    assert.ok(
      result.notes.some(n => /library holds/i.test(n)),
      `notes did not name the library: ${JSON.stringify(result.notes)}`,
    );
  });

  it("points somewhere when it declines only some types", () => {
    const result = generateMockEvaluation({
      objectives,
      assessmentTypes: ["multiple_choice", "open_ended"],
      count: 4,
      difficulty: "standard",
    });
    assert.ok(result.questions.length > 0);
    assert.deepEqual(result.unavailableTypes, ["multiple_choice"]);
    assert.ok(result.notes.some(n => /library holds/i.test(n)));
  });

  it("stays quiet about the library when it declined nothing", () => {
    const result = generateMockEvaluation({
      objectives,
      assessmentTypes: ["open_ended"],
      count: 3,
      difficulty: "standard",
    });
    assert.deepEqual(result.unavailableTypes, []);
    assert.ok(!result.notes.some(n => /library holds/i.test(n)));
    // The context still travels — a caller may want it either way.
    assert.ok(result.bankContext.total > 0);
  });

  it("has a context even with no objectives to scope it by", () => {
    const result = generateMockEvaluation({
      objectives: [],
      assessmentTypes: ["open_ended"],
      count: 3,
      difficulty: "standard",
    });
    assert.equal(result.bankContext.total, 0);
  });

  it("never claims the documents are reproducible", () => {
    const result = generateMockEvaluation({
      objectives,
      assessmentTypes: ["multiple_choice"],
      count: 5,
      difficulty: "standard",
    });
    const note = result.notes.find(n => /library holds/i.test(n));
    assert.ok(note);
    assert.match(note, /not be reproduced verbatim/);
  });
});
