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

  it("the Arabic table agrees the noun with the count; English is unchanged", () => {
    const table = Array.from({ length: 5 }, (_, i) => ({ code: `L${i + 1}`, id: `x${i}`, unitId: "U", title: `t${i + 1}` }));
    const slotsFor = (counts: number[]) => counts.flatMap((n, i) => Array.from({ length: n }, () => `L${i + 1}`));
    const body = { scope, distribution: "balanced", coverage: { lessons: table, slots: slotsFor([1, 2, 3, 10, 11]) } };
    const ar = coverageClauseAr(body);
    assert.ok(ar.includes("L1: t1 — سؤال واحد\n"), ar);
    assert.ok(ar.includes("L2: t2 — سؤالان\n"), ar);
    assert.ok(ar.includes("L3: t3 — 3 أسئلة\n"), ar);
    assert.ok(ar.includes("L4: t4 — 10 أسئلة\n"), ar);
    assert.ok(ar.includes("L5: t5 — 11 سؤالًا\n"), ar);
    const en = coverageClauseEn(body);
    assert.ok(en.includes("L1: t1 — 1 question\n") && en.includes("L2: t2 — 2 questions\n") && en.includes("L5: t5 — 11 questions\n"), en);
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
  const wide = (b: object): Record<string, unknown> => ({ ...base, ...b });

  it("carry the clause for a wide scope", () => {
    for (const p of [quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn]) {
      assert.ok(p(wide(balanced)).includes("L3"), `${p.name} lacks the lesson table`);
    }
  });

  const builders = [
    ["quizPromptAr", quizPromptAr, coverageClauseAr],
    ["quizPromptEn", quizPromptEn, coverageClauseEn],
    ["worksheetPromptAr", worksheetPromptAr, coverageClauseAr],
    ["worksheetPromptEn", worksheetPromptEn, coverageClauseEn],
  ] as const;

  it("the clause is the ONLY difference from the same request without coverage", () => {
    for (const [name, p, clauseOf] of builders) {
      // Worksheet builders pass the worked-example flag (Mathematics has one), quiz builders do not.
      const withExample = name.startsWith("worksheet");
      const body = wide(balanced);
      const clause = clauseOf(body, withExample);
      assert.ok(clause.length > 0, name);
      const { coverage: _c, scope: _s, distribution: _d, ...plain } = body;
      assert.equal(p(body).replace(clause, ""), p(plain), `${name}: more than the clause differs`);
      // Same with the scope but no coverage, and with context + prior review on the line the clause sits on.
      const ctx = { ...base, additionalContext: "ctx", includePriorReview: true, priorKnowledge: ["a"], numQuestions: 5 };
      const wideCtx = { ...ctx, ...balanced };
      assert.equal(p(wideCtx).replace(clauseOf(wideCtx, withExample), ""), p(ctx), `${name}: context/prior variant`);
    }
  });

  it("junk or over-limit coverage produces exactly the no-coverage prompt", () => {
    const junk = [
      { ...balanced, coverage: { lessons: Array.from({ length: 121 }, (_, i) => ({ code: `L${i + 1}`, title: "t" })) } },
      { ...balanced, coverage: { lessons: [{ code: "bad", title: "t" }] } },
      { ...balanced, coverage: "L1" },
      { ...balanced, coverage: null },
      { ...balanced, scope: { kind: "lesson", scopeKey: "k", unitIds: [] } },
    ];
    for (const [name, p] of builders) {
      for (const j of junk) {
        const { coverage: _c, scope: _s, distribution: _d, ...plain } = wide(j);
        assert.equal(p(wide(j)), p(plain), `${name} changed on junk coverage`);
      }
    }
  });

  it("a maths worksheet says the worked example counts toward the per-lesson numbers", () => {
    assert.match(worksheetPromptEn(wide(balanced)), /worked example and the question you ask the student to complete count toward/);
    assert.match(worksheetPromptAr(wide(balanced)), /المثال المحلول والسؤال الذي يُطلب من الطالب إكماله يُحسبان ضمن/);
    assert.match(worksheetPromptEn(wide(balanced)), /prior-knowledge review is in addition/);
  });

  it("a subject without a worked example, a quiz, homework and a random plan do not carry it", () => {
    const arabic = { ...wide(balanced), subject: "اللغة العربية" };
    assert.doesNotMatch(worksheetPromptEn(arabic), /worked example and the question/);
    assert.doesNotMatch(worksheetPromptAr(arabic), /المثال المحلول والسؤال/);
    assert.doesNotMatch(quizPromptEn(wide(balanced)), /worked example and the question/);
    assert.doesNotMatch(quizPromptAr(wide(balanced)), /المثال المحلول والسؤال/);
    assert.doesNotMatch(worksheetPromptEn(wide({ ...balanced, homework: true })), /worked example and the question/);
    assert.doesNotMatch(worksheetPromptEn(wide(random)), /worked example and the question/);
  });

  it("a random request renders as random even if slots were sent (the key says random)", () => {
    const mixed = { ...balanced, distribution: "random" };
    assert.equal(parseCoverage(mixed)!.counts, null);
    assert.match(coverageClauseEn(mixed), /at random/);
    assert.ok(!/ — \d+ question/.test(coverageClauseEn(mixed)));
    // absent distribution keeps the balanced rendering
    const { distribution: _d, ...absent } = balanced;
    assert.ok(parseCoverage(absent)!.counts !== null);
  });

  it("homework (a worksheet with homework:true) carries it too", () => {
    assert.ok(worksheetPromptAr(wide({ ...balanced, homework: true })).includes("L1"));
  });
});
