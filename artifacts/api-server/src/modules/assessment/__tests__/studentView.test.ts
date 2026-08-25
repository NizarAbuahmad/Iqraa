/**
 * The student-facing projection.
 *
 * The test that matters is the last one: it serialises the payload and asserts
 * no answer key survives **anywhere in the string**, at any depth. Checking
 * `payload.expectedAnswer === undefined` would pass while the key sat inside an
 * option, and that is precisely how this leaks.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateShareCode,
  hashAccessToken,
  issueAccessToken,
  normalizeShareCode,
  sanitizeQuestionForStudent,
} from "../studentView.ts";

describe("share codes", () => {
  it("never contains a character that can be read two ways", () => {
    for (let i = 0; i < 200; i++) {
      assert.match(generateShareCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("accepts what a student actually types", () => {
    assert.equal(normalizeShareCode("abc-234"), "ABC234");
    assert.equal(normalizeShareCode("  ab c23 4 "), "ABC234");
  });

  it("drops ambiguous characters rather than guessing at them", () => {
    // O could be Q, D or zero. Inventing an intent produces a wrong exam.
    assert.equal(normalizeShareCode("ABCO23"), "ABC23");
    assert.equal(normalizeShareCode(null), "");
    assert.equal(normalizeShareCode(12345), "");
  });
});

describe("access tokens", () => {
  it("issues a token and a matching hash, and never stores the token", () => {
    const { token, hash } = issueAccessToken();
    assert.equal(token.length, 64);
    assert.equal(hash, hashAccessToken(token));
    assert.notEqual(hash, token);
  });

  it("gives different tokens each time", () => {
    assert.notEqual(issueAccessToken().token, issueAccessToken().token);
  });
});

describe("sanitizeQuestionForStudent", () => {
  const mcq = {
    id: "q1",
    orderIndex: 0,
    type: "multiple_choice",
    marks: "3.00",
    body: {
      stem: "ما ناتج ٢+٢؟",
      multiSelect: false,
      options: [
        { id: "a", text: "٣", isCorrect: false },
        { id: "b", text: "٤", isCorrect: true, explanation: "لأن…" },
      ],
      // A generator that leaves the key in the body must not defeat this.
      correctOptionId: "b",
    },
  };

  it("keeps what the student needs to answer", () => {
    const out = sanitizeQuestionForStudent(mcq);
    assert.equal(out.id, "q1");
    assert.equal(out.body["stem"], "ما ناتج ٢+٢؟");
    assert.equal((out.body["options"] as unknown[]).length, 2);
  });

  it("strips correctness from inside each option", () => {
    const out = sanitizeQuestionForStudent(mcq);
    const options = out.body["options"] as Record<string, unknown>[];
    for (const o of options) {
      assert.deepEqual(Object.keys(o).sort(), ["id", "text"]);
    }
  });

  it("drops body fields that are not on the allowlist", () => {
    const out = sanitizeQuestionForStudent(mcq);
    assert.equal("correctOptionId" in out.body, false);
  });

  it("fails safe for a question type it has never seen", () => {
    const out = sanitizeQuestionForStudent({
      id: "q9",
      orderIndex: 1,
      type: "some_future_type",
      marks: "1",
      body: { prompt: "اشرح", expectedAnswer: "الجواب", secretRubric: { a: 1 } },
    });
    assert.equal(out.body["prompt"], "اشرح");
    assert.equal("expectedAnswer" in out.body, false);
    assert.equal("secretRubric" in out.body, false);
  });

  it("leaks no answer key anywhere in the serialised payload, at any depth", () => {
    const questions = [
      mcq,
      {
        id: "q2",
        orderIndex: 1,
        type: "true_false",
        marks: "1",
        body: { statement: "الماء يغلي عند ١٠٠", answer: true },
      },
      {
        id: "q3",
        orderIndex: 2,
        type: "fill_blank",
        marks: "2",
        // Two places a key can hide: the real one (`expectedAnswer.blanks`,
        // which never reaches this function) and `body.blanks`, where a
        // generator could plausibly leave it. Neither may survive.
        body: { template: "{{1}} + ٢ = ٤", blanks: ["٢"], wordBank: ["١", "٢", "٣"] },
        expectedAnswer: { blanks: [{ accept: ["٢"] }] },
      },
    ].map(sanitizeQuestionForStudent);

    const serialised = JSON.stringify({ questions });
    for (const forbidden of [
      "expectedAnswer",
      "rubric",
      "isCorrect",
      "correctOptionId",
      "explanation",
      "secretRubric",
      '"blanks"',
      '"answer"',
    ]) {
      assert.equal(
        serialised.includes(forbidden),
        false,
        `"${forbidden}" reached the student payload`,
      );
    }
  });
});
