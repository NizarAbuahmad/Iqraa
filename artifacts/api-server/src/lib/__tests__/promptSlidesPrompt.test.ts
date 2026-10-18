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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECK_ICON_NAMES,
  MAX_PROMPT_SLIDE_CHARTS,
  sanitizeDeckStructure,
} from "../promptSlidesPrompt.ts";
import { DECK_LAYOUT_NAMES } from "../promptSlidesPrompt.ts";

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

describe("the LaTeX ban reaches the model as text, not control characters", () => {
  // `\frac`, `\theta`, `\times` sat unescaped inside the template literal, so
  // JavaScript read `\f` as a form feed and `\t` as a tab: the model was told
  // not to write «(␌rac, ␉heta, ␉imes)». Found 2026-10-08.
  for (const [name, build] of [["arabic", promptSlidesPromptAr], ["english", promptSlidesPromptEn]] as const) {
    it(`${name}: names the backslash commands literally`, () => {
      const prompt = build(baseBody);
      assert.ok(prompt.includes("\\frac"), "expected the literal \\frac");
      assert.ok(prompt.includes("\\theta") && prompt.includes("\\times"));
      assert.doesNotMatch(prompt, /[\f\t]/, "a form feed or tab means an escape was swallowed");
    });
  }
});

describe("icons and charts — structure the model chooses", () => {
  for (const [label, build] of BOTH) {
    describe(label, () => {
      const prompt = build(baseBody);

      it("lists every icon name the app can draw, and asks for an icon on each concept slide", () => {
        for (const name of DECK_ICON_NAMES) assert.ok(prompt.includes(name), name);
        assert.match(prompt, /"icon"/);
      });

      it("shows the shape in the skeleton so the model has seen it", () => {
        assert.match(prompt, /"icon": "bulb"/);
        assert.match(prompt, /"icon": "flag"/);
      });

      it("allows a chart only on real figures and forbids inventing any", () => {
        assert.match(prompt, /"visual"/);
        assert.match(prompt, /"kind":"chart"/);
        assert.match(prompt, label === "ar" ? /لا تخترع أرقامًا/ : /Never invent figures/);
        assert.ok(prompt.includes(`${MAX_PROMPT_SLIDE_CHARTS}`));
      });

      it("keeps a chart off a laid-out or photographed slide, and emoji out of titles", () => {
        assert.match(prompt, label === "ar" ? /يحمل "layout" أو "mediaPrompt"|تحمل "layout" أو "mediaPrompt"/ : /carries a "layout" or a "mediaPrompt"/);
        assert.match(prompt, label === "ar" ? /ولا تضع إيموجي في العنوان/ : /no emoji in a title/);
      });
    });
  }

  it("the API's icon list is the app's list — read out of the app's own source", () => {
    // The server cannot import the app, so the two lists are copies. This is
    // the guard that makes a copy safe: add an icon to one and not the other
    // and the model is told about a picture the app cannot draw, or never told
    // about one it can.
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "../../../../mobile/services/deckIcons.ts"), "utf8");
    const block = source.match(/export const DECK_SECTION_ICONS = \[([\s\S]*?)\] as const/);
    assert.ok(block, "DECK_SECTION_ICONS not found in the app's deckIcons.ts");
    const appNames = [...block![1]!.matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    assert.deepEqual([...DECK_ICON_NAMES].sort(), [...appNames].sort());
  });
});

describe("sanitizeDeckStructure — optional extras are kept only where they can be drawn", () => {
  const chart = { kind: "chart", chartType: "bar", categories: ["أ", "ب", "ج"], values: [3, 5, 2] };
  const deckOf = (slides: Record<string, unknown>[]) => ({ activityName: "x", slides });
  const slidesOf = (d: unknown) => (d as { slides: Record<string, unknown>[] }).slides;

  it("keeps a valid icon and chart untouched", () => {
    const out = slidesOf(sanitizeDeckStructure(deckOf([{ icon: "atom", visual: chart }])));
    assert.equal(out[0]!.icon, "atom");
    assert.deepEqual(out[0]!.visual, chart);
  });

  it("deletes an unknown icon, including inherited object keys", () => {
    for (const bad of ["rocket", "", "toString", "constructor", 5, null]) {
      const out = slidesOf(sanitizeDeckStructure(deckOf([{ icon: bad }])));
      assert.equal("icon" in out[0]!, false, String(bad));
    }
  });

  it("deletes a chart that is ragged, negative, unlabeled, or the wrong kind — and its reveal flag", () => {
    const bads = [
      { ...chart, values: [1, 2] },
      { ...chart, values: [3, -1, 2] },
      { ...chart, categories: ["أ", "", "ج"] },
      { ...chart, categories: ["أ", "أ", "ج"] },
      { ...chart, chartType: "line" },
      { ...chart, kind: "plot" },
      "chart",
    ];
    for (const bad of bads) {
      const out = slidesOf(sanitizeDeckStructure(deckOf([{ visual: bad, visualOnReveal: true }])));
      assert.equal("visual" in out[0]!, false, JSON.stringify(bad));
      assert.equal("visualOnReveal" in out[0]!, false);
    }
  });

  it("reads numeric strings, and refuses prose posing as a number", () => {
    const ok = slidesOf(sanitizeDeckStructure(deckOf([{ visual: { ...chart, values: ["٣", "5", "2.5"] } }])));
    assert.deepEqual((ok[0]!.visual as { values: number[] }).values, [3, 5, 2.5]);
    const bad = slidesOf(sanitizeDeckStructure(deckOf([{ visual: { ...chart, values: ["about 3", 5, 2] } }])));
    assert.equal("visual" in bad[0]!, false);
  });

  it("drops a chart from a slide whose layout already fills the screen", () => {
    const out = slidesOf(sanitizeDeckStructure(deckOf([{ layout: "stat", visual: chart }])));
    assert.equal(out[0]!.layout, "stat");
    assert.equal("visual" in out[0]!, false);
  });

  it("keeps the first three charts and cuts the rest", () => {
    const out = slidesOf(sanitizeDeckStructure(deckOf(Array.from({ length: 5 }, () => ({ visual: chart })))));
    assert.deepEqual(out.map(s => "visual" in s), [true, true, true, false, false]);
  });

  it("never refuses or reshapes a deck — it only prunes", () => {
    const d = deckOf([{ title: "t", content: "c" }, "not a slide" as never]);
    const out = sanitizeDeckStructure(d) as { activityName: string; slides: unknown[] };
    assert.equal(out.activityName, "x");
    assert.equal(out.slides.length, 2);
    for (const junk of [null, undefined, "deck", 3, [], { slides: "no" }]) {
      assert.deepEqual(sanitizeDeckStructure(junk), junk);
    }
  });
});

describe("structure layouts — timeline, stats, table, flow", () => {
  for (const [label, build] of BOTH) {
    describe(label, () => {
      const prompt = build(baseBody);

      it("names all four, with the JSON shape each one needs", () => {
        for (const name of ["timeline", "stats", "table", "flow"]) assert.ok(prompt.includes(`"${name}"`), name);
        assert.match(prompt, /"timeline": \[\{"label"/);
        assert.match(prompt, /"stats": \[\{"value"/);
        assert.match(prompt, /"table": \{"headers"/);
        assert.match(prompt, /"flow": \{"steps"/);
        assert.match(prompt, /"cycle"/);
      });

      it("demands one cell under every header, and forbids inventing figures or dates", () => {
        assert.match(prompt, label === "ar" ? /خلية واحدة بالضبط تحت كل عنوان/ : /exactly one cell under every header/);
        assert.match(prompt, label === "ar" ? /لا تخترع أرقامًا أبدًا/ : /Never invent a figure/);
        assert.match(prompt, label === "ar" ? /لا مخترَعة/ : /never invented/);
      });

      it("asks for one sentence of content on these slides, and lists them as an exception to the two-line rule", () => {
        assert.match(prompt, label === "ar" ? /جملة واحدة تلخّص الشريحة/ : /ONE sentence that sums the slide up/);
        assert.match(prompt, label === "ar"
          ? /"timeline" أو "stats" أو "table" أو "flow" أو "quote" أو "photo"، فهذه سطر واحد عمدًا/
          : /"timeline", "stats", "table", "flow", "quote" or "photo", which are one line on purpose/);
      });
    });
  }

  for (const [label, build] of BOTH) {
    describe(`quote and photo — ${label}`, () => {
      const prompt = build(baseBody);

      it("names both, with the JSON shape the quote needs and the search phrase the photo needs", () => {
        assert.match(prompt, /"quote": \{"text"/);
        assert.match(prompt, /- "photo":/);
        assert.match(prompt, label === "ar" ? /حتى ٢٠٠ حرف/ : /up to 200 characters/);
        assert.match(prompt, label === "ar" ? /لا تنسب كلامًا إلى أحد/ : /Never attribute words to someone/);
      });

      it("lets a photo slide — and only that layout — carry a mediaPrompt, and keeps them one line", () => {
        assert.match(prompt, label === "ar" ? /إلا إن كان "photo"/ : /unless it is "photo"/);
        assert.match(prompt, label === "ar"
          ? /"flow" أو "quote" أو "photo"، فهذه سطر واحد عمدًا/
          : /"flow", "quote" or "photo", which are one line on purpose/);
      });
    });
  }

  it("the layout list the server accepts is the app's SLIDE_LAYOUTS — read out of the app's source", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "../../../../mobile/services/slideLayout.ts"), "utf8");
    const block = source.match(/export const SLIDE_LAYOUTS = \[([\s\S]*?)\] as const/);
    assert.ok(block, "SLIDE_LAYOUTS not found in the app's slideLayout.ts");
    const appNames = [...block![1]!.matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    assert.deepEqual([...DECK_LAYOUT_NAMES].sort(), [...appNames].sort());
  });
});

describe("sanitizeDeckStructure — layouts", () => {
  const deckOf = (slides: Record<string, unknown>[]) => ({ activityName: "x", slides });
  const slidesOf = (d: unknown) => (d as { slides: Record<string, unknown>[] }).slides;
  const timeline = [{ label: "1", text: "a" }, { label: "2", text: "b" }, { label: "3", text: "c" }];

  it("keeps a known layout on a prose slide, payload and all", () => {
    for (const type of ["intro", "summary"]) {
      const out = slidesOf(sanitizeDeckStructure(deckOf([{ type, layout: "timeline", timeline }])));
      assert.equal(out[0]!.layout, "timeline");
      assert.deepEqual(out[0]!.timeline, timeline);
    }
  });

  it("keeps quote and photo on a prose slide, and strips them from a question", () => {
    for (const layout of ["quote", "photo"]) {
      assert.equal(slidesOf(sanitizeDeckStructure(deckOf([{ type: "intro", layout }])))[0]!.layout, layout);
      assert.equal("layout" in slidesOf(sanitizeDeckStructure(deckOf([{ type: "question", layout }])))[0]!, false, layout);
    }
  });

  it("deletes a layout name the app does not know", () => {
    for (const bad of ["carousel", "", "toString", 4, null]) {
      const out = slidesOf(sanitizeDeckStructure(deckOf([{ type: "intro", layout: bad }])));
      assert.equal("layout" in out[0]!, false, String(bad));
    }
  });

  it("deletes a layout from a question, challenge or divider — it would hide the options, the answer or the photo", () => {
    for (const type of ["question", "challenge", "divider", "graph", "media"]) {
      const out = slidesOf(sanitizeDeckStructure(deckOf([{ type, layout: "stats", stats: [{ value: "1", label: "a" }], options: ["a", "b"] }])));
      assert.equal("layout" in out[0]!, false, type);
      assert.deepEqual(out[0]!.options, ["a", "b"], "the question's own fields are untouched");
    }
  });

  it("does not judge the payload — the app re-checks it with the real limits", () => {
    const thin = [{ label: "1", text: "only one" }];
    const out = slidesOf(sanitizeDeckStructure(deckOf([{ type: "intro", layout: "timeline", timeline: thin }])));
    assert.equal(out[0]!.layout, "timeline");
    assert.deepEqual(out[0]!.timeline, thin);
  });
});
