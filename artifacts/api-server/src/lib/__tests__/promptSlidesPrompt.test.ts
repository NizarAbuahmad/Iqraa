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
      // Two separate claims, because the second is the one that breaks in
      // production: an Arabic query returns nothing from an English index.
      assert.match(prompt, /عبارة بحث|search phrase/);
      assert.match(prompt, /بالإنجليزية|English/);
      // The count the client caps at must be the count the prompt asks for.
      assert.equal(MAX_PROMPT_SLIDE_IMAGES, 3);
      assert.match(prompt, /ثلاث شرائح|three slides/);
      assert.match(prompt, /لا تكتب "mediaUrl"|Never write "mediaUrl"/);
    });

    it(`${label}: prescribes the arc, including a divider`, () => {
      assert.match(prompt, /divider/);
      assert.match(prompt, /summary/);
      assert.match(prompt, /challenge/);
    });
  }

  for (const [label, build] of BOTH) {
    const prompt = build(baseBody);

    it(`${label}: offers every layout the renderers can draw`, () => {
      // A layout the prompt asks for but no renderer knows would fall back to
      // an ordinary slide forever, invisibly. These four are the set in
      // services/slideLayout.ts.
      for (const layout of ["statement", "stat", "compare", "steps"]) {
        assert.match(prompt, new RegExp(`"${layout}"`), `${layout} is never offered`);
      }
    });

    it(`${label}: gives the stat layout an honesty bar`, () => {
      // Left alone, a model will happily invent «73% من الطلبة» and project it.
      assert.match(prompt, /لا تخترع إحصاءات|Never invent statistics/);
    });

    it(`${label}: caps how much of the deck wears a special shape`, () => {
      assert.match(prompt, /أكثر من نصف|no more than half/);
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

describe("deck kind — a general deck is not a lesson", () => {
  /**
   * The defect these pin: the arc was written as a lesson and only a lesson.
   * A teacher asked for a Mother's Day deck and got «أهداف الحصة», «مثال
   * محلول» and «تحقّق سريع» — classroom furniture nailed onto a celebration,
   * which is what "the structure is too close to the lessons tool" meant.
   */
  const body = { additionalContext: "عرض عن يوم الأم", slideCount: 10 };

  it("makes the model choose the deck kind before it writes an arc", () => {
    const ar = promptSlidesPromptAr(body);
    assert.match(ar, /عرض تعليمي/);
    assert.match(ar, /عرض عام/);
    assert.match(ar, /بنية \(أ\)/);
    assert.match(ar, /بنية \(ب\)/);
    const en = promptSlidesPromptEn(body);
    assert.match(en, /A teaching deck/);
    assert.match(en, /A general deck/);
    assert.match(en, /Structure for \(A\)/);
    assert.match(en, /Structure for \(B\)/);
  });

  it("names the failure it is correcting, so the model does not default to a lesson", () => {
    assert.match(promptSlidesPromptAr(body), /لا تفترض \(أ\)/);
    assert.match(promptSlidesPromptEn(body), /Do not assume \(A\)/);
  });

  it("makes the quiz optional on a general deck and keeps it on a teaching one", () => {
    // Both halves matter. Dropping the check everywhere would hollow out real
    // lessons, which is the opposite mistake and just as wrong.
    assert.match(promptSlidesPromptEn(body), /A question slide is OPTIONAL here/);
    assert.match(promptSlidesPromptEn(body), /A check slide \(question\) with four options/);
  });

  it("stops the skeleton teaching the model to say «الحصة» on every deck", () => {
    const ar = promptSlidesPromptAr(body);
    assert.ok(!ar.includes("هدف الحصة بجملة واحدة"), "learningObjective example still says الحصة");
    assert.ok(!ar.includes("ما يحتاجه المعلّم قبل الحصة"), "teacherPreparation example still says الحصة");
    assert.ok(!promptSlidesPromptEn(body).includes("The lesson goal in one sentence"));
  });
});

describe("deckPhotoQueries — the deck's topic, not the school subject", () => {
  /**
   * `deckPhotoQueries()` on the client keys off the curriculum subject, which
   * in the older Slides Maker IS the deck's topic. Here it is only the
   * teacher's profile, so a Mother's Day deck searched Unsplash for
   * "mathematics equations chalkboard" and got a real, wrong photo.
   */
  const body = { additionalContext: "عرض عن يوم الأم" };

  it("asks for two cover/section queries in both languages", () => {
    assert.match(promptSlidesPromptAr(body), /"deckPhotoQueries"/);
    assert.match(promptSlidesPromptEn(body), /"deckPhotoQueries"/);
  });

  it("requires english, because an arabic query returns nothing at all", () => {
    assert.match(promptSlidesPromptAr(body), /بالإنجليزية دائمًا/);
    assert.match(promptSlidesPromptEn(body), /Always English/);
  });

  it("tells it to describe the topic rather than the subject, with the real example", () => {
    assert.match(promptSlidesPromptAr(body), /mother and child hands/);
    assert.match(promptSlidesPromptEn(body), /never "mathematics classroom"/);
  });

  it("asks for four queries, not two — the spares are the client's fallback", () => {
    // A production deck made exactly two Unsplash calls because no slide
    // carried a `mediaPrompt`, while filling `deckPhotoQueries` perfectly.
    // Required array fields get filled; optional per-slide ones do not, so the
    // floor now rides on the array.
    assert.match(promptSlidesPromptEn(body), /FOUR English search phrases/);
    assert.match(promptSlidesPromptEn(body), /spares for content slides/);
    assert.match(promptSlidesPromptAr(body), /أربع عبارات بحث/);
    assert.match(promptSlidesPromptAr(body), /الأربع مطلوبة/);
    for (const p of [promptSlidesPromptAr(body), promptSlidesPromptEn(body)]) {
      const skeleton = p.match(/"deckPhotoQueries":\s*\[[^\]]*\]/)?.[0] ?? "";
      assert.equal((skeleton.match(/"/g) ?? []).length, 10, `skeleton should show 4 queries: ${skeleton}`);
    }
  });
});

describe("mediaPrompt is a requirement, not a permission", () => {
  /**
   * The measured defect. The rule said "include it only where a picture adds
   * meaning, on at most 3 slides" — and the model read that permission as
   * licence to emit none at all, so every content slide in a real deck was
   * pure text and only the cover and divider had pictures.
   */
  const body = { additionalContext: "يوم الأم" };

  it("demands it on exactly three slides", () => {
    assert.match(promptSlidesPromptEn(body), /REQUIRED on exactly three slides/);
    assert.match(promptSlidesPromptAr(body), /مطلوب على ثلاث شرائح بالضبط/);
  });

  it("no longer phrases it as optional", () => {
    assert.ok(!promptSlidesPromptEn(body).includes("include it only where a picture adds meaning"));
    assert.ok(!promptSlidesPromptAr(body).includes("ضعه فقط حين تضيف الصورة معنًى"));
  });

  it("says why it matters — that it is the only route to a content-slide picture", () => {
    assert.match(promptSlidesPromptEn(body), /only way a picture ever reaches a content slide/);
    assert.match(promptSlidesPromptAr(body), /الطريقة الوحيدة لوصول صورة إلى شريحة محتوى/);
  });
});
