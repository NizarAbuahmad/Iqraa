/**
 * The system prompts' book-style rule.
 *
 * Generic across subjects: nothing here names math, chemistry or finlit —
 * the fix is "quote the supplied textbook context" instead of a per-subject
 * glossary, so one clause in the shared system prompt has to cover every
 * generator and every subject. See prompts.ts for why.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SYSTEM_AR, SYSTEM_EN } from "../prompts.ts";

describe("style rule", () => {
  it("reaches every generator, being in the shared system prompt", () => {
    assert.match(SYSTEM_AR, /الالتزام بلغة الكتاب/);
    assert.match(SYSTEM_EN, /Match the textbook's own language/);
  });

  it("tells the model to quote the book's own wording, not paraphrase it", () => {
    assert.match(SYSTEM_AR, /لا تستبدلها بمرادفات عامة أو ترجمة حرة/);
    assert.match(SYSTEM_EN, /generic paraphrasing or free translation/);
  });

  it("does not contradict the figure rule's latin-variable requirement", () => {
    assert.match(SYSTEM_AR, /الاستثناء الوحيد معادلات الرسوم البيانية/);
    assert.match(SYSTEM_EN, /does not override the figures rule/);
  });
});
