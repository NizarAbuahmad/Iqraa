/**
 * The cache keys recorded on every generation.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/generationKey.test.ts
 *
 * These assertions are about hit rate, not about hashing. A cache keyed on an
 * un-normalised request misses on differences that mean nothing — a stray
 * space, a reordered array, the same Arabic word spelled with a different
 * alef — and the resulting low hit rate looks like "caching doesn't help here"
 * rather than "the key is wrong".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generationKeys, normalizeText } from "../generationKey.ts";

const base = { subject: "رياضيات", grade: "10", topic: "كثيرات الحدود", language: "arabic" };
const keys = (body: Record<string, unknown>) => generationKeys("worksheet", "gpt-5.4-mini", body);

describe("normalizeText", () => {
  it("folds the Arabic spellings that mean the same lesson", () => {
    // Each of these is the same word a teacher might type three ways.
    assert.equal(normalizeText("الأهداف"), normalizeText("الاهداف"));
    assert.equal(normalizeText("المعـــادلات"), normalizeText("المعادلات")); // tatweel
    assert.equal(normalizeText("مُشْتَقّة"), normalizeText("مشتقة")); // diacritics
    assert.equal(normalizeText("علي"), normalizeText("على")); // alef maqsura
  });

  it("collapses whitespace and case", () => {
    assert.equal(normalizeText("  Word   Problems \n"), "word problems");
  });
});

describe("generationKeys", () => {
  it("gives the same key to requests that differ only in noise", () => {
    assert.equal(
      keys(base).coarseKey,
      keys({ ...base, topic: "  كثيرات   الحدود  " }).coarseKey,
    );
  });

  it("ignores the order fields arrive in", () => {
    const a = keys({ grade: "10", topic: base.topic, subject: base.subject, language: "arabic" });
    assert.equal(a.strictKey, keys(base).strictKey);
  });

  it("ignores the order of a question-types array", () => {
    const a = keys({ ...base, questionTypes: ["short_answer", "multiple_choice"] });
    const b = keys({ ...base, questionTypes: ["multiple_choice", "short_answer"] });
    assert.equal(a.strictKey, b.strictKey);
  });

  it("treats an absent field and its empty value as the same request", () => {
    assert.equal(keys(base).strictKey, keys({ ...base, objectives: "" }).strictKey);
  });

  it("separates different artifact kinds for one lesson", () => {
    const worksheet = generationKeys("worksheet", "gpt-5.4-mini", base);
    const quiz = generationKeys("quiz", "gpt-5.4-mini", base);
    assert.notEqual(worksheet.coarseKey, quiz.coarseKey);
  });

  it("separates models, since one model's artifact is not the other's", () => {
    assert.notEqual(
      generationKeys("worksheet", "gpt-5.4-mini", base).coarseKey,
      generationKeys("worksheet", "gpt-5.4-nano", base).coarseKey,
    );
  });

  it("prefers a curriculum lesson id over the typed topic when one is sent", () => {
    // Two teachers typing the topic differently still share a key if the
    // client resolved the same lesson. This is the whole long-tail fix.
    const a = keys({ ...base, lessonId: "math-g10-s1-u1-l2", topic: "كثيرات الحدود" });
    const b = keys({ ...base, lessonId: "math-g10-s1-u1-l2", topic: "كثيرات الحدود والعمليات عليها" });
    assert.equal(a.coarseKey, b.coarseKey);
  });

  describe("coarse vs strict — the superset measurement", () => {
    it("collapses the sliced parameters in the coarse key only", () => {
      const easy = keys({ ...base, difficulty: "easy", numQuestions: 5 });
      const hard = keys({ ...base, difficulty: "hard", numQuestions: 15 });
      // One superset artifact could serve both...
      assert.equal(easy.coarseKey, hard.coarseKey);
      // ...but they are distinct requests, and the strict key must say so, or
      // the two repeat rates are the same number and measure nothing.
      assert.notEqual(easy.strictKey, hard.strictKey);
    });

    it("still separates genuinely different lessons in the coarse key", () => {
      assert.notEqual(keys(base).coarseKey, keys({ ...base, topic: "المتجهات" }).coarseKey);
    });

    it("changes the strict key for priorTopicsNotes but not the coarse key", () => {
      const plain = keys(base);
      const withNotes = keys({ ...base, priorTopicsNotes: "راجع حل المعادلات من الصف التاسع" });
      assert.equal(plain.coarseKey, withNotes.coarseKey);
      assert.notEqual(plain.strictKey, withNotes.strictKey);
    });
  });

  describe("teacher-pasted context", () => {
    it("is flagged, and never changes the coarse key", () => {
      const plain = keys(base);
      const pasted = keys({ ...base, additionalContext: "نص من الكتاب المدرسي" });
      assert.equal(pasted.hasContext, true);
      assert.equal(plain.hasContext, false);
      // Same coarse key, so the flag — not the key — is what excludes these
      // from a global hit-rate figure. If the context changed the coarse key,
      // such requests would silently look like ordinary cache misses.
      assert.equal(plain.coarseKey, pasted.coarseKey);
    });

    it("separates different pasted material in the strict key", () => {
      assert.notEqual(
        keys({ ...base, additionalContext: "درس أ" }).strictKey,
        keys({ ...base, additionalContext: "درس ب" }).strictKey,
      );
    });

    it("does not count whitespace-only context as context", () => {
      assert.equal(keys({ ...base, additionalContext: "   " }).hasContext, false);
    });
  });

  it("partitions traffic when the prompt version changes", () => {
    // Without this, editing a prompt would keep serving artifacts generated by
    // the old one — the stale-cache failure the plan calls out by name.
    const before = generationKeys("worksheet", "gpt-5.4-mini", base, "2026-08-22.1");
    const after = generationKeys("worksheet", "gpt-5.4-mini", base, "2026-08-22.2");
    assert.notEqual(before.coarseKey, after.coarseKey);
    assert.notEqual(before.strictKey, after.strictKey);
  });
});
