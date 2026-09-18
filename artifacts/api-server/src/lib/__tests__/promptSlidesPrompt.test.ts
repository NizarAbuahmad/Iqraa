/**
 * Prompt-slides prompt builders.
 *
 * What these guard: the first version of this prompt named six slide types,
 * defined none of them, left the slide count to the model's discretion, and
 * listed only prohibitions under "mandatory rules". Teachers got six near-blank
 * cards with a dead teacher-notes button. Every assertion below pins one of the
 * mechanisms that fixed that, because each is invisible in the output until a
 * teacher projects a deck in front of a class and finds it empty.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/promptSlidesPrompt.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PROMPT_SLIDES,
  MAX_PROMPT_SLIDE_IMAGES,
  MIN_PROMPT_SLIDES,
  promptSlidesPromptAr,
  promptSlidesPromptEn,
  stripUnearnedPromptSlideVerification,
} from "../promptSlidesPrompt.ts";

const baseBody = {
  subject: "Science",
  grade: "6",
  language: "english",
  additionalContext: "Make a 6-slide intro to photosynthesis, fun tone, 2 quiz questions",
};

const BOTH = [
  ["ar", promptSlidesPromptAr] as const,
  ["en", promptSlidesPromptEn] as const,
];

describe("promptSlidesPrompt — carries the teacher's description", () => {
  for (const [label, build] of BOTH) {
    it(`${label}: interpolates the description verbatim`, () => {
      assert.ok(build(baseBody).includes(baseBody.additionalContext));
    });
  }

  it("offers grade and subject as a hint the description can override", () => {
    const ar = promptSlidesPromptAr(baseBody);
    const en = promptSlidesPromptEn(baseBody);
    // The profile scope must never read as a hard requirement — a teacher whose
    // profile says grade 6 can still ask for a grade 9 deck.
    assert.match(ar, /الوصف هو المرجع/);
    assert.match(en, /the description wins/);
  });

  it("omits the scope line entirely when the profile has nothing to offer", () => {
    const bare = { ...baseBody, grade: "", subject: "" };
    assert.ok(!promptSlidesPromptEn(bare).includes("This teacher usually teaches"));
  });
});

describe("promptSlidesPrompt — slide count", () => {
  it("names a default when the teacher did not choose", () => {
    assert.match(promptSlidesPromptAr(baseBody), /اجعلها 10 شرائح/);
    assert.match(promptSlidesPromptEn(baseBody), /make it 10 slides/);
  });

  it("honours a requested count", () => {
    assert.match(promptSlidesPromptAr({ ...baseBody, slideCount: 8 }), /أنشئ 8 شريحة بالضبط/);
    assert.match(promptSlidesPromptEn({ ...baseBody, slideCount: 8 }), /exactly 8 slides/);
  });

  it("clamps an absurd count to the cap, and a tiny one to the floor", () => {
    assert.match(
      promptSlidesPromptEn({ ...baseBody, slideCount: 999 }),
      new RegExp(`exactly ${MAX_PROMPT_SLIDES} slides`),
    );
    assert.match(
      promptSlidesPromptEn({ ...baseBody, slideCount: 2 }),
      new RegExp(`exactly ${MIN_PROMPT_SLIDES} slides`),
    );
  });
});

describe("promptSlidesPrompt — the rules that stop empty decks", () => {
  for (const [label, build] of BOTH) {
    const prompt = build(baseBody);

    it(`${label}: puts a teacher block in the skeleton`, () => {
      // The presenter gates its whole teacher panel on `slide.teacher`. A model
      // shown a skeleton without the key never invents one.
      assert.match(prompt, /"teacher"\s*:\s*\{/);
      assert.match(prompt, /expectedAnswer/);
      assert.match(prompt, /commonMisconceptions/);
    });

    it(`${label}: demands a teacher block on every slide, not just the example`, () => {
      assert.match(prompt, /كل شريحة بلا استثناء تحمل كائن "teacher"|Every slide without exception carries a non-empty "teacher"/);
    });

    it(`${label}: shows a literal multi-line bulleted content example`, () => {
      // One flat sentence renders as a ~90% empty slide, because the presenter
      // splits content on \n and draws "• " lines as cards.
      assert.match(prompt, /•[^"]*\\n•/);
    });

    it(`${label}: sets a floor of two lines per slide`, () => {
      assert.match(prompt, /لا تقلّ أي شريحة عن سطرين|never fewer than two lines on any slide/);
    });

    it(`${label}: requires one idea per concept slide`, () => {
      assert.match(prompt, /فكرة واحدة فقط|exactly one idea per slide|carries exactly one idea/);
    });

    it(`${label}: bars filler distractors`, () => {
      assert.match(prompt, /أخطاء شائعة حقيقية|real, plausible misconceptions/);
    });

    it(`${label}: still pins the 0-based correctIndex`, () => {
      assert.match(prompt, /فهرس مُصفَّر|0-based/);
    });

    it(`${label}: asks for latin equations so a graph can be drawn`, () => {
      assert.match(prompt, /بالحرفين اللاتينيين x و y|latin x and y/);
    });

    it(`${label}: describes mediaPrompt as an english photo search phrase`, () => {
      assert.match(prompt, /عبارة بحث عن صورة|photo search phrase/);
      assert.match(prompt, new RegExp(String(MAX_PROMPT_SLIDE_IMAGES)));
      assert.match(prompt, /لا تكتب "mediaUrl"|Never write "mediaUrl"/);
    });

    it(`${label}: prescribes the arc, including a divider`, () => {
      assert.match(prompt, /divider/);
      assert.match(prompt, /summary/);
      assert.match(prompt, /challenge/);
    });
  }

  it("no longer tells the model to withhold content the teacher did not ask for", () => {
    // This single line capped every deck's richness at the teacher's own
    // terseness — a two-line description bought a two-line deck.
    assert.ok(!promptSlidesPromptAr(baseBody).includes("لا تُقحم محتوى لم يُطلب"));
    assert.ok(!promptSlidesPromptEn(baseBody).includes("Do not add content that was not asked for"));
  });
});

describe("stripUnearnedPromptSlideVerification", () => {
  it("removes verification fields a model invented", () => {
    const deck = {
      activityName: "d",
      slides: [{ title: "a", content: "b", verified: true, verifiedBy: "symbolic", computedAnswer: "2" }],
    };
    const out = stripUnearnedPromptSlideVerification(deck) as typeof deck;
    assert.equal("verified" in out.slides[0]!, false);
    assert.equal("verifiedBy" in out.slides[0]!, false);
    assert.equal("computedAnswer" in out.slides[0]!, false);
    assert.equal(out.slides[0]!.title, "a");
  });

  it("passes through anything that is not a deck", () => {
    assert.equal(stripUnearnedPromptSlideVerification(null), null);
    assert.equal(stripUnearnedPromptSlideVerification("x"), "x");
  });
});
