import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMathsLesson, parsePractice, PRACTICE_TOTAL_MAX } from "../practice.ts";

const MATHS = "kbl-g5-math-s1-nccd-u2_l3";

describe("parsePractice", () => {
  it("takes a maths lesson with a sane score", () => {
    assert.deepEqual(parsePractice({ lessonId: MATHS, correct: 7, total: 10 }), { ok: true, value: { lessonId: MATHS, correct: 7, total: 10 } });
    assert.equal(parsePractice({ lessonId: MATHS, correct: 0, total: 3 }).ok, true);
  });

  it("refuses a lesson that is not maths, or not a lesson", () => {
    assert.equal(isMathsLesson(MATHS), true);
    assert.equal(isMathsLesson("kbl-math-s1-nccd-u1_lab"), true, "Grade 10 maths");
    assert.equal(isMathsLesson("no-such-lesson"), false);
    for (const lessonId of ["no-such-lesson", "", 42, null, "x".repeat(200)]) {
      assert.equal(parsePractice({ lessonId, correct: 1, total: 2 }).ok, false, String(lessonId));
    }
  });

  it("refuses scores outside 0 ≤ correct ≤ total, 1 ≤ total ≤ the cap, and non-integers", () => {
    for (const [correct, total] of [[11, 10], [-1, 10], [1.5, 10], [0, 0], [1, PRACTICE_TOTAL_MAX + 1], ["5", 10], [5, "10"]]) {
      assert.equal(parsePractice({ lessonId: MATHS, correct, total }).ok, false, `${correct}/${total}`);
    }
    assert.equal(parsePractice(null).ok, false);
  });
});
