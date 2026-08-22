/**
 * Language compliance for chat replies.
 *
 * Arabic is the product language and a reply that drifts into English is a
 * failure a teacher sees immediately — but it is invisible to latency, tokens,
 * cost, and (chat being prose) to any schema check. This is the one thing
 * about a prose reply that can be scored rather than rated.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  answeredInArabic,
  arabicShare,
  ARABIC_REPLY_FLOOR,
} from "../languageCompliance.ts";

describe("arabicShare", () => {
  it("scores a plain Arabic reply at 1", () => {
    assert.equal(arabicShare("مشتقة الدالة هي ضعف المتغير"), 1);
  });

  it("scores a plain English reply at 0", () => {
    assert.equal(arabicShare("The derivative is twice the variable"), 0);
  });

  it("does not punish Latin maths notation inside an Arabic answer", () => {
    // This is the whole reason letters are counted and symbols are not: a
    // correct Arabic answer about derivatives is full of f(x) = 2x, and
    // counting those characters would score a good reply as half-English.
    const reply = "أوجد مشتقة الدالة f(x) = 3x^2 + 5x - 7، فتكون f'(x) = 6x + 5.";
    assert.ok(arabicShare(reply) >= ARABIC_REPLY_FLOOR, String(arabicShare(reply)));
    assert.ok(answeredInArabic(reply));
  });

  it("does not punish chemical formulas", () => {
    const reply = "يتكوّن ملح الطعام NaCl من رابطة أيونية بين الصوديوم والكلور.";
    assert.ok(answeredInArabic(reply));
  });

  it("catches an English answer carrying a few Arabic words", () => {
    const reply =
      "Sure! Here is a full lesson plan about الاشتقاق for Grade 10 students, "
      + "including objectives, activities and assessment.";
    assert.ok(!answeredInArabic(reply), String(arabicShare(reply)));
  });

  it("ignores digits, whitespace and punctuation entirely", () => {
    // Only letters count, so a reply that is mostly numbers is scored on the
    // words around them rather than diluted to nothing.
    assert.equal(arabicShare("الإجابة: 32 (٣٢) — 100%"), 1);
  });

  it("returns 0 for a reply with no letters at all", () => {
    // An empty or symbols-only response is a failure in its own right and
    // must not be flattered with a perfect score.
    assert.equal(arabicShare(""), 0);
    assert.equal(arabicShare("   \n  "), 0);
    assert.equal(arabicShare("42 + 7 = 49"), 0);
  });
});
