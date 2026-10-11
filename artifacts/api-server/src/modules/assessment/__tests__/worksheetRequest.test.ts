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

  describe("format", () => {
    const withFormat = (format: unknown) => {
      const b: any = valid();
      b.worksheet.sections[0].questions[0].format = format;
      return parseWorksheetRequest(b);
    };
    const q0 = (r: ReturnType<typeof parseWorksheetRequest>) => {
      assert.ok(r.ok, JSON.stringify(r));
      return r.value.worksheet.sections[0]!.questions[0] as any;
    };
    const win = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };

    it("keeps a well-formed format of each kind, rebuilt field by field", () => {
      const formats = [
        { kind: "match", stem: "صِل", left: ["a", "b"], right: ["x", "y"], pairs: [1, 0] },
        { kind: "order", stem: "رتّب", steps: ["a", "b", "c"], order: [2, 0, 1] },
        { kind: "spot_error", stem: "أين؟", steps: ["a", "b", "c"], wrongStep: 1, fix: "f", why: "w" },
        { kind: "graph", stem: "ارسم", exprs: ["x + 1"], window: win },
      ];
      for (const f of formats) assert.deepEqual(q0(withFormat(f)).format, f);
      assert.deepEqual(q0(withFormat({ ...formats[3], extra: "dropped", window: { ...win, z: 1 } })).format, formats[3]);
    });

    const malformed: [string, unknown][] = [
      ["an unknown kind", { kind: "other", stem: "s" }],
      ["a non-object", "match"],
      ["a non-string in left", { kind: "match", stem: "s", left: ["a", 2], right: ["x", "y"], pairs: [0, 1] }],
      ["a pair out of range", { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 2] }],
      ["a fractional pair", { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 0.5] }],
      ["more than 10 steps", { kind: "order", stem: "s", steps: Array.from({ length: 11 }, () => "a"), order: Array.from({ length: 11 }, (_, i) => i) }],
      ["a step over 300 characters", { kind: "order", stem: "s", steps: ["a", "b".repeat(301)], order: [0, 1] }],
      ["an order index out of range", { kind: "order", stem: "s", steps: ["a", "b"], order: [0, 2] }],
      ["a wrongStep out of range", { kind: "spot_error", stem: "s", steps: ["a", "b", "c"], wrongStep: 3, fix: "f", why: "w" }],
      ["no stem", { kind: "spot_error", steps: ["a", "b", "c"], wrongStep: 0, fix: "f", why: "w" }],
      ["a window that is not numbers", { kind: "graph", stem: "s", exprs: ["x"], window: { xMin: "a", xMax: 3, yMin: -3, yMax: 3 } }],
      ["an inverted window", { kind: "graph", stem: "s", exprs: ["x"], window: { xMin: 3, xMax: -3, yMin: -3, yMax: 3 } }],
      ["no expressions", { kind: "graph", stem: "s", exprs: [], window: win }],
    ];
    for (const [name, format] of malformed) {
      it(`drops ${name} without refusing the request`, () => {
        const q = q0(withFormat(format));
        assert.equal("format" in q, false);
        assert.equal(q.text, "حل 2^x = 8");
      });
    }
  });

  it("refuses a non-object body", () => {
    assert.equal(parseWorksheetRequest(null).ok, false);
    assert.equal(parseWorksheetRequest("x").ok, false);
  });
});
