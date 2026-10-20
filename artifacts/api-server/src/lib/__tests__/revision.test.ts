/**
 * The revision clause of a wide-scope lesson plan, activity and classroom deck.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/revision.test.ts
 *
 * Three things are pinned: a request with no scope gets EXACTLY the prompt it
 * got before (the clause is the only difference, by `replace(clause, "")`
 * identity, as `coverage.test.ts` does for the quiz); the three kinds say
 * different things; and the clause renders nothing the strict cache key does
 * not hash (no `unitId`), so two requests that share a pooled slot share a
 * prompt.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { revisionClauseAr, revisionClauseEn } from "../revision.ts";
import { activityPromptAr, activityPromptEn, lessonPlanPromptAr, lessonPlanPromptEn } from "../prompts.ts";
import {
  CLASSROOM_ACTIVITY_TYPES, classroomActivityPrompt, classroomPromptAr, classroomPromptEn, classroomSetupClause,
} from "../classroomPrompts.ts";

const scope = { kind: "semester", scopeKey: "sem:grade-10:mathematics:1", unitIds: ["kbu-math-s1-nccd-u2"] };
const lessons = [
  { code: "L1", id: "x1", unitId: "U", title: "حل نظام مكوَّن من معادلة خطية ومعادلة تربيعية" },
  { code: "L2", id: "x2", unitId: "U", title: "حل المعادلة الأسية" },
  { code: "L3", id: "x3", unitId: "V", title: "الزوايا في الدائرة" },
];
const wideFields = { scope, coverage: { lessons } };
const base = {
  subject: "Mathematics", grade: "الصف العاشر", topic: "الفصل الأول كاملًا", duration: 45,
  additionalContext: "📚 النطاق: الفصل الأول كاملًا (18 درسًا)\n\nالوحدة: الأسس والمعادلات\n- حل المعادلة الأسية",
};
const KINDS = ["plan", "activity", "classroom"] as const;
const without = (b: Record<string, unknown>) => {
  const { scope: _s, coverage: _c, ...plain } = b;
  return plain;
};

describe("revisionClauseAr / revisionClauseEn", () => {
  it("is empty without a valid wide scope — a lesson request is untouched", () => {
    for (const kind of KINDS) {
      for (const b of [
        base,
        { ...base, coverage: { lessons } },                                  // a table but no scope
        { ...base, scope: { kind: "lesson", scopeKey: "lesson:x", unitIds: [] } },
        { ...base, scope: { kind: "semester", unitIds: [] } },               // no scopeKey
        { ...base, scope: "sem:grade-10:mathematics:1" },
      ]) {
        assert.equal(revisionClauseAr(b, kind), "", `${kind} ar`);
        assert.equal(revisionClauseEn(b, kind), "", `${kind} en`);
      }
    }
  });

  it("starts on its own line and lists the scope's lessons in book order", () => {
    for (const kind of KINDS) {
      const ar = revisionClauseAr({ ...base, ...wideFields }, kind);
      const en = revisionClauseEn({ ...base, ...wideFields }, kind);
      for (const c of [ar, en]) {
        assert.ok(c.startsWith("\n"), kind);
        const at = lessons.map(l => c.indexOf(`- ${l.title}`));
        assert.ok(at.every(i => i > 0), `${kind}: a lesson is missing`);
        assert.deepEqual([...at].sort((x, y) => x - y), at, `${kind}: not in table order`);
      }
    }
  });

  it("agrees the Arabic lesson count: 1, 2, 3–10, 11+", () => {
    const table = (n: number) => ({
      ...base, scope,
      coverage: { lessons: Array.from({ length: n }, (_, i) => ({ code: `L${i + 1}`, id: `x${i}`, unitId: "U", title: `t${i}` })) },
    });
    assert.ok(revisionClauseAr(table(1), "plan").includes("(درس واحد)"));
    assert.ok(revisionClauseAr(table(2), "plan").includes("(درسان)"));
    assert.ok(revisionClauseAr(table(3), "plan").includes("(3 دروس)"));
    assert.ok(revisionClauseAr(table(10), "plan").includes("(10 دروس)"));
    assert.ok(revisionClauseAr(table(11), "plan").includes("(11 درسًا)"));
    assert.ok(revisionClauseEn(table(11), "plan").includes("(11)"));
  });

  it("without a usable lesson table it still frames the session, but lists nothing", () => {
    const ar = revisionClauseAr({ ...base, scope, coverage: { lessons: [{ code: "bad", title: "t" }] } }, "plan");
    assert.ok(ar.length > 0);
    assert.ok(!ar.includes("دروس النطاق"));
  });

  it("each kind says something different, in both languages", () => {
    for (const clause of [revisionClauseAr, revisionClauseEn]) {
      const texts = KINDS.map(k => clause({ ...base, ...wideFields }, k));
      assert.equal(new Set(texts).size, KINDS.length);
    }
  });

  it("the plan asks for a round per unit and the left-out lessons in the introduction", () => {
    const ar = revisionClauseAr({ ...base, ...wideFields }, "plan");
    assert.match(ar, /جولةً لكل وحدة/);
    assert.match(ar, /"introduction"/);
    assert.match(ar, /صيغة المتكلم/);
    const en = revisionClauseEn({ ...base, ...wideFields }, "plan");
    assert.match(en, /one round per unit/);
    assert.match(en, /"introduction"/);
  });

  it("a scope may be a single unit: nothing says several units, and the plan's voice rule is where it really is", () => {
    for (const kind of KINDS) {
      const ar = revisionClauseAr({ ...base, ...wideFields }, kind);
      const en = revisionClauseEn({ ...base, ...wideFields }, kind);
      // Mutation caught: the old «عدة وحدات» / "several units" in the activity and classroom contracts.
      assert.doesNotMatch(ar, /عدة وحدات/, `${kind} ar`);
      assert.doesNotMatch(en, /several units/i, `${kind} en`);
    }
    for (const kind of ["activity", "classroom"] as const) {
      assert.match(revisionClauseAr({ ...base, ...wideFields }, kind), /وحدة أو أكثر/, `${kind} ar`);
      assert.match(revisionClauseEn({ ...base, ...wideFields }, kind), /one or more units/, `${kind} en`);
      // A single unit is spread over its lessons, not left without a share.
      assert.match(revisionClauseAr({ ...base, ...wideFields }, kind), /وحدة واحدة فوزّع/, `${kind} ar`);
      assert.match(revisionClauseEn({ ...base, ...wideFields }, kind), /single unit/, `${kind} en`);
    }
    // The teaching-style structure sits ABOVE the clause and the teacher's voice rule BELOW it.
    const wide = { ...base, teachingStyle: "direct", ...wideFields };
    const prompt = lessonPlanPromptAr(wide);
    const clause = revisionClauseAr(wide, "plan");
    const styleAt = prompt.indexOf("أسلوب التدريس");
    const voiceAt = prompt.indexOf("صيغة النص — بصيغة المتكلم");
    const clauseAt = prompt.indexOf(clause);
    assert.ok(styleAt >= 0 && styleAt < clauseAt && clauseAt < voiceAt, "probe: the prompt's order moved");
    // Mutation caught: «أعلاه» for the voice rule that follows the clause.
    assert.match(clause, /بنية أسلوب التدريس كما وردت أعلاه، وعلى صيغة المتكلم المستقبل للمعلم كما وردت أدناه/);
  });

  it("the activity rewords the textbook page for a revision only inside the clause", () => {
    assert.match(revisionClauseAr({ ...base, ...wideFields }, "activity"), /«صفحة الكتاب»/);
    assert.match(revisionClauseEn({ ...base, ...wideFields }, "activity"), /"the textbook page"/);
  });

  it("renders nothing derived from the table's unitId, which the cache key does not hash", () => {
    const moved = { ...base, scope, coverage: { lessons: lessons.map(l => ({ ...l, unitId: "elsewhere" })) } };
    for (const kind of KINDS) {
      assert.equal(revisionClauseAr(moved, kind), revisionClauseAr({ ...base, ...wideFields }, kind));
      assert.equal(revisionClauseEn(moved, kind), revisionClauseEn({ ...base, ...wideFields }, kind));
    }
  });
});

describe("the clause is the ONLY difference a scope makes to a prompt", () => {
  const STYLES = ["direct", "inquiry", "collaborative"];
  const FORMATS = ["individual", "group", "discussion", "hands-on", "game"];

  it("lesson plan, every style, with and without the extras on the clause's line", () => {
    for (const [p, clause] of [[lessonPlanPromptAr, revisionClauseAr], [lessonPlanPromptEn, revisionClauseEn]] as const) {
      for (const teachingStyle of STYLES) {
        for (const extra of [{}, { ministryRoles: true, objectives: "هدف", priorTopicsNotes: "ملاحظة" }, { subject: "Chemistry" }]) {
          const wide = { ...base, teachingStyle, ...extra, ...wideFields };
          const c = clause(wide, "plan");
          assert.ok(c.length > 0 && p(wide).includes(c), `${p.name}/${teachingStyle}: clause missing`);
          assert.equal(p(wide).replace(c, ""), p(without(wide)), `${p.name}/${teachingStyle}: more than the clause differs`);
        }
      }
    }
  });

  it("activity, every format and the warm-up", () => {
    for (const [p, clause] of [[activityPromptAr, revisionClauseAr], [activityPromptEn, revisionClauseEn]] as const) {
      for (const extra of [...FORMATS.map(activityType => ({ activityType })), { activityVariant: "warmup" }]) {
        const wide = { ...base, ...extra, ...wideFields };
        const c = clause(wide, "activity");
        assert.ok(c.length > 0 && p(wide).includes(c), `${p.name}: clause missing`);
        assert.equal(p(wide).replace(c, ""), p(without(wide)), `${p.name}/${JSON.stringify(extra)}`);
      }
    }
  });

  it("classroom deck, every type, both languages, both room setups", () => {
    for (const isAr of [true, false]) {
      for (const activityType of CLASSROOM_ACTIVITY_TYPES) {
        for (const classroomSetup of ["screen", "board"]) {
          const plain = { ...base, activityType, classroomSetup };
          // Without a scope: exactly what the route concatenated before.
          assert.equal(
            classroomActivityPrompt(plain, isAr),
            (isAr ? classroomPromptAr(plain) : classroomPromptEn(plain)) + classroomSetupClause(plain, isAr),
            `${activityType}/${isAr}: a lesson deck changed`,
          );
          const wide = { ...plain, ...wideFields };
          const c = (isAr ? revisionClauseAr : revisionClauseEn)(wide, "classroom");
          assert.ok(c.length > 0 && classroomActivityPrompt(wide, isAr).includes(c));
          assert.equal(classroomActivityPrompt(wide, isAr).replace(c, ""), classroomActivityPrompt(plain, isAr));
        }
      }
    }
  });
});
