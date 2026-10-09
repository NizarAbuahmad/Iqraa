/**
 * A worksheet turned into evaluation questions a class can take.
 *
 * What may be marked automatically is decided here, and the rule is: only what
 * the existing graders can judge without guessing. Multiple choice by option
 * id, true/false, and a numeric key through `answersMatch`. Everything else is
 * a short answer for the teacher — a wrong automatic mark is worse than a
 * question waiting for a person. Every converted question must also pass the
 * real type registry, or the route would store something a student cannot take.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";
import { convertWorksheet, type WorksheetInput } from "../fromWorksheet.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";

type Q = WorksheetInput["sections"][number]["questions"][number];

const one = (q: Q, answer: string, solution?: string[]) =>
  convertWorksheet({
    sections: [{ questions: [q] }],
    answerKey: [{ num: 1, answer, ...(solution ? { solution } : {}) }],
  });

const only = (r: ReturnType<typeof convertWorksheet>) => {
  assert.ok(r.ok, JSON.stringify(r));
  const q = r.questions[0]!;
  assert.deepEqual(QUESTION_TYPES[q.type].validate({ ...q, rubric: null }), [], `${q.type} does not validate`);
  return q;
};

describe("convertWorksheet", () => {
  it("multiple choice whose key matches an option → auto-marked by option id", () => {
    const q = only(one({ text: "أوجد x: 2^x = 8", options: ["x = 2", "x = 3", "x = 4", "x = 5"], points: 2 }, "x = 3"));
    assert.equal(q.type, "multiple_choice");
    assert.deepEqual(q.expectedAnswer, { optionIds: ["b"] });
    assert.equal(q.body["stem"], "أوجد x: 2^x = 8");
    assert.equal(q.marks, 2);
  });

  it("matches through a baked-in option marker, and drops the marker", () => {
    const q = only(one({ text: "س", options: ["أ) 6", "ب) 8", "ج) 9"], points: 1 }, "8"));
    assert.deepEqual(q.expectedAnswer, { optionIds: ["b"] });
    assert.deepEqual((q.body["options"] as { text: string }[]).map(o => o.text), ["6", "8", "9"]);
  });

  it("«صح / خطأ» → true_false", () => {
    const q = only(one({ text: "العبارة 2^0 = 1 صحيحة.", options: ["صح", "خطأ"], points: 1 }, "صح"));
    assert.equal(q.type, "true_false");
    assert.deepEqual(q.expectedAnswer, { value: true });
    assert.equal(q.body["statement"], "العبارة 2^0 = 1 صحيحة.");
    assert.deepEqual(only(one({ text: "س", options: ["True", "False"], points: 1 }, "False")).expectedAnswer, { value: false });
  });

  it("a plain-number or x = number key → fill_blank accepting both forms", () => {
    const q = only(one({ text: "حل 5^x = 25", points: 3 }, "x = 2"));
    assert.equal(q.type, "fill_blank");
    assert.match(String(q.body["template"]), /\{\{1\}\}$/);
    assert.deepEqual(q.expectedAnswer, { blanks: [{ accept: ["x = 2", "2"] }] });
    assert.deepEqual(only(one({ text: "كم مولًا؟", points: 1 }, "0.5")).expectedAnswer, { blanks: [{ accept: ["0.5"] }] });
    assert.equal(only(one({ text: "س", points: 1 }, "-٣")).type, "fill_blank");
  });

  it("drops the paper's writing lines, so a generated numeric question is still auto-marked", () => {
    // generateWorksheet appends «الإجابة:» and two rules to every question
    // without options (homework: «مساحة العمل:», three). Read as blanks, they
    // made every generated numeric question a short answer — found driving the
    // web build. On screen the student has a box; the lines are noise.
    const lines = "\n_________________________________\n_________________________________";
    const q = only(one({ text: `أوجد قيمة x: 2x = 10\n\nالإجابة:${lines}`, points: 2 }, "x = 5"));
    assert.equal(q.type, "fill_blank");
    assert.equal(q.body["template"], "أوجد قيمة x: 2x = 10\nالإجابة: {{1}}");
    assert.equal(only(one({ text: `Find x: 2x = 10\n\nAnswer:${lines}`, points: 2 }, "5")).type, "fill_blank");
    const hw = only(one({ text: `بسّط: cos²θ + sin²θ\n\nمساحة العمل:${lines}\n_____________`, points: 2 }, "1"));
    assert.equal(hw.type, "fill_blank");
    assert.equal(hw.body["template"], "بسّط: cos²θ + sin²θ\nالإجابة: {{1}}");
    const sa = only(one({ text: `Explain why.\n\nWork space:${lines}`, points: 2 }, "Because they are complementary"));
    assert.equal(sa.type, "short_answer");
    assert.equal(sa.body["prompt"], "Explain why.");
  });

  it("labels the blank in the sheet's language", () => {
    const r = convertWorksheet({ sections: [{ questions: [{ text: "Find x: 2x = 10", points: 1 }] }], answerKey: [{ num: 1, answer: "5" }] }, "en");
    assert.ok(r.ok);
    assert.equal(r.questions[0]!.body["template"], "Find x: 2x = 10\nAnswer: {{1}}");
  });

  it("fails closed to a teacher-marked short answer", () => {
    const cases: [Q, string][] = [
      [{ text: "س", options: ["1", "2", "3"], points: 1 }, "4"],                     // key matches no option
      [{ text: "س", options: ["نعم", "لا"], points: 1 }, "نعم"],                     // 2 options, not صح/خطأ
      [{ text: "اشرح لماذا", points: 2 }, "لأن الأساسين متساويان"],                 // Arabic key
      [{ text: "بسّط", points: 2 }, "2^(x+1)"],                                       // an expression
      [{ text: "حل", points: 2 }, "س = 3"],                                          // Arabic variable
      [{ text: "أكمل الحل:\n1) نكتب 9 = 3^2\n2) __________", points: 6 }, "x = 2"],   // half-solved
    ];
    for (const [q, a] of cases) assert.equal(only(one(q, a)).type, "short_answer", `${q.text} / ${a}`);
  });

  it("keeps the working in the teacher's model answer", () => {
    const q = only(one({ text: "اشرح", points: 2 }, "ج", ["خطوة ١", "إذن ج"]));
    assert.equal(q.expectedAnswer["modelAnswer"], "ج\nخطوة ١\nإذن ج");
    assert.deepEqual(q.expectedAnswer["keyConcepts"], ["ج"]);
  });

  it("blocks a question with no key, naming it by its number on the paper", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "أ", points: 1 }] }, { questions: [{ text: "ب", points: 1 }] }],
      answerKey: [{ num: 1, answer: "3" }, { num: 2, answer: "  " }],
    });
    assert.deepEqual(r, { ok: false, missingKey: [2] });
  });

  it("numbers straight through the sections, as the key does", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "أ", points: 1 }] }, { questions: [{ text: "ب", options: ["صح", "خطأ"], points: 1 }] }],
      answerKey: [{ num: 1, answer: "7" }, { num: 2, answer: "خطأ" }],
    });
    assert.ok(r.ok);
    assert.deepEqual(r.questions.map(q => q.type), ["fill_blank", "true_false"]);
  });

  it("counts auto- and teacher-marked", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "أ", options: ["صح", "خطأ"], points: 1 }, { text: "ب", points: 1 }] }],
      answerKey: [{ num: 1, answer: "خطأ" }, { num: 2, answer: "اشرح" }],
    });
    assert.ok(r.ok);
    assert.deepEqual([r.autoMarked, r.teacherMarked], [1, 1]);
  });

  it("gives a zero-point question one mark rather than none", () => {
    assert.equal(only(one({ text: "س", points: 0 }, "3")).marks, 1);
  });

  it("carries a book figure and drops any other", () => {
    const fig = { uri: `${BOOK_FIGURE_BASE_URL}/a/p1.png`, caption: "ص ١" };
    assert.deepEqual(only(one({ text: "س", points: 1, figure: fig }, "3")).body["figure"], fig);
    const foreign = only(one({ text: "س", points: 1, figure: { uri: "https://x.example/a.png", caption: "c" } }, "3"));
    assert.equal(foreign.body["figure"], undefined);
  });
});
