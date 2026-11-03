/**
 * The teaching style has to reach the prompt, and shape more than one field.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/lessonStylePrompts.test.ts
 *
 * Both builders used to interpolate the style's name into a single line and
 * stop — the English one passed the raw enum token (`inquiry`) rather than a
 * phrase. Nothing downstream told the model what an inquiry lesson or a
 * collaborative lesson structurally IS, so the live path had the same defect as
 * the offline generator. These clauses mirror
 * `artifacts/mobile/services/ai/lessonPlanBlueprints.ts`; change one, change
 * the other.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  lessonPlanPromptAr, lessonPlanPromptEn,
  lessonStyleClauseAr, lessonStyleClauseEn,
} from "../prompts.ts";

const base = { subject: "الرياضيات", grade: "العاشر", topic: "قانون الجيوب", duration: 45 };
const STYLES = ["direct", "inquiry", "collaborative", "5e"] as const;

describe("lesson-plan prompts differ per teaching style", () => {
  for (const [name, build] of [["ar", lessonPlanPromptAr], ["en", lessonPlanPromptEn]] as const) {
    it(`${name}: every style produces a different prompt`, () => {
      const prompts = STYLES.map(teachingStyle => build({ ...base, teachingStyle }));
      assert.equal(new Set(prompts).size, STYLES.length, `${name}: only ${new Set(prompts).size} distinct`);
    });

    it(`${name}: the clause covers the whole plan, not just mainActivity`, () => {
      const p = build({ ...base, teachingStyle: "collaborative" });
      assert.match(p, name === "ar" ? /في كل حقول الخطة/ : /across EVERY field of the plan/);
      // It must actually name the other phases it governs.
      assert.match(p, /guidedPractice/);
      assert.match(p, /independentPractice/);
    });

    it(`${name}: an unknown style falls back to direct rather than vanishing`, () => {
      const p = build({ ...base, teachingStyle: "socratic-seminar" });
      const direct = build({ ...base, teachingStyle: "direct" });
      assert.equal(p, direct);
    });
  }

  it("the style name is followed by its structure, not left standing alone", () => {
    // It used to be a lone `Teaching style: inquiry` line with nothing after
    // it — the model was told the label and never what it meant.
    const p = lessonPlanPromptEn({ ...base, teachingStyle: "inquiry" });
    assert.match(p, /Teaching style: inquiry\nThe structure this style requires/);
    assert.match(p, /The rule comes last, not first/);
  });
});

describe("each style's clause states what that style requires", () => {
  it("inquiry forbids opening with the rule", () => {
    assert.match(lessonStyleClauseAr({ teachingStyle: "inquiry" }), /ممنوع: أن تبدأ الحصة بتعريف القاعدة/);
    assert.match(lessonStyleClauseEn({ teachingStyle: "inquiry" }), /Forbidden: opening the lesson by stating the rule/);
  });

  it("collaborative forbids the exact self-contradiction the old plan carried", () => {
    assert.match(lessonStyleClauseAr({ teachingStyle: "collaborative" }), /المناقشة بين الطلبة مؤجّلة/);
    assert.match(lessonStyleClauseAr({ teachingStyle: "collaborative" }), /ممنوع تمامًا/);
    assert.match(lessonStyleClauseEn({ teachingStyle: "collaborative" }), /peer discussion is not permitted/);
    assert.match(lessonStyleClauseEn({ teachingStyle: "collaborative" }), /Strictly forbidden/);
  });

  it("direct is the only style whose independent stage is discussion-free", () => {
    const direct = lessonStyleClauseEn({ teachingStyle: "direct" });
    assert.match(direct, /Only here is independent practice individual and discussion-free/);
    for (const teachingStyle of ["inquiry", "collaborative"] as const) {
      assert.ok(
        !/discussion-free/.test(lessonStyleClauseEn({ teachingStyle })),
        `${teachingStyle} should not claim a discussion-free stage`,
      );
    }
  });

  it("collaborative demands individual accountability after the group work", () => {
    assert.match(lessonStyleClauseEn({ teachingStyle: "collaborative" }), /individual accountability AFTER the group work/i);
    assert.match(lessonStyleClauseAr({ teachingStyle: "collaborative" }), /مساءلة فردية/);
  });
});

describe("the 5E model's clause names the five stages and their order", () => {
  it("ar: Engage in the introduction, Explore before Explain, Elaborate, Evaluate", () => {
    const c = lessonStyleClauseAr({ teachingStyle: "5e" });
    assert.match(c, /نموذج 5E/);
    for (const stage of ["التشويق (Engage)", "الاستكشاف (Explore)", "التفسير (Explain)", "التوسّع (Elaborate)", "التقويم (Evaluate)"]) {
      assert.ok(c.includes(stage), `missing ${stage}`);
    }
    assert.ok(c.indexOf("الاستكشاف (Explore)") < c.indexOf("التفسير (Explain)"), "Explore must be stated before Explain");
    for (const field of ["introduction", "mainActivity", "guidedPractice", "independentPractice", "assessment"]) {
      assert.match(c, new RegExp(`"${field}"`), `the clause never says where the stages go: ${field}`);
    }
    assert.match(c, /ممنوع: أن تسمّي الفكرة أو المصطلح قبل مرحلة التفسير/);
  });

  it("en: the same contract", () => {
    const c = lessonStyleClauseEn({ teachingStyle: "5e" });
    assert.match(c, /^Teaching style: 5E model\n/);
    for (const stage of ["Engage", "Explore", "Explain", "Elaborate", "Evaluate"]) assert.ok(c.includes(stage), `missing ${stage}`);
    assert.ok(c.indexOf("Explore") < c.indexOf("Explain"), "Explore must be stated before Explain");
    assert.match(c, /Forbidden: naming the idea or the term before the Explain stage/);
  });

  it("neither language lets a 5E plan ban peer discussion or claim a discussion-free stage", () => {
    assert.ok(!/discussion-free/.test(lessonStyleClauseEn({ teachingStyle: "5e" })));
    assert.ok(!/المناقشة بين الطلبة مؤجّلة/.test(lessonStyleClauseAr({ teachingStyle: "5e" })));
  });

  it("only 5E labels the introduction as the Engage stage", () => {
    for (const teachingStyle of ["direct", "inquiry", "collaborative"] as const) {
      assert.ok(!lessonStyleClauseAr({ teachingStyle }).includes("التشويق (Engage)"), teachingStyle);
      assert.ok(!lessonStyleClauseEn({ teachingStyle }).includes("Engage"), teachingStyle);
    }
  });
});
