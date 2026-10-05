/**
 * A worksheet opens with a worked example, and its key shows the working.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/worksheetWorkedExample.test.ts
 *
 * The offline generator (`artifacts/mobile/services/ai/generators.ts`) builds
 * this structure from solved bank items; the live prompt has to ask for the
 * same one, or a teacher gets a different paper depending on whether live AI
 * was on. And because a pooled worksheet is served to every teacher who asks
 * for that lesson, a malformed example must be dropped before it is stored,
 * not rendered to the whole class.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";
import { sanitizeWorksheetExtras } from "../generationShape.ts";

const base = { subject: "الرياضيات", grade: "العاشر", topic: "المعادلات الأسية", numQuestions: 10, difficulty: "medium" };

describe("the worksheet prompt asks for a worked example", () => {
  for (const [name, build] of [["ar", worksheetPromptAr], ["en", worksheetPromptEn]] as const) {
    it(`${name}: describes workedExample and a per-question solution in the JSON shape`, () => {
      const p = build(base);
      assert.match(p, /"workedExample"/);
      assert.match(p, /"solution"/);
      assert.match(p, /"selfExplain"/);
    });

    it(`${name}: the example and the half-solved question count inside the total`, () => {
      const p = build(base);
      // n is the TOTAL on the page, so the model must not add them on top.
      assert.match(p, name === "ar" ? /ضمن عدد الأسئلة|من العدد الكلي|ضمن العدد/ : /count toward|inside the total|within the total/i);
      assert.match(p, name === "ar" ? /9/ : /\b9\b/, "n − 1 questions in sections for n = 10");
    });

    it(`${name}: asks for a half-solved first question, not a second worked example`, () => {
      const p = build(base);
      assert.match(p, name === "ar" ? /نصف محلول|محلول جزئيًا|يكمل/ : /half-solved|partly solved|finish/i);
    });

    it(`${name}: lets the model leave them out when the lesson has no procedure to model`, () => {
      const p = build(base);
      assert.match(p, name === "ar" ? /احذف|أغفل|لا تُدرج/ : /omit|leave out/i);
    });

    it(`${name}: homework does not ask for a worked example`, () => {
      const hw = build({ ...base, homework: true });
      assert.doesNotMatch(hw, /"workedExample"/);
    });
  }
});

const example = () => ({
  problem: "حل المعادلة 2^(x+1) = 32",
  steps: ["نكتب 32 = 2^5", "نساوي الأسس: x + 1 = 5", "إذن x = 4"],
  answer: "x = 4",
  selfExplain: "لماذا يجوز مساواة الأسس هنا؟",
});
const sheet = (over: Record<string, unknown> = {}) => ({
  title: "ورقة", instructions: "تعليمات",
  sections: [{ type: "short_answer", title: "أ", questions: [{ text: "س", points: 2 }] }],
  answerKey: [{ num: 1, answer: "x = 2", solution: ["نحل", "x = 2"] }],
  ...over,
});

describe("sanitizeWorksheetExtras", () => {
  it("passes a well-formed worked example and solutions through unchanged", () => {
    const input = sheet({ workedExample: example() });
    assert.deepEqual(sanitizeWorksheetExtras("worksheet", input), input);
  });

  it("drops a worked example with no steps and keeps the rest of the paper", () => {
    const out = sanitizeWorksheetExtras("worksheet", sheet({ workedExample: { ...example(), steps: [] } })) as Record<string, unknown>;
    assert.equal("workedExample" in out, false);
    assert.equal((out.sections as unknown[]).length, 1);
  });

  it("drops a worked example with a single step: one line is an answer, not working", () => {
    const out = sanitizeWorksheetExtras("worksheet", sheet({ workedExample: { ...example(), steps: ["x = 4"] } })) as Record<string, unknown>;
    assert.equal("workedExample" in out, false);
  });

  it("drops a worked example whose steps are not all non-empty strings", () => {
    for (const steps of [["a", 3], ["a", ""], ["a", "  "], "not an array"]) {
      const out = sanitizeWorksheetExtras("worksheet", sheet({ workedExample: { ...example(), steps } })) as Record<string, unknown>;
      assert.equal("workedExample" in out, false, JSON.stringify(steps));
    }
  });

  it("drops a worked example missing its problem or answer", () => {
    for (const missing of ["problem", "answer"]) {
      const bad = { ...example(), [missing]: "" };
      const out = sanitizeWorksheetExtras("worksheet", sheet({ workedExample: bad })) as Record<string, unknown>;
      assert.equal("workedExample" in out, false, missing);
    }
  });

  it("keeps an example that has no selfExplain: that line is optional", () => {
    const { selfExplain: _omit, ...bare } = example();
    const out = sanitizeWorksheetExtras("worksheet", sheet({ workedExample: bare })) as Record<string, unknown>;
    assert.deepEqual(out.workedExample, bare);
  });

  it("removes a malformed solution from that key row only", () => {
    const out = sanitizeWorksheetExtras("worksheet", sheet({
      answerKey: [
        { num: 1, answer: "a", solution: ["ok", "fine"] },
        { num: 2, answer: "b", solution: "one string" },
        { num: 3, answer: "c", solution: [] },
      ],
    })) as { answerKey: Array<Record<string, unknown>> };
    assert.deepEqual(out.answerKey[0].solution, ["ok", "fine"]);
    assert.equal("solution" in out.answerKey[1], false);
    assert.equal("solution" in out.answerKey[2], false);
    assert.equal(out.answerKey[1].answer, "b", "the answer itself is never touched");
  });

  it("treats a solution of more than 8 lines as a runaway and drops it", () => {
    const long = Array.from({ length: 9 }, (_, i) => `step ${i}`);
    const out = sanitizeWorksheetExtras("worksheet", sheet({ answerKey: [{ num: 1, answer: "a", solution: long }] })) as { answerKey: Array<Record<string, unknown>> };
    assert.equal("solution" in out.answerKey[0], false);
  });

  it("leaves every other kind alone", () => {
    const quiz = { title: "q", questions: [{ id: "q1" }], workedExample: { junk: true } };
    assert.deepEqual(sanitizeWorksheetExtras("quiz", quiz), quiz);
  });

  it("does not throw on something that is not an object", () => {
    for (const bad of [null, undefined, "x", 3, []]) {
      assert.doesNotThrow(() => sanitizeWorksheetExtras("worksheet", bad));
    }
  });
});
