/**
 * The clarifying round's prompt and its parser.
 *
 * `parseQuestions` is the interesting half: it stands between a cheap model's
 * free-form JSON and a screen that renders tappable chips, and the client
 * treats "no questions" and "broken questions" identically — so anything it
 * lets through must be renderable, and anything doubtful must become `[]`.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/promptSlidesQuestions.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CLARIFYING_QUESTIONS,
  parseQuestions,
  questionsPromptAr,
  questionsPromptEn,
} from "../promptSlidesQuestions.ts";

const ok = {
  questions: [
    {
      id: "purpose",
      question: "What is this lesson for?",
      options: [{ id: "new", label: "New explanation" }, { id: "revision", label: "Revision" }],
    },
  ],
};

describe("questionsPrompt", () => {
  it("carries the teacher's description", () => {
    const body = { prompt: "slides about fractions" };
    assert.ok(questionsPromptAr(body).includes("slides about fractions"));
    assert.ok(questionsPromptEn(body).includes("slides about fractions"));
  });

  it("tells the model to ask nothing when the description is already specific", () => {
    // Without this the model asks for the sake of asking, and every teacher
    // pays a round of taps before every deck.
    assert.match(questionsPromptAr({ prompt: "x" }), /\{"questions":\[\]\}/);
    assert.match(questionsPromptEn({ prompt: "x" }), /\{"questions":\[\]\}/);
  });

  it("caps the number of questions in both languages", () => {
    const cap = new RegExp(String(MAX_CLARIFYING_QUESTIONS));
    assert.match(questionsPromptAr({ prompt: "x" }), cap);
    assert.match(questionsPromptEn({ prompt: "x" }), cap);
  });
});

describe("parseQuestions", () => {
  it("accepts a well-formed set", () => {
    const out = parseQuestions(ok);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "purpose");
    assert.equal(out[0]!.options.length, 2);
  });

  it("treats every unusable shape as no questions", () => {
    for (const bad of [null, undefined, {}, [], "text", 42, { questions: "nope" }]) {
      assert.deepEqual(parseQuestions(bad), [], `${JSON.stringify(bad)} should yield no questions`);
    }
  });

  it("drops a question with fewer than two options — that is not a question", () => {
    const one = { questions: [{ id: "q", question: "Pick", options: [{ id: "a", label: "A" }] }] };
    assert.deepEqual(parseQuestions(one), []);
  });

  it("drops options and questions missing an id or a label", () => {
    const messy = {
      questions: [
        { id: "", question: "No id", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
        { id: "q2", question: "", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
        {
          id: "q3",
          question: "Fine",
          options: [{ id: "a", label: "A" }, { id: "b" }, { label: "C" }, { id: "d", label: "D" }],
        },
      ],
    };
    const out = parseQuestions(messy);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "q3");
    assert.deepEqual(out[0]!.options.map(o => o.id), ["a", "d"]);
  });

  it("never returns more than the cap, however many the model sent", () => {
    const many = {
      questions: Array.from({ length: 9 }, (_, i) => ({
        id: `q${i}`,
        question: `Q${i}`,
        options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      })),
    };
    assert.equal(parseQuestions(many).length, MAX_CLARIFYING_QUESTIONS);
  });

  it("caps options at four so a question still fits a phone", () => {
    const wide = {
      questions: [{
        id: "q",
        question: "Pick",
        options: Array.from({ length: 7 }, (_, i) => ({ id: `o${i}`, label: `O${i}` })),
      }],
    };
    assert.equal(parseQuestions(wide)[0]!.options.length, 4);
  });
});
