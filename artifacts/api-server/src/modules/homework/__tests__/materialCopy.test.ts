import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { studentCopy } from "../materialCopy.ts";

/** The answer-bearing fields of each material type the app saves (services/ai/AIService.ts). */
describe("studentCopy — a saved material without its answers", () => {
  it("blanks a quiz's answers and explanations, keeps the questions", () => {
    const out = studentCopy({
      title: "q",
      questions: [{ text: "1+1", options: ["1", "2"], correctAnswer: "2", explanation: "count", points: 1 }],
    }) as { questions: Record<string, unknown>[] };
    assert.deepEqual(out.questions[0], { text: "1+1", options: ["1", "2"], correctAnswer: "", explanation: "", points: 1 });
  });

  it("empties a worksheet's answer key and strips structured-question solutions", () => {
    const out = studentCopy({
      sections: [
        {
          questions: [
            { text: "a", answer: "x" },
            { text: "m", format: { kind: "match", stem: "s", left: ["a"], right: ["b"], pairs: [0] } },
            { text: "o", format: { kind: "order", stem: "s", steps: ["1", "2"], order: [1, 0] } },
            { text: "e", format: { kind: "spot_error", stem: "s", steps: ["1"], wrongStep: 0, fix: "f", why: "w" } },
          ],
        },
      ],
      answerKey: [{ num: 1, answer: "x", solution: ["s"] }],
      workedExample: { problem: "p", steps: ["s"], answer: "r" },
    }) as Record<string, any>;
    assert.deepEqual(out.answerKey, []);
    const [plain, match, order, spot] = out.sections[0].questions;
    assert.equal(plain.answer, "");
    assert.deepEqual(match.format, { kind: "match", stem: "s", left: ["a"], right: ["b"], pairs: [] });
    assert.deepEqual(order.format, { kind: "order", stem: "s", steps: ["1", "2"], order: [] });
    assert.deepEqual(spot.format, { kind: "spot_error", stem: "s", steps: ["1"], fix: "", why: "" });
    assert.deepEqual(out.workedExample.steps, ["s"], "a worked example is for study and stays");
  });

  it("drops a deck's reveal slides and every slide's answer and teacher companion", () => {
    const out = studentCopy({
      slides: [
        { type: "question", title: "Q", content: "c", answer: "a", correctIndex: 1, teacher: { expectedAnswer: "a" }, unlockCode: "k" },
        { type: "reveal", title: "A", content: "the answer" },
      ],
      teacherNotes: ["n"],
      answerKey: ["a"],
    }) as Record<string, any>;
    assert.equal(out.slides.length, 1);
    assert.deepEqual(out.slides[0], { type: "question", title: "Q", content: "c", answer: "", unlockCode: "" });
    assert.deepEqual(out.teacherNotes, []);
    assert.deepEqual(out.answerKey, []);
  });

  it("leaves a lesson plan's ministry `teacher` text and an unrelated `order` alone", () => {
    const plan = { ministryRoles: [{ teacher: "سأعرض", learner: "يحل" }], meta: { order: 2 } };
    assert.deepEqual(studentCopy(plan), plan);
  });
});
