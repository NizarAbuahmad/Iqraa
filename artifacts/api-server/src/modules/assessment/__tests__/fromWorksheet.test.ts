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
import { sanitizeQuestionForStudent } from "../studentView.ts";

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

describe("formats", () => {
  const FIX = "الصحيح: 2x = 6";
  const WHY = "لأنّ الجمع لا يُوزَّع على الضرب";
  const asStudent = (q: { type: string; body: Record<string, unknown> }) =>
    sanitizeQuestionForStudent({ id: "q1", orderIndex: 0, type: q.type, marks: "2", body: q.body }, "attempt-1");

  it("match → matching, auto-marked, pairs by id", () => {
    const q = only(one({ text: "x", points: 3, format: { kind: "match", stem: "صِل", left: ["2^x = 8", "3^x = 9"], right: ["2", "3"], pairs: [1, 0] } } as any, "١-ب، ٢-أ"));
    assert.equal(q.type, "matching");
    assert.deepEqual(q.expectedAnswer, { pairs: [{ left: "l0", right: "r1" }, { left: "l1", right: "r0" }] });
    assert.deepEqual(q.body["left"], [{ id: "l0", text: "2^x = 8" }, { id: "l1", text: "3^x = 9" }]);
    assert.deepEqual(q.body["right"], [{ id: "r0", text: "2" }, { id: "r1", text: "3" }]);
  });

  it("order → matching against positions", () => {
    const q = only(one({ text: "x", points: 2, format: { kind: "order", stem: "رتّب", steps: ["b", "a", "c"], order: [1, 0, 2] } } as any, "ب، أ، ج"));
    assert.equal(q.type, "matching");
    assert.deepEqual((q.expectedAnswer as any).pairs[0], { left: "s1", right: "p0" });
    assert.deepEqual((q.body["right"] as { text: string }[]).map(r => r.text), ["الأولى", "الثانية", "الثالثة"]);
    assert.match(String(q.body["stem"]), /^طابق كل خطوة بترتيبها في الحل\.\nرتّب$/);
  });

  it("order on an English paper uses English positions and instruction", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "x", points: 2, format: { kind: "order", stem: "Order", steps: ["b", "a"], order: [1, 0] } } as any] }],
      answerKey: [{ num: 1, answer: "a, b" }],
    }, "en");
    assert.ok(r.ok);
    assert.deepEqual((r.questions[0]!.body["right"] as { text: string }[]).map(x => x.text), ["1st", "2nd"]);
    assert.match(String(r.questions[0]!.body["stem"]), /^Match each step to its position in the solution\.\nOrder$/);
  });

  it("spot_error → multiple choice over step numbers", () => {
    const q = only(one({ text: "x", points: 2, format: { kind: "spot_error", stem: "أين الخطأ؟", steps: ["a", "b", "c"], wrongStep: 1, fix: "B", why: "w" } } as any, "الخطوة ٢: B"));
    assert.equal(q.type, "multiple_choice");
    assert.deepEqual(q.expectedAnswer, { optionIds: ["b"] });
    assert.equal(q.body["stem"], "أين الخطأ؟\n1) a\n2) b\n3) c");
    assert.deepEqual(q.body["options"], [{ id: "a", text: "الخطوة ١" }, { id: "b", text: "الخطوة ٢" }, { id: "c", text: "الخطوة ٣" }]);
  });

  it("spot_error on an English paper names the steps in English", () => {
    const r = convertWorksheet({
      sections: [{ questions: [{ text: "x", points: 2, format: { kind: "spot_error", stem: "Find the error", steps: ["a", "b", "c"], wrongStep: 0, fix: "F", why: "W" } } as any] }],
      answerKey: [{ num: 1, answer: "Step 1" }],
    }, "en");
    assert.ok(r.ok);
    assert.deepEqual((r.questions[0]!.body["options"] as { text: string }[]).map(o => o.text), ["Step 1", "Step 2", "Step 3"]);
  });

  it("graph → teacher-marked short answer", () => {
    const q = only(one({ text: "x", points: 2, format: { kind: "graph", stem: "ارسم", exprs: ["x + 1"], window: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 } } } as any, "(1 ، 2)"));
    assert.equal(q.type, "short_answer");
    assert.equal(q.body["prompt"], "ارسم\ny = x + 1");
    assert.deepEqual(q.expectedAnswer, { modelAnswer: "(1 ، 2)", keyConcepts: ["(1 ، 2)"] });
  });

  it("a malformed format falls back to the text rules", () => {
    const q = only(one({ text: "x", points: 2, format: { kind: "match", stem: "s", left: ["a"], right: ["b"], pairs: [5] } } as any, "شرح طويل"));
    assert.equal(q.type, "short_answer");
  });

  it("every way a format can be invalid falls through, and still validates", () => {
    const bad: unknown[] = [
      { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0] },
      { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 0] },
      { kind: "match", stem: "s", left: ["a", "b"], right: ["x"], pairs: [0, 0] },
      { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 2] },
      { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 0.5] },
      { kind: "order", stem: "s", steps: ["a"], order: [0] },
      { kind: "order", stem: "s", steps: ["a", "b", "c", "d", "e", "f", "g"], order: [0, 1, 2, 3, 4, 5, 6] },
      { kind: "order", stem: "s", steps: ["a", "b", "c"], order: [0, 0, 1] },
      { kind: "order", stem: "s", steps: ["a", "b", "c"], order: [0, 1] },
      { kind: "spot_error", stem: "s", steps: ["a", "b"], wrongStep: 0, fix: "f", why: "w" },
      { kind: "spot_error", stem: "s", steps: ["a", "b", "c"], wrongStep: 3, fix: "f", why: "w" },
      { kind: "spot_error", stem: "s", steps: ["a", "b", "c"], wrongStep: -1, fix: "f", why: "w" },
      { kind: "graph", stem: "s", exprs: [], window: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 } },
      { kind: "graph", stem: " ", exprs: ["x"], window: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 } },
      { kind: "other", stem: "s" },
      "match",
    ];
    for (const format of bad) {
      const q = only(one({ text: "اشرح", points: 2, format } as any, "شرح"));
      assert.equal(q.type, "short_answer", JSON.stringify(format));
      assert.equal(q.body["prompt"], "اشرح");
    }
  });

  it("counts match, order and spot_error as auto-marked, graph as the teacher's", () => {
    const r = convertWorksheet({
      sections: [{ questions: [
        { text: "m", points: 1, format: { kind: "match", stem: "s", left: ["a", "b"], right: ["x", "y"], pairs: [0, 1] } },
        { text: "o", points: 1, format: { kind: "order", stem: "s", steps: ["a", "b"], order: [1, 0] } },
        { text: "e", points: 1, format: { kind: "spot_error", stem: "s", steps: ["a", "b", "c"], wrongStep: 2, fix: "f", why: "w" } },
        { text: "g", points: 1, format: { kind: "graph", stem: "s", exprs: ["x"], window: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 } } },
      ] as any }],
      answerKey: [1, 2, 3, 4].map(num => ({ num, answer: "k" })),
    });
    assert.ok(r.ok);
    assert.deepEqual([r.autoMarked, r.teacherMarked], [3, 1]);
    for (const q of r.questions) assert.deepEqual(QUESTION_TYPES[q.type].validate({ ...q, rubric: null }), []);
  });

  // R8: the key rides in expectedAnswer only. What a student is sent is the
  // type's own projection of the body, so both are checked.
  it("never puts the fix or the reason in anything a student can read", () => {
    const q = only(one({ text: "x", points: 2, format: { kind: "spot_error", stem: "أين الخطأ؟", steps: ["a", "b", "c"], wrongStep: 1, fix: FIX, why: WHY } } as any, "الخطوة ٢"));
    for (const seen of [JSON.stringify(q.body), JSON.stringify(asStudent(q).body)]) {
      assert.ok(!seen.includes(FIX), seen);
      assert.ok(!seen.includes(WHY), seen);
    }
    assert.ok(!JSON.stringify(q.expectedAnswer).includes(FIX));
  });

  it("never puts the pairing or the order in a match or order body", () => {
    const m = only(one({ text: "x", points: 2, format: { kind: "match", stem: "صِل", left: ["a", "b"], right: ["x", "y"], pairs: [1, 0] } } as any, "k"));
    const o = only(one({ text: "x", points: 2, format: { kind: "order", stem: "رتّب", steps: ["b", "a", "c"], order: [1, 0, 2] } } as any, "k"));
    for (const q of [m, o]) {
      for (const seen of [q.body, asStudent(q).body]) {
        for (const key of ["pairs", "order", "wrongStep", "fix", "why", "expectedAnswer"]) assert.ok(!(key in seen), key);
      }
    }
  });

  it("a student is given the matching question's stem, which is the problem", () => {
    const o = only(one({ text: "x", points: 2, format: { kind: "order", stem: "رتّب حل 2x + 1 = 7", steps: ["b", "a"], order: [1, 0] } } as any, "k"));
    assert.equal(asStudent(o).body["stem"], "طابق كل خطوة بترتيبها في الحل.\nرتّب حل 2x + 1 = 7");
  });

  it("a matching body with no stem, or an empty one, projects to exactly left and right", () => {
    const columns = { left: [{ id: "l1", text: "a" }, { id: "l2", text: "b" }], right: [{ id: "r1", text: "x" }, { id: "r2", text: "y" }] };
    for (const body of [columns, { ...columns, stem: "" }, { ...columns, stem: "   " }]) {
      const out = asStudent({ type: "matching", body }).body;
      assert.deepEqual(Object.keys(out).sort(), ["left", "right"]);
      assert.ok(!("stem" in out));
    }
  });

  it("graph keeps the working after the key in the model answer, as a solved short answer does", () => {
    const graph = { kind: "graph", stem: "ارسم", exprs: ["x + 1"], window: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 } };
    const plain = only(one({ text: "اشرح", points: 2 }, "(1 ، 2)", ["خطوة ١", "خطوة ٢"]));
    const q = only(one({ text: "x", points: 2, format: graph } as any, "(1 ، 2)", ["خطوة ١", "خطوة ٢"]));
    assert.equal(q.expectedAnswer["modelAnswer"], "(1 ، 2)\nخطوة ١\nخطوة ٢");
    assert.deepEqual(q.expectedAnswer, plain.expectedAnswer);
    assert.deepEqual(q.expectedAnswer["keyConcepts"], ["(1 ، 2)"]);
  });

  it("carries a book figure on a format question too", () => {
    const fig = { uri: `${BOOK_FIGURE_BASE_URL}/a/p1.png`, caption: "ص ١" };
    const q = only(one({ text: "x", points: 2, figure: fig, format: { kind: "graph", stem: "ارسم", exprs: ["x"], window: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 } } } as any, "k"));
    assert.deepEqual(q.body["figure"], fig);
  });
});
