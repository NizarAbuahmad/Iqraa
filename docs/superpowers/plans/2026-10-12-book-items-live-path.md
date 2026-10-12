# Real Book Items on the Live Model Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maths evaluations written by the model also carry real, cited NCCD book questions (at most half the paper), behind a server flag that is off by default.

**Architecture:** In `POST /evaluations/:id/generate`'s live branch, `planBookDraw` decides how many book questions `k` the paper will carry, the model is asked for `count − k`, and `assembleLivePaper` cuts the model's surplus first, adds `k` book questions drawn so none is a near-duplicate of a model question, and sorts the combined list into the paper's type blocks. The existing, already-reviewed `bookQuestion` builder is exported and reused; the mock path is unchanged in behaviour.

**Tech Stack:** TypeScript run by `node --experimental-strip-types --test`, Express API (`artifacts/api-server`), the `@workspace/curriculum/bookItems` reader from PR #1021.

**Spec:** `docs/superpowers/specs/2026-10-12-book-items-live-path-design.md` (approved 2026-10-12). Builds on `2026-10-12-book-items-design.md` and the code in PR [#1021](https://github.com/NizarAbuahmad/Iqraa/pull/1021).

## Global Constraints

- **Off by default.** `BOOK_ITEMS_LIVE` is on only when it is exactly `"true"`, read per request. With it unset nothing about a production paper changes except one new `generationParams.bookItems` field on maths papers.
- At most `floor(count / 2)` book questions, never more than are eligible, only when the subject is `mathematics`, an objective has a `lessonId` with items, and a matching type (`multiple_choice` for unit-test choices, `short_answer` for exercises) was requested.
- Join by `objective.lessonId`, never by title. A `computed` book question must never carry a `check` (it would earn the «تم التحقق» badge).
- The model's surplus is cut **before** the book questions are added, so the route's own final trim has nothing left to cut when a book share exists. The combined list is then stably sorted into the paper's type blocks (order of `assessmentTypes`), because the model was told to lay the paper out in consecutive type blocks.
- No database schema change, no native module, no mobile change, no `app.json` `version` bump.
- Tests live inside `artifacts/api-server/src/**/__tests__/`; relative imports in node-tested code use explicit `.ts` extensions. Run `pnpm run build` before `pnpm test` in `artifacts/api-server` (the mount-order suite boots the built bundle).
- Commit messages end with the two attribution lines given in the session's system reminder. Implementers commit locally and never push; the controller pushes.

## Differences from the spec

| Spec said | This plan does | Why |
| --- | --- | --- |
| Book questions are "appended after the model's" | Book questions are sorted into the paper's type blocks (`typeOrder`) instead of appended | Found in the Task 3 review: appending split the ministry blocks. |
| The builder "moves out of `mockGenerator.ts`" | `bookQuestion` is **exported** and takes a `slot(kind)` function; the new live-path code is in `bookQuestions.ts` | Moving it would drag `buildRubric` and `BANK_TIER` along or create an import cycle, and re-review already-reviewed code, for no gain. |
| Test "flag off: byte-for-byte identical request and rows" | Pinned for the pure assembly (`k = 0` passes the model's paper through untouched) and by the typechecker for the route glue | The route handler needs auth, a database and an OpenAI stub; there is no existing harness for it. STATUS.md says so plainly and gives a manual check for after the flag is turned on. |

## Environment (once, before Task 1)

```bash
pnpm install --frozen-lockfile
pnpm run typecheck:libs
cd artifacts/api-server && pnpm run build
```

Baseline to hold: the API suite is **1563** passing before this work (1594 after: the 31 tests in `bookQuestions.test.ts`).

## File structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/modules/assessment/mockGenerator.ts` (modify) | Export `bookQuestion`; competency and marks come from a `slot(kind)` function instead of fixed arguments. |
| `artifacts/api-server/src/modules/assessment/bookQuestions.ts` (new) | `isBookItemsLiveOn`, `planBookDraw`, `drawBookQuestions`, `assembleLivePaper`, `previousBookItemIds`. |
| `artifacts/api-server/src/modules/assessment/__tests__/bookQuestions.test.ts` (new) | Plan, draw, regeneration, assembly. |
| `artifacts/api-server/src/routes/evaluations.ts` (modify) | The few lines that call them in the live branch. |
| `LOCAL_SETUP.md`, `STATUS.md`, `CLAUDE.md` (modify) | The flag and what is true now. |

---

### Task 1: Let the caller choose competency and marks by kind

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/mockGenerator.ts`

**Interfaces:**
- Consumes: the existing private `bookQuestion` and `buildBookQuestion` in that file.
- Produces: `export function bookQuestion(args: { objective; difficulty; slot: (kind: BookItemKind) => { competency: CompetencyKey; marks: number }; wantChoice; wantShort; session; rng; accepted }): GeneratedQuestion | null`. The mock loop passes `slot: () => ({ competency, marks })`.

This is a behaviour-preserving refactor: the existing tests are the safety net, so there is no new test.

- [ ] **Step 1: Confirm the baseline**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/bookItems.test.ts`
Expected: all pass (this file covers the mock path's book questions).

- [ ] **Step 2: Apply the change**

Apply to `artifacts/api-server/src/modules/assessment/mockGenerator.ts` (with `git apply` or by hand; the result must be exactly this, plus the `BookItemKind` type import shown at its top):

```diff
diff --git a/artifacts/api-server/src/modules/assessment/mockGenerator.ts b/artifacts/api-server/src/modules/assessment/mockGenerator.ts
index 775cc551..31cad405 100644
--- a/artifacts/api-server/src/modules/assessment/mockGenerator.ts
+++ b/artifacts/api-server/src/modules/assessment/mockGenerator.ts
@@ -34,6 +34,7 @@ import {
 } from "@workspace/curriculum";
 import {
   type BookItem,
+  type BookItemKind,
   bookCitation,
   bookStatusLabel,
   displayMath,
@@ -463,11 +464,15 @@ function bankMultipleChoice(
  * Returns null whenever the lesson has no item of a requested shape, so the
  * caller falls through to the generated bank exactly as it did before.
  */
-function bookQuestion(args: {
+export function bookQuestion(args: {
   objective: CurriculumObjective;
-  competency: CompetencyKey;
   difficulty: Difficulty;
-  marks: number;
+  /**
+   * Competency and marks for the item that was actually drawn. A function of
+   * the kind because the kind is only known once an item is taken: the mock
+   * path fixes both by slot, the live path by kind (see `bookQuestions.ts`).
+   */
+  slot: (kind: BookItemKind) => { competency: CompetencyKey; marks: number };
   wantChoice: boolean;
   wantShort: boolean;
   session: Set<string>;
@@ -480,7 +485,7 @@ function bookQuestion(args: {
    */
   accepted: readonly GeneratedQuestion[];
 }): GeneratedQuestion | null {
-  const { objective, competency, difficulty, marks, session, rng, accepted } = args;
+  const { objective, difficulty, session, rng, accepted } = args;
   const lessonId = objective.lessonId;
   if (!lessonId) return null;
   const tier = BANK_TIER[difficulty];
@@ -491,6 +496,7 @@ function bookQuestion(args: {
       (args.wantShort && takeBookItem({ lessonId, kind: "exercise", tier, session, rng })) ||
       null;
     if (!item) return null;
+    const { competency, marks } = args.slot(item.kind);
     const built = buildBookQuestion(item, objective, competency, difficulty, marks);
     // A malformed item is spent and the slot falls through, as before.
     if (!built) return null;
@@ -700,9 +706,8 @@ export function generateMockEvaluation(req: GenerationRequest): GenerationResult
       if (bookUsed < bookQuota) {
         const book = bookQuestion({
           objective,
-          competency,
           difficulty: req.difficulty,
-          marks,
+          slot: () => ({ competency, marks }),
           wantChoice: mcqAvailable,
           wantShort: available.includes("short_answer"),
           session: bookSession,
```

- [ ] **Step 3: Typecheck and re-run the mock-path tests**

Run: `cd artifacts/api-server && pnpm run typecheck && node --experimental-strip-types --test src/modules/assessment/__tests__/bookItems.test.ts src/modules/assessment/__tests__/bankMultipleChoice.test.ts src/modules/assessment/__tests__/mockVariation.test.ts`
Expected: typecheck prints no errors; every test passes.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/mockGenerator.ts
git commit -m "Export bookQuestion and let the caller pick competency and marks by kind"
```

---

### Task 2: Plan, draw and assemble

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/bookQuestions.ts`
- Create: `artifacts/api-server/src/modules/assessment/__tests__/bookQuestions.test.ts`

**Interfaces:**
- Consumes: Task 1's `bookQuestion`; `bookItemsForLesson` from `@workspace/curriculum/bookItems`; `MARKS_BY_COMPETENCY` from `./competency.ts`; `validateGenerated` (tests only).
- Produces (used by Task 3): `isBookItemsLiveOn(): boolean`; `planBookDraw(req: BookPlanRequest): number` (what a seeded dry run of the draw can deliver, capped at half the paper; `BookPlanRequest` takes an optional `difficulty`, default `"standard"`); `drawBookQuestions(req: BookDrawRequest): GeneratedQuestion[]`; `assembleLivePaper({ modelQuestions, requested, k, draw }): LivePaper` with `LivePaper = { questions; trimmed; drawn }`; `previousBookItemIds(previous): Set<string>`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/assessment/__tests__/bookQuestions.test.ts`:

```ts
/**
 * Real book questions on the live model path.
 *
 * What these pin:
 *  1. Nothing is planned or drawn unless the flag is on, the subject is maths,
 *     a lesson with items is selected and a matching type was requested.
 *  2. The plan is at most half the paper and never more than is eligible, and it
 *     is what the draw can DELIVER: near-duplicate book items are not both drawn,
 *     so counting raw items would ask the model for too few questions.
 *  3. A draw is never a near-duplicate of a model question, never an unrequested
 *     type, and never carries a `check`.
 *  4. A regeneration prefers items the teacher has not seen, and falls back to
 *     repeats before returning a short paper.
 *  5. The assembled paper is exactly as long as was asked, the model's surplus
 *     is cut BEFORE the book questions are added, and with no book questions the
 *     model's paper passes through untouched.
 *  6. With a `typeOrder` and at least one book question drawn, the combined paper
 *     is stably sorted into one block per type (the ministry layout the prompt
 *     asks for); with no `typeOrder`, or nothing drawn, nothing is reordered.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookItemsForLesson, displayMath } from "@workspace/curriculum/bookItems";
import type { CurriculumObjective } from "@workspace/curriculum";
import type { QuestionType } from "@workspace/db";
import {
  assembleLivePaper,
  drawBookQuestions,
  isBookItemsLiveOn,
  planBookDraw,
  previousBookItemIds,
} from "../bookQuestions.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { DUPLICATE_THRESHOLD, promptOf, stemSimilarity, validateGenerated } from "../validator.ts";
import { MARKS_BY_COMPETENCY } from "../competency.ts";

const SYSTEMS = "kbl-math-s1-nccd-u1_l1";
const DERIVATIVES = "kbl-math-s2-nccd-u6_l2";
/** Every lesson that has served book items (lib/curriculum/src/data/book-items/). */
const LESSONS_WITH_ITEMS = [SYSTEMS, "kbl-math-s1-nccd-u1_l2", DERIVATIVES];

const objective = (id: string, lessonId?: string): CurriculumObjective =>
  ({
    id,
    description: "objective",
    descriptionAr: "هدف",
    bloomsSource: "defaulted",
    skills: [],
    ...(lessonId ? { lessonId } : {}),
  }) as unknown as CurriculumObjective;

/** Deterministic rng so a failing draw is reproducible. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

/** A model-written question: distinct wording per index, valid for the validator. */
const modelQuestion = (i: number, objectiveId: string): GeneratedQuestion => ({
  type: "short_answer",
  body: { prompt: `سؤال رقم ${i}: اشرح باستعمال المفردة الخاصة ${"أ".repeat(i + 1)} كلمة مميزة${i}` },
  expectedAnswer: { modelAnswer: `إجابة ${i}`, keyConcepts: [`مفهوم${i}`] },
  rubric: { criteria: [{ label: "صحة", marks: 3 }] },
  objectiveId,
  competencyKey: "application",
  difficulty: "standard",
  marks: 3,
  skill: null,
  gradingMode: "ai_rubric",
  aiMetadata: { generator: "llm" },
});

const BOTH = ["multiple_choice", "short_answer"] as const;
const plan = (over: Partial<Parameters<typeof planBookDraw>[0]> = {}) =>
  planBookDraw({
    objectives: [objective("o1", SYSTEMS)],
    assessmentTypes: [...BOTH],
    count: 10,
    subjectId: "mathematics",
    enabled: true,
    ...over,
  });

const saved = process.env["BOOK_ITEMS_LIVE"];
afterEach(() => {
  if (saved === undefined) delete process.env["BOOK_ITEMS_LIVE"];
  else process.env["BOOK_ITEMS_LIVE"] = saved;
});

describe("isBookItemsLiveOn", () => {
  it("is on only for exactly 'true', read per call", () => {
    delete process.env["BOOK_ITEMS_LIVE"];
    assert.equal(isBookItemsLiveOn(), false);
    for (const v of ["1", "TRUE", "yes", "", "false"]) {
      process.env["BOOK_ITEMS_LIVE"] = v;
      assert.equal(isBookItemsLiveOn(), false, v);
    }
    process.env["BOOK_ITEMS_LIVE"] = "true";
    assert.equal(isBookItemsLiveOn(), true);
  });
});

describe("planBookDraw", () => {
  it("plans nothing unless every condition holds", () => {
    assert.ok(plan() > 0, "the baseline must plan something");
    assert.equal(plan({ enabled: false }), 0, "flag off");
    assert.equal(plan({ subjectId: "chemistry" }), 0, "not maths");
    assert.equal(plan({ subjectId: undefined }), 0, "no subject");
    assert.equal(plan({ objectives: [objective("o1")] }), 0, "no lessonId");
    assert.equal(plan({ objectives: [objective("o1", "kbl-math-s1-nccd-u4_l1")] }), 0, "lesson without items");
    assert.equal(plan({ assessmentTypes: ["true_false", "fill_blank"] }), 0, "no matching type");
  });

  it("is at most half the paper", () => {
    assert.equal(plan({ count: 1 }), 0);
    assert.equal(plan({ count: 4 }), 2);
    assert.equal(plan({ count: 7 }), 3);
  });

  it("is never more than what is eligible, counted per requested type", () => {
    const only = (kind: "exercise" | "unit-test-mcq") =>
      bookItemsForLesson(DERIVATIVES).filter(i => i.kind === kind).length;
    assert.equal(plan({ objectives: [objective("o1", DERIVATIVES)], assessmentTypes: ["short_answer"], count: 100 }), only("exercise"));
    // Derivatives have no unit-test choices, so asking only for choices plans none.
    assert.equal(plan({ objectives: [objective("o1", DERIVATIVES)], assessmentTypes: ["multiple_choice"], count: 100 }), only("unit-test-mcq"));
  });

  it("plans what the draw can deliver, not how many items are eligible", () => {
    const o = [objective("o1", SYSTEMS)];
    const eligibleShort = bookItemsForLesson(SYSTEMS).filter(i => i.kind === "exercise").length;
    const planned = plan({ objectives: o, assessmentTypes: ["short_answer"], count: 40 });
    // The eight exercises are systems that read as near-duplicates of each other.
    assert.equal(eligibleShort, 8);
    assert.equal(planned, 4);
  });

  it("every lesson with book items: a draw of the planned size delivers exactly the plan", () => {
    const typeSets = [[...BOTH], ["short_answer"], ["multiple_choice"]] as const;
    for (const lesson of LESSONS_WITH_ITEMS) {
      assert.ok(bookItemsForLesson(lesson).length > 0, `${lesson} must have items`);
      for (const types of typeSets) {
        const o = [objective("o1", lesson)];
        const k = plan({ objectives: o, assessmentTypes: [...types], count: 40 });
        for (let seed = 1; seed <= 15; seed += 1) {
          const drawn = drawBookQuestions({
            objectives: o, assessmentTypes: [...types], difficulty: "standard",
            k, accepted: [], rng: lcg(seed),
          });
          assert.equal(drawn.length, k, `${lesson} [${types.join("+")}] seed ${seed}: planned ${k}, drew ${drawn.length}`);
        }
      }
    }
  });

  it("plans the same for the same request, and the plan holds at every difficulty", () => {
    // Today the plan does not vary with difficulty (tier only changes WHICH items
    // are drawn, not how many), so this pins plan == draw, not that it is read.
    assert.equal(plan({ count: 40 }), plan({ count: 40 }));
    for (const difficulty of ["basic", "standard", "advanced"] as const) {
      const o = [objective("o1", SYSTEMS)];
      const k = plan({ objectives: o, count: 40, difficulty });
      const drawn = drawBookQuestions({
        objectives: o, assessmentTypes: [...BOTH], difficulty, k, accepted: [], rng: lcg(5),
      });
      assert.equal(drawn.length, k, difficulty);
    }
  });

  it("counts a lesson once however many objectives point at it", () => {
    const one = plan({ count: 100 });
    const two = plan({ count: 100, objectives: [objective("o1", SYSTEMS), objective("o2", SYSTEMS)] });
    assert.equal(two, one);
  });
});

describe("drawBookQuestions", () => {
  const draw = (over: Partial<Parameters<typeof drawBookQuestions>[0]> = {}) =>
    drawBookQuestions({
      objectives: [objective("o1", SYSTEMS)],
      assessmentTypes: [...BOTH],
      difficulty: "standard",
      k: 4,
      accepted: [],
      rng: lcg(7),
      ...over,
    });

  it("draws k distinct, labelled book questions with no check", () => {
    const qs = draw();
    assert.equal(qs.length, 4);
    assert.equal(new Set(qs.map(q => q.aiMetadata["bookItemId"])).size, 4);
    for (const q of qs) {
      assert.equal(q.aiMetadata["generator"], "book");
      assert.equal(q.check ?? null, null);
    }
  });

  it("assigns competency and marks by kind", () => {
    for (const q of draw({ k: 6 })) {
      if (q.type === "multiple_choice") {
        assert.deepEqual([q.competencyKey, q.marks], ["understanding", MARKS_BY_COMPETENCY["understanding"]]);
      } else {
        assert.deepEqual([q.competencyKey, q.marks], ["application", MARKS_BY_COMPETENCY["application"]]);
      }
    }
  });

  it("draws only the requested types", () => {
    assert.ok(draw({ assessmentTypes: ["short_answer"], k: 5 }).every(q => q.type === "short_answer"));
    assert.ok(draw({ assessmentTypes: ["multiple_choice"], k: 5 }).every(q => q.type === "multiple_choice"));
    assert.deepEqual(draw({ assessmentTypes: ["true_false"] }), []);
  });

  it("returns nothing for k <= 0 or objectives without a lesson", () => {
    assert.deepEqual(draw({ k: 0 }), []);
    assert.deepEqual(draw({ objectives: [objective("o1")] }), []);
  });

  it("stops short, rather than looping, when the pool is spent", () => {
    const qs = draw({ k: 500 });
    assert.ok(qs.length > 0 && qs.length < 500, `${qs.length} drawn`);
  });

  it("is reproducible for a seed", () => {
    const ids = (seed: number) => draw({ rng: lcg(seed) }).map(q => q.aiMetadata["bookItemId"]);
    assert.deepEqual(ids(11), ids(11));
  });

  it("prefers items the teacher has not seen, and falls back to repeats before coming up short", () => {
    const first = draw({ k: 3 });
    const seen = new Set(first.map(q => String(q.aiMetadata["bookItemId"])));
    const next = draw({ k: 3, avoidIds: seen });
    assert.equal(next.length, 3);
    assert.ok(next.every(q => !seen.has(String(q.aiMetadata["bookItemId"]))), "should have preferred unseen items");

    const everything = new Set(bookItemsForLesson(SYSTEMS).map(i => i.id));
    const repeated = draw({ k: 3, avoidIds: everything });
    assert.equal(repeated.length, 3, "all seen: repeats are better than a short paper");
  });

  it("never draws a book item the model has already written (clash against MODEL questions)", () => {
    const asModelQuestion = (instruction: string, stem: string): GeneratedQuestion => ({
      ...modelQuestion(0, "o1"),
      // Exactly the text `promptOf` reads from a book question's body.
      body: { prompt: displayMath(`${instruction}\n${stem}`) },
    });
    for (let seed = 1; seed <= 10; seed += 1) {
      const free = draw({ assessmentTypes: ["short_answer"], k: 8, rng: lcg(seed) });
      assert.ok(free.length > 0);
      const target = free[0]!;
      const item = bookItemsForLesson(SYSTEMS).find(i => i.id === target.aiMetadata["bookItemId"])!;
      const model = asModelQuestion(item.instruction, item.stem);
      // The model question really is what the validator would call a duplicate.
      assert.ok(stemSimilarity(promptOf(model), promptOf(target)) > DUPLICATE_THRESHOLD);

      const again = draw({ assessmentTypes: ["short_answer"], k: 8, rng: lcg(seed), accepted: [model] });
      const ids = again.map(q => q.aiMetadata["bookItemId"]);
      assert.ok(!ids.includes(item.id), `seed ${seed}: drew ${item.id} although the model already wrote it`);
      const { rejected } = validateGenerated([model, ...again], { allowedObjectiveIds: ["o1"], allowedTypes: [...BOTH] });
      assert.deepEqual(rejected, [], `seed ${seed}`);
    }
  });

  it("clash check covers multiple choice too: the only choice item is withheld when the model wrote it", () => {
    const [mcq] = bookItemsForLesson(SYSTEMS).filter(i => i.kind === "unit-test-mcq");
    assert.ok(mcq);
    const model: GeneratedQuestion = {
      ...modelQuestion(0, "o1"),
      body: { prompt: displayMath(`${mcq.instruction}\n${mcq.stem}`) },
    };
    assert.equal(draw({ assessmentTypes: ["multiple_choice"], k: 1 }).length, 1, "control: drawn without the clash");
    assert.deepEqual(draw({ assessmentTypes: ["multiple_choice"], k: 1, accepted: [model] }), []);
  });

  it("a partly seen lesson: unseen items first, then repeats, never twice and never a clash", () => {
    for (const lesson of [DERIVATIVES, SYSTEMS]) {
      const o = [objective("o1", lesson)];
      const items = bookItemsForLesson(lesson).filter(i => i.kind === "exercise");
      const free = (seed: number, avoidIds?: ReadonlySet<string>, k = 40) =>
        drawBookQuestions({
          objectives: o, assessmentTypes: ["short_answer"], difficulty: "standard",
          k, accepted: [], avoidIds, rng: lcg(seed),
        });
      for (let seed = 1; seed <= 20; seed += 1) {
        // See half the lesson, then ask for more than the unseen half can supply.
        const seen = new Set(items.slice(0, Math.ceil(items.length / 2)).map(i => i.id));
        const unseenDrawable = free(seed, new Set(items.slice(0, Math.ceil(items.length / 2)).map(i => i.id)), 1000)
          .filter(q => !seen.has(String(q.aiMetadata["bookItemId"])));
        const k = unseenDrawable.length + 2;
        const out = free(seed, seen, k);
        const ids = out.map(q => String(q.aiMetadata["bookItemId"]));
        assert.equal(out.length, k, `${lesson} seed ${seed}: short of ${k}`);
        assert.equal(new Set(ids).size, ids.length, `${lesson} seed ${seed}: an item came twice: ${ids}`);
        // Unseen items lead; only then do repeats follow.
        const firstSeen = ids.findIndex(id => seen.has(id));
        assert.ok(firstSeen === -1 || ids.slice(0, firstSeen).every(id => !seen.has(id)));
        assert.ok(ids.slice(0, unseenDrawable.length).every(id => !seen.has(id)), `${lesson} seed ${seed}: a repeat came before the unseen ones ran out`);
        // The repeats are not near-duplicates of what came before them either.
        for (let i = 0; i < out.length; i += 1) {
          for (let j = 0; j < i; j += 1) {
            assert.ok(
              stemSimilarity(promptOf(out[i]!), promptOf(out[j]!)) <= DUPLICATE_THRESHOLD,
              `${lesson} seed ${seed}: ${ids[i]} clashes with ${ids[j]}`,
            );
          }
        }
      }
    }
  });

  it("is never rejected by the validator against model questions, over many seeds", () => {
    for (const lesson of [SYSTEMS, "kbl-math-s1-nccd-u1_l2", DERIVATIVES]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const o = objective("o1", lesson);
        const model = [0, 1, 2, 3, 4].map(i => modelQuestion(i, "o1"));
        const book = drawBookQuestions({
          objectives: [o], assessmentTypes: [...BOTH], difficulty: "standard",
          k: 5, accepted: model, rng: lcg(seed),
        });
        assert.ok(book.length > 0, `${lesson} seed ${seed}: nothing drawn, so this proves nothing`);
        const { rejected } = validateGenerated([...model, ...book], {
          allowedObjectiveIds: ["o1"],
          allowedTypes: [...BOTH],
        });
        assert.deepEqual(rejected, [], `${lesson} seed ${seed}: ${JSON.stringify(rejected)}`);
      }
    }
  });
});

describe("assembleLivePaper", () => {
  const model = (n: number) => Array.from({ length: n }, (_, i) => modelQuestion(i, "o1"));
  const bookFor = (accepted: readonly GeneratedQuestion[], k: number) =>
    drawBookQuestions({
      objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], difficulty: "standard",
      k, accepted, rng: lcg(3),
    });

  it("with no book questions planned, passes the model's paper through untouched", () => {
    const m = model(12);
    const out = assembleLivePaper({ modelQuestions: m, requested: 10, k: 0, draw: () => assert.fail("must not draw") });
    assert.deepEqual(out.questions, m);
    assert.equal(out.trimmed, 0);
    assert.equal(out.drawn, 0);
  });

  it("is exactly as long as asked, model first, book after", () => {
    const out = assembleLivePaper({ modelQuestions: model(6), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.questions.length, 10);
    assert.deepEqual(out.questions.slice(0, 6).map(q => q.aiMetadata["generator"]), Array(6).fill("llm"));
    assert.deepEqual(out.questions.slice(6).map(q => q.aiMetadata["generator"]), Array(4).fill("book"));
    assert.equal(out.drawn, 4);
  });

  it("cuts the model's surplus BEFORE adding the book questions", () => {
    const out = assembleLivePaper({ modelQuestions: model(9), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.trimmed, 3, "9 returned, 6 allowed");
    assert.equal(out.questions.length, 10);
    assert.equal(out.questions.filter(q => q.aiMetadata["generator"] === "book").length, 4, "no book question was cut");
  });

  it("hands the draw only the questions that survive the cut", () => {
    let seen = -1;
    assembleLivePaper({ modelQuestions: model(9), requested: 10, k: 4, draw: a => { seen = a.length; return []; } });
    assert.equal(seen, 6);
  });

  it("keeps every book question when the model delivers fewer than asked", () => {
    const out = assembleLivePaper({ modelQuestions: model(2), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.questions.length, 6);
    assert.equal(out.drawn, 4);
  });

  describe("type blocks (typeOrder)", () => {
    const ORDER = ["multiple_choice", "short_answer", "true_false"] as const;
    /** A model question of a given type; `tag` makes its position recognisable. */
    const typed = (type: QuestionType, tag: number): GeneratedQuestion => ({
      ...modelQuestion(tag, "o1"),
      type,
    });
    const typesOf = (qs: readonly GeneratedQuestion[]) => qs.map(q => q.type);
    /** Every type forms ONE run: no type appears again after another type began. */
    const runsOf = (qs: readonly GeneratedQuestion[]) => {
      const runs: QuestionType[] = [];
      for (const q of qs) if (runs[runs.length - 1] !== q.type) runs.push(q.type);
      return runs;
    };
    /** Book questions the draw returns, with the given types, in the given order. */
    const fakeBook = (types: readonly QuestionType[]): GeneratedQuestion[] =>
      types.map((t, i) => ({
        ...modelQuestion(100 + i, "o1"),
        type: t,
        aiMetadata: { generator: "book", bookItemId: `bi-${i}` },
      }));
    const tagOf = (q: GeneratedQuestion) => String(q.aiMetadata["generator"] === "book" ? q.aiMetadata["bookItemId"] : q.body["prompt"]);

    it("the split-block example: MCQ x2, short x2, T/F x1 plus 5 short book questions is one run per type", () => {
      // The model wrote its share (5) in the order the prompt asked for.
      const m = [typed("multiple_choice", 0), typed("multiple_choice", 1), typed("short_answer", 2), typed("short_answer", 3), typed("true_false", 4)];
      const book = fakeBook(Array(5).fill("short_answer"));
      const out = assembleLivePaper({
        modelQuestions: m, requested: 10, k: 5, draw: () => book, typeOrder: ORDER,
      });
      assert.equal(out.questions.length, 10);
      assert.deepEqual(runsOf(out.questions), [...ORDER], "each type is one consecutive block, in typeOrder");
      assert.deepEqual(
        typesOf(out.questions),
        [...Array(2).fill("multiple_choice"), ...Array(7).fill("short_answer"), "true_false"],
      );
      assert.equal(out.drawn, 5);
      assert.equal(out.trimmed, 0);
    });

    it("is a stable sort: each source keeps its within-type order, and the model comes before the book within a type", () => {
      const m = [typed("short_answer", 0), typed("multiple_choice", 1), typed("short_answer", 2), typed("multiple_choice", 3)];
      const book = fakeBook(["short_answer", "multiple_choice", "short_answer"]);
      const out = assembleLivePaper({
        modelQuestions: m, requested: 7, k: 3, draw: () => book, typeOrder: ORDER,
      });
      const mcqPrompt = (i: number) => String(m[i]!.body["prompt"]);
      assert.deepEqual(out.questions.map(tagOf), [
        // multiple_choice: model 1, model 3, then book bi-1
        mcqPrompt(1), mcqPrompt(3), "bi-1",
        // short_answer: model 0, model 2, then book bi-0, bi-2
        mcqPrompt(0), mcqPrompt(2), "bi-0", "bi-2",
      ]);
    });

    it("a type missing from typeOrder sorts last and keeps its relative order", () => {
      const m = [typed("fill_blank", 0), typed("short_answer", 1), typed("fill_blank", 2)];
      const book = fakeBook(["short_answer"]);
      const out = assembleLivePaper({
        modelQuestions: m, requested: 4, k: 1, draw: () => book, typeOrder: ["short_answer"],
      });
      assert.deepEqual(typesOf(out.questions), ["short_answer", "short_answer", "fill_blank", "fill_blank"]);
      assert.deepEqual(out.questions.slice(2).map(tagOf), [String(m[0]!.body["prompt"]), String(m[2]!.body["prompt"])]);
    });

    it("k = 0 passes the model's paper through untouched, even when it is out of type order", () => {
      const m = [typed("true_false", 0), typed("multiple_choice", 1), typed("short_answer", 2), typed("multiple_choice", 3)];
      const out = assembleLivePaper({
        modelQuestions: m, requested: 4, k: 0, draw: () => assert.fail("must not draw"), typeOrder: ORDER,
      });
      assert.deepEqual(out.questions, m);
      assert.deepEqual(typesOf(out.questions), ["true_false", "multiple_choice", "short_answer", "multiple_choice"]);
    });

    it("k > 0 but nothing drawn: the model's questions keep their order, even when out of type order", () => {
      const m = [typed("true_false", 0), typed("multiple_choice", 1), typed("short_answer", 2), typed("multiple_choice", 3)];
      const out = assembleLivePaper({
        modelQuestions: m, requested: 6, k: 2, draw: () => [], typeOrder: ORDER,
      });
      assert.deepEqual(out.questions, m);
      assert.equal(out.drawn, 0);
    });

    it("without a typeOrder the book questions are appended, as before", () => {
      const m = [typed("true_false", 0), typed("multiple_choice", 1)];
      const book = fakeBook(["multiple_choice", "short_answer"]);
      const out = assembleLivePaper({ modelQuestions: m, requested: 4, k: 2, draw: () => book });
      assert.deepEqual(out.questions, [...m, ...book]);
    });
  });
});

describe("previousBookItemIds", () => {
  it("collects the ids of earlier book questions and ignores everything else", () => {
    const ids = previousBookItemIds([
      { aiMetadata: { generator: "book", bookItemId: "bi-a" } },
      { aiMetadata: { generator: "llm" } },
      { aiMetadata: null },
      { aiMetadata: { bookItemId: 5 } },
    ]);
    assert.deepEqual([...ids], ["bi-a"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/bookQuestions.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../bookQuestions.ts`.

- [ ] **Step 3: Write the module**

Create `artifacts/api-server/src/modules/assessment/bookQuestions.ts`:

```ts
/**
 * Real book questions on the live model path.
 *
 * The model writes the paper as it always has; this adds real NCCD questions
 * after it, deterministically, so they arrive word for word with their citation
 * and the model can neither reword them nor change their answers. The builder
 * itself is `bookQuestion` in `mockGenerator.ts`, shared with the mock path.
 *
 * Design: docs/superpowers/specs/2026-10-12-book-items-live-path-design.md.
 *
 * Ordering is the whole point of `assembleLivePaper`: the model's surplus is cut
 * BEFORE the book questions are added (so none of them is ever the one cut), and
 * the combined paper is then put into the ministry's type blocks.
 */
import { bookItemsForLesson } from "@workspace/curriculum/bookItems";
import type { CurriculumObjective } from "@workspace/curriculum";
import type { Difficulty, QuestionType } from "@workspace/db";
import { MARKS_BY_COMPETENCY, type CompetencyKey } from "./competency.ts";
import { bookQuestion, type GeneratedQuestion } from "./mockGenerator.ts";

/**
 * Off unless exactly "true", like `AI_LIVE_MODE`, and read per request. Off by
 * default so merging changes nothing in production until a person has compared
 * the served items with the printed books.
 */
export function isBookItemsLiveOn(): boolean {
  return process.env["BOOK_ITEMS_LIVE"] === "true";
}

export interface BookPlanRequest {
  objectives: readonly CurriculumObjective[];
  assessmentTypes: readonly QuestionType[];
  /** The number of questions the teacher asked for. */
  count: number;
  subjectId: string | undefined;
  enabled: boolean;
  /** The paper's difficulty; it picks the tier the dry run draws from. Defaults to "standard". */
  difficulty?: Difficulty;
}

/** Small seeded generator, so the dry run in `planBookDraw` is the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How many book questions this paper will carry, decided BEFORE the model is
 * asked so it can be asked for that many fewer. This is what the draw can
 * DELIVER, not how many items are eligible: two book items whose stems are
 * near-duplicates of each other are never both drawn (the validator would
 * reject the second), so counting raw items asks the model for too few
 * questions and the paper comes back short with the pool not exhausted. The
 * number comes from a dry run of the real draw with a fixed seed. It still
 * draws nothing for the paper. At most half the paper, as on the mock path.
 */
export function planBookDraw(req: BookPlanRequest): number {
  if (!req.enabled || req.subjectId !== "mathematics") return 0;
  const wantChoice = req.assessmentTypes.includes("multiple_choice");
  const wantShort = req.assessmentTypes.includes("short_answer");
  if (!wantChoice && !wantShort) return 0;

  const lessons = new Set<string>();
  for (const o of req.objectives) if (o.lessonId) lessons.add(o.lessonId);
  let eligible = 0;
  for (const lessonId of lessons) {
    for (const item of bookItemsForLesson(lessonId)) {
      if (item.kind === "unit-test-mcq" ? wantChoice : wantShort) eligible += 1;
    }
  }
  const cap = Math.max(0, Math.min(Math.floor(req.count / 2), eligible));
  if (cap === 0) return 0;
  const dry = drawBookQuestions({
    objectives: req.objectives,
    assessmentTypes: req.assessmentTypes,
    difficulty: req.difficulty ?? "standard",
    k: cap,
    accepted: [],
    rng: mulberry32(1),
  });
  return Math.min(cap, dry.length);
}

/**
 * Competency and marks by kind. Nominal, and stated as such: the model chooses
 * these for its own questions, and a book item's cognitive demand is not read
 * from the book. Solving a system is application; picking the satisfying pair
 * is understanding.
 */
const SLOT: Record<"exercise" | "unit-test-mcq", CompetencyKey> = {
  exercise: "application",
  "unit-test-mcq": "understanding",
};
const liveSlot = (kind: "exercise" | "unit-test-mcq") => ({
  competency: SLOT[kind],
  marks: MARKS_BY_COMPETENCY[SLOT[kind]],
});

export interface BookDrawRequest {
  objectives: readonly CurriculumObjective[];
  assessmentTypes: readonly QuestionType[];
  difficulty: Difficulty;
  /** From `planBookDraw`. */
  k: number;
  /** The model's questions, so a book question is never a near-duplicate of one. */
  accepted: readonly GeneratedQuestion[];
  /** Book item ids the teacher has already been shown (a regeneration). */
  avoidIds?: ReadonlySet<string>;
  rng: () => number;
}

const idOf = (q: GeneratedQuestion) => String(q.aiMetadata["bookItemId"] ?? "");

/** Fisher–Yates on the supplied rng, so a seeded run is reproducible. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function drawPass(
  req: BookDrawRequest,
  want: number,
  session: Set<string>,
  already: readonly GeneratedQuestion[],
): GeneratedQuestion[] {
  const wantChoice = req.assessmentTypes.includes("multiple_choice");
  const wantShort = req.assessmentTypes.includes("short_answer");
  const order = shuffled(req.objectives.filter(o => o.lessonId), req.rng);
  const out: GeneratedQuestion[] = [];
  while (out.length < want) {
    let drew = false;
    for (const objective of order) {
      if (out.length >= want) break;
      const q = bookQuestion({
        objective,
        difficulty: req.difficulty,
        slot: liveSlot,
        wantChoice,
        wantShort,
        session,
        rng: req.rng,
        accepted: [...already, ...out],
      });
      if (q) {
        out.push(q);
        drew = true;
      }
    }
    // A whole pass that drew nothing means the pools are spent: stop, short.
    if (!drew) break;
  }
  return out;
}

/**
 * Draw up to `k` book questions, round-robin over the objectives, never one that
 * the validator would reject as a near-duplicate of `accepted`. A regeneration
 * prefers items the teacher has not seen and falls back to repeats before it
 * would hand back a short paper: a repeated real question is acceptable.
 */
export function drawBookQuestions(req: BookDrawRequest): GeneratedQuestion[] {
  if (req.k <= 0) return [];
  const first = drawPass(req, req.k, new Set(req.avoidIds ?? []), req.accepted);
  if (first.length >= req.k || !req.avoidIds || req.avoidIds.size === 0) return first;
  const spent = new Set(first.map(idOf));
  const second = drawPass(req, req.k - first.length, spent, [...req.accepted, ...first]);
  return [...first, ...second];
}

export interface LivePaper {
  questions: GeneratedQuestion[];
  /** Model questions cut because the paper would otherwise exceed what was asked. */
  trimmed: number;
  drawn: number;
}

/**
 * The model's questions plus the book's, exactly `requested` long when the
 * model delivered. With `k === 0` the model's questions pass through UNTOUCHED,
 * so the flag being off is byte-for-byte the behaviour before this existed.
 *
 * Block order: the model is told to lay the paper out as a ministry exam does,
 * each question type in ONE consecutive block, in the order of
 * `evaluation.assessmentTypes`. Appending the book's questions at the end would
 * split a block (MCQ, short, T/F, then short again). So, when `typeOrder` is
 * given and at least one book question was drawn, the combined list is stably
 * sorted by each question's `type` index in `typeOrder`. Stable means each
 * source keeps its own within-type order and, within a type, the model's
 * questions come before the book's. A type missing from `typeOrder` sorts last,
 * in relative order. With `k <= 0`, nothing drawn, or no `typeOrder`, nothing is
 * reordered, so the model's own order is never second-guessed.
 *
 * This is safe because the route's final trim (which cuts from the END of the
 * paper) cannot fire when `k > 0`: the model is cut to `requested - k` first, so
 * the paper can never exceed `requested`. Position therefore no longer decides
 * which question survives, and the order is free to follow the blocks.
 */
export function assembleLivePaper(args: {
  modelQuestions: readonly GeneratedQuestion[];
  requested: number;
  k: number;
  draw: (accepted: readonly GeneratedQuestion[]) => GeneratedQuestion[];
  /** The paper's question types in block order (`evaluation.assessmentTypes`). */
  typeOrder?: readonly QuestionType[];
}): LivePaper {
  if (args.k <= 0) return { questions: [...args.modelQuestions], trimmed: 0, drawn: 0 };
  const modelCap = Math.max(0, args.requested - args.k);
  const kept = args.modelQuestions.slice(0, modelCap);
  const book = args.draw(kept);
  const combined = [...kept, ...book];
  return {
    questions: book.length > 0 && args.typeOrder ? sortIntoTypeBlocks(combined, args.typeOrder) : combined,
    trimmed: args.modelQuestions.length - kept.length,
    drawn: book.length,
  };
}

/** Stable sort by the index of each question's type in `order`; unlisted types last. */
function sortIntoTypeBlocks(
  questions: readonly GeneratedQuestion[],
  order: readonly QuestionType[],
): GeneratedQuestion[] {
  const rank = (q: GeneratedQuestion) => {
    const i = order.indexOf(q.type);
    return i === -1 ? order.length : i;
  };
  // Decorate with the original index rather than lean on Array.sort's stability.
  return questions
    .map((q, at) => ({ q, at, r: rank(q) }))
    .sort((a, b) => a.r - b.r || a.at - b.at)
    .map(x => x.q);
}

/** The book item ids a previous version of this paper carried. */
export function previousBookItemIds(
  previous: ReadonlyArray<{ aiMetadata: Record<string, unknown> | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const q of previous) {
    const id = q.aiMetadata?.["bookItemId"];
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/bookQuestions.test.ts`
Expected: `# pass 31`, `# fail 0`.

- [ ] **Step 5: Typecheck**

Run: `cd artifacts/api-server && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/bookQuestions.ts artifacts/api-server/src/modules/assessment/__tests__/bookQuestions.test.ts
git commit -m "Plan, draw and assemble real book questions for model-written evaluations"
```

---

### Task 3: Wire it into the live branch, behind the flag

**Files:**
- Modify: `artifacts/api-server/src/routes/evaluations.ts`
- Modify: `LOCAL_SETUP.md`

**Interfaces:**
- Consumes: Task 2's exports.
- Produces: with `BOOK_ITEMS_LIVE=true`, a live maths evaluation carries up to `floor(count / 2)` book questions, sorted into the paper's type blocks with the model's; every live maths paper records `generationParams.bookItems = { enabled, planned, drawn, ids }`.

The handler has no test harness (it needs auth, a database and an OpenAI stub); the logic it calls is covered by Task 2, and the glue is covered by the typechecker. Do not invent a route test.

- [ ] **Step 1: Apply the route change**

Apply to `artifacts/api-server/src/routes/evaluations.ts`:

```diff
diff --git a/artifacts/api-server/src/routes/evaluations.ts b/artifacts/api-server/src/routes/evaluations.ts
index e8693167..28d3b9e4 100644
--- a/artifacts/api-server/src/routes/evaluations.ts
+++ b/artifacts/api-server/src/routes/evaluations.ts
@@ -64,6 +64,13 @@ import {
 } from "../modules/assessment/mockGenerator";
 import { validateGenerated } from "../modules/assessment/validator";
 import { contradictionWarning, verificationAfterEdit, verifyAnswerKeys } from "../modules/assessment/keyVerification.ts";
+import {
+  assembleLivePaper,
+  drawBookQuestions,
+  isBookItemsLiveOn,
+  planBookDraw,
+  previousBookItemIds,
+} from "../modules/assessment/bookQuestions.ts";
 import { relateAnswerKey } from "../lib/mathVerifierClient.ts";
 import { QUESTION_TYPES } from "../modules/assessment/questionTypes";
 import { COMPETENCY_KEYS, competencyForBlooms, type CompetencyKey } from "../modules/assessment/competency";
@@ -738,12 +745,26 @@ router.post("/evaluations/:id/generate", aiLimiter, async (req: AuthenticatedReq
         previousQuestions.map(q => ({ text: questionStem(q.body as Record<string, unknown>) })),
       );
 
+      // Real book questions are added after the model has written its share, so
+      // the model is asked for that many fewer. Off unless BOOK_ITEMS_LIVE=true,
+      // in which case `bookPlanned` is 0 and nothing below changes.
+      const bookEnabled = isBookItemsLiveOn();
+      const bookPlanned = planBookDraw({
+        objectives,
+        assessmentTypes: evaluation.assessmentTypes,
+        count: evaluation.targetQuestionCount,
+        subjectId: evaluation.subjectId ?? undefined,
+        enabled: bookEnabled,
+        difficulty: evaluation.difficulty,
+      });
+      const modelCount = evaluation.targetQuestionCount - bookPlanned;
+
       const runLlm = (avoidList: readonly string[], insistent: boolean) => generateWithModel(
         {
           objectives,
           gradeId: evaluation.gradeId,
           assessmentTypes: evaluation.assessmentTypes,
-          count: evaluation.targetQuestionCount,
+          count: modelCount,
           difficulty: evaluation.difficulty,
           language: evaluation.language,
           bookExcerpts: grounding?.block,
@@ -801,13 +822,58 @@ router.post("/evaluations/:id/generate", aiLimiter, async (req: AuthenticatedReq
         ? grounding.sources.map(s => ({ sourceId: s.sourceId, page: s.page }))
         : [];
       generationNotes.push(...llm.notes);
+
+      // The model's surplus is cut to its share first, then the book's questions
+      // are drawn and the paper is put into the type blocks the prompt asked for
+      // (see assembleLivePaper). With a book share the paper cannot exceed the
+      // request, so the surplus trim further down cannot fire.
+      const assembled = assembleLivePaper({
+        modelQuestions: llm.questions,
+        requested: evaluation.targetQuestionCount,
+        k: bookPlanned,
+        typeOrder: evaluation.assessmentTypes,
+        draw: accepted => drawBookQuestions({
+          objectives,
+          assessmentTypes: evaluation.assessmentTypes,
+          difficulty: evaluation.difficulty,
+          k: bookPlanned,
+          accepted,
+          avoidIds: previousBookItemIds(previousQuestions),
+          rng: Math.random,
+        }),
+      });
+      if (evaluation.subjectId === "mathematics") {
+        generationParams["bookItems"] = {
+          enabled: bookEnabled,
+          planned: bookPlanned,
+          drawn: assembled.drawn,
+          ids: assembled.questions
+            .filter(q => q.aiMetadata["generator"] === "book")
+            .map(q => q.aiMetadata["bookItemId"]),
+        };
+      }
+      if (assembled.trimmed > 0) {
+        generationNotes.push(
+          `The generator returned ${assembled.trimmed} more question${assembled.trimmed === 1 ? "" : "s"} than the ${modelCount} asked of it; the extra ${assembled.trimmed === 1 ? "one was" : "ones were"} left out.`,
+        );
+      }
+      if (assembled.drawn > 0) {
+        generationNotes.push(
+          `${assembled.drawn} question${assembled.drawn === 1 ? " is a" : "s are"} real item${assembled.drawn === 1 ? "" : "s"} from the NCCD books; each is labelled with how its answer was established.`,
+        );
+      }
+      if (assembled.drawn < bookPlanned) {
+        generationNotes.push(
+          `Only ${assembled.drawn} of ${bookPlanned} planned book question${bookPlanned === 1 ? "" : "s"} could be added (the rest of the book's questions repeat ones already on the paper or the model's).`,
+        );
+      }
       result = {
-        questions: llm.questions,
+        questions: assembled.questions,
         // The model was asked for every requested type, so nothing is
         // "unavailable" the way it is for the mock — a type that came back
         // wrong is a discard, and llm.notes already says so.
         unavailableTypes: [],
-        shortfall: Math.max(0, evaluation.targetQuestionCount - llm.questions.length),
+        shortfall: Math.max(0, evaluation.targetQuestionCount - assembled.questions.length),
         notes: [],
         // Still worth carrying: the bank pointer answers "where else could I
         // look", which is useful whether or not the generator declined
```

- [ ] **Step 2: Document the flag**

Add this row to the env table in `LOCAL_SETUP.md`, directly after the `AI_BUDGET_USD` row (the diff in Task 4 includes it; apply it now so the flag is never undocumented):

```
| `BOOK_ITEMS_LIVE` | unset (off; anything but literal `"true"`) | Lets the live model path add real NCCD maths book questions to an evaluation (at most half the paper). Only meaningful with `AI_LIVE_MODE=true`. Leave off until the served items (`lib/curriculum/src/data/book-items/`) have been compared with the printed books. A paper records what happened in `generationParams.bookItems` |
```

- [ ] **Step 3: Build, run the whole API suite and typecheck**

Run: `cd artifacts/api-server && pnpm run build && pnpm test && pnpm run typecheck`
Expected: `# pass 1594`, `# fail 0`; typecheck prints no errors.

- [ ] **Step 4: Review your own diff against the constraints**

Read `git diff HEAD~1` and confirm: (a) with `bookPlanned === 0`, `modelCount` equals `evaluation.targetQuestionCount` and `assembled.questions` has the same contents as `llm.questions`; (b) `shortfall` is computed from `assembled.questions`; (c) nothing was changed in the mock branch.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/evaluations.ts LOCAL_SETUP.md
git commit -m "Add real book questions to model-written maths evaluations behind BOOK_ITEMS_LIVE"
```

---

### Task 4: Record it, and hand it over

**Files:**
- Modify: `STATUS.md`, `CLAUDE.md`

- [ ] **Step 1: Update the docs**

Apply (the `LOCAL_SETUP.md` hunk is already in from Task 3; skip it if so):

```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index cbe17e92..6161ff89 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -154,12 +154,14 @@ Shipping to production: [`docs/deploying.md`](./docs/deploying.md).
   flattens exponents and splits fractions — must never carry a `check`: the
   existing verification pass would badge it «تم التحقق», which says the stem was
   read correctly and nothing has checked that. `SERVED_STATUSES` is the one place
-  that decides what a paper may draw. Only the API's mock evaluation generator uses
-  book items, and it runs only when live AI is off; production has
-  `AI_LIVE_MODE=true`, so today no live paper uses them. The live-AI path and
-  the mobile offline generators ignore them, so
-  a paper differs by which path made it — add a family to the script's `TABLE`,
-  never to a generator.
+  that decides what a paper may draw. Only the API's evaluation generator uses
+  book items: the mock path always, the live model path only when
+  `BOOK_ITEMS_LIVE=true` (off by default; read `generationParams.bookItems` to see
+  which state a paper was made in). The mobile offline generators and
+  `routes/generate.ts` ignore them, so a paper differs by which path made it —
+  add a family to the script's `TABLE`, never to a generator. On the live path
+  the model's surplus is cut before the book questions are added, and the
+  combined list is sorted into the paper's type blocks.
 - **A teaching style shapes the whole lesson plan, in two places.** Per-style
   phases live in `artifacts/mobile/services/ai/lessonPlanBlueprints.ts` and the
   matching contract in `LESSON_STYLE_RULES_AR`/`_EN`
diff --git a/LOCAL_SETUP.md b/LOCAL_SETUP.md
index 12cebfa8..da3631c8 100644
--- a/LOCAL_SETUP.md
+++ b/LOCAL_SETUP.md
@@ -109,6 +109,7 @@ Without an OpenAI key, the API process will not start (AI client initializes at
 | `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog Cloud region — use the EU host if the project is EU-hosted |
 | `AI_LIVE_MODE` | `false` (anything but literal `"true"`) | Server-side counterpart to the above — must be exactly `true` to let chat/generate/derivativeVerified call OpenAI |
 | `AI_BUDGET_USD` | `2` | Hard USD cap on estimated spend while `AI_LIVE_MODE=true`. In-process only, resets on restart |
+| `BOOK_ITEMS_LIVE` | unset (off; anything but literal `"true"`) | Lets the live model path add real NCCD maths book questions to an evaluation (at most half the paper). Only meaningful with `AI_LIVE_MODE=true`. Leave off until the served items (`lib/curriculum/src/data/book-items/`) have been compared with the printed books. A paper records what happened in `generationParams.bookItems` |
 | `AI_MODEL` | `gpt-4o-mini` | Model for the live-AI routes; cheap by default. Sets both workloads below unless one overrides it |
 | `AI_MODEL_GENERATE` | falls back to `AI_MODEL` | Lesson plans, worksheets, quizzes, activities — one long structured document per call |
 | `AI_MODEL_CHAT` | falls back to `AI_MODEL` | Chat turns — many short calls where latency and cost dominate |
diff --git a/STATUS.md b/STATUS.md
index 8bcb3677..0b2144cd 100644
--- a/STATUS.md
+++ b/STATUS.md
@@ -971,6 +971,38 @@ an announcement by default» below.
     **Warm the verifier as well as the API before a demo** — a sleeping
     verifier and an undeployed one look the same from the app.
 
+## Real book items on the live model path, behind `BOOK_ITEMS_LIVE`, 2026-10-12
+
+The 24 served book items (see the next section) now also reach evaluations the
+model writes, not just the mock generator's. **Off by default**: nothing changes
+in production until `BOOK_ITEMS_LIVE=true` is set on iqraa-api, and that should
+wait until a person has compared the served items with the printed books.
+Design: `docs/superpowers/specs/2026-10-12-book-items-live-path-design.md`.
+
+- **How.** In `POST /evaluations/:id/generate`, `planBookDraw` decides how many
+  book questions (`k`, at most half the paper, never more than eligible), the
+  model is asked for `count − k`, and `assembleLivePaper` (`modules/assessment/
+  bookQuestions.ts`) cuts the model's surplus first, adds the book questions
+  (drawn so none is a near-duplicate of a model question) and sorts the combined
+  list into the paper's type blocks, so the ministry blocks are not split. The
+  route's own final trim cannot fire when a book share exists. With the flag off
+  `k` is 0 and the model's paper passes through untouched.
+- **Competency and marks are by kind and nominal.** An exercise is
+  `application` (3 marks), a unit-test choice `understanding` (2 marks); the model
+  picks its own for the rest.
+- **A regeneration prefers items the teacher has not seen** (their ids are in each
+  question's `aiMetadata.bookItemId`) and repeats rather than shorten the paper.
+- **What shows.** `evaluation.generator` stays `"llm"`; each book question is
+  `aiMetadata.generator: "book"` and shows its citation and key label on the
+  evaluation screen. `generationParams.bookItems = { enabled, planned, drawn, ids }`
+  is written on every live maths paper, so "why no book items" is answerable from
+  the row when the flag is unset.
+- **Not verified end to end.** The route's few lines of glue are covered by the
+  typechecker and the helper tests, not by a route test. After turning the flag on,
+  generate one maths evaluation and check `generationParams.bookItems` and that
+  the paper is exactly the requested length.
+- **Still not covered:** the mobile offline quiz/exam generators and
+  `routes/generate.ts` (worksheets, quizzes).
+
 ## Real book items in the mock evaluation generator: 24 served, none verified, none live yet, 2026-10-12
 
 A Grade 10 maths evaluation used to be built from generated templates only.
@@ -980,13 +1012,12 @@ guide's end-of-unit test — for the objective's own lesson. Reader:
 `scripts/extract_book_items.py`. Design:
 `docs/superpowers/specs/2026-10-12-book-items-design.md`.
 
-- **Not on the live path yet.** `generateMockEvaluation` has one caller, the
-  non-live `else` branch of `POST /evaluations/:id/generate`
-  (`routes/evaluations.ts`); the live path calls the model. Production runs
-  `AI_LIVE_MODE=true` (see "Live AI is on, 2026-08-20"), so with today's settings
-  **no live evaluation draws book items** — they appear only when live AI is off
-  (dev, demo, or `AI_LIVE_MODE` unset). Next slices: give the live model path the
-  same items, or the mobile offline quiz/exam generators.
+- **Mock path only until the next section.** `generateMockEvaluation` has one
+  caller, the non-live `else` branch of `POST /evaluations/:id/generate`
+  (`routes/evaluations.ts`); production runs `AI_LIVE_MODE=true` (see "Live AI is
+  on, 2026-08-20"). The live model path draws the same items only when
+  `BOOK_ITEMS_LIVE=true` (previous section, off by default); the mobile offline
+  quiz/exam generators do not use them.
 - **What is in it.** 24 served items: systems of equations (S1 unit 1, two
   lessons), polynomial derivatives (S2 unit 6) and two unit-test choices. 14 more
   were quarantined, each with its reason in `report.json` (no real solution, an
```

- [ ] **Step 2: Re-run the gate once**

Run: `cd artifacts/api-server && pnpm run build && pnpm test && pnpm run typecheck`
Expected: `# pass 1594`, `# fail 0`; no type errors. Then at the repo root: `git status --porcelain` is empty after the commit.

- [ ] **Step 3: Commit and push**

```bash
git add STATUS.md CLAUDE.md
git commit -m "Record real book items on the live path in STATUS and CLAUDE"
git push -u origin claude/great-pasteur-hgo389
```

- [ ] **Step 4: Tell the reviewer what is and is not proven**

Add to PR #1021's body (use `mcp__github__update_pull_request`; keep the existing text): a section "Live path (off by default)" saying: the flag is `BOOK_ITEMS_LIVE=true` on iqraa-api; with it unset nothing changes; the route glue has no route-level test, only the typechecker and the Task 2 tests; and the first manual check after turning it on is to generate one maths evaluation and confirm `generationParams.bookItems` and that the paper is exactly the requested length. The merge is the human's decision; do not merge.

---

## Self-review against the spec

| Spec section | Where |
| --- | --- |
| Plan `k` before the model call; ask the model for `count − k` | Task 2 `planBookDraw`; Task 3 `modelCount` |
| Draw after the model, against its questions; cut the surplus first | Task 2 `assembleLivePaper`, `drawBookQuestions`; Task 3 wiring |
| Regeneration prefers unseen items, falls back to repeats | Task 2 `drawBookQuestions` (`avoidIds`), `previousBookItemIds`; Task 3 passes `previousQuestions` |
| Competency and marks by kind | Task 1 `slot`; Task 2 `liveSlot` |
| Recorded and shown (`generationParams.bookItems`, notes, `aiMetadata`) | Task 3; the citation already shows via PR #1021's evaluation-screen note |
| The flag, off by default, documented | Task 2 `isBookItemsLiveOn`; Task 3 `LOCAL_SETUP.md`; Task 4 STATUS/CLAUDE |
| Tests: plan, draw, assembly, validator never rejects a book question | Task 2 |
| Existing mock-path tests unchanged | Task 1 steps 1 and 3; Task 3 step 3 |
| Flag-off identity | `assembleLivePaper` with `k = 0` (Task 2); route glue by typecheck (see *Differences*) |

No placeholders remain. Names are consistent across tasks: `planBookDraw`, `drawBookQuestions`, `assembleLivePaper`, `previousBookItemIds`, `isBookItemsLiveOn`, `bookQuestion`, `slot`, and the `generationParams.bookItems` shape.
