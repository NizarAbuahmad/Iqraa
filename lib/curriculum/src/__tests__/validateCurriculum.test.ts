/**
 * Curriculum file validation.
 *
 * Phase one is grades 1–10 — roughly an order of magnitude more curriculum
 * than exists here today. At that volume nobody reads every file, and the
 * failure mode is silent: a lesson with no objectives generates ungrounded
 * while the screen still claims curriculum grounding.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  allValid,
  validateCurriculumFile,
  type CurriculumReport,
} from "../validateCurriculum.ts";

const lesson = (over: Record<string, unknown> = {}) => ({
  id: "u1_l1", order: 1, title_ar: "الاشتقاق", title_en: "Differentiation",
  objectives: ["إيجاد مشتقة كثيرة حدود"], vocabulary: ["المشتقة"], ...over,
});

const unit = (over: Record<string, unknown> = {}) => ({
  id: "u1", number: 1, title_ar: "المشتقات", title_en: "Derivatives",
  data_tier: "lesson-level (teacher guide)", prior_knowledge: ["الاقترانات"],
  lessons: [lesson()], ...over,
});

const doc = (over: Record<string, unknown> = {}) => ({
  meta: {
    grade: "الصف التاسع", subject: "العلوم",
    curriculum_authority: "NCCD", schema_version: "1.0",
    semester_covered: 1, source_books: { unit_1: "دليل المعلم" },
  },
  units: [unit()],
  ...over,
});

const run = (over?: Record<string, unknown>): CurriculumReport =>
  validateCurriculumFile("test.json", doc(over));

describe("structural errors — must block the file", () => {
  it("accepts a complete file", () => {
    const r = run();
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.gaps, []);
    assert.equal(r.lessons, 1);
    assert.equal(r.withObjectives, 1);
    assert.ok(allValid([r]));
  });

  it("rejects duplicate unit and lesson ids", () => {
    // Ids are how every lookup finds a lesson; a duplicate silently shadows.
    const dupUnits = run({ units: [unit(), unit({ title_ar: "أخرى" })] });
    assert.ok(dupUnits.errors.some((e) => /duplicate unit id/.test(e.message)));

    const dupLessons = run({
      units: [unit({ lessons: [lesson(), lesson({ title_ar: "درس آخر" })] })],
    });
    assert.ok(dupLessons.errors.some((e) => /duplicate lesson id/.test(e.message)));
  });

  it("rejects a missing Arabic title", () => {
    // Arabic is the product language: an English-only title renders as a blank
    // heading on an RTL screen rather than falling back to the English.
    assert.ok(run({ units: [unit({ title_ar: "  " })] })
      .errors.some((e) => /missing Arabic title/.test(e.message)));
    assert.ok(run({ units: [unit({ lessons: [lesson({ title_ar: "" })] })] })
      .errors.some((e) => /missing Arabic title/.test(e.message)));
  });

  it("rejects missing required meta and a file with no units", () => {
    const noMeta = validateCurriculumFile("x.json", { units: [unit()] });
    assert.ok(noMeta.errors.some((e) => e.path === "meta"));
    assert.ok(run({ units: [] }).errors.some((e) => e.path === "units"));
  });

  it("reports a non-object document rather than throwing", () => {
    for (const bad of [null, 42, "text", []]) {
      const r = validateCurriculumFile("x.json", bad);
      assert.ok(r.errors.length > 0, String(bad));
    }
  });
});

describe("content gaps — reported, never blocking", () => {
  it("counts a lesson with no outcomes as a gap, not an error", () => {
    // This is the case that matters: the file is structurally fine, the app
    // will happily serve the lesson, and nothing is grounding it.
    const r = run({ units: [unit({ lessons: [lesson({ objectives: [] })] })] });
    assert.deepEqual(r.errors, []);
    assert.equal(r.withObjectives, 0);
    assert.ok(r.gaps.some((g) => /no outcomes/.test(g.message)));
    assert.ok(allValid([r]), "gaps must not fail a run");
  });

  it("names the lesson in the gap so it is actionable", () => {
    const r = run({ units: [unit({ lessons: [lesson({ objectives: [] })] })] });
    assert.ok(r.gaps.some((g) => g.message.includes("الاشتقاق")));
  });

  it("flags missing provenance", () => {
    // Without data_tier there is no way to tell a teacher-guide-derived unit
    // from a plausible-looking invention.
    const r = run({ units: [unit({ data_tier: "" })] });
    assert.equal(r.unitsWithDataTier, 0);
    assert.ok(r.gaps.some((g) => /provenance tier/.test(g.message)));
    assert.ok(r.errors.length === 0);
  });

  it("flags a missing source book and missing prior knowledge", () => {
    assert.ok(run({ meta: { ...doc().meta, source_books: {} } })
      .gaps.some((g) => /no source book/.test(g.message)));
    assert.ok(run({ units: [unit({ prior_knowledge: [] })] })
      .gaps.some((g) => /prior_knowledge/.test(g.path)));
  });

  it("treats whitespace-only entries as absent", () => {
    const r = run({ units: [unit({ lessons: [lesson({ objectives: ["  ", ""] })] })] });
    assert.equal(r.withObjectives, 0);
  });
});
