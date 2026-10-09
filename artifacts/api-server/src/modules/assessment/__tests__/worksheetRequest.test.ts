/**
 * The body of `POST /evaluations/from-worksheet`, checked before anything is
 * looked up or stored. A worksheet arrives from the app as JSON the teacher may
 * have edited, so its shape is not trusted.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWorksheetRequest } from "../worksheetRequest.ts";

const valid = () => ({
  worksheet: {
    title: "  ورقة عمل  ",
    sections: [{ title: "أ", questions: [{ text: "حل 2^x = 8", points: 2 }, { text: "س", options: ["صح", "خطأ"], points: 1 }] }],
    answerKey: [{ num: 1, answer: "x = 3" }, { num: 2, answer: "صح", solution: ["خطوة"] }],
  },
  objectiveId: " o-nccd-s1-u3_l1-0 ",
  classGroupId: " c1 ",
  language: "ar",
});

describe("parseWorksheetRequest", () => {
  it("accepts a well-formed body and trims its ids and title", () => {
    const r = parseWorksheetRequest(valid());
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(r.value.objectiveId, "o-nccd-s1-u3_l1-0");
    assert.equal(r.value.classGroupId, "c1");
    assert.equal(r.value.title, "ورقة عمل");
    assert.equal(r.value.language, "ar");
    assert.equal(r.value.worksheet.sections[0]!.questions.length, 2);
    assert.deepEqual(r.value.worksheet.answerKey[1]!.solution, ["خطوة"]);
  });

  it("falls back to Arabic for an unknown language", () => {
    const r = parseWorksheetRequest({ ...valid(), language: "fr" });
    assert.ok(r.ok);
    assert.equal(r.value.language, "ar");
  });

  for (const [name, mutate] of [
    ["no worksheet", (b: any) => { delete b.worksheet; }],
    ["no sections", (b: any) => { b.worksheet.sections = []; }],
    ["a question with no text", (b: any) => { b.worksheet.sections[0].questions[0].text = " "; }],
    ["non-numeric points", (b: any) => { b.worksheet.sections[0].questions[0].points = "two"; }],
    ["options that are not strings", (b: any) => { b.worksheet.sections[0].questions[1].options = [1, 2]; }],
    ["an answer key that is not a list", (b: any) => { b.worksheet.answerKey = "x"; }],
    ["no objective", (b: any) => { b.objectiveId = ""; }],
    ["no class", (b: any) => { delete b.classGroupId; }],
    ["more than 50 questions", (b: any) => {
      b.worksheet.sections[0].questions = Array.from({ length: 51 }, () => ({ text: "س", points: 1 }));
    }],
  ] as const) {
    it(`refuses ${name}`, () => {
      const body = valid();
      mutate(body);
      const r = parseWorksheetRequest(body);
      assert.equal(r.ok, false, name);
    });
  }

  it("refuses a non-object body", () => {
    assert.equal(parseWorksheetRequest(null).ok, false);
    assert.equal(parseWorksheetRequest("x").ok, false);
  });
});
