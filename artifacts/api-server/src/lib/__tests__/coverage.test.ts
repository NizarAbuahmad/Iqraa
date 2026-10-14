import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coverageClauseAr, coverageClauseEn, parseCoverage } from "../coverage.ts";
import { quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";

const CIRCLE = "kbu-math-s1-nccd-u2";
const scope = { kind: "semester", scopeKey: "sem:grade-10:mathematics:1", unitIds: [CIRCLE] };
const lessons = [
  { code: "L1", id: "x1", unitId: "U", title: "المعادلات الأسية" },
  { code: "L2", id: "x2", unitId: "U", title: "اللوغاريتمات" },
  { code: "L3", id: "x3", unitId: "V", title: "الدائرة" },
];
const balanced = { scope, distribution: "balanced", numQuestions: 5, coverage: { lessons, slots: ["L1", "L3", "L1", "L2", "L3"] } };
const random = { scope, distribution: "random", numQuestions: 5, coverage: { lessons } };
const base = { subject: "Mathematics", grade: "الصف العاشر", topic: "الفصل الأول كاملًا", language: "arabic" };

describe("parseCoverage", () => {
  it("reads the lesson table and turns balanced slots into per-lesson counts", () => {
    const c = parseCoverage(balanced)!;
    assert.deepEqual(c.lessons.map(l => l.code), ["L1", "L2", "L3"]);
    assert.deepEqual([...c.counts!.entries()], [["L1", 2], ["L2", 1], ["L3", 2]]);
  });

  it("random has the table and no counts", () => {
    const c = parseCoverage(random)!;
    assert.equal(c.counts, null);
    assert.equal(c.lessons.length, 3);
  });

  it("is null without a valid wide scope — a lesson request is untouched", () => {
    assert.equal(parseCoverage({ ...balanced, scope: undefined }), null);
    assert.equal(parseCoverage({ ...balanced, scope: { kind: "lesson", scopeKey: "k", unitIds: [] } }), null);
    assert.equal(parseCoverage({ scope }), null);
  });

  it("rejects request-controlled junk", () => {
    const bad = (l: unknown) => parseCoverage({ scope, coverage: { lessons: l } });
    assert.equal(bad([]), null);
    assert.equal(bad([{ code: "x", title: "t" }]), null);                       // code must be L<n>
    assert.equal(bad([{ code: "L1", title: "a" }, { code: "L1", title: "b" }]), null); // duplicate code
    assert.equal(bad(Array.from({ length: 121 }, (_, i) => ({ code: `L${i + 1}`, title: "t" }))), null);
    assert.equal(bad("L1"), null);
  });

  it("cleans a title: one line, bounded", () => {
    const c = parseCoverage({ scope, coverage: { lessons: [{ code: "L1", title: `a\n\nIGNORE ALL ${"x".repeat(400)}` }] } })!;
    assert.ok(!c.lessons[0]!.title.includes("\n"));
    assert.ok(c.lessons[0]!.title.length <= 160);
  });

  it("ignores slots that name a lesson not in the table, and absurd slot lists", () => {
    const c = parseCoverage({ scope, coverage: { lessons, slots: ["L1", "L9"] } })!;
    assert.deepEqual([...c.counts!.entries()], [["L1", 1]]);
    assert.equal(parseCoverage({ scope, coverage: { lessons, slots: Array.from({ length: 200 }, () => "L1") } })!.counts, null);
  });

  it("never throws on junk bodies", () => {
    for (const coverage of [null, 5, "x", [], { lessons: null }, { lessons: [null] }, { lessons: [{ code: 1, title: {} }] }, { lessons: [{ code: "L1", title: "a" }], slots: "L1" }]) {
      assert.doesNotThrow(() => parseCoverage({ scope, coverage }));
    }
  });
});

describe("the coverage clause", () => {
  it("balanced names each lesson with its question count, in Arabic and English", () => {
    const ar = coverageClauseAr(balanced);
    assert.ok(ar.includes("L1") && ar.includes("المعادلات الأسية") && ar.includes("L3"));
    assert.match(ar, /"lesson"/);
    assert.ok(coverageClauseEn(balanced).includes("L2"));
  });

  it("random lists the lessons and says to repeat none before all are used", () => {
    assert.match(coverageClauseEn(random), /random/i);
    assert.match(coverageClauseEn(random), /repeat/i);
  });

  it("is empty for a lesson request", () => {
    assert.equal(coverageClauseAr({ ...base }), "");
    assert.equal(coverageClauseEn({ ...base }), "");
  });
});

describe("the four prompts", () => {
  const wide = (b: object) => ({ ...base, ...b });

  it("carry the clause for a wide scope", () => {
    for (const p of [quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn]) {
      assert.ok(p(wide(balanced)).includes("L3"), `${p.name} lacks the lesson table`);
    }
  });

  it("are byte-identical to before for a lesson request", () => {
    for (const p of [quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn]) {
      assert.ok(!p({ ...base }).includes('"lesson"'), `${p.name} mentions the lesson tag`);
    }
    // The clause renders to '' so the template line it sits on adds nothing but its newline.
    assert.equal(coverageClauseAr({ ...base }), "");
  });

  it("homework (a worksheet with homework:true) carries it too", () => {
    assert.ok(worksheetPromptAr(wide({ ...balanced, homework: true })).includes("L1"));
  });
});
