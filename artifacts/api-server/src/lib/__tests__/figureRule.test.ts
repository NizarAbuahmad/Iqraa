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

import { SYSTEM_AR, SYSTEM_EN } from "../prompts.ts";

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
