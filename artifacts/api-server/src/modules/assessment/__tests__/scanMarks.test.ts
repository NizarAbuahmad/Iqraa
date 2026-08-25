/**
 * Reading marks off a photograph.
 *
 * Every test here is about the same question: when the reading is uncertain,
 * does the result under-claim? A wrong OCR does not throw — it produces a
 * confident number against a real student's name, so the only safe failure is
 * an empty box the teacher has to look at.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScanPrompt,
  parseArabicNumber,
  parseScanResponse,
  type ScannableQuestion,
} from "../scanMarks.ts";

const QUESTIONS: ScannableQuestion[] = [
  { questionId: "q1", number: 1, maxMarks: 5, type: "open_ended" },
  { questionId: "q2", number: 2, maxMarks: 10, type: "open_ended" },
  { questionId: "q3", number: 3, maxMarks: 2, type: "short_answer" },
];

describe("parseArabicNumber", () => {
  it("reads Western and Arabic-Indic digits the same", () => {
    assert.equal(parseArabicNumber("7"), 7);
    assert.equal(parseArabicNumber("٧"), 7);
    assert.equal(parseArabicNumber("۷"), 7);
    assert.equal(parseArabicNumber(7), 7);
  });

  it("reads the half marks teachers actually write", () => {
    assert.equal(parseArabicNumber("5.5"), 5.5);
    assert.equal(parseArabicNumber("٥٫٥"), 5.5);
    assert.equal(parseArabicNumber("5½"), 5.5);
    assert.equal(parseArabicNumber("٥ ونصف"), 5.5);
  });

  it("is null for anything that is not a number", () => {
    for (const raw of ["", "  ", "غير واضح", null, undefined, {}, NaN]) {
      assert.equal(parseArabicNumber(raw), null, JSON.stringify(raw));
    }
  });
});

describe("buildScanPrompt", () => {
  it("tells the model it is transcribing, not marking", () => {
    const { system } = buildScanPrompt(QUESTIONS);
    assert.match(system, /transcribing, not marking/);
    assert.match(system, /never infer a mark from the student's work/);
  });

  it("says outright that omitting beats guessing", () => {
    // The single most important instruction: a guessed mark is attached to a
    // real student, and nothing downstream can tell it from a read one.
    assert.match(buildScanPrompt(QUESTIONS).system, /Omitting is always better than guessing/);
  });

  it("lists each question with its ceiling", () => {
    const { user } = buildScanPrompt(QUESTIONS);
    assert.match(user, /1\. out of 5/);
    assert.match(user, /2\. out of 10/);
  });
});

describe("parseScanResponse", () => {
  it("accepts a clean reading", () => {
    const { proposals, skipped } = parseScanResponse(
      { marks: [{ number: 1, value: 4, readAs: "4" }, { number: 2, value: 7.5, readAs: "٧٫٥" }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 2);
    assert.equal(proposals[0]!.questionId, "q1");
    assert.equal(proposals[1]!.awardedMarks, 7.5);
    assert.equal(proposals[1]!.readAs, "٧٫٥");
    // Question 3 had no mark, so it is reported as still needing one.
    assert.deepEqual(skipped.map(s => s.number), [3]);
  });

  it("drops a mark above the question's ceiling instead of clamping it", () => {
    // Clamping 50 to 5 would look exactly like a correct reading.
    const { proposals, skipped } = parseScanResponse(
      { marks: [{ number: 1, value: 50, readAs: "50" }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 0);
    assert.match(skipped.find(s => s.number === 1)!.reason, /outside 0–5/);
  });

  it("never turns an unreadable mark into a zero", () => {
    const { proposals, skipped } = parseScanResponse(
      { marks: [{ number: 2, value: "مطموس", readAs: "؟" }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 0);
    assert.match(skipped.find(s => s.number === 2)!.reason, /could not read/);
  });

  it("ignores a mark for a question that is not on this paper", () => {
    // A misread of the page number would otherwise put a mark on the wrong
    // question — silently, and with the right-looking value.
    const { proposals } = parseScanResponse(
      { marks: [{ number: 9, value: 3, readAs: "3" }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 0);
  });

  it("takes only the first reading when a question appears twice", () => {
    const { proposals } = parseScanResponse(
      { marks: [{ number: 1, value: 4 }, { number: 1, value: 1 }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]!.awardedMarks, 4);
  });

  it("reports every question when the response is unusable", () => {
    for (const raw of [null, undefined, {}, { marks: "no" }, [], "text"]) {
      const { proposals, skipped } = parseScanResponse(raw, QUESTIONS);
      assert.equal(proposals.length, 0, JSON.stringify(raw));
      assert.equal(skipped.length, 3, "every question still needs a mark");
    }
  });

  it("accepts a zero the teacher actually wrote", () => {
    // The one case where zero is right: it was on the page.
    const { proposals } = parseScanResponse(
      { marks: [{ number: 3, value: 0, readAs: "٠" }] },
      QUESTIONS,
    );
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]!.awardedMarks, 0);
  });
});
