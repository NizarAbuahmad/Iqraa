/**
 * The system prompts' figure rule.
 *
 * Decks shipped formative checks reading «يمثل الرسم البياني خطين مستقيمين…»
 * beside an empty slide. The app-side guard now drops such a question rather
 * than projecting a claim it cannot honour — but dropping is a last resort:
 * the question is still lost. The real fix is that the model never writes one,
 * which is what this rule is for.
 *
 * The clause under test is the LATIN-VARIABLE one, because it is the part that
 * silently does nothing when wrong. `extractGraphCommands` matches `[a-z]`
 * terms, so «y = 2س + 1» extracts NOTHING and its question is dropped exactly
 * as if it had named no equations at all. A rule that told the model only to
 * "state the equations" would produce dutifully compliant questions that still
 * show an empty slide — the original bug, wearing a better sentence.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SYSTEM_AR, SYSTEM_EN, systemPrompt } from "../prompts.ts";

describe("figure rule", () => {
  it("reaches every generator, being in the shared system prompt", () => {
    // lesson-plan, worksheet, quiz and classroom-activity all pass these.
    assert.match(SYSTEM_AR, /قاعدة الرسوم والأشكال/);
    assert.match(SYSTEM_EN, /Figures and graphs/);
  });

  it("names the phrasings the model actually produced", () => {
    assert.match(SYSTEM_AR, /يمثل الرسم البياني/);
    assert.match(SYSTEM_EN, /the graph shows/i);
  });

  it("demands latin x and y — the clause that fails silently when absent", () => {
    assert.match(SYSTEM_AR, /اللاتيني/);
    assert.match(SYSTEM_AR, /y = 2x \+ 1/);
    assert.match(SYSTEM_EN, /latin x and y/);
    assert.match(SYSTEM_EN, /y = 2x \+ 1/);
  });

  it("shows no Arabic maths variable in its worked example", () => {
    // «س» or «ص» in the example would teach the form that extracts nothing.
    const example = /مثال صحيح:.*/u.exec(SYSTEM_AR)?.[0] ?? "";
    assert.ok(example.length > 0, "the Arabic rule carries a worked example");
    assert.ok(!/[سص]\s*[=+\-]/u.test(example), `Arabic variable in: ${example}`);
  });

  it("tells the model what to do instead, not only what to avoid", () => {
    // Without this the model's escape route is to drop graph questions
    // entirely, which costs the deck a whole class of question.
    assert.match(SYSTEM_AR, /فاكتبه بلا أي إشارة إلى رسم/);
    assert.match(SYSTEM_EN, /write it with no reference to a figure/);
  });
});

/**
 * The exception, and the flag that gates it.
 *
 * The rule above bans «في الشكل المجاور» — correctly, when the app has no
 * picture to show. But four subjects DO have the book's own crops printed in
 * the export appendix and the on-screen panel, and there the ban silently put
 * every circle-geometry, apparatus and Venn-diagram question out of scope.
 *
 * These assert the gate, not the wording, because the gate is the part that is
 * dangerous when wrong. Permission granted for a lesson with no figures
 * reproduces the original empty-reference bug in a new place, so the default
 * has to be denial and every non-count has to read as none.
 */
describe("book-figure exception", () => {
  const AR = { ar: true, en: false };

  it("is absent by default — a caller that says nothing gets the strict prompt", () => {
    assert.equal(systemPrompt(AR.ar), SYSTEM_AR);
    assert.equal(systemPrompt(AR.en), SYSTEM_EN);
    assert.equal(systemPrompt(AR.ar, {}), SYSTEM_AR);
  });

  it("is present only when the lesson actually has figures", () => {
    const withFigs = systemPrompt(AR.ar, { hasBookFigures: true });
    assert.match(withFigs, /أشكال الكتاب المدرسي/);
    assert.match(withFigs, /في الشكل المجاور/);
    assert.doesNotMatch(systemPrompt(AR.ar, { hasBookFigures: false }), /أشكال الكتاب المدرسي/);

    const en = systemPrompt(AR.en, { hasBookFigures: true });
    assert.match(en, /student-book figures/i);
    assert.match(en, /in the figure opposite/);
    assert.doesNotMatch(systemPrompt(AR.en, { hasBookFigures: false }), /student-book figures/i);
  });

  it("keeps the whole base prompt — the exception adds, never replaces", () => {
    // A rewrite that dropped the style rule or the latin-variable clause while
    // "loosening" the figure rule would pass every assertion above.
    const withFigs = systemPrompt(AR.ar, { hasBookFigures: true });
    assert.ok(withFigs.startsWith(SYSTEM_AR), "base prompt is intact and first");
    assert.match(withFigs, /y = 2x \+ 1/);
  });

  it("still refuses to let the model name or describe a figure it cannot see", () => {
    // The appendix is lesson-level and ordered by page, so «الشكل ٣» would be
    // a citation the model invented — the failure `figuresSectionHTML`
    // documents from the rendering side.
    assert.match(systemPrompt(AR.ar, { hasBookFigures: true }), /لا ترقّم الأشكال/);
    assert.match(systemPrompt(AR.en, { hasBookFigures: true }), /do not number the figures/i);
  });
});

/**
 * The one rule that asks for a visual instead of forbidding one.
 *
 * Both clauses name a format because both feed a miner that fails closed:
 * `extractChartData` refuses anything under three self-labelled values, and
 * `extractGraphCommands` matches `[a-z]` only. A vague "use visuals where
 * helpful" would satisfy a reader and change nothing measurable, which is
 * why these assert the specifics rather than the intent.
 */
describe("visual rule", () => {
  it("reaches every generator, being in the shared system prompt", () => {
    assert.match(SYSTEM_AR, /قابلًا للعرض/);
    assert.match(SYSTEM_EN, /projectable/i);
  });

  it("names the chart miner's actual threshold, not just 'use data'", () => {
    assert.match(SYSTEM_AR, /ثلاثة بنود على الأقل/);
    assert.match(SYSTEM_EN, /at least three items/i);
  });

  it("repeats the latin-variable requirement where it asks for a curve", () => {
    // The plot miner is the same `[a-z]` matcher as the figure rule's, so an
    // invitation to "state the equation" without this produces compliant
    // prose that plots nothing.
    assert.match(SYSTEM_AR, /بالحرفين اللاتينيين x و y/);
    assert.match(SYSTEM_EN, /using latin x and y/i);
  });

  it("asks for structure the renderers already have — tables and steps", () => {
    assert.match(SYSTEM_AR, /جدول/);
    assert.match(SYSTEM_EN, /table for comparisons/i);
  });
});
