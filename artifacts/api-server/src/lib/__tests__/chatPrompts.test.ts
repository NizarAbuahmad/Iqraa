/**
 * The ceiling on caller-supplied text reaching a chat prompt.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/chatPrompts.test.ts
 *
 * What this guards: `/chat` interpolated `context` into the system prompt whole
 * and forwarded each history turn at whatever length it arrived. The only
 * ceiling underneath was `express.json({ limit: "12mb" })`, which is roughly
 * three million input tokens in a single request — more than the whole shared
 * monthly budget, spendable by any signed-in account in one call. The point of
 * the clamp is that no request can be arbitrarily expensive, so the assertions
 * below are about the *bound* holding, not about the exact figure.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSystemPromptAr,
  buildSystemPromptEn,
  CHAT_CONTEXT_MAX_CHARS,
  CHAT_MESSAGE_MAX_CHARS,
  clampPromptText,
} from "../chatPrompts.ts";

describe("clampPromptText", () => {
  it("passes through text that is already within the ceiling", () => {
    assert.equal(clampPromptText("قانون الجيوب", 100), "قانون الجيوب");
    // Exactly at the ceiling is within it.
    assert.equal(clampPromptText("abcde", 5), "abcde");
  });

  it("truncates text above the ceiling to exactly the ceiling", () => {
    assert.equal(clampPromptText("abcdef", 5), "abcde");
    assert.equal(clampPromptText("x".repeat(50_000), 24_000).length, 24_000);
  });

  it("leaves an absent value absent rather than inventing an empty string", () => {
    // `context` is optional, and the prompt builders branch on undefined to
    // decide whether to emit the textbook-reference block at all. Turning it
    // into "" here would emit an empty block instead of omitting it.
    assert.equal(clampPromptText(undefined, 100), undefined);
  });
});

describe("a hostile request cannot make the prompt arbitrarily large", () => {
  // 12MB is what express.json would have accepted before the clamp.
  const huge = "ض".repeat(12 * 1024 * 1024);

  // Baseline carries a one-character context, so it includes the grounding
  // block's own heading. An empty string would not: the builders treat it as
  // falsy and omit the block, which makes it the wrong thing to measure against.
  it("bounds the Arabic system prompt", () => {
    const unbounded = buildSystemPromptAr(true, huge);
    const bounded = buildSystemPromptAr(true, clampPromptText(huge, CHAT_CONTEXT_MAX_CHARS));
    assert.ok(
      unbounded.length > 12_000_000,
      "the unclamped path really was unbounded — if this fails the clamp moved upstream",
    );
    assert.ok(bounded.length < unbounded.length / 100);
    assert.ok(bounded.length <= buildSystemPromptAr(true, "x").length + CHAT_CONTEXT_MAX_CHARS);
  });

  it("bounds the English system prompt by the same ceiling", () => {
    const bounded = buildSystemPromptEn(true, clampPromptText(huge, CHAT_CONTEXT_MAX_CHARS));
    assert.ok(bounded.length <= buildSystemPromptEn(true, "x").length + CHAT_CONTEXT_MAX_CHARS);
  });

  it("caps a single history turn, which no turn count could", () => {
    // CHAT_HISTORY_TURNS bounded how many turns were forwarded and nothing
    // bounded their size, so twelve turns of twelve megabytes each passed.
    assert.equal(clampPromptText(huge, CHAT_MESSAGE_MAX_CHARS).length, CHAT_MESSAGE_MAX_CHARS);
  });
});

describe("the prompt follows a change of subject", () => {
  // The catalog covers Grades 1–12 across every MVP subject, but the prompt
  // still said "Grade 10 maths and chemistry" and told the model to redirect
  // anything else — so a Grade 1 teacher moving to biology was pushed away by
  // the prompt itself, before the pinned-lesson context even came into it.
  for (const teacher of [true, false]) {
    it(`Arabic, ${teacher ? "teacher" : "student"}`, () => {
      const p = buildSystemPromptAr(teacher);
      assert.match(p, /من الصف الأول إلى الصف الثاني عشر/);
      assert.match(p, /عند تغيير الموضوع/);
      assert.doesNotMatch(p, /خارج نطاق منهج الصف العاشر/);
    });
    it(`English, ${teacher ? "teacher" : "student"}`, () => {
      const p = buildSystemPromptEn(teacher);
      assert.match(p, /Grades 1 to 12/);
      assert.match(p, /when they change topic/);
      assert.doesNotMatch(p, /outside Grade 10/);
    });
  }
});
