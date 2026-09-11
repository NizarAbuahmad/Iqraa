/**
 * Read-aloud scoring.
 *
 * The score a student sees comes straight out of here, so what matters is that
 * it is honest at the edges: a perfect reading scores 1, a wrong reading does
 * not score well by accident, and nothing about the shape of the input can
 * hand out marks nobody earned.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_WORDS, normalizeForReading, scoreReading } from "../readAloud.ts";

const PASSAGE = "The power of appearance is greater than we think.";

describe("normalizeForReading", () => {
  it("drops punctuation and case, which a reader does not speak", () => {
    assert.deepEqual(normalizeForReading("The power, of Appearance!"), ["the", "power", "of", "appearance"]);
  });

  it("keeps a contraction as one word", () => {
    // Splitting on the apostrophe would score a correctly-read "we're" as two
    // errors against one reference word.
    assert.deepEqual(normalizeForReading("we're"), ["we're"]);
  });

  it("treats a curly apostrophe as a straight one", () => {
    // Whisper emits ’, a pasted passage usually has '. Same word, two sources.
    assert.deepEqual(normalizeForReading("we’re"), normalizeForReading("we're"));
  });

  it("strips an apostrophe used as a quotation mark", () => {
    assert.deepEqual(normalizeForReading("'style' is a wheel"), ["style", "is", "a", "wheel"]);
  });

  it("keeps digits as written", () => {
    assert.deepEqual(normalizeForReading("in 1990"), ["in", "1990"]);
  });
});

describe("scoreReading", () => {
  it("gives a perfect reading full marks", () => {
    const s = scoreReading(PASSAGE, PASSAGE);
    assert.equal(s.accuracy, 1);
    assert.equal(s.errors, 0);
  });

  it("ignores punctuation and capitalisation differences", () => {
    const s = scoreReading(PASSAGE, "the power of appearance is greater than we think");
    assert.equal(s.accuracy, 1);
  });

  it("charges one error per wrong word", () => {
    const s = scoreReading(PASSAGE, "The power of appearance is smaller than we think.");
    assert.equal(s.errors, 1);
    assert.equal(s.referenceWords, 9);
    assert.ok(Math.abs(s.accuracy - 8 / 9) < 1e-9);
  });

  it("charges a skipped word", () => {
    const s = scoreReading(PASSAGE, "The power of appearance is than we think.");
    assert.equal(s.errors, 1);
  });

  it("charges an inserted word", () => {
    const s = scoreReading(PASSAGE, "The real power of appearance is greater than we think.");
    assert.equal(s.errors, 1);
  });

  it("scores a reading in the wrong order badly", () => {
    // The Jaccard trap: `stemSimilarity` in validator.ts is order-insensitive
    // and would score this a perfect 1.0. Reading the words of a passage in a
    // jumbled order is not reading the passage.
    const backwards = PASSAGE.split(" ").reverse().join(" ");
    const s = scoreReading(PASSAGE, backwards);
    assert.ok(s.accuracy < 0.5, `expected a poor score, got ${s.accuracy}`);
  });

  it("gives silence nothing", () => {
    const s = scoreReading(PASSAGE, "");
    assert.equal(s.accuracy, 0);
    assert.equal(s.spokenWords, 0);
  });

  it("never returns a negative score, however much is said", () => {
    // Errors can exceed the reference length when a student talks past the
    // passage; a negative accuracy is not something a teacher can act on.
    const s = scoreReading("Hello there.", "completely unrelated words ".repeat(50));
    assert.ok(s.accuracy >= 0);
  });

  it("scores an unrelated reading at zero, not merely low", () => {
    const s = scoreReading(PASSAGE, "bananas bananas bananas bananas bananas bananas bananas bananas bananas");
    assert.equal(s.accuracy, 0);
  });

  it("refuses to award marks for an empty passage", () => {
    // A broken question must never read as a perfect performance. Validation
    // rejects this before it ships; the score fails closed anyway.
    assert.equal(scoreReading("", "anything at all").accuracy, 0);
    assert.equal(scoreReading("   ", "").accuracy, 0);
  });

  it("bounds the work it will do on a hostile input", () => {
    // The alignment matrix is |reference| x |spoken|; this route's identity is
    // a shared link, so an unbounded transcript is a cost vector.
    const huge = "word ".repeat(5000);
    const s = scoreReading(huge, huge);
    assert.equal(s.referenceWords, MAX_WORDS);
    assert.equal(s.spokenWords, MAX_WORDS);
    assert.equal(s.accuracy, 1);
  });

  it("still scores the truncated prefix honestly", () => {
    const ref = Array.from({ length: MAX_WORDS + 50 }, (_, i) => `w${i}`).join(" ");
    const said = Array.from({ length: MAX_WORDS + 50 }, (_, i) => (i === 0 ? "wrong" : `w${i}`)).join(" ");
    const s = scoreReading(ref, said);
    assert.equal(s.errors, 1);
  });
});
