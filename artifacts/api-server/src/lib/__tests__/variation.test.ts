/**
 * Regeneration has to *be* different, not be told to be.
 *
 * Before this, "regenerate" re-sent an identical body and the model returned
 * the same questions reworded. The prompt directives here are the fix, and
 * `overlapRatio` is the check that they worked — this repo has shipped a flag
 * describing an intention rather than a result before (CLAUDE.md, `verified`),
 * and "regenerated" is exactly that kind of claim.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OVERLAP_REJECT_ABOVE,
  VARIATION_PROFILE_COUNT,
  normalizeAvoidInput,
  overlapRatio,
  signatureLines,
  variationBlock,
  variationProfile,
} from "../variation.ts";

const QUIZ = {
  title: "اختبار في كثيرات الحدود",
  questions: [
    { id: "q1", text: "جد ناتج قسمة كثيرة الحدود على العامل المعطى", points: 2 },
    { id: "q2", text: "حلّل كثيرة الحدود التالية إلى عواملها الأولية", points: 2 },
  ],
};

describe("signatureLines", () => {
  it("pulls the stems out of an artifact without knowing its shape", () => {
    const lines = signatureLines(QUIZ);
    assert.equal(lines.length, 3); // title + two stems
    assert.ok(lines.some((l) => l.includes("حلل كثيرة الحدود")));
  });

  it("walks a worksheet's nested sections too — one extractor, six shapes", () => {
    const lines = signatureLines({
      title: "ورقة عمل حول المشتقات",
      sections: [
        { title: "القسم الأول من الورقة", questions: [{ text: "اشتق الاقتران التالي بالنسبة إلى س" }] },
      ],
    });
    assert.ok(lines.some((l) => l.includes("اشتق الاقتران")));
    assert.ok(lines.some((l) => l.includes("القسم الاول")));
  });

  it("drops short strings — a section label is not a question", () => {
    // «الأسئلة» is on every paper of a kind. Counting it would report overlap
    // between two artifacts that share nothing.
    assert.deepEqual(signatureLines({ title: "الأسئلة" }), []);
  });

  it("is stable: the same artifact gives the same list", () => {
    assert.deepEqual(signatureLines(QUIZ), signatureLines(QUIZ));
  });

  it("survives a shape it has never seen", () => {
    assert.deepEqual(signatureLines(null), []);
    assert.deepEqual(signatureLines("a string"), []);
    assert.deepEqual(signatureLines({ nothing: "useful here at all" }), []);
  });
});

describe("overlapRatio", () => {
  it("reports the share of the new artifact the teacher had already seen", () => {
    const seen = signatureLines(QUIZ);
    assert.equal(overlapRatio(seen, seen), 1);
    assert.equal(overlapRatio(["a wholly different stem here"], seen), 0);
  });

  it("catches a 'new' paper that is the old one — the case that matters", () => {
    const seen = signatureLines(QUIZ);
    const regenerated = signatureLines({
      title: "اختبار في كثيرات الحدود",
      questions: [
        { text: "جد ناتج قسمة كثيرة الحدود على العامل المعطى" },
        { text: "سؤال جديد تمامًا لم يظهر في النسخة السابقة إطلاقًا" },
      ],
    });
    assert.ok(overlapRatio(regenerated, seen) > OVERLAP_REJECT_ABOVE);
  });

  it("measures containment, not similarity: a short new list inside a long seen one is caught", () => {
    // Jaccard would score this low because the lists are different sizes, and
    // the retry would never fire on the exact failure it exists for.
    const seen = [...signatureLines(QUIZ), "extra one", "extra two", "extra three", "extra four"];
    assert.equal(overlapRatio([signatureLines(QUIZ)[1]!], seen), 1);
  });

  it("reports 0 when either side is empty — absent evidence is not evidence", () => {
    assert.equal(overlapRatio([], ["a"]), 0);
    assert.equal(overlapRatio(["a"], []), 0);
  });
});

describe("variationProfile", () => {
  it("leaves slot 0 unsteered — the first artifact is the tuned prompt's own", () => {
    assert.equal(variationProfile(0, true), "");
    assert.equal(variationProfile(0, false), "");
  });

  it("gives every later slot a different angle", () => {
    const seen = new Set<string>();
    for (let i = 1; i < VARIATION_PROFILE_COUNT; i++) {
      const p = variationProfile(i, true);
      assert.ok(p.length > 0, `slot ${i} has no directive`);
      assert.ok(!seen.has(p), `slot ${i} repeats an earlier angle`);
      seen.add(p);
    }
  });

  it("wraps rather than falling off the end", () => {
    assert.equal(variationProfile(VARIATION_PROFILE_COUNT, true), variationProfile(0, true));
    assert.equal(variationProfile(-1, true), variationProfile(VARIATION_PROFILE_COUNT - 1, true));
  });

  it("answers in the language the artifact is written in", () => {
    assert.match(variationProfile(1, true), /[؀-ۿ]/);
    assert.doesNotMatch(variationProfile(1, false), /[؀-ۿ]/);
  });
});

describe("variationBlock", () => {
  it("is empty for a first generation — the common path sends the prompt as written", () => {
    assert.equal(variationBlock({ variantIndex: 0, isArabic: true, avoid: [] }), "");
  });

  it("quotes back what not to repeat", () => {
    const block = variationBlock({
      variantIndex: 1,
      isArabic: true,
      avoid: ["حلل كثيرة الحدود التالية الي عواملها"],
    });
    assert.ok(block.includes("حلل كثيرة الحدود التالية الي عواملها"));
  });

  it("says so louder on the retry", () => {
    const plain = variationBlock({ variantIndex: 1, isArabic: false, avoid: ["some earlier stem"] });
    const retry = variationBlock({
      variantIndex: 1, isArabic: false, avoid: ["some earlier stem"], insistent: true,
    });
    assert.ok(retry.length > plain.length);
    assert.ok(retry.includes("rejected"));
  });
});

describe("normalizeAvoidInput", () => {
  it("normalises to the same form stored signatures use, so the two compare", () => {
    // Two spellings of one stem — diacritics and alef forms — must collapse,
    // or the exclusion list quietly fails to match what the model returns.
    const [line] = normalizeAvoidInput(["  إحسب   المشتقة  "]);
    assert.equal(line, normalizeAvoidInput(["احسب المشتقة"])[0]);
  });

  it("ignores anything that is not a usable string", () => {
    assert.deepEqual(normalizeAvoidInput("not an array"), []);
    assert.deepEqual(normalizeAvoidInput([1, null, {}, "short"]), []);
  });

  it("caps the list — an exclusion block must not outweigh the prompt", () => {
    const many = Array.from({ length: 100 }, (_, i) => `a distinct question stem number ${i}`);
    assert.ok(normalizeAvoidInput(many).length <= 24);
  });
});
