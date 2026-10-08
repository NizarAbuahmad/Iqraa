/**
 * What this guards: a deck can clear `assertUsableDeck` and still break the
 * contract the prompt states — a `correctIndex` past the options, a slide the
 * app cannot give a teacher panel, a photo on a slide that has no room for one.
 * Each test starts from a deck that satisfies the whole contract and breaks
 * exactly one thing, so a failure names the rule.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDeck } from "../deckChecks.ts";

const T = { teachingTips: "tip" };
const BOOK = "الاقتران الخطي يمثل بخط مستقيم وميل الخط المستقيم يساوي التغير في الصادات على التغير في السينات وفي حالة خاصة يكون الميل صفر والخط أفقي";

function goodDeck() {
  return {
    deckPhotoQueries: ["straight line graph", "road slope", "ramp incline", "staircase steps"],
    slides: [
      { slideNumber: 1, type: "intro", title: "الاقتران الخطي", content: "بنهاية الحصة ستحسب الميل", teacher: T },
      { slideNumber: 2, type: "intro", title: "تشويق", content: "• سؤال\n• موقف", teacher: T },
      { slideNumber: 3, type: "divider", title: "الشرح", content: "• بداية\n• القسم", teacher: T },
      { slideNumber: 4, type: "intro", title: "ميل الخط المستقيم", content: "• الميل يساوي التغير في الصادات\n• على التغير في السينات", mediaPrompt: "straight line graph", teacher: T },
      { slideNumber: 5, type: "intro", title: "التمثيل", content: "• الاقتران الخطي يمثل بخط مستقيم\n• مثال", mediaPrompt: "road slope", teacher: T },
      { slideNumber: 6, type: "intro", title: "حالة خاصة", content: "• الميل صفر\n• خط أفقي", mediaPrompt: "ramp incline", teacher: T },
      { slideNumber: 7, type: "challenge", title: "مثال محلول", content: "أوجد ميل الخط المار بالنقطتين", answer: "2", teacher: { expectedAnswer: "الحل" } },
      {
        slideNumber: 8, type: "question", title: "تحقّق سريع", content: "ما ميل الخط المستقيم؟",
        options: ["التغير في الصادات على التغير في السينات", "مجموع الإحداثيات", "حاصل ضرب النقطتين", "طول القطعة"],
        correctIndex: 0, teacher: T,
      },
      { slideNumber: 9, type: "summary", title: "الخلاصة", content: "• أ\n• ب\n• ج", teacher: T },
    ],
  };
}

const codes = (deck: unknown, source = "") => checkDeck(deck, source).map(i => i.code);

describe("checkDeck", () => {
  it("passes a deck that keeps the whole contract", () => {
    assert.deepEqual(checkDeck(goodDeck(), BOOK), []);
  });

  it("flags a correctIndex that points past the options", () => {
    const d = goodDeck();
    (d.slides[7] as Record<string, unknown>).correctIndex = 4;
    assert.ok(codes(d).includes("correct_index_out_of_range"));
  });

  it("flags a one-based correctIndex only when it overflows — 0 is the first option", () => {
    const d = goodDeck();
    (d.slides[7] as Record<string, unknown>).correctIndex = 0;
    assert.ok(!codes(d).includes("correct_index_out_of_range"));
  });

  it("flags duplicate or missing options", () => {
    const d = goodDeck();
    (d.slides[7] as Record<string, unknown>).options = ["أ", "أ", "ب", "ج"];
    assert.ok(codes(d).includes("bad_options"));
    (d.slides[7] as Record<string, unknown>).options = ["أ", "ب", "ج"];
    assert.ok(codes(d).includes("option_count"));
  });

  it("flags a slide with no teacher block", () => {
    const d = goodDeck();
    delete (d.slides[1] as Record<string, unknown>).teacher;
    assert.ok(codes(d).includes("no_teacher_block"));
  });

  it("flags a model-written verification claim", () => {
    const d = goodDeck();
    (d.slides[7] as Record<string, unknown>).verified = true;
    assert.ok(codes(d).includes("claims_verification"));
  });

  it("flags the wrong number of photo prompts, and a photo on a laid-out slide", () => {
    const d = goodDeck();
    (d.slides[5] as Record<string, unknown>).mediaPrompt = "";
    assert.ok(codes(d).includes("media_prompt_count"));
    const e = goodDeck();
    (e.slides[3] as Record<string, unknown>).layout = "statement";
    assert.ok(codes(e).includes("media_on_layout_slide"));
  });

  it("flags incomplete layouts", () => {
    const d = goodDeck();
    Object.assign(d.slides[4]!, { layout: "compare", mediaPrompt: "", compare: { leftTitle: "قبل", left: ["a"], rightTitle: "", right: [] } });
    assert.ok(codes(d).includes("compare_incomplete"));
  });

  it("flags a challenge with no answer anywhere", () => {
    const d = goodDeck();
    Object.assign(d.slides[6]!, { answer: "", teacher: T });
    assert.ok(codes(d).includes("challenge_without_answer"));
  });

  it("flags a deck that does not end on a summary, and an unknown slide type", () => {
    const d = goodDeck();
    d.slides.pop();
    assert.ok(codes(d).includes("no_closing_summary"));
    (d.slides[0] as Record<string, unknown>).type = "quiz";
    assert.ok(codes(d).includes("unknown_type"));
  });

  it("flags an answer and explanation the book never says — only when there is a book", () => {
    const d = goodDeck();
    Object.assign(d.slides[7]!, { options: ["تتحول الطاقة الحرارية إلى حركية", "ب", "ج", "د"] });
    assert.ok(codes(d, BOOK).includes("weak_book_support"));
    assert.ok(!codes(d, "").includes("weak_book_support"));
  });

  it("treats a non-deck as an error, not a crash", () => {
    assert.deepEqual(codes(null), ["no_slides"]);
    assert.deepEqual(codes({ slides: "x" }), ["no_slides"]);
  });
});
