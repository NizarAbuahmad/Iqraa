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
import { QUESTION_TYPES } from "../questionTypes.ts";

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

/**
 * A matching question is answerable without reading it if the right column
 * arrives in the same order as the left — which is how a generator asked for
 * `pairs` in order writes them. The delivered order has to differ from the
 * stored one, and then has to stop moving: a student sees this list on claim
 * and again on every resume.
 */
describe("matching: the order the student is given", () => {
  const stored = {
    left: [
      { id: "l1", text: "الجزيء" },
      { id: "l2", text: "الذرة" },
      { id: "l3", text: "الأيون" },
      { id: "l4", text: "النظير" },
      { id: "l5", text: "المركب" },
    ],
    right: [
      { id: "r1", text: "١" },
      { id: "r2", text: "٢" },
      { id: "r3", text: "٣" },
      { id: "r4", text: "٤" },
      { id: "r5", text: "٥" },
    ],
  };
  const question = (id: string) => ({
    id,
    orderIndex: 0,
    type: "matching",
    marks: "5",
    body: structuredClone(stored),
  });
  const rightIds = (id: string) =>
    (sanitizeQuestionForStudent(question(id)).body["right"] as { id: string }[])
      .map(r => r.id)
      .join(",");
  const asStored = stored.right.map(r => r.id).join(",");

  it("does not hand the column over in stored order", () => {
    // Counted over many questions rather than asserted on one: a shuffle is
    // allowed to return some question to its stored order — 1 in 120 for five
    // items — and a test that forbids that is pinning the hash, not the
    // property. What must not happen is stored order being the general case.
    const ids = Array.from({ length: 40 }, (_, i) => `question-${i}`);
    const unshuffled = ids.filter(id => rightIds(id) === asStored).length;
    assert.ok(unshuffled <= 3, `${unshuffled} of 40 questions kept the stored order`);
  });

  it("gives one student the same order every time, so a resume does not reshuffle", () => {
    // The claim route and the state route sanitise separately. If this ever
    // depends on Math.random, the column reorders under a student who reloads.
    assert.equal(rightIds("q-abc"), rightIds("q-abc"));
    assert.equal(rightIds("q-abc"), rightIds("q-abc"));
  });

  it("gives different questions different orders", () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => rightIds(`another-${i}`)));
    assert.ok(orders.size > 1, "every question came back in the same order");
  });

  it("keeps every right item, exactly once", () => {
    const delivered = (
      sanitizeQuestionForStudent(question("q-set")).body["right"] as { id: string }[]
    ).map(r => r.id);
    assert.deepEqual([...delivered].sort(), ["r1", "r2", "r3", "r4", "r5"]);
  });

  it("leaves the left column alone", () => {
    // Reordering one side is all it takes to break the alignment, and moving
    // both would churn the prompts the student is reading down.
    const out = sanitizeQuestionForStudent(question("q-left"));
    assert.deepEqual(out.body["left"], stored.left);
  });

  it("still marks correct when the student answers the shuffled list", () => {
    // The round trip, and the reason shuffling is safe at all: the student
    // picks ids off the reordered column, `pairs` carries ids, and grading
    // never looks at a position.
    const delivered = sanitizeQuestionForStudent(question("q-grade"));
    const right = delivered.body["right"] as { id: string }[];
    const key = [
      { left: "l1", right: "r1" },
      { left: "l2", right: "r2" },
      { left: "l3", right: "r3" },
      { left: "l4", right: "r4" },
      { left: "l5", right: "r5" },
    ];
    // A student who knows the subject: for each left item, find the right item
    // in the column as delivered and pick it.
    const answered = key.map(k => ({
      left: k.left,
      right: right.find(r => r.id === k.right)!.id,
    }));
    const graded = QUESTION_TYPES.matching.grade!(
      { type: "matching", body: stored, expectedAnswer: { pairs: key } },
      { pairs: answered },
    );
    assert.equal(graded.fraction, 1);
    assert.equal(graded.status, "correct");
  });
});
