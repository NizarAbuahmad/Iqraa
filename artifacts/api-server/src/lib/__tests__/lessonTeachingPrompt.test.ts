/**
 * The Slides Maker explanation prompt, and the shape the route accepts.
 *
 * The prompt rules pinned here each answer a real deck: checks that taught
 * the next lesson, an example projected with its own answer, and a warm-up
 * that was stage directions. See lib/lessonTeachingPrompt.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lessonTeachingPromptAr, lessonTeachingPromptEn, teachingVisualCounts } from "../lessonTeachingPrompt.ts";
import { diagramLimitsAr, diagramLimitsEn, promptSlidesPromptAr, promptSlidesPromptEn } from "../promptSlidesPrompt.ts";
import { assertUsableGeneration, missingFields, UnusableGenerationError } from "../generationShape.ts";

const BODY = {
  topic: "المول والكتلة المولية",
  subject: "Chemistry",
  grade: "الصف العاشر",
  additionalContext: "نتاجات الدرس: أوضح مفهوم المول.",
};

describe("lesson-teaching prompt", () => {
  for (const [lang, build] of [["ar", lessonTeachingPromptAr], ["en", lessonTeachingPromptEn]] as const) {
    it(`${lang}: carries the lesson and its book context`, () => {
      const p = build(BODY);
      assert.ok(p.includes(BODY.topic));
      assert.ok(p.includes(BODY.additionalContext));
    });

    it(`${lang}: asks for every field the deck places`, () => {
      const p = build(BODY);
      for (const field of ['"hook"', '"concepts"', '"workedExample"', '"practice"', '"steps"', '"misconception"']) {
        assert.ok(p.includes(field), `missing ${field}`);
      }
    });

    it(`${lang}: asks for a spot-the-mistake built from one of its own misconceptions`, () => {
      const p = build(BODY);
      for (const field of ['"mistake"', '"claim"']) assert.ok(p.includes(field), `missing ${field}`);
      // The claim is projected: an error marked on screen is no longer a puzzle.
      assert.match(p, lang === "ar" ? /لا تُشِر إلى الخطأ في "claim"/ : /Never mark the error in "claim"/);
    });

    it(`${lang}: sets the hook and practice in Jordan without inventing facts about it`, () => {
      const p = build(BODY);
      assert.match(p, lang === "ar" ? /الأردن/ : /Jordan/);
      assert.match(p, lang === "ar" ? /لا تقدّمها حقائق/ : /never as facts about/);
    });

    it(`${lang}: offers a shape, icon, chart and photo per concept, each optional`, () => {
      const p = build(BODY);
      for (const k of ['"shape"', '"icon"', '"chart"', '"photo"', '"cycle"', '"tree"', '"venn"', '"mindmap"']) assert.ok(p.includes(k), k);
      assert.match(p, lang === "ar" ? /لا تخترع أرقامًا/ : /never invent figures/);
    });

    // The app drops, without a word, any shape over a limit, so a prompt that
    // does not state the limits gets its drawings thrown away. Each cap is its
    // own phrase inside its own shape's line (as promptSlidesPrompt.test.ts does
    // for Prompt Slides), so deleting one cap fails here.
    it(`${lang}: states the gate's limits for every shape it offers`, () => {
      const ascii = build(BODY).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));
      const line = (k: string) => {
        const found = ascii.split("\n").find(l => l.trim().startsWith(`- "${k}":`));
        assert.ok(found, `no limits line for ${k}`);
        return found!;
      };
      const caps: Record<"ar" | "en", Record<string, RegExp[]>> = {
        ar: {
          cycle: [/من 3 إلى 6 مراحل/, /اسم المرحلة حتى 24 حرفًا/, /التوضيح حتى 60/, /أسماء المراحل كلها مختلفة/],
          tree: [/من 2 إلى 4 فروع/, /حتى 4 أوراق/, /الأصل حتى 32 حرفًا/, /الفرع والورقة حتى 24/, /أسماء الفروع كلها مختلفة/, /أوراق الفرع الواحد مختلفة/],
          venn: [/اسم المجموعة حتى 24 حرفًا/, /في مجموعتين حتى 4 عناصر لكل منطقة/, /كل عنصر حتى 32 حرفًا/,
            /حتى 3 عناصر قصيرة لكل مجموعة/, /عنصران مشتركان على الأكثر/, /كل عنصر حتى 16 حرفًا/,
            /أسماء المجموعات مختلفة/, /عنصر واحد على الأقل/],
          mindmap: [/من 3 إلى 6 عقد/, /العقدة حتى 40 حرفًا/, /نصوص العقد كلها مختلفة/],
          compare: [/عنوان لكل طرف/, /سطر واحد على الأقل/],
          table: [/من 2 إلى 4 أعمدة/, /من 2 إلى 6 صفوف/, /العنوان حتى 30 حرفًا/, /الخلية حتى 80/, /خلية واحدة بالضبط/],
          flow: [/من 3 إلى 6 مراحل/, /حتى 60 حرفًا/],
          timeline: [/من 3 إلى 6 أحداث/, /التسمية حتى 24 حرفًا/, /النص حتى 120/],
          stat: [/"value" حتى 12 حرفًا/, /"label"/],
        },
        en: {
          cycle: [/3 to 6 stages/, /a label up to 24 characters/, /a note up to 60/, /all stage labels different/],
          tree: [/2 to 4 branches/, /up to 4 leaves/, /the root up to 32 characters/, /a branch or leaf up to 24/, /all branch labels different/, /leaves within one branch different/],
          venn: [/a set label up to 24 characters/, /up to 4 items per region/, /each item up to 32 characters/,
            /at most 3 short items per set/, /and 2 shared/, /each up to 16 characters/,
            /Set labels must all be different/, /at least one item/],
          mindmap: [/3 to 6 nodes/, /each node up to 40 characters/, /all node texts different/],
          compare: [/a title for each side/, /at least one line on each side/],
          table: [/2 to 4 columns/, /2 to 6 rows/, /a header up to 30 characters/, /a cell up to 80/, /exactly one cell under every header/],
          flow: [/3 to 6 stages/, /up to 60 characters/],
          timeline: [/3 to 6 events/, /a label up to 24 characters/, /the text up to 120/],
          stat: [/"value" up to 12 characters/, /a "label"/],
        },
      };
      for (const [k, res] of Object.entries(caps[lang])) {
        for (const re of res) assert.match(line(k), re, `${k}: ${re}`);
      }
    });

    it(`${lang}: does not hang a bulb on the example concept`, () => {
      assert.equal(build(BODY).includes('"icon": "bulb"'), false);
    });

    it(`${lang}: omits the context block when there is no book context`, () => {
      const p = build({ ...BODY, additionalContext: "" });
      assert.equal(p.includes("undefined"), false);
    });
  }

  it("ar: pins the rules each earlier deck broke", () => {
    const p = lessonTeachingPromptAr(BODY);
    assert.match(p, /التزم بهذا الدرس وحده/);
    assert.match(p, /لا يتضمّن الإجابة/);
    assert.match(p, /لا تعليمات إخراج/);
    assert.match(p, /لا تسمية/);
  });

  // From the first live deck («المول والكتلة المولية», 2026-09-27): the
  // solution wrote «2 x 58» with the letter x as a times sign, the «مثال:»
  // lines named no value at all, and a step read only «نستنتج الكتلة النهائية».
  for (const [lang, build] of [["ar", lessonTeachingPromptAr], ["en", lessonTeachingPromptEn]] as const) {
    it(`${lang}: pins the fixes from the first live deck`, () => {
      const p = build(BODY);
      assert.ok(p.includes("×"), "multiplication sign");
      assert.ok(p.includes("6.022×10²³"), "standard constants allowed");
      assert.ok(p.includes("12 g"), "a concrete example to imitate");
      assert.match(p, lang === "ar" ? /نستنتج الكتلة النهائية/ : /we conclude the final mass/);
    });
  }

  it("en: pins the rules each earlier deck broke", () => {
    const p = lessonTeachingPromptEn(BODY);
    assert.match(p, /Stay inside this lesson/);
    assert.match(p, /never contains the answer/);
    assert.match(p, /No stage directions/);
    assert.match(p, /never a label/);
  });
});

describe("diagram limits are one set of sentences", () => {
  const SHAPES = ["cycle", "tree", "venn", "mindmap"] as const;
  for (const [lang, limits, lesson, slides] of [
    ["ar", diagramLimitsAr, lessonTeachingPromptAr, promptSlidesPromptAr],
    ["en", diagramLimitsEn, lessonTeachingPromptEn, promptSlidesPromptEn],
  ] as const) {
    it(`${lang}: Prompt Slides and the lesson-teaching prompt print the same sentence for each diagram`, () => {
      const l = lesson(BODY);
      const p = slides({ additionalContext: "x" });
      for (const k of SHAPES) {
        const sentence = limits()[k];
        assert.ok(sentence.length > 20, k);
        assert.ok(l.includes(sentence), `lesson-teaching prompt lacks the ${k} limits`);
        assert.ok(p.includes(sentence), `Prompt Slides lacks the ${k} limits`);
      }
    });
  }

  // The limits of the shapes the API does not share a sentence for are written
  // by hand in the lesson-teaching prompt; read the app's constants so a changed
  // limit there fails here rather than silently dropping the model's drawings.
  it("the non-diagram numbers in the prompt are the app's own constants", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "../../../../mobile/services/slideLayout.ts"), "utf8");
    const num = (name: string) => {
      const m = new RegExp(`export const ${name} = (\\d+);`).exec(src);
      assert.ok(m, `${name} not found in slideLayout.ts`);
      return m![1]!;
    };
    const en = lessonTeachingPromptEn(BODY);
    const line = (k: string) => en.split("\n").find(l => l.trim().startsWith(`- "${k}":`))!;
    const expect = (k: string, ...phrases: string[]) => {
      for (const ph of phrases) assert.ok(line(k).includes(ph), `${k}: ${ph}`);
    };
    expect("table", `${num("MIN_TABLE_COLUMNS")} to ${num("MAX_TABLE_COLUMNS")} columns`, `${num("MIN_TABLE_ROWS")} to ${num("MAX_TABLE_ROWS")} rows`,
      `header up to ${num("MAX_TABLE_HEADER_CHARS")} characters`, `cell up to ${num("MAX_TABLE_CELL_CHARS")}`);
    expect("flow", `${num("MIN_FLOW_NODES")} to ${num("MAX_FLOW_NODES")} stages`, `up to ${num("MAX_FLOW_NODE_CHARS")} characters`);
    expect("timeline", `${num("MIN_TIMELINE_EVENTS")} to ${num("MAX_TIMELINE_EVENTS")} events`,
      `label up to ${num("MAX_TIMELINE_LABEL_CHARS")} characters`, `text up to ${num("MAX_TIMELINE_TEXT_CHARS")}`);
    expect("stat", `"value" up to ${num("MAX_STAT_VALUE_CHARS")} characters`);
  });
});

describe("lesson-teaching shape", () => {
  it("accepts an explanation with nothing else", () => {
    assert.deepEqual(missingFields("lesson-teaching", { concepts: [{ title: "x", points: ["y"] }] }), []);
  });

  it("refuses a reply with no explanation — that is the whole call", () => {
    assert.throws(
      () => assertUsableGeneration("lesson-teaching", { hook: { question: "؟" }, concepts: [] }),
      UnusableGenerationError,
    );
  });
});

describe("teachingVisualCounts", () => {
  it("counts the extras the model returned", () => {
    assert.deepEqual(teachingVisualCounts({ concepts: [
      { title: "a", points: ["x"], shape: { layout: "cycle" }, icon: "drop" },
      { title: "b", points: ["y"], chart: { kind: "chart" }, photo: "water cycle" },
      { title: "c", points: ["z"] },
    ] }), { concepts: 3, shape: 1, icon: 1, chart: 1, photo: 1 });
    assert.deepEqual(teachingVisualCounts(null), { concepts: 0, shape: 0, icon: 0, chart: 0, photo: 0 });
  });
});
