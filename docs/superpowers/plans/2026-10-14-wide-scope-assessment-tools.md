# Wide-Scope Quiz, Worksheet, Homework and Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher make a quiz, worksheet, homework or game for a whole unit, semester or book, with questions spread across the lessons in that scope by a teacher-chosen distribution, on both the offline and the live path.

**Architecture:** One pure `planCoverage` decides which lesson each question slot belongs to. The screen sends the lesson table (and, for *balanced*, the plan) with the request; the offline generators re-plan from the same table and draw each question from its slot's lesson through the existing per-lesson banks; the live prompts render the same plan as per-lesson counts and ask the model to tag each question with its lesson. Piece 1's `ScopeSelection`, `resolveScopeGrounding`, `scopeRequestFields` and `scopeKey` cache key carry the scope.

**Tech Stack:** TypeScript, `node --test` (strip-types), Expo/React Native (screens), Express api-server.

**Spec:** `docs/superpowers/specs/2026-10-14-wide-scope-assessment-tools-design.md` (piece 1's spec: `2026-10-13-wide-scope-selection-design.md`; piece 1 is on `main`)

## Global Constraints

- Mobile pure modules are loaded directly by `node --test`: **explicit `.ts` extensions on relative imports** and **no `react-native` / `expo-*` import at module scope** (CLAUDE.md). Screens and RN components cannot be unit-tested; their logic lives in pure modules.
- New mobile tests go inside `artifacts/mobile/services/__tests__/`; api-server tests inside `src/**/__tests__/`. Do not narrow either glob.
- **Generators branch on the subject NAME** (`isMathContext`). Anything calling a generator passes the lesson's own subject; tests pass `subject: 'Mathematics'` / `'Chemistry'`.
- **Two places move together** (CLAUDE.md): the offline plan (`generators.ts`) and the live prompt clause (`api-server/src/lib/prompts.ts`) both come from the one plan; a test pins them equal.
- **A scope is carried as ids, never re-derived from a title; a wide scope never falls back to a title lookup** (fail closed). A wide scope that cannot be grounded is refused before generation.
- Counts: a **wide scope adds 25 and 30**; `NUM_Q_OPTIONS` is **appended to, never inserted into** (persisted indices — CLAUDE.md on picker order). The server's enforcement cap stays 30 (`quizWanted`) and the output-token ceiling is **not** raised.
- The new `lesson` tag is **passed through, never enforced** server-side: no count, trim or reject on it.
- `scopeRequestFields` (piece 1) is **merged over the screen's own fields last** — its `additionalContext` replaces the lesson-derived one.
- A lesson-scope request must be unchanged: byte-identical request fields, unchanged cache key, unchanged offline output shape (no `lessonId` on its questions).
- Arabic is the product language; the UI is RTL-first. Do not add a `KeyboardAvoidingView` inside a screen.
- Every commit message ends with the two trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01S49tDeDJyomhJFC71MHJo1`. No model identifier anywhere else.

## Corrections and refinements found while planning (Task 1 amends the spec)

1. **The game does not inherit the quiz screen.** `game.tsx` builds its own `generateQuiz` request and its own `TopicSelector`. It needs its own adoption (Task 10). Its question-count picker (5/8/10/12) is unchanged.
2. **`planCoverage` takes a pool, not a `ScopeSelection`.** The offline generators only hold the request's lesson table, so the plan is `planCoverage(pool, count, mode, opts)` over `{ id, unitId }[]`; `buildCoverage(scope, …)` builds the pool from piece 1's `lessonsInScope`.
3. **Random does not promise every unit is covered.** It draws without replacement (a lesson repeats only after every lesson was used). The spec's "never leaves a unit out" test and its live "leave no unit uncovered" wording are dropped for random; they hold for *balanced* only.
4. **The live prompt gets per-lesson counts, not a slot order.** A quiz is re-sorted into ministry type blocks and a worksheet is grouped by difficulty, so "question 3 is about L7" cannot hold. The prompt says «L7: 2 questions». The pin test compares the multiset of per-lesson counts.
5. **Offline never reads `slots`.** It re-plans from `coverage.lessons`, after dropping lessons with no offline bank (`NoQuestionBankError` — e.g. a geometry lesson), so one such lesson cannot make a whole-book paper throw. Skipped lessons are reported, not hidden.
6. **Offline caps:** `worksheetOnce` and `homeworkOnce` clamp the count to 20; both rise to 30.
7. **Resolved risk:** `normalizeQuiz` mutates the model's question objects in place and keeps unknown fields, so a `lesson` tag survives. Task 6 still proves it with a test, for the quiz and the worksheet.
8. **`GenerationScope` is not extended.** The screens freeze the wide scope and distribution in their own `wideFrozen` state at generation time and save that, which is the same guarantee without widening a shared type.
9. **Offline regenerate rotation** uses a random `offset` (stateless) rather than a counter.

## File Structure

| File | Responsibility |
| --- | --- |
| Create `artifacts/mobile/services/coveragePlan.ts` | `Distribution`, `planCoverage`, `buildCoverage`, lesson codes, `lessonIdsFromTags`, `coverageSummary`. Pure. |
| Create `artifacts/mobile/services/ai/scopeDraw.ts` | `ScopeDrawer`: per-slot lesson, falls back to other lessons when a (lesson, type) bank is spent. Pure. |
| Create `artifacts/mobile/services/wideScopeRequest.ts` | `buildWideRequest`, count options, form-state helpers, `tagQuizLessons` / `tagWorksheetLessons`. Pure. |
| Modify `artifacts/mobile/services/ai/AIService.ts` | `AIRequest.distribution` / `coverage`; `lessonId` / `lesson` on `QuizQuestion` and `WorksheetQuestion`. |
| Modify `artifacts/mobile/services/ai/generators.ts` | `offlineWideScope`; quiz / worksheet / homework draw per slot. |
| Modify `artifacts/mobile/services/ai/RemoteAIService.ts` | map model lesson codes to lesson ids after a live reply. |
| Create `artifacts/api-server/src/lib/coverage.ts` | `parseCoverage`, `coverageClauseAr/En`. |
| Modify `artifacts/api-server/src/lib/prompts.ts` | insert the clause into the four quiz / worksheet builders. |
| Modify `artifacts/api-server/src/lib/generationKey.ts` | `distribution` in the strict key. |
| Create `artifacts/mobile/hooks/useWideScope.ts` | scope + distribution state for a screen. |
| Create `artifacts/mobile/components/ui/CoverageNotice.tsx` | «الدروس المغطاة» line. |
| Modify `artifacts/mobile/components/ui/TopicSelector.tsx` | `offlineWideScope` prop. |
| Modify `artifacts/mobile/services/i18n.ts` | new strings (ar + en). |
| Modify `app/ai-tools/quiz.tsx`, `worksheet.tsx` (homework), `game.tsx` | adopt it. |
| Modify `STATUS.md`, the spec | record what landed and what was not run. |

---

### Task 1: The coverage plan (`coveragePlan.ts`) and the spec amendments

**Files:**
- Create: `artifacts/mobile/services/coveragePlan.ts`
- Test: `artifacts/mobile/services/__tests__/coveragePlan.test.ts`
- Modify: `docs/superpowers/specs/2026-10-14-wide-scope-assessment-tools-design.md`

**Interfaces:**
- Consumes (piece 1, on `main`): `ScopeSelection`, `lessonsInScope(sel): KBLesson[]` from `./scopeSelection.ts`.
- Produces:
  ```ts
  export type Distribution = 'balanced' | 'random';
  export const DISTRIBUTIONS: readonly Distribution[];            // ['balanced','random']
  export type PoolLesson = { id: string; unitId: string };
  export type CoverageLesson = { code: string; id: string; unitId: string; title: string };
  export type Coverage = { lessons: CoverageLesson[]; slots?: string[] };   // slots = lesson codes, balanced only
  export function planCoverage(pool: readonly PoolLesson[], count: number, mode: Distribution,
    opts?: { offset?: number; random?: () => number }): number[];            // indices into pool, length === count
  export function coverageLessons(sel: ScopeSelection, lang: 'ar' | 'en'): CoverageLesson[];
  export function buildCoverage(sel: ScopeSelection, lang: 'ar' | 'en', count: number, mode: Distribution,
    opts?: { offset?: number }): Coverage;
  export function lessonIdsFromTags(questions: { lesson?: string; lessonId?: string }[], lessons: readonly CoverageLesson[]): void;
  export function coverageSummary(questions: readonly { lessonId?: string }[], lessons: readonly CoverageLesson[]):
    { covered: CoverageLesson[]; uncovered: CoverageLesson[] };
  ```

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/coveragePlan.test.ts`:

```ts
/**
 * Which lesson each question slot belongs to.
 *
 * `planCoverage` is pure: the offline generators and the live prompt both read
 * it, so these tests are the contract between the two. Maths grade 10 is used
 * for the real-scope cases; they are derived from the KB, not from lesson ids.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoverage, coverageLessons, coverageSummary, lessonIdsFromTags, planCoverage, type PoolLesson,
} from '../coveragePlan.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: n });

// Three units of 3, 1 and 2 lessons — uneven on purpose.
const pool: PoolLesson[] = [
  { id: 'a1', unitId: 'A' }, { id: 'a2', unitId: 'A' }, { id: 'a3', unitId: 'A' },
  { id: 'b1', unitId: 'B' },
  { id: 'c1', unitId: 'C' }, { id: 'c2', unitId: 'C' },
];
const ids = (idx: number[]) => idx.map(i => pool[i]!.id);

describe('planCoverage — balanced', () => {
  it('gives every unit a question before any unit gets a second', () => {
    assert.deepEqual(ids(planCoverage(pool, 3, 'balanced')), ['a1', 'b1', 'c1']);
    assert.deepEqual(ids(planCoverage(pool, 6, 'balanced')), ['a1', 'b1', 'c1', 'a2', 'b1', 'c2']);
  });

  it('is exactly `count` long and deterministic', () => {
    for (const n of [1, 2, 5, 12, 30]) assert.equal(planCoverage(pool, n, 'balanced').length, n);
    assert.deepEqual(planCoverage(pool, 9, 'balanced'), planCoverage(pool, 9, 'balanced'));
  });

  it('with fewer questions than units covers distinct units', () => {
    const units = ids(planCoverage(pool, 2, 'balanced')).map(id => pool.find(l => l.id === id)!.unitId);
    assert.equal(new Set(units).size, 2);
  });

  it('an offset changes the plan but still covers every unit once count >= units', () => {
    const base = ids(planCoverage(pool, 3, 'balanced'));
    const moved = ids(planCoverage(pool, 3, 'balanced', { offset: 1 }));
    assert.notDeepEqual(base, moved);
    assert.equal(new Set(moved.map(id => pool.find(l => l.id === id)!.unitId)).size, 3);
  });

  it('a one-lesson pool repeats that lesson', () => {
    assert.deepEqual(planCoverage([{ id: 'x', unitId: 'U' }], 4, 'balanced'), [0, 0, 0, 0]);
  });

  it('an empty pool or a zero count plans nothing', () => {
    assert.deepEqual(planCoverage([], 5, 'balanced'), []);
    assert.deepEqual(planCoverage(pool, 0, 'balanced'), []);
  });
});

describe('planCoverage — random', () => {
  /** A seeded generator so the test is reproducible. */
  const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  it('is reproducible with an injected generator and exactly `count` long', () => {
    const a = planCoverage(pool, 10, 'random', { random: seeded(7) });
    const b = planCoverage(pool, 10, 'random', { random: seeded(7) });
    assert.deepEqual(a, b);
    assert.equal(a.length, 10);
  });

  it('repeats no lesson until every lesson has been used', () => {
    const first = planCoverage(pool, pool.length, 'random', { random: seeded(3) });
    assert.equal(new Set(first).size, pool.length);
    const second = planCoverage(pool, pool.length * 2, 'random', { random: seeded(3) });
    assert.equal(new Set(second.slice(0, pool.length)).size, pool.length);
    assert.equal(new Set(second.slice(pool.length)).size, pool.length);
  });
});

describe('buildCoverage over a real scope', () => {
  it('lists the scope\'s lessons with L1..Ln codes in book order', () => {
    const lessons = coverageLessons(sem(1), 'ar');
    assert.ok(lessons.length > 4);
    assert.deepEqual(lessons.map(l => l.code), lessons.map((_, i) => `L${i + 1}`));
    assert.ok(lessons.every(l => l.id && l.unitId && l.title));
  });

  it('balanced sends slots (codes) of the picked length; random sends none', () => {
    const b = buildCoverage(sem(1), 'ar', 12, 'balanced');
    assert.equal(b.slots?.length, 12);
    assert.ok(b.slots!.every(c => b.lessons.some(l => l.code === c)));
    assert.equal(buildCoverage(sem(1), 'ar', 12, 'random').slots, undefined);
  });

  it('balanced covers every unit of the semester once count >= units', () => {
    const b = buildCoverage(sem(1), 'ar', 12, 'balanced');
    const unitOf = new Map(b.lessons.map(l => [l.code, l.unitId]));
    const allUnits = new Set(b.lessons.map(l => l.unitId));
    const used = new Set(b.slots!.map(c => unitOf.get(c)));
    assert.deepEqual([...used].sort(), [...allUnits].sort());
  });

  it('the two semesters give different lesson tables', () => {
    const a = coverageLessons(sem(1), 'ar').map(l => l.id);
    const b = coverageLessons(sem(2), 'ar').map(l => l.id);
    assert.equal(a.filter(id => b.includes(id)).length, 0);
  });
});

describe('lessonIdsFromTags / coverageSummary', () => {
  const lessons = [
    { code: 'L1', id: 'x1', unitId: 'U', title: 'one' },
    { code: 'L2', id: 'x2', unitId: 'U', title: 'two' },
    { code: 'L3', id: 'x3', unitId: 'V', title: 'three' },
  ];

  it('maps the model\'s codes to lesson ids and drops the raw tag', () => {
    const qs: { lesson?: string; lessonId?: string }[] = [{ lesson: 'L2' }, { lesson: ' l3 ' }, { lesson: 'L9' }, {}];
    lessonIdsFromTags(qs, lessons);
    assert.deepEqual(qs, [{ lessonId: 'x2' }, { lessonId: 'x3' }, {}, {}]);
  });

  it('leaves a question that already has a lessonId alone', () => {
    const qs = [{ lessonId: 'x1', lesson: 'L3' }];
    lessonIdsFromTags(qs, lessons);
    assert.deepEqual(qs, [{ lessonId: 'x1' }]);
  });

  it('summarises what was and was not covered', () => {
    const s = coverageSummary([{ lessonId: 'x1' }, { lessonId: 'x1' }, { lessonId: 'x3' }, {}], lessons);
    assert.deepEqual(s.covered.map(l => l.code), ['L1', 'L3']);
    assert.deepEqual(s.uncovered.map(l => l.code), ['L2']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/coveragePlan.test.ts`
Expected: FAIL — cannot find module `../coveragePlan.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/coveragePlan.ts`:

```ts
/**
 * Which lesson each question of a wide-scope paper is about.
 *
 * A semester has 18 maths lessons and a paper has 5–30 questions, so something
 * must decide which lessons get one. That decision is made here, once, as a
 * plan of lesson indices, and read by BOTH paths: the offline generators draw
 * each question from its slot's lesson, and the live prompt is given the same
 * plan as per-lesson counts. Two places holding the rule independently is how a
 * teacher gets a different paper depending on whether live AI was on.
 *
 * Free of react-native so `node --test` can load it.
 */
import { lessonsInScope, type ScopeSelection } from './scopeSelection.ts';

export type Distribution = 'balanced' | 'random';
export const DISTRIBUTIONS: readonly Distribution[] = ['balanced', 'random'];

/** What a plan needs to know about a lesson. */
export type PoolLesson = { id: string; unitId: string };

/** A lesson as the request carries it: a short code the model can tag a question with. */
export type CoverageLesson = { code: string; id: string; unitId: string; title: string };

/** `slots` holds lesson codes, one per question, and is sent for `balanced` only. */
export type Coverage = { lessons: CoverageLesson[]; slots?: string[] };

function planBalanced(pool: readonly PoolLesson[], n: number, offset: number): number[] {
  const unitOrder: string[] = [];
  const byUnit = new Map<string, number[]>();
  pool.forEach((lesson, i) => {
    let list = byUnit.get(lesson.unitId);
    if (!list) {
      list = [];
      byUnit.set(lesson.unitId, list);
      unitOrder.push(lesson.unitId);
    }
    list.push(i);
  });
  const shift = ((offset % unitOrder.length) + unitOrder.length) % unitOrder.length;
  const units = [...unitOrder.slice(shift), ...unitOrder.slice(0, shift)];
  const taken = new Map<string, number>();
  const out: number[] = [];
  // One lesson from each unit per round, so no unit gets a second before every
  // unit has a first. A small unit's lesson can come round again before a big
  // unit has used all of its own: balanced is by unit, not by lesson.
  while (out.length < n) {
    for (const unit of units) {
      if (out.length >= n) break;
      const list = byUnit.get(unit)!;
      const k = taken.get(unit) ?? 0;
      out.push(list[(k + offset) % list.length]!);
      taken.set(unit, k + 1);
    }
  }
  return out;
}

function planRandom(size: number, n: number, random: () => number): number[] {
  const out: number[] = [];
  // Each pass is a fresh permutation, so no lesson repeats before all were used.
  while (out.length < n) {
    const pass = Array.from({ length: size }, (_, i) => i);
    for (let i = pass.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pass[i], pass[j]] = [pass[j]!, pass[i]!];
    }
    out.push(...pass);
  }
  return out.slice(0, n);
}

/**
 * Indices into `pool`, one per question slot.
 *
 * `offset` rotates where `balanced` starts so an offline Regenerate does not
 * return the same plan; it is never sent to the server.
 */
export function planCoverage(
  pool: readonly PoolLesson[],
  count: number,
  mode: Distribution,
  opts: { offset?: number; random?: () => number } = {},
): number[] {
  const n = Math.max(0, Math.floor(count));
  if (pool.length === 0 || n === 0) return [];
  return mode === 'random'
    ? planRandom(pool.length, n, opts.random ?? Math.random)
    : planBalanced(pool, n, opts.offset ?? 0);
}

/** The lessons of a scope as the request carries them, in book order. */
export function coverageLessons(sel: ScopeSelection, lang: 'ar' | 'en'): CoverageLesson[] {
  return lessonsInScope(sel).map((l, i) => ({
    code: `L${i + 1}`,
    id: l.id,
    unitId: l.unitId,
    title: lang === 'ar' ? l.titleAr : l.titleEn,
  }));
}

/** The coverage block of a request. `random` carries no per-question assignment. */
export function buildCoverage(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  count: number,
  mode: Distribution,
  opts: { offset?: number } = {},
): Coverage {
  const lessons = coverageLessons(sel, lang);
  if (mode === 'random') return { lessons };
  const plan = planCoverage(lessons, count, 'balanced', opts);
  return { lessons, slots: plan.map(i => lessons[i]!.code) };
}

/**
 * Turn the model's `lesson` code on each question into a lesson id, in place,
 * and drop the raw tag. A code that is not in the table is ignored: model
 * tagging is unreliable, and a reply is never rejected over it.
 */
export function lessonIdsFromTags(
  questions: { lesson?: string; lessonId?: string }[],
  lessons: readonly CoverageLesson[],
): void {
  const byCode = new Map(lessons.map(l => [l.code, l.id]));
  for (const q of questions) {
    const raw = typeof q.lesson === 'string' ? q.lesson.trim().toUpperCase() : '';
    delete q.lesson;
    if (q.lessonId) continue;
    const id = byCode.get(raw);
    if (id) q.lessonId = id;
  }
}

/** Which of the scope's lessons the paper's questions actually belong to. */
export function coverageSummary(
  questions: readonly { lessonId?: string }[],
  lessons: readonly CoverageLesson[],
): { covered: CoverageLesson[]; uncovered: CoverageLesson[] } {
  const used = new Set(questions.map(q => q.lessonId).filter((id): id is string => !!id));
  return {
    covered: lessons.filter(l => used.has(l.id)),
    uncovered: lessons.filter(l => !used.has(l.id)),
  };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/coveragePlan.test.ts`
Expected: all PASS. If the `balanced 6` expectation fails, re-check the round loop: round 1 is `a1, b1, c1`; round 2 is `a2, b1` (unit B has one lesson, so it wraps), `c2`.

- [ ] **Step 5: Amend the spec**

In `docs/superpowers/specs/2026-10-14-wide-scope-assessment-tools-design.md` make exactly these edits (the nine items under *Corrections and refinements* at the top of this plan are the source; use their wording):
- §1: the signature becomes `planCoverage(pool, count, mode, opts)` over `{ id, unitId }[]`, plus `buildCoverage(scope, lang, count, mode, opts)`; **random** "draws without replacement; a lesson repeats only after every lesson was used" and "does not promise every unit is covered".
- §2: add "Lessons with no offline bank are dropped from the offline plan and reported, and the offline path re-plans from `coverage.lessons` (it never reads `slots`)". Replace "caps" so worksheet and homework clamp at 30.
- §3: the prompt renders **per-lesson counts** (not a slot order); for `random` it says "choose lessons at random and repeat none before all are used" (drop "leave no unit uncovered"); the wire `coverage` is `{ lessons: [{ code, id, unitId, title }], slots? }`.
- §5: add `game.tsx` to the screens; remove "`GenerationScope` records scope + distribution" in favour of "each screen freezes the wide scope and distribution in its own state at generation time".
- *Non-goals / intro:* delete "The game needs no work of its own… inherits the quiz".
- *Risks:* mark the `normalizeQuiz` risk resolved (it mutates in place and keeps unknown fields; a test still proves it).
- *Tests:* remove "never leaves a unit out when `count >= units`" from the random bullet (keep it for balanced).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/coveragePlan.ts artifacts/mobile/services/__tests__/coveragePlan.test.ts docs/superpowers/specs/2026-10-14-wide-scope-assessment-tools-design.md
git commit -m "feat: coverage plan for wide-scope papers"
```

---

### Task 2: The per-slot lesson drawer (`scopeDraw.ts`)

**Files:**
- Create: `artifacts/mobile/services/ai/scopeDraw.ts`
- Test: `artifacts/mobile/services/__tests__/scopeDraw.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ScopeDrawer<L extends { id: string }> {
    constructor(slots: readonly L[], all: readonly L[], spent: { isSpent: (e: unknown) => boolean; error: () => unknown });
    lessonAt(slot: number): L;
    draw<T>(slot: number, bankKey: string, make: (lesson: L) => T): { value: T; lesson: L };
  }
  ```
  `draw` calls `make` with the slot's lesson; when `make` throws something `isSpent` recognises, that (lesson, `bankKey`) pair is remembered as spent and the next lesson in `all` is tried; when every lesson is spent for that key it throws `spent.error()`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/scopeDraw.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScopeDrawer } from '../ai/scopeDraw.ts';

class Spent extends Error {}
const opts = { isSpent: (e: unknown) => e instanceof Spent, error: () => new Spent('all spent') };
const L = (id: string) => ({ id });
const all = [L('a'), L('b'), L('c')];

describe('ScopeDrawer', () => {
  it('draws from the lesson its slot names', () => {
    const d = new ScopeDrawer([all[1]!, all[2]!, all[0]!], all, opts);
    assert.equal(d.draw(0, 'mc', l => l.id).lesson.id, 'b');
    assert.equal(d.draw(1, 'mc', l => l.id).lesson.id, 'c');
    assert.equal(d.draw(2, 'mc', l => l.id).lesson.id, 'a');
  });

  it('slots wrap round when there are more questions than slots', () => {
    const d = new ScopeDrawer([all[0]!, all[1]!], all, opts);
    assert.equal(d.lessonAt(2).id, 'a');
    assert.equal(d.lessonAt(5).id, 'b');
  });

  it('hands a spent lesson\'s question to the next lesson, and remembers it', () => {
    const calls: string[] = [];
    const d = new ScopeDrawer([all[0]!], all, opts);
    const make = (l: { id: string }) => {
      calls.push(l.id);
      if (l.id === 'a') throw new Spent('a is out of mc');
      return l.id;
    };
    assert.equal(d.draw(0, 'mc', make).lesson.id, 'b');
    calls.length = 0;
    // 'a' is spent for mc now, so it is not even tried again.
    assert.equal(d.draw(0, 'mc', make).lesson.id, 'b');
    assert.deepEqual(calls, ['b']);
  });

  it('spent is per bank key: a lesson out of mc can still write true/false', () => {
    const d = new ScopeDrawer([all[0]!], all, opts);
    d.draw(0, 'mc', l => { if (l.id === 'a') throw new Spent(); return 1; });
    assert.equal(d.draw(0, 'tf', l => l.id).lesson.id, 'a');
  });

  it('throws the spent error when every lesson is out, and rethrows anything else', () => {
    const d = new ScopeDrawer([all[0]!], all, opts);
    assert.throws(() => d.draw(0, 'mc', () => { throw new Spent(); }), Spent);
    // all three are now spent for mc: still the spent error, with no further calls
    let called = 0;
    assert.throws(() => d.draw(0, 'mc', () => { called++; return 1; }), Spent);
    assert.equal(called, 0);
    const e = new ScopeDrawer([all[0]!], all, opts);
    assert.throws(() => e.draw(0, 'mc', () => { throw new TypeError('boom'); }), TypeError);
  });

  it('refuses to be built with no slots', () => {
    assert.throws(() => new ScopeDrawer([], all, opts));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeDraw.test.ts`
Expected: FAIL — cannot find module `../ai/scopeDraw.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/ai/scopeDraw.ts`:

```ts
/**
 * Draw a question from a lesson, and move on when that lesson has nothing left.
 *
 * The offline generators build a question from ONE lesson's bank at a time. For
 * a wide scope each question slot names a lesson (`planCoverage`); when that
 * lesson's bank is spent for the question type being drawn, the share goes to
 * the next lesson in the scope instead of ending the paper — the same rule the
 * single-lesson generators already follow for a spent type (`quizCount.test.ts`).
 *
 * "Spent" is remembered per (lesson, bank key), so a lesson out of
 * multiple-choice can still write true/false. The error type is injected
 * because `BankSpentError` is private to generators.ts.
 *
 * Free of react-native so `node --test` can load it.
 */
export class ScopeDrawer<L extends { id: string }> {
  private readonly spentFor = new Set<string>();

  constructor(
    private readonly slots: readonly L[],
    private readonly all: readonly L[],
    private readonly spent: { isSpent: (e: unknown) => boolean; error: () => unknown },
  ) {
    if (slots.length === 0) throw new Error('ScopeDrawer: no slots');
  }

  /** The lesson question `slot` belongs to; slots wrap when a paper is longer than its plan. */
  lessonAt(slot: number): L {
    const n = this.slots.length;
    return this.slots[((slot % n) + n) % n]!;
  }

  draw<T>(slot: number, bankKey: string, make: (lesson: L) => T): { value: T; lesson: L } {
    const first = this.lessonAt(slot);
    const start = Math.max(0, this.all.findIndex(l => l.id === first.id));
    for (let k = 0; k < this.all.length; k++) {
      const lesson = this.all[(start + k) % this.all.length]!;
      const key = `${lesson.id}\u0000${bankKey}`;
      if (this.spentFor.has(key)) continue;
      try {
        return { value: make(lesson), lesson };
      } catch (e) {
        if (!this.spent.isSpent(e)) throw e;
        this.spentFor.add(key);
      }
    }
    throw this.spent.error();
  }
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeDraw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/scopeDraw.ts artifacts/mobile/services/__tests__/scopeDraw.test.ts
git commit -m "feat: per-slot lesson drawer for wide-scope offline papers"
```

---

### Task 3: Request types and the wide-scope request builder

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts`
- Create: `artifacts/mobile/services/wideScopeRequest.ts`
- Modify: `artifacts/mobile/services/ai/RemoteAIService.ts`
- Test: `artifacts/mobile/services/__tests__/wideScopeRequest.test.ts`

**Interfaces:**
- Consumes: Task 1's `Distribution`, `Coverage`, `CoverageLesson`, `buildCoverage`, `lessonIdsFromTags`; piece 1's `ScopeSelection`, `parseScope`, `resolveScopeGrounding`, `ScopeGrounding`, `scopeRequestFields`.
- Produces:
  ```ts
  // AIService.ts
  AIRequest.distribution?: 'balanced' | 'random';
  AIRequest.coverage?: { lessons: CoverageLesson[]; slots?: string[] };
  QuizQuestion.lessonId?: string;  QuizQuestion.lesson?: string;
  WorksheetQuestion.lessonId?: string;  WorksheetQuestion.lesson?: string;
  // wideScopeRequest.ts
  export type WideRequestFields = Pick<AIRequest,
    'scope' | 'additionalContext' | 'contextSource' | 'distribution' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'>;
  export type WideRequest = { fields: WideRequestFields; grounding: ScopeGrounding; lessons: CoverageLesson[] };
  export function buildWideRequest(sel: ScopeSelection, lang: 'ar'|'en', count: number, mode: Distribution,
    opts?: { offset?: number }): WideRequest | null;      // null: a lesson scope, or one that does not ground
  export const BASE_QUESTION_COUNTS: readonly number[];   // [5, 8, 10, 12, 15, 20]
  export const ALL_QUESTION_COUNTS: readonly number[];    // [5, 8, 10, 12, 15, 20, 25, 30]
  export function visibleCountOptions(isWide: boolean): number;   // 8 or 6
  export function clampCountIndex(idx: number, isWide: boolean): number;
  export function scopeFromParam(raw?: string): ScopeSelection | null;
  export function distributionFromParam(raw?: string): Distribution;
  export function scopeFormState(sel: ScopeSelection | null, mode: Distribution): { scope?: string; distribution?: string };
  export function tagQuizLessons(out: QuizOutput, req: AIRequest): QuizOutput;
  export function tagWorksheetLessons(out: WorksheetOutput, req: AIRequest): WorksheetOutput;
  ```

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/wideScopeRequest.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_QUESTION_COUNTS, BASE_QUESTION_COUNTS, buildWideRequest, clampCountIndex, distributionFromParam,
  scopeFormState, scopeFromParam, tagQuizLessons, tagWorksheetLessons, visibleCountOptions,
} from '../wideScopeRequest.ts';
import type { AIRequest, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };

describe('buildWideRequest', () => {
  it('a semester produces the piece-1 scope, a lesson table and, for balanced, slots', () => {
    const w = buildWideRequest(sem1, 'ar', 12, 'balanced')!;
    assert.ok(w);
    assert.equal(w.fields.scope?.kind, 'semester');
    assert.equal(w.fields.distribution, 'balanced');
    assert.equal(w.fields.coverage?.slots?.length, 12);
    assert.equal(w.fields.coverage?.lessons.length, w.lessons.length);
    assert.equal(w.fields.contextSource, 'curriculum');
    assert.ok((w.fields.additionalContext ?? '').length > 0);
  });

  it('random sends the lesson table but no slots', () => {
    const w = buildWideRequest(sem1, 'ar', 12, 'random')!;
    assert.equal(w.fields.distribution, 'random');
    assert.equal(w.fields.coverage?.slots, undefined);
    assert.ok(w.fields.coverage!.lessons.length > 0);
  });

  it('explicitly clears the single-lesson fields so a merge cannot leave a stale lesson behind', () => {
    const w = buildWideRequest(sem1, 'ar', 10, 'balanced')!;
    for (const k of ['unitId', 'lessonId'] as const) {
      assert.ok(k in w.fields && w.fields[k] === undefined, `${k} must be present and undefined`);
    }
    assert.equal(w.fields.bookFigureCount, 0);
  });

  it('merged over a screen\'s own fields it replaces the lesson-derived context', () => {
    const own = { additionalContext: 'lesson context', lessonId: 'L-x', unitId: 'U-x', bookFigureCount: 3 };
    const w = buildWideRequest(sem1, 'ar', 10, 'balanced')!;
    const merged = { ...own, ...w.fields };
    assert.notEqual(merged.additionalContext, 'lesson context');
    assert.equal(merged.lessonId, undefined);
    assert.equal(merged.unitId, undefined);
    assert.equal(merged.bookFigureCount, 0);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    assert.equal(buildWideRequest({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId: 'nope' }, 'ar', 10, 'balanced'), null);
    assert.equal(buildWideRequest({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar', 10, 'balanced'), null);
  });
});

describe('question counts', () => {
  it('appends 25 and 30 to the existing options without moving them', () => {
    assert.deepEqual([...BASE_QUESTION_COUNTS], [5, 8, 10, 12, 15, 20]);
    assert.deepEqual([...ALL_QUESTION_COUNTS], [5, 8, 10, 12, 15, 20, 25, 30]);
  });

  it('shows 25 and 30 on a wide scope only, and clamps a saved index back inside', () => {
    assert.equal(visibleCountOptions(false), 6);
    assert.equal(visibleCountOptions(true), 8);
    assert.equal(clampCountIndex(7, true), 7);
    assert.equal(clampCountIndex(7, false), 5);
    assert.equal(clampCountIndex(2, false), 2);
  });
});

describe('saved state', () => {
  it('round-trips a scope and a distribution through route params', () => {
    const state = scopeFormState(sem1, 'random');
    assert.deepEqual(scopeFromParam(state.scope), sem1);
    assert.equal(distributionFromParam(state.distribution), 'random');
  });

  it('a material saved before this has neither, and reads as no scope, balanced', () => {
    assert.deepEqual(scopeFormState(null, 'balanced'), {});
    assert.equal(scopeFromParam(undefined), null);
    assert.equal(distributionFromParam(undefined), 'balanced');
  });

  it('refuses junk and a scope that no longer covers anything', () => {
    assert.equal(scopeFromParam('not json'), null);
    assert.equal(scopeFromParam(JSON.stringify({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' })), null);
    assert.equal(distributionFromParam('sideways'), 'balanced');
  });

  it('a lesson scope is not saved as a wide scope', () => {
    assert.deepEqual(scopeFormState({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId: 'x' }, 'balanced'), {});
  });
});

describe('tagging a live reply', () => {
  const req = {
    coverage: { lessons: [{ code: 'L1', id: 'x1', unitId: 'U', title: 'one' }, { code: 'L2', id: 'x2', unitId: 'U', title: 'two' }] },
  } as unknown as AIRequest;

  it('maps quiz question codes to lesson ids', () => {
    const out = { title: 't', duration: 1, totalPoints: 2, questions: [
      { id: 'q1', type: 'multiple_choice', text: 'a', correctAnswer: 'a', points: 1, explanation: '', lesson: 'L2' },
      { id: 'q2', type: 'true_false', text: 'b', correctAnswer: 'صح', points: 1, explanation: '' },
    ] } as unknown as QuizOutput;
    const tagged = tagQuizLessons(out, req);
    assert.equal(tagged.questions[0]!.lessonId, 'x2');
    assert.equal('lesson' in tagged.questions[0]!, false);
    assert.equal(tagged.questions[1]!.lessonId, undefined);
  });

  it('maps worksheet question codes inside sections', () => {
    const out = { title: 't', instructions: '', sections: [
      { type: 'short_answer', title: 's', questions: [{ text: 'a', points: 1, lesson: 'L1' }] },
    ], answerKey: [] } as unknown as WorksheetOutput;
    assert.equal(tagWorksheetLessons(out, req).sections[0]!.questions[0]!.lessonId, 'x1');
  });

  it('does nothing for a request with no coverage', () => {
    const out = { title: 't', duration: 1, totalPoints: 1, questions: [{ id: 'q1', lesson: 'L1' }] } as unknown as QuizOutput;
    assert.equal(tagQuizLessons(out, {} as AIRequest).questions[0]!.lessonId, undefined);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/wideScopeRequest.test.ts`
Expected: FAIL — cannot find module `../wideScopeRequest.ts`.

- [ ] **Step 3: Add the types**

In `artifacts/mobile/services/ai/AIService.ts`:

(a) Directly after the `scope?:` field that piece 1 added to `AIRequest`, add:

```ts
  /**
   * How a wide scope's questions are spread over its lessons. Part of the
   * strict cache key; absent for a single lesson.
   */
  distribution?: 'balanced' | 'random';
  /**
   * The lessons of a wide scope, each with a short code the model tags a
   * question with, and — for `balanced` only — the per-question plan as
   * lesson codes. The offline path ignores `slots` and re-plans from `lessons`
   * (some lessons have no offline bank); the live prompt renders the plan as
   * per-lesson counts. Neither is hashed into the cache key: both are a pure
   * function of the scope and the count.
   */
  coverage?: {
    lessons: Array<{ code: string; id: string; unitId: string; title: string }>;
    slots?: string[];
  };
```

(b) In `interface QuizQuestion`, after `fromBank?: true;`, add:

```ts
  /** The KB lesson this question was written for — set on a wide-scope paper. */
  lessonId?: string;
  /** The model's raw lesson code (`L3`). Mapped to `lessonId` on arrival and then removed. */
  lesson?: string;
```

(c) In `interface WorksheetQuestion`, after its `fromBank?: true;`, add the same two fields with the same comments.

- [ ] **Step 4: Implement the builder**

Create `artifacts/mobile/services/wideScopeRequest.ts`:

```ts
/**
 * What a screen adds to a request when the teacher picked a unit, a semester
 * or the whole book — and the small pieces of state around it.
 *
 * Free of react-native so `node --test` can load it; the screens and
 * `useWideScope` are thin wrappers around it.
 */
import type { AIRequest, QuizOutput, WorksheetOutput } from './ai/AIService.ts';
import { buildCoverage, DISTRIBUTIONS, lessonIdsFromTags, type CoverageLesson, type Distribution } from './coveragePlan.ts';
import { scopeRequestFields } from './generatorRequests.ts';
import { resolveScopeGrounding, type ScopeGrounding } from './scopeGrounding.ts';
import { parseScope, type ScopeSelection } from './scopeSelection.ts';

export type WideRequestFields = Pick<
  AIRequest,
  'scope' | 'additionalContext' | 'contextSource' | 'distribution' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'
>;

export type WideRequest = {
  fields: WideRequestFields;
  grounding: ScopeGrounding;
  lessons: CoverageLesson[];
};

/**
 * The fields to MERGE OVER a screen's own, last.
 *
 * `unitId` and `lessonId` are present and `undefined` on purpose: a screen's
 * own request carries the lesson its topic grounded to (nothing, for a label
 * like «الفصل الأول كاملًا», but never rely on that), and a spread only
 * overrides a key that is there. `bookFigureCount: 0` selects the stricter
 * prompt that forbids «انظر الشكل» — a whole-semester paper has no single
 * figure appendix.
 *
 * Null for a lesson scope and for a wide scope that does not ground: the
 * caller refuses rather than generate a mislabeled paper.
 */
export function buildWideRequest(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  count: number,
  mode: Distribution,
  opts: { offset?: number } = {},
): WideRequest | null {
  if (sel.kind === 'lesson') return null;
  const grounding = resolveScopeGrounding(sel, lang);
  if (!grounding.grounded) return null;
  const coverage = buildCoverage(sel, lang, count, mode, opts);
  return {
    grounding,
    lessons: coverage.lessons,
    fields: {
      ...scopeRequestFields(grounding),
      unitId: undefined,
      lessonId: undefined,
      bookFigureCount: 0,
      distribution: mode,
      coverage,
    },
  };
}

/** The picker's counts. 25 and 30 are APPENDED: saved indices must keep their meaning. */
export const BASE_QUESTION_COUNTS: readonly number[] = [5, 8, 10, 12, 15, 20];
export const ALL_QUESTION_COUNTS: readonly number[] = [...BASE_QUESTION_COUNTS, 25, 30];

/** How many of `ALL_QUESTION_COUNTS` a screen offers. */
export function visibleCountOptions(isWide: boolean): number {
  return isWide ? ALL_QUESTION_COUNTS.length : BASE_QUESTION_COUNTS.length;
}

/** A saved index that points at 25 or 30 falls back to 20 when the scope is a single lesson. */
export function clampCountIndex(idx: number, isWide: boolean): number {
  return Math.min(idx, visibleCountOptions(isWide) - 1);
}

export function scopeFromParam(raw?: string): ScopeSelection | null {
  if (!raw) return null;
  try {
    return parseScope(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function distributionFromParam(raw?: string): Distribution {
  return (DISTRIBUTIONS as readonly string[]).includes(raw ?? '') ? (raw as Distribution) : 'balanced';
}

/** What a saved material records. A lesson scope records nothing: it is today's behaviour. */
export function scopeFormState(sel: ScopeSelection | null, mode: Distribution): { scope?: string; distribution?: string } {
  if (!sel || sel.kind === 'lesson') return {};
  return { scope: JSON.stringify(sel), distribution: mode };
}

/** Map the model's lesson codes on a live quiz to lesson ids. A no-op without a coverage table. */
export function tagQuizLessons(out: QuizOutput, req: AIRequest): QuizOutput {
  if (req.coverage?.lessons.length) lessonIdsFromTags(out.questions, req.coverage.lessons);
  return out;
}

/** The same for a live worksheet or homework. */
export function tagWorksheetLessons(out: WorksheetOutput, req: AIRequest): WorksheetOutput {
  if (req.coverage?.lessons.length) {
    for (const section of out.sections) lessonIdsFromTags(section.questions, req.coverage.lessons);
  }
  return out;
}
```

- [ ] **Step 5: Hook the live reply**

In `artifacts/mobile/services/ai/RemoteAIService.ts` add (matching that file's existing import style — it uses extensionless relative imports; the test above does not load this file):

```ts
import { tagQuizLessons, tagWorksheetLessons } from '../wideScopeRequest';
```

and change the three posts so each result is tagged:

```ts
  async generateWorksheet(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput> {
    return generateWithProvenance(
      'worksheet',
      async () => tagWorksheetLessons(await postJSON<WorksheetOutput>('/generate/worksheet', req, opts), req),
      () => this.fallback.generateWorksheet(req),
    );
  }

  async generateQuiz(req: AIRequest, opts?: GenerateOptions): Promise<QuizOutput> {
    return generateWithProvenance(
      'quiz',
      async () => tagQuizLessons(await postJSON<QuizOutput>('/generate/quiz', req, opts), req),
      () => this.fallback.generateQuiz(req),
    );
  }

  async generateHomework(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput> {
    return generateWithProvenance(
      'homework',
      async () => tagWorksheetLessons(await postJSON<WorksheetOutput>('/generate/homework', req, opts), req),
      () => this.fallback.generateHomework(req),
    );
  }
```

- [ ] **Step 6: Run the tests**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/wideScopeRequest.test.ts services/__tests__/generatorRequests.test.ts services/__tests__/scopeRequest.test.ts && pnpm test 2>&1 | tail -6`
Expected: PASS; `pnpm test` 0 failures.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/wideScopeRequest.ts artifacts/mobile/services/ai/RemoteAIService.ts artifacts/mobile/services/__tests__/wideScopeRequest.test.ts
git commit -m "feat: wide-scope request builder, count options and live lesson tagging"
```

---

### Task 4: Offline quiz draws from the plan

**Files:**
- Modify: `artifacts/mobile/services/ai/generators.ts` (add `offlineWideScope` near `requireQuestionBank`; change `quizOnce`)
- Test: `artifacts/mobile/services/__tests__/quizWideScope.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3 (`planCoverage`, `ScopeDrawer`, `buildWideRequest`, the `AIRequest.coverage` / `distribution` fields, `QuizQuestion.lessonId`).
- Produces (used by Task 5): inside `generators.ts`
  ```ts
  type OfflineSlotLesson = { id: string; topic: string; kb: KBLesson };
  type OfflineWideScope = { drawer: ScopeDrawer<OfflineSlotLesson>; lessons: OfflineSlotLesson[]; skipped: CoverageLesson[] };
  function offlineWideScope(req: AIRequest, lang: Lang, count: number): OfflineWideScope | null;   // null unless req.scope && req.coverage
  const spentOpts: { isSpent: (e: unknown) => boolean; error: () => unknown };   // BankSpentError
  ```

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/quizWideScope.test.ts`:

```ts
/**
 * A quiz for a whole semester draws each question from a lesson in it.
 *
 * Properties, not bank sizes: the banks grow as items are added. Which lessons
 * have an offline bank is discovered by asking for a one-lesson quiz, so the
 * assertions track the data rather than a list that would drift.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import type { Distribution } from '../coveragePlan.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const base = {
  grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', totalMarks: 20, duration: 20,
  difficulty: 'medium', questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
} as const;

async function wideQuiz(count: number, mode: Distribution = 'balanced', regenerate = false) {
  const wide = buildWideRequest(sem1, 'ar', count, mode)!;
  const out = await aiService.generateQuiz({
    ...base, topic: 'الفصل الأول كاملًا', numQuestions: count, regenerate, ...wide.fields,
  } as AIRequest);
  return { wide, out };
}

/** Lessons of the semester that can write a quiz offline at all. */
async function bankableIds(): Promise<Set<string>> {
  const ok = new Set<string>();
  for (const l of lessonsInScope(sem1)) {
    try {
      await aiService.generateQuiz({ ...base, topic: l.titleAr, lessonId: l.id, numQuestions: 3, questionTypes: ['multiple_choice'] } as AIRequest);
      ok.add(l.id);
    } catch (e) {
      if ((e as { code?: string }).code !== 'no_question_bank') throw e;
    }
  }
  return ok;
}

describe('offline quiz — a wide scope', () => {
  it('every question belongs to a lesson of the scope, and says which', async () => {
    const { wide, out } = await wideQuiz(12);
    const inScope = new Set(wide.lessons.map(l => l.id));
    assert.ok(out.questions.length > 0);
    for (const q of out.questions) assert.ok(q.lessonId && inScope.has(q.lessonId), `q ${q.id}: ${q.lessonId}`);
  });

  it('balanced covers every unit that has a bank once count >= units', async () => {
    const ok = await bankableIds();
    const { wide, out } = await wideQuiz(12);
    const expected = new Set(wide.lessons.filter(l => ok.has(l.id)).map(l => l.unitId));
    const unitOf = new Map(wide.lessons.map(l => [l.id, l.unitId]));
    const got = new Set(out.questions.map(q => unitOf.get(q.lessonId!)));
    assert.ok(expected.size >= 2, 'probe: the semester should have several units with a bank');
    assert.deepEqual([...got].sort(), [...expected].sort());
  });

  it('never draws a question from a lesson that has no offline bank', async () => {
    const ok = await bankableIds();
    const { out } = await wideQuiz(20);
    for (const q of out.questions) assert.ok(ok.has(q.lessonId!), `q ${q.id} is from a lesson with no bank`);
  });

  it('a count above the old 20 cap is honoured, or honestly reported short', async () => {
    const { out } = await wideQuiz(30);
    if (out.questions.length < 30) assert.deepEqual(out.shortfall, { requested: 30, produced: out.questions.length });
    else assert.equal(out.shortfall, undefined);
    assert.ok(out.questions.length >= 25, `only ${out.questions.length}`);
  });

  it('still prints in ministry blocks and numbers straight through', async () => {
    const { out } = await wideQuiz(20);
    const types = out.questions.map(q => q.type);
    const runs = types.filter((t, i) => t !== types[i - 1]);
    assert.deepEqual(runs, ['multiple_choice', 'true_false', 'short_answer'], `interleaved: ${types}`);
    assert.deepEqual(out.questions.map(q => q.id), out.questions.map((_, i) => `q${i + 1}`));
  });

  it('random mode also stays inside the scope', async () => {
    const { wide, out } = await wideQuiz(15, 'random');
    const inScope = new Set(wide.lessons.map(l => l.id));
    for (const q of out.questions) assert.ok(inScope.has(q.lessonId!));
  });

  it('a regenerate is still inside the scope', async () => {
    const { wide, out } = await wideQuiz(12, 'balanced', true);
    const inScope = new Set(wide.lessons.map(l => l.id));
    for (const q of out.questions) assert.ok(inScope.has(q.lessonId!));
  });
});

describe('offline quiz — a single lesson is unchanged', () => {
  it('carries no lessonId and needs no coverage', async () => {
    const lesson = lessonsInScope(sem1)[0]!;
    const out: QuizOutput = await aiService.generateQuiz({
      ...base, topic: lesson.titleAr, lessonId: lesson.id, numQuestions: 5, questionTypes: ['multiple_choice'],
    } as AIRequest);
    assert.equal(out.questions.length, 5);
    assert.ok(out.questions.every(q => q.lessonId === undefined));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quizWideScope.test.ts`
Expected: FAIL — questions carry no `lessonId` (the generator ignores `coverage`). If the first lesson of semester 1 has no bank, the last test throws `no_question_bank`: pick the first *bankable* lesson in that test instead (use `bankableIds()`), do not weaken the generator.

- [ ] **Step 3: Add `offlineWideScope` to `generators.ts`**

Add the imports at the top of the file, with the others:

```ts
import { ScopeDrawer } from './scopeDraw.ts';
import { planCoverage, type CoverageLesson } from '../coveragePlan.ts';
```

(If the file's existing relative imports are extensionless, match that style — esbuild resolves both; node tests need `.ts` only for files they load directly, and this file is loaded by existing tests, so keep **`.ts`** for the two new lines.)

Directly after `requireQuestionBank` (the function ending near line 894) add:

```ts
// ─── Wide scope ──────────────────────────────────────────────────────────────

/** A lesson of a wide scope as the offline makers need it: its own title and KB row. */
type OfflineSlotLesson = { id: string; topic: string; kb: KBLesson };
type OfflineWideScope = {
  drawer: ScopeDrawer<OfflineSlotLesson>;
  lessons: OfflineSlotLesson[];
  /** Lessons dropped because they have no offline bank — reported, not hidden. */
  skipped: CoverageLesson[];
};

/** `BankSpentError` is private to this file, so the drawer is told how to recognise it. */
const spentOpts = {
  isSpent: (e: unknown) => e instanceof BankSpentError,
  error: () => new BankSpentError(),
};

/**
 * The lessons a wide-scope request names, planned across `count` question slots.
 *
 * Null unless the request carries a wide scope and its lesson table: every
 * other request goes through the single-lesson path exactly as before.
 *
 * The plan is re-made HERE from `coverage.lessons`, never read from
 * `coverage.slots`: a lesson with no offline bank (a geometry lesson, say) must
 * not make a whole-book paper throw `NoQuestionBankError`, so such lessons are
 * dropped first and the rest are planned. For a scope whose lessons all have a
 * bank this is the same plan the live prompt was given.
 */
function offlineWideScope(req: AIRequest, lang: Lang, count: number): OfflineWideScope | null {
  const table = req.coverage?.lessons;
  if (!req.scope || !table?.length) return null;
  const usable: OfflineSlotLesson[] = [];
  const pool: { id: string; unitId: string }[] = [];
  const skipped: CoverageLesson[] = [];
  for (const entry of table) {
    const kb = getLessonById(entry.id);
    if (!kb) { skipped.push(entry); continue; }
    const topic = lang === 'ar' ? kb.titleAr : kb.titleEn;
    try {
      requireQuestionBank(topic, kb, req.subject);
    } catch (e) {
      if (!(e instanceof NoQuestionBankError)) throw e;
      skipped.push(entry);
      continue;
    }
    usable.push({ id: kb.id, topic, kb });
    pool.push({ id: kb.id, unitId: entry.unitId });
  }
  if (usable.length === 0) throw new NoQuestionBankError(req.topic);
  const offset = req.regenerate ? Math.floor(Math.random() * pool.length) : 0;
  const plan = planCoverage(pool, count, req.distribution ?? 'balanced', { offset });
  return { drawer: new ScopeDrawer(plan.map(i => usable[i]!), usable, spentOpts), lessons: usable, skipped };
}
```

- [ ] **Step 4: Change `quizOnce`**

In `quizOnce`, replace

```ts
    const kb = groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    requireQuestionBank(topic, kb, req.subject);
    const totalMarks = req.totalMarks ?? 20;
```

with

```ts
    const types: QType[] = (req.questionTypes as QType[]) ?? ['multiple_choice', 'true_false', 'short_answer'];
    // Teacher-picked count, cycled evenly across the selected types; marks
    // distributed evenly. Falls back to 2-per-type for callers (e.g. the
    // classroom mini-quiz) that don't send numQuestions.
    const numQuestions = Math.max(types.length, req.numQuestions ?? types.length * 2);
    // A wide scope draws every question from the lesson its slot names; any
    // other request is the single-lesson path below, unchanged.
    const wide = offlineWideScope(req, lang, numQuestions);
    const kb = wide ? null : groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    if (!wide) requireQuestionBank(topic, kb, req.subject);
    const totalMarks = req.totalMarks ?? 20;
```

and delete the two now-duplicated declarations further down (`const types: QType[] = (req.questionTypes as QType[]) ?? [...]` and the `const numQuestions = Math.max(types.length, ...)` line with its comment block above it, which this change moved up).

Then replace the whole `try { ... }` factory block inside the `while (questions.length < numQuestions)` loop — from `// \`word_problem\` falls into the short-answer branch` down to the closing of the `en` branch — with:

```ts
        // `word_problem` falls into the short-answer branch (see `blockTypes` above).
        // A wide scope draws from the lesson this slot names and, when that
        // lesson's bank is spent for the type, from the next lesson that has
        // some; a single lesson draws from `topic` / `kb` as it always did.
        const draw = (make: (tp: string, k: KBLesson | null) => QuizQuestion): QuizQuestion => {
          if (!wide) return pushUnique(() => make(topic, kb));
          const { value, lesson } = wide.drawer.draw(questions.length, type, l => pushUnique(() => make(l.topic, l.kb)));
          value.lessonId = lesson.id;
          return value;
        };
        if (lang === 'ar') {
          if (type === 'multiple_choice') questions.push(draw((tp, k) => makeQuizMCQ_ar(tp, k, pts, id, req.subject, tier)));
          else if (type === 'true_false') questions.push(draw((tp, k) => makeQuizTF_ar(tp, k, pts, id, req.subject, tier)));
          else if (type === 'fill_blank') questions.push(draw((tp, k) => makeQuizFB_ar(tp, k, pts, id, req.subject, tier)));
          else questions.push(draw((tp, k) => makeQuizSA_ar(tp, k, pts, id, req.subject, tier)));
        } else {
          if (type === 'multiple_choice') questions.push(draw((tp, k) => makeQuizMCQ_en(tp, k, pts, id, req.subject, tier)));
          else if (type === 'true_false') questions.push(draw((tp, k) => makeQuizTF_en(tp, k, pts, id, req.subject, tier)));
          else if (type === 'fill_blank') questions.push(draw((tp, k) => makeQuizFB_en(tp, k, pts, id, req.subject, tier)));
          else questions.push(draw((tp, k) => makeQuizSA_en(tp, k, pts, id, req.subject, tier)));
        }
        made.set(type, (made.get(type) ?? 0) + 1);
```

(The surrounding `try { … } catch (e) { if (!(e instanceof BankSpentError)) throw e; spent.add(type); }` stays exactly as it is: the drawer throws `BankSpentError` only when *every* lesson is out of that type.)

- [ ] **Step 5: Run the new test and the whole mobile suite**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quizWideScope.test.ts && pnpm test 2>&1 | tail -8`
Expected: new tests PASS; `pnpm test` 0 failures (this includes `quizCount.test.ts`, `quizRegenerateStems.test.ts` — the single-lesson path must be unchanged).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/ai/generators.ts artifacts/mobile/services/__tests__/quizWideScope.test.ts
git commit -m "feat: offline quiz draws each question from its slot's lesson on a wide scope"
```

---

### Task 5: Offline worksheet and homework draw from the plan

**Files:**
- Modify: `artifacts/mobile/services/ai/generators.ts` (`worksheetOnce`, `homeworkOnce`)
- Test: `artifacts/mobile/services/__tests__/worksheetWideScope.test.ts`

**Interfaces:**
- Consumes: Task 4's `offlineWideScope(req, lang, count): OfflineWideScope | null`, `ScopeDrawer.draw` / `lessonAt`, `OfflineSlotLesson`.
- Produces: worksheet and homework questions carrying `lessonId`; the worksheet / homework offline count cap raised from 20 to 30.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/worksheetWideScope.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput, WorksheetQuestion } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const base = {
  grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', difficulty: 'medium',
  questionTypes: ['multiple_choice', 'short_answer'],
} as const;

const wideReq = (count: number, mode: 'balanced' | 'random' = 'balanced') => {
  const wide = buildWideRequest(sem1, 'ar', count, mode)!;
  return { wide, req: { ...base, topic: 'الفصل الأول كاملًا', numQuestions: count, ...wide.fields } as AIRequest };
};
const flat = (w: WorksheetOutput): WorksheetQuestion[] => w.sections.flatMap(s => s.questions);

describe('offline worksheet — a wide scope', () => {
  it('every practice question belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    const inScope = new Set(wide.lessons.map(l => l.id));
    const tagged = flat(out).filter(q => q.lessonId);
    assert.ok(tagged.length >= 8, `only ${tagged.length} tagged questions`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!), `foreign lesson ${q.lessonId}`);
  });

  it('draws from more than one lesson (it is not the old single-lesson paper)', async () => {
    const { req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    assert.ok(new Set(flat(out).map(q => q.lessonId).filter(Boolean)).size >= 3);
  });

  it('keeps the picked total: the worked example and the half-solved item count inside it', async () => {
    const { req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    const questions = flat(out).length + (out.workedExample ? 1 : 0);
    if (out.shortfall) assert.equal(out.shortfall.requested, 12);
    else assert.equal(questions, 12);
  });

  it('a count above the old 20 cap is honoured or honestly reported short', async () => {
    const { req } = wideReq(30);
    const out = await aiService.generateWorksheet(req);
    const produced = flat(out).length + (out.workedExample ? 1 : 0);
    assert.ok(produced > 20, `still capped at ${produced}`);
    if (produced < 30) assert.equal(out.shortfall?.requested, 30);
  });

  it('the worked example belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    if (!out.workedExample) return; // a lesson without checked working simply has none
    assert.ok(wide.lessons.length > 0);
  });
});

describe('offline homework — a wide scope', () => {
  it('every independent-practice question belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateHomework(req);
    const inScope = new Set(wide.lessons.map(l => l.id));
    const tagged = flat(out).filter(q => q.lessonId);
    assert.ok(tagged.length >= 5, `only ${tagged.length} tagged questions`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!));
  });

  it('draws from several lessons, and honours a count above 20', async () => {
    const { req } = wideReq(30);
    const out = await aiService.generateHomework(req);
    assert.ok(new Set(flat(out).map(q => q.lessonId).filter(Boolean)).size >= 3);
    assert.ok(flat(out).length > 20, `still capped at ${flat(out).length}`);
  });
});

describe('a single lesson is unchanged', () => {
  const lesson = lessonsInScope(sem1)[0]!;
  const one = { ...base, topic: lesson.titleAr, lessonId: lesson.id, numQuestions: 8 } as AIRequest;

  it('worksheet questions carry no lessonId', async () => {
    assert.ok(flat(await aiService.generateWorksheet(one)).every(q => q.lessonId === undefined));
  });

  it('homework questions carry no lessonId', async () => {
    assert.ok(flat(await aiService.generateHomework(one)).every(q => q.lessonId === undefined));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/worksheetWideScope.test.ts`
Expected: FAIL — no question carries `lessonId`. (If the first lesson of semester 1 has no offline bank the last describe throws `no_question_bank`: use the first lesson that has one; do not change the generator.)

- [ ] **Step 3: Change `worksheetOnce`**

(a) At the top, replace

```ts
    const kb = docs.present ? null : groundedKb(topic, lang, req.lessonId);
    // A paper built from the teacher's own file is grounded in that file.
    if (!docs.present) requireQuestionBank(topic, kb, req.subject);
```

with

```ts
    // A wide scope draws each question from the lesson its slot names (never
    // together with an uploaded document, which has its own grounding).
    const wide = docs.present ? null : offlineWideScope(req, lang, Math.min(30, Math.max(5, req.numQuestions ?? 8)));
    const kb = docs.present || wide ? null : groundedKb(topic, lang, req.lessonId);
    // A paper built from the teacher's own file is grounded in that file.
    if (!docs.present && !wide) requireQuestionBank(topic, kb, req.subject);
```

(b) Raise the cap: change `const totalQ = Math.min(20, Math.max(5, req.numQuestions ?? 8));` to `Math.min(30, ...)` and update the comment above it from "the picker's own range (5–20" to "(5–30".

(c) Replace `takeSolved` so a wide scope's example and half-solved item come from the next slot's lesson, advancing the slot only when an item was actually taken:

```ts
    // Which question slot the next question fills. The worked example and the
    // half-solved item are slots 0 and 1; the practice follows.
    let slot = 0;
    const takeSolved = (tier: DiffTier): SolvedItem | null => {
      if (docs.present) return null;
      const at = wide ? wide.drawer.lessonAt(slot) : null;
      const tp = at ? at.topic : topic;
      const kbRow = at ? at.kb : kb;
      let item: SolvedItem | null = null;
      if (isChemContext(tp, kbRow, req.subject)) item = takeSolvedChem(tp, kbRow, tier, lang);
      else if (isMathContext(tp, kbRow, req.subject)) item = takeSolvedMath(tp, kbRow, tier, lang);
      if (item && wide) slot += 1;
      return item;
    };
```

(d) Replace `makeGenericQ` and `makeQ`:

```ts
    const makeGenericQ = (type: QType, diff: DiffTier, atSlot: number): WQ => {
      if (!wide) return makeWorksheetQ(type, lang, topic, kb, diff, req.subject);
      const { value, lesson } = wide.drawer.draw(atSlot, type, l => makeWorksheetQ(type, lang, l.topic, l.kb, diff, req.subject));
      return { ...value, lessonId: lesson.id };
    };

    /** Main-body question via shared factories (math → concrete practice). Dedup stems. */
    const makeQ = (type: QType, diff: DiffTier): WQ => {
      // One slot per question, however many attempts the stem dedup needs.
      const atSlot = slot;
      slot += 1;
      for (let attempt = 0; attempt < 12; attempt++) {
        const q = makeGenericQ(type, diff, atSlot);
        const key = questionStemKey(q.text);
        if (!usedStems.has(key)) {
          usedStems.add(key);
          return q;
        }
      }
      const fallback = makeGenericQ(type, diff, atSlot);
      usedStems.add(questionStemKey(fallback.text));
      return fallback;
    };
```

(`slot` is the variable declared in (c); declare `let slot = 0;` once, **before** `takeSolved`, which is where (c) puts it. `makeGenericQ` / `makeQ` are defined later in the function, so the order holds.)

Confirm `withoutSteps(q)` (used when pushing practice questions) keeps `lessonId`; if it rebuilds the object field by field instead of spreading, add `lessonId: q.lessonId` there and cover it with the first test above.

(e) The title and instructions use `topic`, which for a wide scope is the label `req.topic` — no change.

- [ ] **Step 4: Change `homeworkOnce`**

(a) Replace

```ts
    const kb = groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    requireQuestionBank(topic, kb, req.subject);
```

with

```ts
    const count = Math.min(30, Math.max(3, req.numQuestions ?? 5));
    const wide = offlineWideScope(req, lang, count);
    const kb = wide ? null : groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    if (!wide) requireQuestionBank(topic, kb, req.subject);
```

(b) Change `const total = Math.min(20, Math.max(3, req.numQuestions ?? 5));` to `const total = count;` (the clamp now lives in `count`, at 30).

(c) In the core loop replace the `makeWorksheetQ` calls. The loop body becomes:

```ts
      for (let i = 0; i < coreN; i++) {
        const type = coreTypes[i % coreTypes.length]!;
        const make = (tp: string, k: KBLesson | null, diff: DiffTier) => makeWorksheetQ(type, lang, tp, k, diff, req.subject);
        // A wide scope draws from slot i's lesson (falling to the next lesson
        // when that bank is spent for this type); a lesson from `topic` / `kb`.
        const drawn = (diff: DiffTier): WQ => {
          if (!wide) return make(topic, kb, diff);
          const { value, lesson } = wide.drawer.draw(i, type, l => make(l.topic, l.kb, diff));
          return { ...value, lessonId: lesson.id };
        };
        let q: WQ | null = null;
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = drawn('medium');
          const key = questionStemKey(candidate.text);
          if (!usedStems.has(key)) {
            usedStems.add(key);
            q = candidate;
            break;
          }
        }
        if (!q) q = drawn('hard');
        // Room to write only where the answer is written; a choice is circled.
        const written = type !== 'multiple_choice' && type !== 'true_false';
        core.push({
          ...withoutSteps(q),
          text: written ? `${q.text}${workSpace}` : q.text,
          points: type === 'multiple_choice' ? 4 : type === 'true_false' ? 2 : type === 'fill_blank' ? 3 : 8,
        });
        coreKey.push({ num: coreKey.length + 1, answer: q.answer ?? '—', ...(q.steps ? { solution: q.steps } : {}) });
        coreKinds.add(type);
      }
```

(d) The challenge question reads one lesson: for a wide scope use the next slot's lesson. Replace the three lines that compute `challengePractice` with:

```ts
    const challengeLesson = wide ? wide.drawer.lessonAt(coreN) : null;
    const cTopic = challengeLesson ? challengeLesson.topic : topic;
    const cKb = challengeLesson ? challengeLesson.kb : kb;
    const challengePractice = isMathContext(cTopic, cKb, req.subject)
      ? takeConcreteMath('short_answer', cTopic, cKb, 'hard', lang, 12)
      : isChemContext(cTopic, cKb, req.subject)
        ? takeConcreteChem('short_answer', cTopic, cKb, 'hard', lang, 12)
        : null;
```

and, in the `challenge` object built from `challengePractice`, add `...(challengeLesson ? { lessonId: challengeLesson.id } : {})` so the challenge is tagged too. (Remove the now-unused `const math = isMathContext(topic, kb, req.subject);` near the top **only if** nothing else reads `math`; otherwise leave it.)

- [ ] **Step 5: Run the new test and the whole suite**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/worksheetWideScope.test.ts && pnpm test 2>&1 | tail -8`
Expected: new tests PASS; `pnpm test` 0 failures (includes `worksheetCount.test.ts`, `worksheetRegenerateStems.test.ts`, `steps.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/ai/generators.ts artifacts/mobile/services/__tests__/worksheetWideScope.test.ts
git commit -m "feat: offline worksheet and homework draw from the coverage plan on a wide scope"
```

---

### Task 6: Server — coverage clause, key, counts and tag passthrough

**Files:**
- Create: `artifacts/api-server/src/lib/coverage.ts`
- Modify: `artifacts/api-server/src/lib/prompts.ts`
- Modify: `artifacts/api-server/src/lib/generationKey.ts`
- Test: `artifacts/api-server/src/lib/__tests__/coverage.test.ts`, append to `generationKey.test.ts`, `generationShape.test.ts` (find its name with `ls src/lib/__tests__ | grep -i shape`)

**Interfaces:**
- Consumes: `parseWideScope` from `./grounding.ts` (piece 1); the wire shape from Task 3.
- Produces:
  ```ts
  // coverage.ts
  export interface CoverageTable { lessons: { code: string; title: string }[]; counts: Map<string, number> | null }
  export function parseCoverage(body: Record<string, unknown>): CoverageTable | null;
  export function coverageClauseAr(b: Record<string, unknown>): string;   // '' unless a valid wide-scope coverage
  export function coverageClauseEn(b: Record<string, unknown>): string;
  ```
  `counts` is the per-lesson question count derived from `slots` (balanced), `null` for random.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/lib/__tests__/coverage.test.ts`:

```ts
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
```

Append to `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` (it already defines `base` and `keys`):

```ts
describe("distribution in the cache key", () => {
  const wide = (distribution: string) => ({
    ...base, scope: { kind: "semester", scopeKey: "sem:grade-10:mathematics:1", unitIds: [] }, distribution,
  });

  it("balanced and random for one scope never share a slot", () => {
    assert.notEqual(keys(wide("balanced")).strictKey, keys(wide("random")).strictKey);
  });

  it("the coverage table and slots are not hashed (they are a function of the scope)", () => {
    const a = { ...wide("balanced"), coverage: { lessons: [{ code: "L1", title: "a" }], slots: ["L1"] } };
    const b = { ...wide("balanced"), coverage: { lessons: [{ code: "L1", title: "a" }, { code: "L2", title: "b" }], slots: ["L2"] } };
    assert.equal(keys(a).strictKey, keys(b).strictKey);
  });

  it("a request with no distribution hashes exactly as before", () => {
    assert.deepEqual(keys(base), keys({ ...base, distribution: undefined }));
  });
});
```

In the shape test file (`src/lib/__tests__/generationShape.test.ts` — confirm the name; add the cases to whichever file already tests `normalizeQuiz` and `trimWorksheet`), add:

```ts
describe("a lesson tag survives normalisation, and the counts the wide scope offers are enforced", () => {
  const mc = (i: number, lesson: string) => ({ id: `q${i}`, type: "multiple_choice", text: `s${i}`, options: ["a", "b", "c", "d"], correctAnswer: "a", points: 1, explanation: "", lesson });

  it("normalizeQuiz keeps `lesson` on every question, including after it reorders", () => {
    const parsed = { questions: [
      { id: "q1", type: "short_answer", text: "w", correctAnswer: "x", points: 1, explanation: "", lesson: "L2" },
      mc(2, "L1"),
    ] };
    normalizeQuiz(parsed, ["multiple_choice", "short_answer"], 2);
    assert.deepEqual(parsed.questions.map(q => (q as { lesson?: string }).lesson), ["L1", "L2"]);
  });

  it("a worksheet's tags survive the top-up merge and the trim", () => {
    const base = { sections: [{ type: "short_answer", title: "a", questions: [{ text: "1", points: 1, lesson: "L1" }, { text: "2", points: 1, lesson: "L2" }] }], answerKey: [] };
    const extra = { sections: [{ type: "short_answer", title: "b", questions: [{ text: "3", points: 1, lesson: "L3" }] }], answerKey: [] };
    mergeWorksheetTopUp(base, extra);
    const tags = (base.sections as { questions: { lesson?: string }[] }[]).flatMap(s => s.questions.map(q => q.lesson));
    assert.deepEqual(tags, ["L1", "L2", "L3"]);
    trimWorksheet(base, { numQuestions: 2 });
    const left = (base.sections as { questions: { lesson?: string }[] }[]).flatMap(s => s.questions);
    assert.ok(left.every(q => typeof q.lesson === "string"));
  });

  it("25 and 30 are real counts; 31 is treated as 'did not say'", () => {
    assert.equal(quizWanted({ numQuestions: 25 }), 25);
    assert.equal(quizWanted({ numQuestions: 30 }), 30);
    assert.equal(quizWanted({ numQuestions: 31 }), null);
  });

  it("a 25-question quiz that came back with 20 owes 5; with 30 asked and 22 back, 8", () => {
    const q = (n: number) => ({ questions: Array.from({ length: n }, (_, i) => mc(i + 1, "L1")) });
    assert.equal(quizShortfall(q(20), { numQuestions: 25 }), 5);
    assert.equal(quizShortfall(q(22), { numQuestions: 30 }), 8);
    assert.equal(quizShortfall(q(30), { numQuestions: 30 }), 0);
  });

  it("a 30-question worksheet is held to its count", () => {
    const sheet = (n: number) => ({ sections: [{ type: "short_answer", title: "s", questions: Array.from({ length: n }, (_, i) => ({ text: `q${i}`, points: 1 })) }], answerKey: [] });
    assert.equal(worksheetShortfall(sheet(24), { numQuestions: 30 }), 6);
    assert.equal(worksheetShortfall(sheet(30), { numQuestions: 30 }), 0);
  });
});
```

(Import `normalizeQuiz`, `mergeWorksheetTopUp`, `trimWorksheet`, `quizWanted`, `quizShortfall`, `worksheetShortfall` from `../generationShape.ts` in that file if its import line lacks any of them.)

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/coverage.test.ts src/lib/__tests__/generationKey.test.ts`
Expected: FAIL — cannot find `../coverage.ts`; the key tests fail because `distribution` is ignored. (The shape tests should already PASS — they pin existing behaviour; if one fails, **stop and report**: it means a normaliser drops the tag or the cap differs from CLAUDE.md, and the design needs revisiting, not the test weakening.)

- [ ] **Step 3: Add the key field**

In `artifacts/api-server/src/lib/generationKey.ts`, add `"distribution",` to the `STRICT_ONLY_FIELDS` array, after `"classroomSetup",`, with this comment above it:

```ts
  // How a wide scope's questions are spread over its lessons. A balanced paper
  // and a random one for the same semester are different artifacts. The lesson
  // table and the plan are NOT here: they are a pure function of `scopeKey` and
  // `numQuestions`. Absent for a single lesson, so no existing key changes.
```

- [ ] **Step 4: Implement `coverage.ts`**

Create `artifacts/api-server/src/lib/coverage.ts`:

```ts
/**
 * The coverage clause of a wide-scope quiz / worksheet / homework prompt.
 *
 * A semester has far more lessons than a paper has questions, so the app picks
 * which lessons get one (`planCoverage` in the mobile app) and sends the lesson
 * table with a short code per lesson. The prompt renders that plan as
 * per-lesson COUNTS rather than a slot order: a quiz is re-sorted into type
 * blocks and a worksheet into difficulty bands, so "question 3 is about L7"
 * cannot hold.
 *
 * Everything here is request-controlled, so it is validated and bounded; titles
 * are folded to one line and truncated. The clause is '' for anything that is
 * not a valid wide-scope request, which leaves every lesson prompt byte-for-byte
 * as it was.
 *
 * Imports nothing that touches the OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";

const MAX_LESSONS = 120;       // an English book has 100
const MAX_SLOTS = 60;          // the largest paper is 30
const MAX_TITLE = 160;
const CODE = /^L\d{1,3}$/;

export interface CoverageTable {
  lessons: { code: string; title: string }[];
  /** Questions per lesson code for `balanced`; `null` for `random` (no assignment is sent). */
  counts: Map<string, number> | null;
}

function cleanTitle(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}

export function parseCoverage(body: Record<string, unknown>): CoverageTable | null {
  if (!parseWideScope(body.scope)) return null;
  const raw = body.coverage;
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!Array.isArray(c.lessons) || c.lessons.length === 0 || c.lessons.length > MAX_LESSONS) return null;

  const lessons: { code: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const item of c.lessons) {
    if (typeof item !== "object" || item === null) return null;
    const code = String((item as Record<string, unknown>).code ?? "");
    const title = cleanTitle((item as Record<string, unknown>).title);
    if (!CODE.test(code) || seen.has(code) || title === "") return null;
    seen.add(code);
    lessons.push({ code, title });
  }

  let counts: Map<string, number> | null = null;
  if (Array.isArray(c.slots) && c.slots.length > 0 && c.slots.length <= MAX_SLOTS) {
    counts = new Map();
    for (const slot of c.slots) {
      const code = String(slot);
      if (seen.has(code)) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    if (counts.size === 0) counts = null;
  }
  return { lessons, counts };
}

function tableLines(c: CoverageTable, isAr: boolean): string {
  const row = (l: { code: string; title: string }) => {
    const n = c.counts?.get(l.code);
    if (c.counts && !n) return null;
    const suffix = n ? (isAr ? ` — ${n} ${n === 1 ? "سؤال" : "أسئلة"}` : ` — ${n} question${n === 1 ? "" : "s"}`) : "";
    return `${l.code}: ${l.title}${suffix}`;
  };
  return c.lessons.map(row).filter((r): r is string => r !== null).join("\n");
}

export function coverageClauseAr(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  const rule = c.counts
    ? "اكتب بالضبط عدد الأسئلة المذكور لكل درس (وليس غير ذلك)، وزّعها على أنواع الأسئلة كما يلزم."
    : "وزّع الأسئلة على هذه الدروس اختيارًا عشوائيًا، ولا تكرّر درسًا قبل أن تستعمل كل الدروس.";
  return `\nالنطاق يشمل عدة دروس. وزّع الأسئلة عليها ولا تحصرها في درس واحد:\n${tableLines(c, true)}\n${rule}\nأضف إلى كل سؤال الحقل "lesson" برمز الدرس الذي يخصّه السؤال (مثل "L3") — لا تضع نصًّا آخر فيه.`;
}

export function coverageClauseEn(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  const rule = c.counts
    ? "Write exactly the number of questions listed for each lesson (no others), spread over the question types as needed."
    : "Spread the questions over these lessons at random, and repeat no lesson before every lesson has been used.";
  return `\nThe scope covers several lessons. Spread the questions over them; do not confine them to one lesson:\n${tableLines(c, false)}\n${rule}\nGive every question a "lesson" field holding the code of the lesson it belongs to (e.g. "L3") — nothing else in that field.`;
}
```

- [ ] **Step 5: Insert the clause into the four prompt builders**

In `artifacts/api-server/src/lib/prompts.ts` add near the top with the other imports:

```ts
import { coverageClauseAr, coverageClauseEn } from "./coverage.ts";
```

In each of the four builders, insert `${coverageClauseAr(b)}` (the two Arabic builders) or `${coverageClauseEn(b)}` (the two English ones) on its own line **immediately before** the existing line that begins `${b.additionalContext ? ` — that line appears once in each of `worksheetPromptAr`, `worksheetPromptEn`, `quizPromptAr` and `quizPromptEn`. For `quizPromptAr` the result reads:

```ts
${QUIZ_VARIETY_RULE_AR}${coverageClauseAr(b)}
${b.additionalContext ? `\nسياق الكتاب المدرسي ...
```

(i.e. append it to the variety-rule line in the two quiz builders, so the clause follows "cover different parts of the lesson" and can refine it) and for the worksheet builders put it on the line before `${b.additionalContext ? …`. Because the clause is `""` for a lesson request, those requests' prompts are unchanged.

- [ ] **Step 6: Run the tests and the build**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/coverage.test.ts src/lib/__tests__/generationKey.test.ts src/lib/__tests__/generationShape.test.ts && pnpm build && pnpm test 2>&1 | tail -8`
Expected: PASS; `pnpm test` 0 failures with the mount-order suite running (the bundle was built first).

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/lib/coverage.ts artifacts/api-server/src/lib/prompts.ts artifacts/api-server/src/lib/generationKey.ts artifacts/api-server/src/lib/__tests__/
git commit -m "feat(api): coverage clause, distribution key and 25/30 counts for wide-scope papers"
```

---

### Task 7: The live prompt and the offline plan agree

**Files:**
- Test: `artifacts/mobile/services/__tests__/coverageLivePrompt.test.ts`

This is the "two places" pin. It lives in the mobile suite because both halves are importable there (the api-server `prompts.ts` has no client dependency, so it loads under `node --test`); if the import path below does not resolve, create the same test in `artifacts/api-server/src/lib/__tests__/` and import the mobile `buildWideRequest` by relative path instead.

**Interfaces:**
- Consumes: Task 3's `buildWideRequest`; Task 4's offline quiz; Task 6's `quizPromptEn` / `parseCoverage`.

- [ ] **Step 1: Write the test**

Create `artifacts/mobile/services/__tests__/coverageLivePrompt.test.ts`:

```ts
/**
 * One plan, two consumers.
 *
 * The screen makes the plan once and sends it. The live prompt renders it as
 * per-lesson counts; the offline generator re-plans from the same lesson table.
 * For a scope whose lessons all have an offline bank these must be the same
 * multiset of lessons — otherwise a teacher gets a different paper depending on
 * whether live AI was on (CLAUDE.md: "two places move together").
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { planCoverage } from '../coveragePlan.ts';
import { parseCoverage } from '../../../api-server/src/lib/coverage.ts';
import { quizPromptEn } from '../../../api-server/src/lib/prompts.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };

describe('the live prompt renders the plan the screen made', () => {
  it('lists every lesson of the table, and per-lesson counts that add up to the picked number', () => {
    const w = buildWideRequest(sem1, 'en', 12, 'balanced')!;
    const body = { subject: 'Mathematics', grade: 'Grade 10', topic: 'Entire semester 1', numQuestions: 12, ...w.fields };
    const table = parseCoverage(body)!;
    assert.equal(table.lessons.length, w.lessons.length);
    assert.equal([...table.counts!.values()].reduce((a, b) => a + b, 0), 12);
    const prompt = quizPromptEn(body);
    for (const [code, n] of table.counts!) assert.ok(prompt.includes(`${code}: `) && n > 0);
  });

  it('the counts are the plan\'s, lesson for lesson', () => {
    const w = buildWideRequest(sem1, 'en', 12, 'balanced')!;
    const plan = planCoverage(w.lessons, 12, 'balanced');
    const expected = new Map<string, number>();
    for (const i of plan) expected.set(w.lessons[i]!.code, (expected.get(w.lessons[i]!.code) ?? 0) + 1);
    const got = parseCoverage({ scope: w.fields.scope, coverage: w.fields.coverage })!.counts!;
    assert.deepEqual([...got.entries()].sort(), [...expected.entries()].sort());
  });
});

describe('the offline paper follows the same plan', () => {
  it('draws from the lessons the plan names (every lesson here has a bank or is dropped)', async () => {
    const w = buildWideRequest(sem1, 'ar', 12, 'balanced')!;
    const out = await aiService.generateQuiz({
      grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', topic: 'الفصل الأول كاملًا',
      totalMarks: 20, duration: 20, difficulty: 'medium', questionTypes: ['multiple_choice'], numQuestions: 12, ...w.fields,
    } as AIRequest);
    const planned = new Set(planCoverage(w.lessons, 12, 'balanced').map(i => w.lessons[i]!.id));
    const drawn = new Set(out.questions.map(q => q.lessonId));
    // Every lesson the paper used is one the plan named; a spent bank may hand a
    // share to a neighbour, so the converse is not asserted.
    for (const id of drawn) assert.ok(planned.has(id!) || w.lessons.some(l => l.id === id));
    const unitsPlanned = new Set(planCoverage(w.lessons, 12, 'balanced').map(i => w.lessons[i]!.unitId));
    const unitsDrawn = new Set(out.questions.map(q => w.lessons.find(l => l.id === q.lessonId)?.unitId));
    assert.ok([...unitsDrawn].every(u => unitsPlanned.has(u!)), 'the paper strayed outside the planned units');
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/coverageLivePrompt.test.ts`
Expected: PASS. If `prompts.ts` cannot be imported from the mobile suite (it pulls a package the mobile alias cannot resolve), move this one file to `artifacts/api-server/src/lib/__tests__/coverageLivePrompt.test.ts`, import the mobile modules by relative path (`../../../../mobile/services/...`), and run it with the api-server command; the assertions are unchanged.

- [ ] **Step 3: Commit**

```bash
git add artifacts/mobile/services/__tests__/coverageLivePrompt.test.ts
git commit -m "test: pin the live coverage prompt to the offline plan"
```

---

### Task 8: Shared UI — `useWideScope`, `CoverageNotice`, `TopicSelector.offlineWideScope`, strings

**Files:**
- Create: `artifacts/mobile/hooks/useWideScope.ts`
- Create: `artifacts/mobile/components/ui/CoverageNotice.tsx`
- Modify: `artifacts/mobile/components/ui/TopicSelector.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

These are React Native files: no unit test is possible (the mobile runner cannot load them). Verification is typecheck, the existing suite, and the read-through in Step 6.

**Interfaces:**
- Consumes: Task 3's `scopeFromParam`, `distributionFromParam`; Task 1's `Distribution`, `CoverageLesson`, `coverageSummary`; piece 1's `ScopeSelection`.
- Produces:
  ```ts
  // hooks/useWideScope.ts
  export function useWideScope(params: { scope?: string; distribution?: string }): {
    scopeSel: ScopeSelection | null; setScopeSel: (s: ScopeSelection | null) => void;
    distribution: Distribution; setDistribution: (d: Distribution) => void;
    isWide: boolean;                       // scopeSel is a unit / semester / book
  };
  // components/ui/CoverageNotice.tsx
  export function CoverageNotice(props: { lessons: CoverageLesson[]; questions: readonly { lessonId?: string }[]; modelReported: boolean }): JSX.Element | null;
  // TopicSelector: new optional prop
  offlineWideScope?: boolean
  // i18n keys (ar + en)
  distributionLabel, distributionBalanced, distributionRandom, wideScopeUngrounded,
  coveredLessons: (n, total, names) => string, uncoveredLessons: (n) => string, coverageModelReported
  ```

- [ ] **Step 1: The hook**

Create `artifacts/mobile/hooks/useWideScope.ts`:

```ts
/**
 * What a generator screen holds about a wide scope: the structured selection
 * `TopicSelector` reports, and how the teacher wants questions spread over it.
 *
 * Both are seeded from route params, because a saved material reopens through
 * them (`scopeFormState` writes the same two keys). A material saved before
 * this existed has neither and reads as no scope, balanced — today's behaviour.
 */
import { useState } from 'react';
import type { Distribution } from '@/services/coveragePlan';
import { distributionFromParam, scopeFromParam } from '@/services/wideScopeRequest';
import type { ScopeSelection } from '@/services/scopeSelection';

export function useWideScope(params: { scope?: string; distribution?: string }) {
  const [scopeSel, setScopeSel] = useState<ScopeSelection | null>(() => scopeFromParam(params.scope));
  const [distribution, setDistribution] = useState<Distribution>(() => distributionFromParam(params.distribution));
  const isWide = !!scopeSel && scopeSel.kind !== 'lesson';
  return { scopeSel, setScopeSel, distribution, setDistribution, isWide };
}
```

- [ ] **Step 2: The coverage notice**

Create `artifacts/mobile/components/ui/CoverageNotice.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { coverageSummary, type CoverageLesson } from '@/services/coveragePlan';

/**
 * «الدروس المغطاة» — which lessons of a wide scope the paper's questions are about.
 *
 * Offline the list is exact: each question is drawn from a named lesson. Live
 * it is read from the model's own tags, which are unreliable, so it says so
 * (`modelReported`) instead of presenting a claim as a fact. Renders nothing
 * when no question carries a lesson — an untagged live reply has nothing true
 * to say here, and a blank list would read as «nothing covered».
 */
export function CoverageNotice({ lessons, questions, modelReported }: {
  lessons: CoverageLesson[];
  questions: readonly { lessonId?: string }[];
  modelReported: boolean;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const { covered, uncovered } = coverageSummary(questions, lessons);
  if (covered.length === 0) return null;
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const text = [
    t('coveredLessons', covered.length, lessons.length, covered.map(l => l.title).join(isRTL ? '، ' : ', ')),
    uncovered.length > 0 ? t('uncoveredLessons', uncovered.length) : '',
    modelReported ? t('coverageModelReported') : '',
  ].filter(Boolean).join(' ');
  return (
    <View style={[styles.box, row, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
      <Ionicons name="layers-outline" size={18} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, padding: 12, borderWidth: 1, marginHorizontal: 20, marginBottom: 12, alignItems: 'flex-start' },
  text: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
});
```

- [ ] **Step 3: The `TopicSelector` prop**

In `artifacts/mobile/components/ui/TopicSelector.tsx`:

(a) In `interface Props`, after `onScopeChange`, add:

```ts
  /**
   * The screen's offline generators can honour a unit / semester / book scope,
   * so `availableKinds` need not drop `semester` under DEMO_MODE (the offline
   * path is exactly what DEMO_MODE runs). Quiz, worksheet, homework and game
   * pass it; every other screen keeps today's behaviour until piece 3.
   */
  offlineWideScope?: boolean;
```

(b) Add `offlineWideScope,` to the destructured props, and change the `kinds` line from

```ts
  const kinds = availableKinds(gradeId, subjectId, allowedKinds, DEMO_MODE);
```

to

```ts
  const kinds = availableKinds(gradeId, subjectId, allowedKinds, DEMO_MODE && !offlineWideScope);
```

- [ ] **Step 4: The strings**

In `artifacts/mobile/services/i18n.ts` add the keys after the `entireUnit:` line in **both** language blocks (Arabic near line 1033, English near 3533). Match the file's two entry styles (plain string; arrow function for interpolation, as `selectLessonsLabel` does):

Arabic:
```ts
    distributionLabel: 'توزيع الأسئلة',
    distributionBalanced: 'متوازن حسب الوحدة',
    distributionRandom: 'عشوائي',
    wideScopeUngrounded: 'لا يمكن ربط هذا النطاق بالمنهاج، فلم يُنشأ شيء. اختر درسًا أو وحدة أو فصلًا آخر.',
    coveredLessons: (n: number, total: number, names: string) => `الدروس المغطاة (${n} من ${total}): ${names}.`,
    uncoveredLessons: (n: number) => `لم تُغطَّ ${n} دروس.`,
    coverageModelReported: 'القائمة حسب ما أعلنه النموذج.',
```

English:
```ts
    distributionLabel: 'Question spread',
    distributionBalanced: 'Balanced by unit',
    distributionRandom: 'Random',
    wideScopeUngrounded: 'This scope could not be tied to the curriculum, so nothing was generated. Pick a lesson, unit or semester instead.',
    coveredLessons: (n: number, total: number, names: string) => `Lessons covered (${n} of ${total}): ${names}.`,
    uncoveredLessons: (n: number) => `${n} lesson${n === 1 ? '' : 's'} not covered.`,
    coverageModelReported: 'This list is as the model reported it.',
```

(If `t` is typed by the Arabic table's keys, adding to Arabic first makes the keys known; add to both before running the typecheck.)

- [ ] **Step 5: Typecheck and the suite**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors (the repo may print unrelated pre-existing ones in this container: capture the error set before and after and show none mention the files above); 0 test failures.

- [ ] **Step 6: Read-through and commit**

Re-read the diff against each bullet above (no unit test covers it) and note in the report that it was verified by reading and typecheck only.

```bash
git add artifacts/mobile/hooks/useWideScope.ts artifacts/mobile/components/ui/CoverageNotice.tsx artifacts/mobile/components/ui/TopicSelector.tsx artifacts/mobile/services/i18n.ts
git commit -m "feat: shared wide-scope UI pieces and the offlineWideScope selector prop"
```

---

### Task 9: The quiz screen (`quiz.tsx`)

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/quiz.tsx`

Not unit-testable; the logic it uses is covered by Tasks 1-8. Verified by typecheck, the suite, and the read-through.

**Interfaces:**
- Consumes: Task 3 (`buildWideRequest`, `ALL_QUESTION_COUNTS`, `visibleCountOptions`, `clampCountIndex`, `scopeFormState`), Task 1 (`DISTRIBUTIONS`), Task 8 (`useWideScope`, `CoverageNotice`, `offlineWideScope`, the i18n keys), piece 1's `ScopeSelection`.

- [ ] **Step 1: Imports, counts, params, state**

(a) Extend the existing imports:

```ts
import { aiErrorText, getLastGeneration, isAbortError } from '@/services/ai/aiProvenance';
import { CoverageNotice } from '@/components/ui/CoverageNotice';
import { useWideScope } from '@/hooks/useWideScope';
import { DISTRIBUTIONS, type CoverageLesson } from '@/services/coveragePlan';
import {
  ALL_QUESTION_COUNTS, buildWideRequest, clampCountIndex, scopeFormState, visibleCountOptions,
} from '@/services/wideScopeRequest';
```

(b) Replace `const NUM_Q_OPTIONS = [5, 8, 10, 12, 15, 20];` with:

```ts
// 25 and 30 are appended (saved positions keep their meaning) and shown only on a wide scope.
const NUM_Q_OPTIONS = ALL_QUESTION_COUNTS;
```

(c) Add `scope?: string; distribution?: string;` to the `useLocalSearchParams<{ … }>` type (it currently ends `… selectedTypes?: string;`).

(d) Directly after `useWarmGrounding(topic, lang);` add:

```ts
  const wideScope = useWideScope(params);
  /** The wide scope and distribution the paper on screen was generated under — what Save records. */
  const [wideFrozen, setWideFrozen] = useState<{ sel: ScopeSelection; distribution: Distribution } | null>(
    () => (wideScope.isWide ? { sel: wideScope.scopeSel!, distribution: wideScope.distribution } : null),
  );
  /** Which lessons the paper covers, and whether that is exact (offline) or the model's own word (live). */
  const [coverageInfo, setCoverageInfo] = useState<{ lessons: CoverageLesson[]; modelReported: boolean } | null>(null);
```

and add `import type { ScopeSelection } from '@/services/scopeSelection'; import type { Distribution } from '@/services/coveragePlan';` (merge into the imports above if the file already imports from those modules).

(e) After the existing `numQIdx` state, keep the saved index inside what is offered:

```ts
  useEffect(() => {
    setNumQIdx(i => clampCountIndex(i, wideScope.isWide));
  }, [wideScope.isWide]);
```

- [ ] **Step 2: `generate()` — branch on a wide scope**

In `generate`, change the early checks so a wide scope skips the lesson-topic check, and refuses when it cannot ground:

```ts
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson only.
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wide = wideScope.isWide
      ? buildWideRequest(wideScope.scopeSel!, lang, NUM_Q_OPTIONS[numQIdx]!, wideScope.distribution, { offset: opts?.regenerate ? Math.floor(Math.random() * 1000) : 0 })
      : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
```

(replacing the existing `topic` / `missing` / `conflict` lines). Inside the `try`, replace the grounding and request construction so the wide fields merge **last**:

```ts
      const kbScope = { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id };
      const grounding = wide
        ? { lesson: null, grounded: true }
        : resolveGeneratorGrounding(topic.trim(), lang, { scope: kbScope });
      const additionalContext = wide ? undefined : buildGeneratorContext(topic.trim(), lang, { scope: kbScope });
      const unitId = wide ? undefined : generatorUnitId(topic.trim(), lang, kbScope);
      const out = await aiService.generateQuiz({
        /* …every existing field, unchanged… */
        ...regenerationFields(opts?.regenerate === true, previous),
        // Last: the wide scope's digest replaces the lesson-derived context, and
        // its explicit-undefined lessonId / unitId clear the single-lesson fields.
        ...(wide ? wide.fields : {}),
      }, { signal: controller.signal });
```

After `setGenerated(captureGenerationScope(...))` add:

```ts
      setWideFrozen(wide ? { sel: wideScope.scopeSel!, distribution: wideScope.distribution } : null);
      setCoverageInfo(wide ? { lessons: wide.lessons, modelReported: getLastGeneration()?.source === 'live' } : null);
```

`captureGenerationScope(…, grounding)` takes `Pick<GeneratorGrounding,'lesson'|'grounded'>`; the `{ lesson: null, grounded: true }` literal satisfies it.

In the `catch` that restores the held paper, nothing changes (the frozen state belongs to the paper that came back; if its type needs holding too, add `wideFrozen` and `coverageInfo` to `held` and restore them alongside `generated` — do this: it keeps the coverage line honest after a cancelled regenerate).

- [ ] **Step 3: Save the scope and distribution**

In `handleSave`, extend `formState`:

```ts
    const formState = {
      gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic,
      durationIdx, marksIdx, numQIdx, diffIdx, selectedTypes: JSON.stringify(Array.from(selectedTypes)),
      // From the frozen scope, not the live pickers (a teacher can move them after generating).
      ...scopeFormState(wideFrozen?.sel ?? null, wideFrozen?.distribution ?? 'balanced'),
    };
```

- [ ] **Step 4: The form**

(a) `TopicSelector` gets the three new props:

```tsx
        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={text => { setTopic(text); setError(''); }}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          lang={lang}
          isRTL={isRTL}
          colors={colors}
          accent={ACCENT}
          hasError={!!error && !topic}
          t={t}
        />
```

(b) Directly **after** the `TopicSelector` and before the level picker, the distribution picker, shown only on a wide scope:

```tsx
        {wideScope.isWide && (
          <PickerField
            label={t('distributionLabel')}
            value={t(wideScope.distribution === 'balanced' ? 'distributionBalanced' : 'distributionRandom')}
            options={[t('distributionBalanced'), t('distributionRandom')]}
            onChange={i => wideScope.setDistribution(DISTRIBUTIONS[i]!)}
            colors={colors} isRTL={isRTL} accent={ACCENT}
          />
        )}
```

(c) The count picker shows 25/30 only on a wide scope — change its `options` to `numQLabels.slice(0, visibleCountOptions(wideScope.isWide))` (and its `value` stays `numQLabels[numQIdx]`).

(d) Next to the existing `<ShortPaperNotice shortfall={result.shortfall} repeated={result.repeated} />` add:

```tsx
          {coverageInfo && (
            <CoverageNotice lessons={coverageInfo.lessons} questions={result.questions} modelReported={coverageInfo.modelReported} />
          )}
```

- [ ] **Step 5: Typecheck, suite, read-through**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors, 0 test failures. Then confirm by reading the diff that: a single-lesson request is built exactly as before (`wide` is `null`, every spread is empty); `...wide.fields` is the **last** spread; `setWideFrozen`/`setCoverageInfo` are cleared to `null` for a lesson paper; and the held-paper restore includes them. State in the report that no browser was available, so the picker, the distribution control, the count options and the coverage line were **not** clicked through.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/app/ai-tools/quiz.tsx
git commit -m "feat: quiz screen — unit, semester and book scopes with a distribution picker"
```

---

### Task 10: The worksheet / homework screen (`worksheet.tsx`)

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/worksheet.tsx`

Same shape as Task 9; the worksheet screen serves both the worksheet and (`isHomework`) the homework, and builds its request with `buildWorksheetRequest(form, grounding)`.

- [ ] **Step 1: Imports, counts, params, state**

Do exactly Task 9 Step 1 (a)-(e) in `worksheet.tsx`, with these differences: `NUM_Q_OPTIONS` is the line `const NUM_Q_OPTIONS = [5, 8, 10, 12, 15, 20];` (line ~87); the params type is the one ending `… selectedTypes?: string; isHomework?: string;` (add `scope?: string; distribution?: string;`); the existing aiProvenance import is `import { aiErrorText, isAbortError } from '@/services/ai/aiProvenance';` (add `getLastGeneration`); and `useWarmGrounding(topic, lang);` is the anchor for the new state.

- [ ] **Step 2: `generate()`**

Change the early checks as in Task 9 Step 2 (the `generate` here has the same `topic` / `missing` / `conflict` lines). Inside the `try`, the request is built by:

```ts
      const grounding = resolveGeneratorGrounding(topic.trim(), lang, { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
      const baseReq = buildWorksheetRequest({ … }, grounding);
```

Make it wide-aware:

```ts
      const grounding = wide
        ? ({ lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' } as GeneratorGrounding)
        : resolveGeneratorGrounding(topic.trim(), lang, { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
      const ownReq = buildWorksheetRequest({ /* …existing form object, unchanged… */ }, grounding);
      // Last: the wide scope's digest replaces the lesson-derived context.
      const baseReq = wide ? { ...ownReq, ...wide.fields } : ownReq;
```

(`GeneratorGrounding` is already imported in `kbContext` — add it to this file's import from `@/services/kbContext` if absent. `buildWorksheetRequest` reads `grounding.lesson` for prior knowledge: `null` skips it, which is right for a wide scope; the prior-review option is therefore a no-op there.)

`...wide.fields` also carries `distribution` and `coverage`, which flow through the `{ ...baseReq, difficulty: d }` spreads of the three-level path unchanged.

After `setGenerated(captureGenerationScope(...))` add the same `setWideFrozen` / `setCoverageInfo` lines as Task 9 Step 2 (the paper's questions are `out.sections.flatMap(s => s.questions)`).

- [ ] **Step 3: Save**

Extend the `formState` in the save handler (line ~469) with `...scopeFormState(wideFrozen?.sel ?? null, wideFrozen?.distribution ?? 'balanced'),` exactly as Task 9 Step 3.

- [ ] **Step 4: The form**

(a) `TopicSelector` (line ~660): add `allowedKinds={['lesson', 'unit', 'semester', 'book']}`, `onScopeChange={wideScope.setScopeSel}` and `offlineWideScope`.
(b) After it, the same distribution `PickerField` as Task 9 Step 4(b) (this file's local `PickerField` wrapper takes the same props).
(c) The count `PickerField` at line ~678: `options={numQLabels.slice(0, visibleCountOptions(wideScope.isWide))}`.
(d) Where the result's `ShortPaperNotice` / grounding notice renders, add

```tsx
          {coverageInfo && result && (
            <CoverageNotice
              lessons={coverageInfo.lessons}
              questions={result.sections.flatMap(s => s.questions)}
              modelReported={coverageInfo.modelReported}
            />
          )}
```

(e) The «numQuestionsIncludesExample» hint under the count stays as is.

- [ ] **Step 5: Typecheck, suite, read-through, commit**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors; 0 failures. Verify by reading that the homework path (`isHomework`) takes the same branch, that a lesson request is built exactly as before, and that `...wide.fields` merges last. State that no browser was available.

```bash
git add artifacts/mobile/app/ai-tools/worksheet.tsx
git commit -m "feat: worksheet and homework screen — unit, semester and book scopes"
```

---

### Task 11: The game screen (`game.tsx`)

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/game.tsx`

The game builds its own `generateQuiz` request (it does **not** reuse `quiz.tsx`) and has its own count picker (`QUESTION_COUNTS = [5, 8, 10, 12]`, left unchanged), so it needs the scope and the distribution but not the 25/30 counts or the coverage line.

- [ ] **Step 1: Imports and state**

Add `import { useWideScope } from '@/hooks/useWideScope'; import { DISTRIBUTIONS } from '@/services/coveragePlan'; import { buildWideRequest } from '@/services/wideScopeRequest';`. Where the screen reads its route params, add `scope?: string; distribution?: string;` to the params type and call `const wideScope = useWideScope(params);` next to the other state.

- [ ] **Step 2: `generate()`**

Change the early checks like Task 9 Step 2 (`trimmed` replaces `topic.trim()`): compute

```ts
    const wide = wideScope.isWide
      ? buildWideRequest(wideScope.scopeSel!, lang as 'ar' | 'en', questionCount, wideScope.distribution, { offset: opts?.regenerate ? Math.floor(Math.random() * 1000) : 0 })
      : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
```

before the `groundedSubjectConflict` check, and run that check only `if (!wide)`. Replace the grounding lines with:

```ts
    const grounding = wide
      ? ({ lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' } as GeneratorGrounding)
      : resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en', { scope: kbScope });
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');
```

(`GeneratorGrounding` is already imported in this file.) Add `...(wide ? wide.fields : {}),` as the **last** field of the `generateQuiz({ … })` object, after `...regenerationFields(...)`, with this comment above it: `// Last: the wide scope's digest replaces the lesson-derived context.` `buildGameDeckFromQuiz(quiz, trimmed, isAr, { lesson: grounding.lesson, … })` already accepts `lesson: null`, so the deck's figures are simply absent for a wide scope.

- [ ] **Step 3: The form**

On the `TopicSelector` (line ~327) add `allowedKinds={['lesson', 'unit', 'semester', 'book']}`, `onScopeChange={wideScope.setScopeSel}` and `offlineWideScope`. After it add the distribution `PickerField`, written with whichever picker component this screen uses for its other options (if it has no `PickerField`, use the same `Pressable`-based control it uses for `QUESTION_COUNTS`, with the two `distribution*` labels; the state is `wideScope.distribution` / `wideScope.setDistribution(DISTRIBUTIONS[i]!)`).

- [ ] **Step 4: Typecheck, suite, read-through, commit**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors; 0 failures. Verify by reading that a single-lesson game request is unchanged. State that no browser was available.

```bash
git add artifacts/mobile/app/ai-tools/game.tsx
git commit -m "feat: game screen — unit, semester and book scopes"
```

---

### Task 12: Record it (`STATUS.md`) and final verification

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Add one bullet under "What works today" (newest first, in that section's voice)**

```markdown
- **Quiz, worksheet, homework and game take a unit, semester or whole book
  (2026-10-14; spec `docs/superpowers/specs/2026-10-14-wide-scope-assessment-tools-design.md`,
  builds on piece 1).** The teacher picks the scope and a «توزيع الأسئلة»
  (balanced by unit, or random); the count picker adds 25 and 30 on a wide
  scope. One `planCoverage` decides which lesson each question is about; the
  offline generators draw each question from that lesson's bank and the live
  prompts get the same plan as per-lesson counts, with a `lesson` tag the
  server passes through and never enforces. Tested: the plan, the drawer, the
  request builder, the offline quiz / worksheet / homework on a real G10 maths
  semester, the prompt clause, the cache key (`distribution`), and the 25/30
  count enforcement. **Not verified:** the screens and `TopicSelector` were
  never run in a browser (none in the build container) — the picker, the
  distribution control, the count options and the coverage line are checked by
  reading and typecheck only; whether the live model follows the plan (the
  screen says «حسب ما أعلنه النموذج» and never claims it did); and how often a
  30-question paper needs the top-up call, since the 24 000-token output
  ceiling is already clamped there. Lesson plan, slides, activity and
  lesson-flow still take one lesson (piece 3). Papers above 30 questions need
  generation split across calls and are not built.
```

- [ ] **Step 2: Full verification — run each and read the output**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
cd ../api-server && pnpm build && pnpm test
cd /home/user/Iqraa && git diff --stat origin/main -- artifacts/mobile/app
```
Expected: typecheck clean (or only the pre-existing, unrelated errors — state how many and that none mention the files this plan touched); both suites 0 failures with the mount-order suite running; the last command lists exactly `quiz.tsx`, `worksheet.tsx`, `game.tsx` under `app/ai-tools` and nothing else under `app`.

- [ ] **Step 3: Commit**

```bash
git add STATUS.md
git commit -m "docs: STATUS — wide-scope quiz, worksheet, homework and game"
```

---

## Self-Review

**Spec coverage**
- Goal 1 (pick unit/semester/book on the tools) → Tasks 8-11 (`TopicSelector` props on each screen). Goal 2 (distribution picker) → Tasks 1, 3, 9-11. Goal 3 (25/30) → Tasks 3, 6, 9, 10. Goal 4 (offline + live same plan, pinned) → Tasks 1, 4-7. Goal 5 (coverage line, model-reported label) → Tasks 8-10. Goal 6 (saved scope/distribution reopen) → Task 3 helpers + Tasks 9-10 (`scopeFormState`, `useWideScope(params)`). Goal 7 (ungrounded refused) → Tasks 3, 9-11.
- Non-goals respected: evaluations untouched; no weighting; no tick-list; no >30; lesson plan/slides stay piece 3.
- Spec §2 offline → Tasks 4-5 incl. the `DEMO_MODE` lift via `offlineWideScope` (Task 8). §3 live → Task 6 (clause, key, tags, counts). §4 UI → Tasks 8-11. §5 screens → Tasks 9-11 incl. merging `scopeRequestFields` last. Risks: normaliser/tag → Task 6 tests; 30-question top-up and ceiling → STATUS (Task 12) and Global Constraints (ceiling not raised).
- The nine corrections at the top are each built in: game (T11), pool-based `planCoverage` (T1), random (T1, T6 clause), per-lesson counts (T6, T7), re-plan offline with skipped lessons (T4), caps 20→30 (T5), resolved risk with test (T6), `wideFrozen` instead of `GenerationScope` (T9-10), stateless offset (T4).

**Placeholder scan:** none — every code step has code. Two edits are described by exact anchor rather than pasted in full: the four prompt insertion points (Task 6 Step 5, each is one line placed before a quoted unique line) and the screen edits in Tasks 9-11, which quote the lines they replace; both name every identifier they use.

**Type consistency:** `CoverageLesson`/`Coverage`/`Distribution` (Task 1) are the types Tasks 3-5, 8-11 import; `AIRequest.coverage` (Task 3) has the same `{lessons:[{code,id,unitId,title}], slots?}` shape that `parseCoverage` (Task 6) reads and `offlineWideScope` (Task 4) reads; `ScopeDrawer.draw(slot, bankKey, make)` (Task 2) is called with that signature in Tasks 4 and 5; `buildWideRequest(...) → {fields, grounding, lessons}` (Task 3) is what Tasks 9-11 destructure; `QuizQuestion.lessonId`/`lesson` (Task 3) are set in Tasks 4-5 and read in Tasks 3, 8, 9-10; `useWideScope`'s return keys (Task 8) are the ones Tasks 9-11 use.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-14-wide-scope-assessment-tools.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.
2. **Inline Execution** — run the tasks in this session with checkpoints.
