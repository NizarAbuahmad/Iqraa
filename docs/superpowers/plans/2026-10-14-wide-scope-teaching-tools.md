# Wide-Scope Teaching Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher make a lesson plan, slide deck, activity, lesson-flow or classroom activity for a whole unit, semester or book — as one selective revision session — on both the offline and the live path, without any of the five screens re-grounding the scope label as a lesson.

**Architecture:** One pure module (`revisionScope.ts`) turns a `ScopeSelection` (or the lesson ids a request carries) into per-unit revision content; `buildScopeRequest` is the teaching tools' counterpart of piece 2's `buildWideRequest` (it merges the scope and lesson table over the screen's own fields without clobbering the teacher's typed text). The server appends one revision clause (only when `scope` is present) to the plan, activity and classroom prompts. Each offline generator gets a wide branch ahead of its single-lesson grounding. Each screen adopts the guards piece 2's reviews forced (inert grounding, no figures, scope-label notice title, no Related-tools, frozen scope saved).

**Tech Stack:** TypeScript, `node --test` (strip-types), Expo/React Native (screens), Express api-server.

**Spec:** `docs/superpowers/specs/2026-10-14-wide-scope-teaching-tools-design.md` (builds on `2026-10-13-wide-scope-selection-design.md` and `2026-10-14-wide-scope-assessment-tools-design.md`; pieces 1–2 are the base of this branch)

## Global Constraints

- Mobile pure modules are loaded directly by `node --test`: **explicit `.ts` extensions on relative imports**, **no `react-native` / `expo-*` import at module scope**, and **no constructor parameter properties, enums or namespaces** (the strip-only runner rejects them). `generators.ts` and other RN-side files use extensionless imports (esbuild). Screens and RN components cannot be unit-tested; their logic lives in pure modules.
- New mobile tests go inside `artifacts/mobile/services/__tests__/`; api-server tests inside `artifacts/api-server/src/**/__tests__/`. Do not narrow either glob. api-server cannot import from mobile.
- Tests that call `aiService` stub the simulated latency: `(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};`. Probe expensive facts once, concurrently, memoized.
- **A wide result never re-grounds its topic label** (a unit title grounds to another grade's lesson): no `resolveGeneratorGrounding` / `generatorLessonId` / `buildGeneratorContext` / `generatorUnitId` / `generatorFigureCount` on a wide scope; module-level inert `WIDE_GROUNDING`; `noFigures`; `scopeLabel(sel, lang)` as the notice title; `hideRelated`; saved scope via `scopeFormState`. Fail closed: an ungrounded wide scope is refused with `wideScopeUngrounded` before generation.
- **A lesson-scope request is unchanged**: byte-identical request fields, prompts (prove with the `prompt.replace(clause, '') === promptWithoutScope` identity test), cache key and offline output shape.
- A wide scope means **one revision session, selective**; it states what it leaves out. No new plan fields, no distribution picker, no count picker on these tools. `distribution` is ignored by the teaching tools.
- Arabic teacher fields are **first person, future** («سأعرض… ثم سأسأل…»); words spoken to students stay in «» and imperative (`__tests__/teacherVoiceCheck.ts` fails on a bare imperative). Arabic counts agree (`arCount.ts`).
- "Two places move together": every offline wide builder has a live prompt clause; a test pins them.
- Every commit message ends with the two trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01S49tDeDJyomhJFC71MHJo1`. No model identifier anywhere else.
- No browser is available when this plan runs: screens are verified by typecheck, the suites, and the adversarial read-through checklist in each screen task. STATUS must say so, and that someone must click through all five screens on the web preview before the branch merges.

## Cross-section decisions made while drafting (the assembler reconciled these; executors follow the tasks)

1. The revision clause lists the lesson table **flat, in book order**, and points the model at the scope digest's unit headings: the server's `parseCoverage` does not carry `unitId` (not hashed), so the clause does not group by unit.
2. `scopeFromKey(scopeKey)` (Task 1, `revisionScope.ts`) is the single way an offline generator reads a `ScopeSelection` back off a request.
3. Task 5 (activity) builds a composite lesson from KB rows rather than from `RevisionUnit` (the blueprints read rules and term definitions that `RevisionUnit` does not carry); discussion and hands-on build on a single claim, so they are pinned at ≥1 unit per version and ≥2 units across regenerates (the spec's test list says the same).
4. The slides deck uses a new `buildRevisionDeck`; `buildLessonDeck(…, { lesson: null })` cannot work (it never projects the plan's main activity, and its fallbacks splice the title into lesson-shaped phrases).
5. Lesson-flow's question steps send `distribution: 'random'` with a lesson table and no slots; «ابدأ الحصة» is hidden on a wide flow.
6. The offline wide lesson plan is deterministic (an offline Regenerate repeats it, and the existing notice says so).
7. Ministry export is hidden on a wide plan; prior-knowledge review is not offered on a wide scope.

## Task order

Tasks 1–4 (foundation, server clause, lesson plan offline, lesson-plan screen) → 5–7 (activity offline, activity screen, classroom builder) → 8–9 (slides, lesson-flow; both consume the wide plan, activity and classroom results) → 10 (STATUS and verification). Tasks 5–7 depend on Task 1 and Task 2; Tasks 8–9 on Tasks 3, 5 and 7.

---


## Drafting notes — shared foundation, server clauses, lesson plan (Tasks 1–4)

### Section overview

Task 1 builds the shared contract every teaching tool consumes: `services/revisionScope.ts` (what one revision session over a unit / semester / book covers — units rebuilt from lesson ids, per-unit caps, which lessons a session shows and which it leaves out, the scope phrase), `buildScopeRequest` in `services/wideScopeRequest.ts` (the teaching tools' counterpart of `buildWideRequest`, which KEEPS the teacher's text and its provenance), `isRevisionRequest` and the `ClassroomActivityRequest` extension in `AIService.ts`. Task 2 builds the server's `revisionClauseAr/En(b, kind)` and appends it once to the lesson-plan prompts, once to the activity prompts and once — through a new `classroomActivityPrompt` wrapper — to the classroom deck prompt; a request without `scope` is byte-identical (pinned by `replace(clause, "")` identity). Task 3 is the offline lesson plan for a wide scope (`services/ai/lessonPlanRevision.ts`, a round per unit in each teaching style, first-person-future Arabic) wired in as the first line of `lessonPlanOnce`, plus a two-places pin against the live prompt. Task 4 adopts the piece-2 guard list on `app/ai-tools/lesson-plan.tsx`, with its request decision extracted into the tested `buildWideLessonPlanRequest`. All code below was typed into a scratch copy of the branch and run: the full mobile suite (4891 tests: 4881 pass, 10 skipped as before, 0 failures), the full api-server suite (1673, 0 failures), `tsc --noEmit` for both packages, and the api-server esbuild bundle.

**Decisions this section made that other sections must know (the assembler should reconcile):**

1. **The revision clause does NOT group lessons by `unitId`.** `parseCoverage` (piece 2) drops `unitId`, and `generationKey.test.ts` pins *"a field the prompt never shows (unitId) is not hashed"*. Rendering a `unitId`-derived grouping would put unhashed request data into a pooled prompt (the poisoning class piece 2's review fixed). So the clause lists the lesson table flat, in book order (code/title — hashed as `coverageHash`), and names the units by pointing at the scope digest's «الوحدة:» / "Unit:" headings (hashed as `contextHash`). Consequence: **no cache-key change**, and the contract's "grouped by unitId" wording is superseded. Any section's test that expects unit titles inside the clause must look in the digest instead.
2. **`buildScopeRequest`'s `contextSource`** is `'teacher'` when `own.contextSource === 'teacher'` **or** when `own.additionalContext` has text and `own.contextSource` is absent (the server's fail-closed reading of an absent source). The contract said "iff own.contextSource === 'teacher'"; this is strictly safer and identical for every screen that states its source.
3. **Contract extensions in `revisionScope.ts`:** `RevisionLesson` gains `thin: boolean` (a lesson with no key concepts and no key terms — the GeoGebra labs — which a round shows only after every lesson that has content); new exports `revisionUnitsFromLessons(lessonIds, lang)` (asked for by the brief), `splitShown(unit, shownPerUnit)`, `scopeFromKey(scopeKey)`, `REVISION_SHOWN_PER_UNIT = 3`, `LEFT_OUT_NAMES = 6`. Offline generators in other sections should rebuild units with `revisionUnitsFromLessons(req.coverage.lessons.map(l => l.id), lang)` and get the phrase from `revisionPhrase(scopeFromKey(req.scope.scopeKey)!, lang)`.
4. **Outcomes are the official outcomes in both languages** (`curriculumObjectivesFor`, Arabic for maths/chemistry) — the same source the scope digest and the single-lesson English plan (`lpObjectivesEn` → `kb.objectives`) already use.
5. **Classroom wrapper:** `classroomActivityPrompt(b, isAr)` in `classroomPrompts.ts` = template + revision clause + `classroomSetupClause`; `routes/generate.ts`'s classroom route calls it. The prompt-slides route keeps calling `classroomSetupClause` directly. The section that builds the classroom builder must not append the clause anywhere else.
6. **The offline wide plan is deterministic** (no regenerate variant): an offline Regenerate returns the same plan and `freshOnRegenerate` reports `repeated: { count: 8, of: 8 }`, which the screen already shows via `ShortPaperNotice`. Live regeneration varies as before.
7. **A wide lesson plan drops `priorTopicsNotes` and `includePriorReview`** (the screen hides both controls on a wide scope); `ministryRoles: true` is still requested (unchanged `buildLessonPlanRequest`), and the Ministry export is hidden (spec open item 1, as proposed). Export/save title on a wide plan: «خطة حصة مراجعة: …» / "Revision Lesson Plan: …".
8. `isRevisionRequest(req)` is the **first line** of `lessonPlanOnce` — before `docsFromReq` and `groundedKb` — so an explicit scope wins over anything parsed from `additionalContext`.
9. Saved state uses `scopeFormState(wideFrozen, 'balanced')`; the `distribution: 'balanced'` key it writes is ignored by the teaching tools.
10. A test that two requests differing only in `scope.scopeKey` get different strict keys **already exists** (`generationKey.test.ts`, *"different scopes never share a slot, in either key"*), so Task 2 adds none.

---

### Task 1: Foundation — `revisionScope.ts`, `buildScopeRequest`, `isRevisionRequest`

**Files:**
- Create: `artifacts/mobile/services/revisionScope.ts`
- Modify: `artifacts/mobile/services/wideScopeRequest.ts` (the `./coveragePlan.ts` import line; insert before `/** The picker's counts. 25 and 30 are APPENDED`)
- Modify: `artifacts/mobile/services/ai/AIService.ts` (the end of `interface ClassroomActivityRequest`)
- Test: `artifacts/mobile/services/__tests__/revisionScope.test.ts`
- Test: `artifacts/mobile/services/__tests__/scopeRequestTeaching.test.ts`

**Interfaces:**
- Consumes (existing): `ScopeSelection`, `lessonsInScope`, `unitsInScope`, `parseScope`, `scopeKey` (`services/scopeSelection.ts`); `curriculumObjectivesFor`, `buildAdaptationsDirective` (`services/kbContext.ts`); `getLessonById`, `getUnitForLesson`, `KB_UNITS`, `KB_BOOKS` (`services/knowledgeBase.ts`); `coverageLessons` (`services/coveragePlan.ts`); `scopeRequestFields` (`services/generatorRequests.ts`); `resolveScopeGrounding`, `ScopeGrounding` (`services/scopeGrounding.ts`); `AIRequest['scope' | 'coverage']`.
- Produces:
  ```ts
  // revisionScope.ts
  export type RevisionLesson = { id: string; title: string; thin: boolean };
  export type RevisionUnit = { unitId: string; title: string; lessons: RevisionLesson[]; outcomes: string[]; concepts: string[]; terms: string[] };
  export const REVISION_SHOWN_PER_UNIT = 3;
  export const LEFT_OUT_NAMES = 6;
  export function revisionUnitsFromLessons(lessonIds: readonly string[], lang: 'ar' | 'en'): RevisionUnit[];
  export function revisionUnits(sel: ScopeSelection, lang: 'ar' | 'en'): RevisionUnit[];
  export function splitShown(unit: RevisionUnit, shownPerUnit: number): { shown: RevisionLesson[]; left: RevisionLesson[] };
  export function scopeFromKey(scopeKey: string): ScopeSelection | null;
  export function revisionPhrase(sel: ScopeSelection, lang: 'ar' | 'en'): string;
  export function leftOutSentence(units: readonly RevisionUnit[], shownPerUnit: number, lang: 'ar' | 'en'): string;
  // wideScopeRequest.ts
  export type ScopeRequestFields = Pick<AIRequest, 'scope' | 'additionalContext' | 'contextSource' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'>;
  export type ScopeRequest = { fields: ScopeRequestFields; grounding: ScopeGrounding; units: RevisionUnit[] };
  export function buildScopeRequest(sel: ScopeSelection, lang: 'ar' | 'en',
    own?: { additionalContext?: string; contextSource?: 'teacher' | 'curriculum' }): ScopeRequest | null;
  // AIService.ts
  ClassroomActivityRequest.scope?: AIRequest['scope'];  ClassroomActivityRequest.coverage?: AIRequest['coverage'];
  export function isRevisionRequest(req: { scope?: { kind: string } | null }): boolean;
  ```
  (`ClassroomActivityRequest` already has `additionalContext?` and `contextSource?` — verified; not re-added.)

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/revisionScope.test.ts`:

```ts
/**
 * What a one-session revision over a unit / semester / book covers.
 *
 * The real Grade 10 maths books are used and every expectation is derived
 * from the KB (lesson order, outcomes), not from copied strings, so a KB edit
 * moves the expectation with it. Number agreement in the "left out" sentence
 * is pinned on hand-built units, where the count is chosen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  leftOutSentence, revisionPhrase, revisionUnits, revisionUnitsFromLessons, scopeFromKey, splitShown,
  REVISION_SHOWN_PER_UNIT, type RevisionUnit,
} from '../revisionScope.ts';
import { curriculumObjectivesFor } from '../kbContext.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { lessonsInScope, scopeKey, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';

const G = 'grade-10';
const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: n });
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'mathematics' };

describe('revisionUnits — real Grade 10 maths', () => {
  for (const n of [1, 2] as const) {
    it(`semester ${n}: one entry per unit, book order, every lesson exactly once`, () => {
      const units = revisionUnits(sem(n), 'ar');
      assert.deepEqual(units.map(u => u.unitId), unitsInScope(sem(n)).map(u => u.id));
      assert.deepEqual(units.flatMap(u => u.lessons.map(l => l.id)), lessonsInScope(sem(n)).map(l => l.id));
      assert.deepEqual(units.map(u => u.title), unitsInScope(sem(n)).map(u => u.titleAr));
    });

    it(`semester ${n}: at most three outcomes, concepts and terms per unit, none empty`, () => {
      for (const u of revisionUnits(sem(n), 'ar')) {
        for (const list of [u.outcomes, u.concepts, u.terms]) {
          assert.ok(list.length <= 3, `${u.title}: ${list.length}`);
          assert.ok(list.every(s => s.trim().length > 0), u.title);
          assert.equal(new Set(list).size, list.length, `${u.title}: duplicate`);
        }
        assert.ok(u.outcomes.length > 0, `${u.title} has no outcome`);
      }
    });
  }

  it('the first outcome of each lesson comes first, and a lab with nothing to review comes last', () => {
    // Semester 1, unit 1 opens with a GeoGebra lab (no concepts, no terms) and then four lessons.
    const u = revisionUnits(sem(1), 'ar')[0]!;
    const thin = u.lessons.filter(l => l.thin);
    assert.ok(thin.length >= 1 && u.lessons[0]!.thin, 'probe: unit 1 should open with a thin lesson');
    const rich = u.lessons.filter(l => !l.thin).map(l => getLessonById(l.id)!);
    assert.deepEqual(u.outcomes, rich.slice(0, 3).map(l => curriculumObjectivesFor(l)[0]!));
  });

  it('English uses the English titles and concepts', () => {
    const ar = revisionUnits(sem(2), 'ar');
    const en = revisionUnits(sem(2), 'en');
    assert.deepEqual(en.map(u => u.title), unitsInScope(sem(2)).map(u => u.titleEn));
    assert.deepEqual(en.map(u => u.lessons.length), ar.map(u => u.lessons.length));
  });

  it('is empty when nothing is in scope', () => {
    assert.deepEqual(revisionUnits({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'gone' }, 'ar'), []);
  });
});

describe('revisionUnitsFromLessons — the offline path rebuilds units from the request', () => {
  it('equals revisionUnits for the same lessons', () => {
    for (const sel of [sem(1), sem(2), book]) {
      assert.deepEqual(revisionUnitsFromLessons(lessonsInScope(sel).map(l => l.id), 'ar'), revisionUnits(sel, 'ar'));
    }
  });

  it('skips ids the KB does not hold and ignores repeats', () => {
    const ids = lessonsInScope(sem(1)).map(l => l.id);
    assert.deepEqual(revisionUnitsFromLessons(['nope', ...ids, ids[0]!], 'ar'), revisionUnits(sem(1), 'ar'));
    assert.deepEqual(revisionUnitsFromLessons(['nope'], 'ar'), []);
  });
});

describe('splitShown', () => {
  it('shows at most N per unit, prefers lessons with content, keeps book order in both lists', () => {
    for (const u of revisionUnits(book, 'ar')) {
      const { shown, left } = splitShown(u, REVISION_SHOWN_PER_UNIT);
      assert.equal(shown.length, Math.min(REVISION_SHOWN_PER_UNIT, u.lessons.length));
      assert.equal(shown.length + left.length, u.lessons.length);
      const at = (id: string) => u.lessons.findIndex(l => l.id === id);
      assert.deepEqual(shown.map(l => at(l.id)), [...shown.map(l => at(l.id))].sort((a, b) => a - b));
      if (left.some(l => !l.thin)) assert.ok(shown.every(l => !l.thin), `${u.title}: a thin lesson shown while a rich one is left out`);
    }
  });
});

const L = (n: number, unitId = 'U') => Array.from({ length: n }, (_, i) => ({ id: `${unitId}${i}`, title: `د${unitId}${i + 1}`, thin: false }));
const unit = (n: number, unitId = 'U'): RevisionUnit => ({ unitId, title: unitId, lessons: L(n, unitId), outcomes: [], concepts: [], terms: [] });

describe('leftOutSentence', () => {
  it('is empty when every unit fits', () => {
    assert.equal(leftOutSentence([unit(3), unit(2, 'V')], 3, 'ar'), '');
    assert.equal(leftOutSentence([unit(3)], 3, 'en'), '');
  });

  it('agrees the Arabic noun with the count: 1, 2, 3–10, 11+', () => {
    assert.ok(leftOutSentence([unit(4)], 3, 'ar').includes('درس واحد:'));
    assert.ok(leftOutSentence([unit(5)], 3, 'ar').includes('درسان:'));
    assert.ok(leftOutSentence([unit(6)], 3, 'ar').includes('3 دروس:'));
    assert.ok(leftOutSentence([unit(13)], 3, 'ar').includes('10 دروس:'));
    assert.ok(leftOutSentence([unit(14)], 3, 'ar').includes('11 درسًا:'));
  });

  it('names at most six titles and counts the rest, agreed', () => {
    const s7 = leftOutSentence([unit(10)], 3, 'ar'); // 7 left: 6 named + 1
    assert.ok(s7.endsWith('ودرس آخر.'), s7);
    assert.ok(leftOutSentence([unit(11)], 3, 'ar').endsWith('ودرسان آخران.'));
    assert.ok(leftOutSentence([unit(12)], 3, 'ar').endsWith('و3 دروس أخرى.'));
    assert.ok(leftOutSentence([unit(20)], 3, 'ar').endsWith('و11 درسًا آخر.'));
    assert.ok(leftOutSentence([unit(20)], 3, 'en').endsWith('and 11 more.'));
  });

  it('names exactly the lessons each unit cannot show, from every unit', () => {
    const units = [unit(5), unit(4, 'V')];
    const s = leftOutSentence(units, 3, 'ar');
    for (const t of ['دU4', 'دU5', 'دV4']) assert.ok(s.includes(`«${t}»`), `${t} missing: ${s}`);
    for (const t of ['دU1', 'دU3', 'دV3']) assert.ok(!s.includes(`«${t}»`), `${t} is shown, not left out: ${s}`);
  });

  it('English counts in English', () => {
    assert.ok(leftOutSentence([unit(4)], 3, 'en').includes('leaves out 1 lesson:'));
    assert.ok(leftOutSentence([unit(6)], 3, 'en').includes('leaves out 3 lessons:'));
  });

  it('on the real book, every lesson is either shown or named as left out', () => {
    const units = revisionUnits(book, 'ar');
    const s = leftOutSentence(units, REVISION_SHOWN_PER_UNIT, 'ar');
    const left = units.flatMap(u => splitShown(u, REVISION_SHOWN_PER_UNIT).left);
    assert.ok(left.length > 0, 'probe: the whole book should not fit one session');
    assert.ok(s.includes(left.length <= 10 ? `${left.length} دروس` : `${left.length} درسًا`), s);
  });
});

describe('revisionPhrase', () => {
  it('names a semester, the book and a unit as a noun phrase, in both languages', () => {
    assert.equal(revisionPhrase(sem(1), 'ar'), 'موضوعات الفصل الأول');
    assert.equal(revisionPhrase(sem(2), 'ar'), 'موضوعات الفصل الثاني');
    assert.equal(revisionPhrase(sem(1), 'en'), 'Semester 1 topics');
    assert.equal(revisionPhrase(book, 'ar'), 'موضوعات الكتاب كله');
    assert.equal(revisionPhrase(book, 'en'), 'whole-book topics');
    const u = unitsInScope(sem(1))[1]!;
    const unitSel: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: u.id };
    assert.equal(revisionPhrase(unitSel, 'ar'), `موضوعات وحدة «${u.titleAr}»`);
    assert.equal(revisionPhrase(unitSel, 'en'), `“${u.titleEn}” unit topics`);
  });

  it('is never the picker label («… كاملًا»)', () => {
    for (const sel of [sem(1), sem(2), book]) assert.ok(!revisionPhrase(sel, 'ar').includes('كاملًا'));
  });
});

describe('scopeFromKey — what the offline generator reads off a request', () => {
  it('round-trips every kind through its key', () => {
    const u = unitsInScope(sem(2))[0]!;
    const lesson = lessonsInScope(sem(2))[2]!;
    const sels: ScopeSelection[] = [
      sem(1), sem(2), book,
      { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: u.id },
      { kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id },
    ];
    for (const sel of sels) assert.deepEqual(scopeFromKey(scopeKey(sel)), sel);
  });

  it('is null for junk and for a scope that no longer covers anything', () => {
    for (const k of ['', 'book', 'sem:grade-10:mathematics:3', 'unit:gone', 'lesson:gone', 'book:grade-99:mathematics', 'x:y']) {
      assert.equal(scopeFromKey(k), null, k);
    }
  });
});
```

Create `artifacts/mobile/services/__tests__/scopeRequestTeaching.test.ts`:

```ts
/**
 * `buildScopeRequest` — what a teaching tool (lesson plan, activity,
 * classroom builder, slides, lesson-flow) adds to its request for a unit,
 * semester or book. Unlike the assessment tools' `buildWideRequest`, it must
 * KEEP the teacher's own text and its provenance.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { isRevisionRequest, type AIRequest } from '../ai/AIService.ts';
import { buildAdaptationsDirective } from '../kbContext.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { revisionUnits } from '../revisionScope.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };

describe('buildScopeRequest', () => {
  it('a semester carries the scope, the digest and the lesson table without slots', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    assert.equal(w.fields.scope?.kind, 'semester');
    assert.equal(w.fields.scope?.scopeKey, 'sem:grade-10:mathematics:1');
    assert.equal(w.fields.additionalContext, w.grounding.context);
    assert.equal(w.fields.contextSource, 'curriculum');
    assert.deepEqual(w.fields.coverage?.lessons.map(l => l.id), lessonsInScope(sem1).map(l => l.id));
    assert.equal('slots' in (w.fields.coverage ?? {}), false);
    assert.deepEqual(w.units, revisionUnits(sem1, 'ar'));
  });

  it('explicitly clears the single-lesson fields, so a merge cannot leave a stale lesson behind', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    for (const k of ['unitId', 'lessonId'] as const) {
      assert.ok(k in w.fields && w.fields[k] === undefined, `${k} must be present and undefined`);
    }
    assert.equal(w.fields.bookFigureCount, 0);
    const merged = { lessonId: 'L-x', unitId: 'U-x', bookFigureCount: 3, ...w.fields };
    assert.equal(merged.lessonId, undefined);
    assert.equal(merged.unitId, undefined);
    assert.equal(merged.bookFigureCount, 0);
  });

  it('keeps the teacher\'s own text after the digest, and keeps it the teacher\'s', () => {
    const directive = buildAdaptationsDirective('بسّط الشرح لطالب يعاني من عسر القراءة', 'ar');
    const w = buildScopeRequest(sem1, 'ar', { additionalContext: directive, contextSource: 'teacher' })!;
    assert.equal(w.fields.additionalContext, `${w.grounding.context}\n\n${directive.trim()}`);
    assert.equal(w.fields.contextSource, 'teacher');
  });

  it('a typed objective alone (no context text) still keeps the request the teacher\'s', () => {
    // The lesson-plan screen puts objectives in their own field, so `own` has no text, only the decision.
    const w = buildScopeRequest(sem1, 'ar', { contextSource: 'teacher' })!;
    assert.equal(w.fields.contextSource, 'teacher');
    assert.equal(w.fields.additionalContext, w.grounding.context);
  });

  it('curriculum-only stays curriculum; text without a stated source is read as the teacher\'s', () => {
    assert.equal(buildScopeRequest(sem1, 'ar', { contextSource: 'curriculum' })!.fields.contextSource, 'curriculum');
    assert.equal(buildScopeRequest(sem1, 'ar', { additionalContext: 'note' })!.fields.contextSource, 'teacher');
    assert.equal(buildScopeRequest(sem1, 'ar', { additionalContext: '   ' })!.fields.contextSource, 'curriculum');
  });

  it('merged LAST over a screen\'s own request, the teacher\'s text survives', () => {
    const own = { additionalContext: 'teacher note', contextSource: 'teacher' as const, lessonId: 'L-x' };
    const merged = { ...own, ...buildScopeRequest(sem1, 'ar', own)!.fields };
    assert.ok(merged.additionalContext!.endsWith('teacher note'));
    assert.equal(merged.contextSource, 'teacher');
    assert.equal(merged.lessonId, undefined);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    const lessonId = lessonsInScope(sem1)[0]!.id;
    assert.equal(buildScopeRequest({ kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId }, 'ar'), null);
    assert.equal(buildScopeRequest({ kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' }, 'ar'), null);
  });
});

describe('isRevisionRequest', () => {
  it('is true exactly when the request carries a scope', () => {
    const w = buildScopeRequest(sem1, 'ar')!;
    assert.equal(isRevisionRequest({ ...({} as AIRequest), ...w.fields }), true);
    assert.equal(isRevisionRequest({} as AIRequest), false);
    // A lesson table alone (no scope) is not a revision request: the gate is the scope.
    assert.equal(isRevisionRequest({ coverage: w.fields.coverage } as AIRequest), false);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/revisionScope.test.ts services/__tests__/scopeRequestTeaching.test.ts`
Expected: FAIL — `Cannot find module '…/services/revisionScope.ts'` (and `buildScopeRequest` / `isRevisionRequest` are not exported).

- [ ] **Step 3: Implement**

(a) Create `artifacts/mobile/services/revisionScope.ts`:

```ts
/**
 * What a revision session over a unit, a semester or the whole book covers.
 *
 * A teaching tool given a wide scope makes ONE revision session (spec
 * `2026-10-14-wide-scope-teaching-tools-design.md`, decision 1): it spends the
 * time on the key ideas of each unit in scope and says plainly what it leaves
 * out. This module is the one place that decides, per unit, which lessons a
 * session shows and which outcomes, concepts and terms it reviews — so the
 * offline plan, its introduction and its "left out" sentence cannot disagree.
 *
 * Units are rebuilt from lesson ids (`revisionUnitsFromLessons`), never from a
 * title: the request carries `coverage.lessons`, and a scope label («الفصل
 * الأول كاملًا», a unit title) grounds to another grade's lesson when looked up.
 *
 * Free of react-native so `node --test` can load it.
 */
import { curriculumObjectivesFor } from './kbContext.ts';
import { getLessonById, getUnitForLesson, KB_BOOKS, KB_UNITS } from './knowledgeBase.ts';
import { lessonsInScope, parseScope, unitsInScope, type ScopeSelection } from './scopeSelection.ts';

export type RevisionLesson = {
  id: string;
  title: string;
  /**
   * The KB lists no key concepts and no key terms for it (the GeoGebra labs
   * are the case in Grade 10 maths). A revision round has nothing of its own to
   * review there, so it is shown only after every lesson that has some.
   */
  thin: boolean;
};

export type RevisionUnit = {
  /** KB unit id. */
  unitId: string;
  /** Unit title in `lang`. */
  title: string;
  /** The unit's lessons in scope, book order. */
  lessons: RevisionLesson[];
  /** Official outcomes, ≤3: the first outcome of each lesson first (non-thin lessons before thin ones). */
  outcomes: string[];
  /** Key concepts, ≤3, same interleaving. */
  concepts: string[];
  /** Key terms, ≤3, same interleaving. */
  terms: string[];
};

/** Per unit, the most a one-session revision names. Also the cap on outcomes / concepts / terms. */
export const REVISION_SHOWN_PER_UNIT = 3;
const CAP = 3;

/** `thin` lessons last, book order kept inside each group. */
function prioritized(lessons: RevisionLesson[]): RevisionLesson[] {
  return [...lessons.filter(l => !l.thin), ...lessons.filter(l => l.thin)];
}

/** One item from each list in turn, then the second of each, … — deduped, at most `cap`. */
function interleave(lists: string[][], cap: number): string[] {
  const out: string[] = [];
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest && out.length < cap; i++) {
    for (const list of lists) {
      const item = list[i]?.trim();
      if (item && !out.includes(item)) out.push(item);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/**
 * The units the given lessons belong to, in the order the lessons come (pass
 * them in book order), each with its own lessons from the list.
 *
 * An id the KB does not hold (or no longer shows) is skipped: the request is
 * client data, and a stale id must not invent a unit.
 */
export function revisionUnitsFromLessons(lessonIds: readonly string[], lang: 'ar' | 'en'): RevisionUnit[] {
  const isAr = lang === 'ar';
  const order: string[] = [];
  const byUnit = new Map<string, NonNullable<ReturnType<typeof getLessonById>>[]>();
  const seen = new Set<string>();
  for (const id of lessonIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const lesson = getLessonById(id);
    if (!lesson) continue;
    let list = byUnit.get(lesson.unitId);
    if (!list) {
      list = [];
      byUnit.set(lesson.unitId, list);
      order.push(lesson.unitId);
    }
    list.push(lesson);
  }
  const units: RevisionUnit[] = [];
  for (const unitId of order) {
    const kbLessons = byUnit.get(unitId)!;
    const unit = getUnitForLesson(kbLessons[0]!);
    const lessons: RevisionLesson[] = kbLessons.map(l => ({
      id: l.id,
      title: isAr ? l.titleAr : l.titleEn,
      thin: (isAr ? l.keyConceptsAr : l.keyConceptsEn).length === 0 && l.keyTerms.length === 0,
    }));
    const kbById = new Map(kbLessons.map(l => [l.id, l]));
    const ranked = prioritized(lessons).map(l => kbById.get(l.id)!);
    units.push({
      unitId,
      title: unit ? (isAr ? unit.titleAr : unit.titleEn) : '',
      lessons,
      outcomes: interleave(ranked.map(l => curriculumObjectivesFor(l)), CAP),
      concepts: interleave(ranked.map(l => isAr ? l.keyConceptsAr : l.keyConceptsEn), CAP),
      terms: interleave(ranked.map(l => l.keyTerms.map(t => isAr ? t.ar : t.en)), CAP),
    });
  }
  return units;
}

/** The units a scope covers, book order; [] when nothing is in scope. */
export function revisionUnits(sel: ScopeSelection, lang: 'ar' | 'en'): RevisionUnit[] {
  return revisionUnitsFromLessons(lessonsInScope(sel).map(l => l.id), lang);
}

/**
 * Which lessons of a unit a one-session revision names, and which it leaves out.
 *
 * Lessons with something to review come first; both lists are in book order.
 */
export function splitShown(unit: RevisionUnit, shownPerUnit: number): { shown: RevisionLesson[]; left: RevisionLesson[] } {
  const keep = new Set(prioritized(unit.lessons).slice(0, Math.max(0, shownPerUnit)).map(l => l.id));
  return {
    shown: unit.lessons.filter(l => keep.has(l.id)),
    left: unit.lessons.filter(l => !keep.has(l.id)),
  };
}

/**
 * The selection a request's id-only `scope.scopeKey` names (`book:g:s`,
 * `sem:g:s:n`, `unit:<id>`, `lesson:<id>`), rebuilt from the KB. Null for a key
 * it cannot read, or one that no longer covers any lesson.
 */
export function scopeFromKey(scopeKey: string): ScopeSelection | null {
  const [kind, ...rest] = scopeKey.split(':');
  if (kind === 'book' && rest.length === 2) {
    return parseScope({ kind: 'book', gradeId: rest[0], subjectId: rest[1] });
  }
  if (kind === 'sem' && rest.length === 3) {
    return parseScope({ kind: 'semester', gradeId: rest[0], subjectId: rest[1], semester: Number(rest[2]) });
  }
  if ((kind === 'unit' || kind === 'lesson') && rest.length === 1) {
    const unitId = kind === 'unit' ? rest[0] : getLessonById(rest[0]!)?.unitId;
    const unit = KB_UNITS.find(u => u.id === unitId);
    const book = unit ? KB_BOOKS.find(b => b.id === unit.bookId) : undefined;
    if (!book) return null;
    return parseScope(kind === 'unit'
      ? { kind: 'unit', gradeId: book.gradeId, subjectId: book.subjectId, unitId }
      : { kind: 'lesson', gradeId: book.gradeId, subjectId: book.subjectId, lessonId: rest[0] });
  }
  return null;
}

/** «موضوعات الفصل الأول» / "Semester 1 topics" — a noun phrase for use INSIDE sentences. */
export function revisionPhrase(sel: ScopeSelection, lang: 'ar' | 'en'): string {
  const isAr = lang === 'ar';
  switch (sel.kind) {
    case 'book':
      return isAr ? 'موضوعات الكتاب كله' : 'whole-book topics';
    case 'semester':
      if (isAr) return sel.semester === 2 ? 'موضوعات الفصل الثاني' : 'موضوعات الفصل الأول';
      return `Semester ${sel.semester === 2 ? 2 : 1} topics`;
    case 'unit': {
      const u = unitsInScope(sel)[0];
      const title = u ? (isAr ? u.titleAr : u.titleEn) : '';
      return isAr ? `موضوعات وحدة «${title}»` : `“${title}” unit topics`;
    }
    case 'lesson': {
      const l = lessonsInScope(sel)[0];
      const title = l ? (isAr ? l.titleAr : l.titleEn) : '';
      return isAr ? `موضوعات درس «${title}»` : `“${title}” lesson topics`;
    }
  }
}

/** «درس واحد» / «درسان» / «3 دروس» / «11 درسًا» — the same rule as `arLessonsPhrase` (arCount.ts). */
function arLessons(n: number): string {
  if (n === 1) return 'درس واحد';
  if (n === 2) return 'درسان';
  if (n >= 3 && n <= 10) return `${n} دروس`;
  return `${n} درسًا`;
}

/** «ودرس آخر» … — the same words as i18n's `coveredLessonsMore` (i18n.ts loads React Native). */
function arMore(k: number): string {
  if (k === 1) return 'ودرس آخر';
  if (k === 2) return 'ودرسان آخران';
  return k <= 10 ? `و${k} دروس أخرى` : `و${k} درسًا آخر`;
}

/** Titles named in the sentence; the rest are counted. */
export const LEFT_OUT_NAMES = 6;

/**
 * One honest sentence naming what a one-session revision leaves out; '' when
 * nothing is left out. Names at most `LEFT_OUT_NAMES` titles and counts the
 * rest; the total is always stated.
 */
export function leftOutSentence(units: readonly RevisionUnit[], shownPerUnit: number, lang: 'ar' | 'en'): string {
  const left = units.flatMap(u => splitShown(u, shownPerUnit).left);
  if (left.length === 0) return '';
  const named = left.slice(0, LEFT_OUT_NAMES).map(l => l.title);
  const hidden = left.length - named.length;
  if (lang === 'ar') {
    const names = named.map(t => `«${t}»`).join('، ');
    return `لن تتّسع حصة واحدة لكل دروس هذا النطاق، فيبقى خارج هذه المراجعة ${arLessons(left.length)}: ${names}${hidden > 0 ? ` ${arMore(hidden)}` : ''}.`;
  }
  const names = named.map(t => `“${t}”`).join(', ');
  return `One session cannot cover every lesson in this scope, so this review leaves out ${left.length} lesson${left.length === 1 ? '' : 's'}: ${names}${hidden > 0 ? ` and ${hidden} more` : ''}.`;
}
```

(b) In `artifacts/mobile/services/wideScopeRequest.ts`, replace the line

```ts
import { buildCoverage, DISTRIBUTIONS, lessonIdsFromTags, type CoverageLesson, type Distribution } from './coveragePlan.ts';
```

with

```ts
import { buildCoverage, coverageLessons, DISTRIBUTIONS, lessonIdsFromTags, type CoverageLesson, type Distribution } from './coveragePlan.ts';
import { revisionUnits, type RevisionUnit } from './revisionScope.ts';
```

and insert this block directly before the line `/** The picker's counts. 25 and 30 are APPENDED: saved indices must keep their meaning. */` (do not change `buildWideRequest`):

```ts
export type ScopeRequestFields = Pick<
  AIRequest,
  'scope' | 'additionalContext' | 'contextSource' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'
>;

export type ScopeRequest = { fields: ScopeRequestFields; grounding: ScopeGrounding; units: RevisionUnit[] };

/**
 * The teaching tools' counterpart of `buildWideRequest`: lesson plan, activity,
 * classroom builder, slides and lesson-flow, when the teacher picked a unit, a
 * semester or the whole book. Returns the fields to MERGE LAST over the
 * screen's own request.
 *
 * Not `buildWideRequest`: that one wants a question count, plans `slots`, and
 * REPLACES `additionalContext` with `contextSource: 'curriculum'` — on a
 * teaching tool that would silently drop the teacher's typed objectives,
 * adaptations and notes, and pool a plan written from them. Here `own` is what
 * the screen already put in its request (the teacher's text folded into
 * `additionalContext`, and the `contextSource` it decided), and it is kept:
 *
 * - `additionalContext` = the scope digest, then a blank line, then the
 *   screen's own text (either may be absent);
 * - `contextSource` = `'teacher'` when the screen said so, or when it sent text
 *   without saying who wrote it (absent is read as the teacher's, fail closed —
 *   the server's own rule); otherwise `'curriculum'`;
 * - `coverage` = `{ lessons }` only — no `slots`: a teaching tool has no
 *   question slots, and the offline path rebuilds its units from these ids;
 * - `unitId` / `lessonId` present and `undefined`, `bookFigureCount: 0`, for
 *   the reason given on `buildWideRequest`.
 *
 * Null for a lesson scope and for a wide scope that does not ground: the
 * screen refuses (`wideScopeUngrounded`) rather than generate a mislabeled
 * session.
 */
export function buildScopeRequest(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  own: { additionalContext?: string; contextSource?: 'teacher' | 'curriculum' } = {},
): ScopeRequest | null {
  if (sel.kind === 'lesson') return null;
  const grounding = resolveScopeGrounding(sel, lang);
  if (!grounding.grounded) return null;
  const digest = scopeRequestFields(grounding);
  const ownText = own.additionalContext?.trim() ?? '';
  const teacher = own.contextSource === 'teacher' || (ownText !== '' && own.contextSource === undefined);
  return {
    grounding,
    units: revisionUnits(sel, lang),
    fields: {
      scope: digest.scope,
      additionalContext: [digest.additionalContext ?? '', ownText].filter(Boolean).join('\n\n') || undefined,
      contextSource: teacher ? 'teacher' : 'curriculum',
      coverage: { lessons: coverageLessons(sel, lang) },
      unitId: undefined,
      lessonId: undefined,
      bookFigureCount: 0,
    },
  };
}
```

(c) In `artifacts/mobile/services/ai/AIService.ts`, the end of `interface ClassroomActivityRequest` reads:

```ts
  numQuestions?: number;
}

/**
 * A deck built directly from the teacher's own free-text description, not a
```

Replace the `  numQuestions?: number;\n}\n` part (keep the comment that follows) with:

```ts
  numQuestions?: number;
  /** A unit / semester / book revision session — see `AIRequest.scope`. Absent for one lesson. */
  scope?: AIRequest['scope'];
  /** The lessons of that scope (no `slots` — see `buildScopeRequest`). Absent for one lesson. */
  coverage?: AIRequest['coverage'];
}

/**
 * Whether a request is for a revision session over a unit, a semester or the
 * whole book rather than one lesson.
 *
 * Read from `scope` alone — there is no separate flag: the scope key is
 * already in the cache key, and a lesson request (no `scope`) must stay
 * byte-identical. The teaching tools' offline generators branch on this and
 * the server's `revisionClauseAr/En` on the same field.
 */
export function isRevisionRequest(req: { scope?: { kind: string } | null }): boolean {
  return !!req.scope;
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/revisionScope.test.ts services/__tests__/scopeRequestTeaching.test.ts services/__tests__/wideScopeRequest.test.ts services/__tests__/scopeRequest.test.ts`
Expected: PASS (28 tests in the two new files; the two existing files unchanged).

Prove the pins bite (then revert each): (1) in `revisionUnitsFromLessons`, replace `prioritized(lessons)` with `lessons` — *"a lab with nothing to review comes last"* fails; (2) in `buildScopeRequest`, change `const teacher = own.contextSource === 'teacher' || …` to `const teacher = false` — the two "keeps … the teacher's" tests fail; (3) in `leftOutSentence`, use `${left.length} دروس` unconditionally — the agreement test fails.

Then: `cd artifacts/mobile && pnpm test 2>&1 | tail -6` — expect `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/revisionScope.ts artifacts/mobile/services/wideScopeRequest.ts artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/__tests__/revisionScope.test.ts artifacts/mobile/services/__tests__/scopeRequestTeaching.test.ts
git commit -m "feat: revision scope — units, left-out sentence and the teaching tools' scope request"
```
(Commit message ends with the two trailers from Global Constraints.)

---

### Task 2: Server — the revision clause in the plan, activity and classroom prompts

**Files:**
- Create: `artifacts/api-server/src/lib/revision.ts`
- Modify: `artifacts/api-server/src/lib/prompts.ts` (import block; `lessonPlanPromptAr`, `lessonPlanPromptEn`, `activityPromptAr`, `activityPromptEn` — quoted anchors below)
- Modify: `artifacts/api-server/src/lib/classroomPrompts.ts` (new import; new `classroomActivityPrompt` before `quickCheckCount`)
- Modify: `artifacts/api-server/src/routes/generate.ts` (the `classroomPrompts.ts` import; the `/generate/classroom-activity` prompt line)
- Test: `artifacts/api-server/src/lib/__tests__/revision.test.ts`

**Interfaces:**
- Consumes (existing): `parseWideScope(raw): WideScope | null` (`lib/grounding.ts`); `parseCoverage(body): CoverageTable | null` (`lib/coverage.ts` — lessons `{ code, id, title }`, **no unitId**); `classroomPromptAr/En`, `classroomSetupClause`, `CLASSROOM_ACTIVITY_TYPES` (`lib/classroomPrompts.ts`).
- Produces:
  ```ts
  // lib/revision.ts
  export type RevisionKind = "plan" | "activity" | "classroom";
  export function revisionClauseAr(b: Record<string, unknown>, kind: RevisionKind): string;
  export function revisionClauseEn(b: Record<string, unknown>, kind: RevisionKind): string;
  // lib/classroomPrompts.ts
  export function classroomActivityPrompt(b: any, isAr: boolean): string;
  ```

**Why there is no cache-key change.** A wide request's strict key already differs from a lesson's and from another scope's: `scope` (the id-only scope key) is in both keys, the digest the request carries in `additionalContext` is hashed as `contextHash`, and the lesson table (code / id / title) as `coverageHash` (piece 2). A lesson request carries none of them, and the clause is `''` without `scope`, so no existing key or prompt changes and `PROMPT_VERSION` is not bumped. The clause renders only the table's titles (hashed) and points at the digest's unit headings (hashed); it renders nothing derived from `coverage.lessons[].unitId`, which the key deliberately does not hash — a test below pins that. The test the brief asks for (two requests differing only in `scope.scopeKey` have different strict keys) already exists: `generationKey.test.ts` → `describe("scope in the cache key")` → *"different scopes never share a slot, in either key"*. None is added.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/lib/__tests__/revision.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/revision.test.ts`
Expected: FAIL — `Cannot find module '…/src/lib/revision.ts'`.

- [ ] **Step 3: Implement**

(a) Create `artifacts/api-server/src/lib/revision.ts`:

```ts
/**
 * The revision clause of a wide-scope lesson plan, activity or classroom deck.
 *
 * A teacher who picks a unit, a semester or the whole book on a teaching tool
 * gets ONE revision session (spec `2026-10-14-wide-scope-teaching-tools-design.md`):
 * it spends the time on the key ideas of each unit and says what it leaves out.
 * The offline twins live in the mobile app — the plan in
 * `services/ai/lessonPlanRevision.ts`, built from `services/revisionScope.ts` —
 * so change one, change the other.
 *
 * What the clause renders is only what the strict cache key already hashes:
 * the lesson table's code and title (`coverageHash`, via `parseCoverage`) and
 * nothing derived from the table's `unitId`, which is deliberately NOT hashed
 * (`generationKey.test.ts`: "a field the prompt never shows (unitId) is not
 * hashed"). The units themselves are named by the scope digest the request
 * carries in `additionalContext` (its «الوحدة:» / "Unit:" headings), which is
 * hashed as `contextHash`. So two requests that share a key share a prompt.
 *
 * '' for anything that is not a valid wide-scope request, which leaves every
 * lesson prompt byte-for-byte as it was. Imports nothing that touches the
 * OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";
import { parseCoverage } from "./coverage.ts";

export type RevisionKind = "plan" | "activity" | "classroom";

/** «درس واحد» / «درسان» / «3 دروس» / «11 درسًا» — `arLessonsPhrase` in the app; the API cannot import it. */
function arLessonCount(n: number): string {
  if (n === 1) return "درس واحد";
  if (n === 2) return "درسان";
  if (n >= 3 && n <= 10) return `${n} دروس`;
  return `${n} درسًا`;
}

function lessonListAr(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  return `\nدروس النطاق (${arLessonCount(c.lessons.length)}) بترتيب الكتاب:\n${c.lessons.map((l) => `- ${l.title}`).join("\n")}`;
}

function lessonListEn(b: Record<string, unknown>): string {
  const c = parseCoverage(b);
  if (!c) return "";
  return `\nLessons in scope (${c.lessons.length}), in book order:\n${c.lessons.map((l) => `- ${l.title}`).join("\n")}`;
}

const CONTRACT_AR: Record<RevisionKind, string> = {
  plan: `هذه خطة حصة مراجعة واحدة لا خطة درس جديد:
- رتّب "mainActivity" جولةً لكل وحدة، بالشكل الذي يقتضيه أسلوب التدريس المحدد أعلاه (المباشر: مراجعة بمثال محلول لكل وحدة؛ الاستقصائي: سؤال موجّه واحد لكل وحدة؛ التعاوني: بطاقة مجموعة لكل وحدة)، ولا تُسقط وحدة.
- اصرف الوقت على الأفكار الرئيسة لكل وحدة، ولا تحاول تغطية كل درس.
- اذكر في "introduction" النطاق الذي تراجعه الحصة، وما الذي لن تتّسع له، بأسماء الدروس.
- اجعل "objectives" من نتاجات الوحدات المذكورة في النطاق، لا أهدافًا عامة.
- حافظ على صيغة المتكلم المستقبل للمعلم وعلى بنية أسلوب التدريس كما وردتا أعلاه.`,
  activity: `هذا النشاط لحصة مراجعة تغطي عدة وحدات، لا درسًا واحدًا:
- استمدّ محتواه من دروس الوحدات المذكورة، وأعطِ كل وحدة نصيبًا منه، ولا تحصره في درس واحد.
- حافظ على بنية هذا النوع من الأنشطة كما وردت أعلاه؛ تتغيّر المادة لا البنية.
- حيث تذكر البنية «صفحة الكتاب»، فالمقصود صفحات الكتاب الخاصة بكل وحدة من الوحدات المذكورة.`,
  classroom: `هذا النشاط الصفي لحصة مراجعة تغطي عدة وحدات، لا درسًا واحدًا:
- وزّع بطاقاته أو أسئلته أو تحدياته على الوحدات المذكورة، وأعطِ كل وحدة نصيبًا منها، ولا تحصرها في درس واحد.
- حافظ على بنية النشاط وشكل JSON المطلوب أعلاه كما هما.`,
};

const CONTRACT_EN: Record<RevisionKind, string> = {
  plan: `This is ONE revision session, not a plan for a new lesson:
- Arrange "mainActivity" as one round per unit, in the form the teaching style above requires (direct: a worked review per unit; inquiry: one guiding question per unit; collaborative: one group card per unit), and leave no unit out.
- Spend the time on each unit's key ideas; do not try to cover every lesson.
- State in "introduction" the scope the session reviews and, by lesson name, what it cannot fit.
- Draw "objectives" from the outcomes of the units in scope, not generic aims.
- Keep the teaching-style structure required above.`,
  activity: `This activity is for a revision session over several units, not one lesson:
- Draw its content from the lessons of the units in scope, give each unit a share, and do not confine it to one lesson.
- Keep this format's structure as required above; the material changes, not the structure.
- Where the structure mentions "the textbook page", read it as each unit's own pages in the book.`,
  classroom: `This classroom activity is for a revision session over several units, not one lesson:
- Spread its cards, questions or challenges over the units in scope, give each unit a share, and do not confine them to one lesson.
- Keep the activity's structure and the required JSON shape above unchanged.`,
};

export function revisionClauseAr(b: Record<string, unknown>, kind: RevisionKind): string {
  if (!parseWideScope(b.scope)) return "";
  return `\nالنطاق أوسع من درس واحد: الوحدات هي عناوين «الوحدة:» في وصف النطاق أعلاه.${lessonListAr(b)}\n${CONTRACT_AR[kind]}`;
}

export function revisionClauseEn(b: Record<string, unknown>, kind: RevisionKind): string {
  if (!parseWideScope(b.scope)) return "";
  return `\nThe scope is wider than one lesson: the units are the "Unit:" headings in the scope description above.${lessonListEn(b)}\n${CONTRACT_EN[kind]}`;
}
```

(b) `artifacts/api-server/src/lib/prompts.ts` — four surgical edits, each anchor occurs exactly once.

Import — after `import { coverageClauseAr, coverageClauseEn } from "./coverage.ts";` add:

```ts
import { revisionClauseAr, revisionClauseEn } from "./revision.ts";
```

`lessonPlanPromptAr` — replace

```
${lessonStyleClauseAr(b)}${kindBlockAr(b)}
${teacherVoiceAr(b, hasPriorReview)}
```

with

```
${lessonStyleClauseAr(b)}${kindBlockAr(b)}${revisionClauseAr(b, "plan")}
${teacherVoiceAr(b, hasPriorReview)}
```

`lessonPlanPromptEn` — replace

```
${lessonStyleClauseEn(b)}${kindBlockEn(b)}
${hasPriorReview ? `
```

with

```
${lessonStyleClauseEn(b)}${kindBlockEn(b)}${revisionClauseEn(b, "plan")}
${hasPriorReview ? `
```

`activityPromptAr` — replace

```
بنية هذا النوع من الأنشطة — التزم بها ولا تستبدلها ببنية عامة:
${rule}
```

with

```
بنية هذا النوع من الأنشطة — التزم بها ولا تستبدلها ببنية عامة:
${rule}${revisionClauseAr(b, "activity")}
```

`activityPromptEn` — replace

```
Structure required for this format — follow it, do not substitute a generic one:
${rule}
```

with

```
Structure required for this format — follow it, do not substitute a generic one:
${rule}${revisionClauseEn(b, "activity")}
```

The clause starts with `\n`, so for a wide request it lands on its own lines; for every other request it is `''` and the template is unchanged. One clause per builder, never one per format: `activityBlueprints.test.ts` / `activityPrompts.test.ts` (every format differs) and `lessonStylePrompts.test.ts` stay untouched.

(c) `artifacts/api-server/src/lib/classroomPrompts.ts` — directly before the doc comment `/**\n * The 7 activity-type ids the classroom hub can send.` add:

```ts
import { revisionClauseAr, revisionClauseEn } from './revision.ts';
```

and directly before the doc comment `/**\n * How many quick-check questions to generate.` add:

```ts
/**
 * The whole user prompt for `/generate/classroom-activity`: the activity
 * type's own template, then — for a unit / semester / book revision deck only —
 * the revision clause, then the room's setup line.
 *
 * The one place the clause is appended, so the 14 per-type templates (7 types
 * × 2 languages) stay untouched; their `"lesson"` / `"activityName"` read
 * `b.topic`, which for a wide deck is the scope label — acceptable there as a
 * display name. Without `scope` this is exactly what the route built before.
 */
export function classroomActivityPrompt(b: any, isAr: boolean): string {
  return (isAr ? classroomPromptAr(b) : classroomPromptEn(b))
    + (isAr ? revisionClauseAr(b, 'classroom') : revisionClauseEn(b, 'classroom'))
    + classroomSetupClause(b, isAr);
}
```

(d) `artifacts/api-server/src/routes/generate.ts` — replace the import

```ts
import {
  classroomPromptAr,
  classroomPromptEn,
  classroomSetupClause,
  stripUnearnedVerification,
} from "../lib/classroomPrompts.ts";
```

with

```ts
import {
  classroomActivityPrompt,
  classroomSetupClause,
  stripUnearnedVerification,
} from "../lib/classroomPrompts.ts";
```

and in `generateRouter.post('/generate/classroom-activity', …)` replace

```ts
    const prompt = (isAr ? classroomPromptAr(body) : classroomPromptEn(body))
      + classroomSetupClause(body, isAr);
```

with

```ts
    const prompt = classroomActivityPrompt(body, isAr);
```

(`classroomSetupClause` stays imported: the prompt-slides route still uses it.)

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/revision.test.ts src/lib/__tests__/classroomPrompts.test.ts src/lib/__tests__/activityPrompts.test.ts src/lib/__tests__/lessonStylePrompts.test.ts src/lib/__tests__/coverage.test.ts src/lib/__tests__/generationKey.test.ts`
Expected: PASS.

Prove the pins bite (then revert): (1) make `revisionClauseAr` return its text without the `parseWideScope` guard — *"is empty without a valid wide scope"* and every identity test fail; (2) append `${revisionClauseAr(b, "plan")}` a second time in `lessonPlanPromptAr` — the identity test fails (`replace` removes one copy only); (3) render `l.unitId` in `lessonListAr` — *"renders nothing derived from the table's unitId"* fails.

Then: `cd artifacts/api-server && pnpm build && pnpm test 2>&1 | tail -6` — expect `# fail 0` (the build is needed for the mount-order suite; CLAUDE.md).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/revision.ts artifacts/api-server/src/lib/prompts.ts artifacts/api-server/src/lib/classroomPrompts.ts artifacts/api-server/src/routes/generate.ts artifacts/api-server/src/lib/__tests__/revision.test.ts
git commit -m "feat: revision clause for wide-scope lesson plans, activities and classroom decks"
```
(Commit message ends with the two trailers from Global Constraints.)

---

### Task 3: Offline lesson plan for a wide scope

**Files:**
- Create: `artifacts/mobile/services/ai/lessonPlanRevision.ts`
- Modify: `artifacts/mobile/services/ai/generators.ts` (the `./AIService.ts` value import; the `./lessonPlanBlueprints.ts` import; the first line of `lessonPlanOnce`)
- Test: `artifacts/mobile/services/__tests__/lessonPlanRevision.test.ts`
- Test: `artifacts/mobile/services/__tests__/lessonPlanRevisionLive.test.ts`

**Interfaces:**
- Consumes: Task 1's `RevisionUnit`, `revisionUnits`, `revisionUnitsFromLessons`, `revisionPhrase`, `scopeFromKey`, `splitShown`, `leftOutSentence`, `REVISION_SHOWN_PER_UNIT`, `isRevisionRequest`, `buildScopeRequest`; Task 2's `lessonPlanPromptAr/En` and `revisionClauseAr/En` (live pin only); existing `arMinutes` (`ai/lessonPlanTypes.ts`), `LESSON_STYLE_IDS` (`ai/lessonPlanBlueprints.ts`), `FIRST_PERSON`, `imperativesIn`, `norm` (`__tests__/teacherVoiceCheck.ts`), `LessonPlanOutput`.
- Produces:
  ```ts
  // services/ai/lessonPlanRevision.ts
  export type RevisionStyle = 'direct' | 'inquiry' | 'collaborative';
  export type RevisionPlanInput = { units: RevisionUnit[]; phrase: string; lang: 'ar' | 'en'; style: string; duration: number; customObjectives?: string };
  export type RevisionPlanFields = Pick<LessonPlanOutput, 'objectives' | 'materials' | 'introduction' | 'mainActivity'
    | 'guidedPractice' | 'independentPractice' | 'closure' | 'assessment' | 'differentiation' | 'homework'>;
  export const ROUND_MARK_AR = 'الجولة';
  export const ROUND_MARK_EN = 'Round';
  export function buildRevisionPlan(input: RevisionPlanInput): RevisionPlanFields;
  export function revisionPlanFromRequest(req: AIRequest): LessonPlanOutput;   // throws when no lesson can be read
  ```

How the generator gets its units: from `req.coverage.lessons[].id` via `revisionUnitsFromLessons` (the same table the live clause lists), falling back to `revisionUnits(scopeFromKey(req.scope.scopeKey))` when the table is absent; the phrase from `scopeFromKey`. Never from `req.topic` (the label). Every field of the real `LessonPlanOutput` is filled except the optional ones: `priorReview` (never on a wide scope), `ministryRoles` (the offline path never sets it, as today), `sources` / `variantId` / `servedReason` / `repeated` (server- or `freshOnRegenerate`-owned). Regenerate variety: none (decision 6 above).

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/lessonPlanRevision.test.ts`:

```ts
/**
 * The offline lesson plan for a unit, a semester or the whole book: one
 * revision session (spec 2026-10-14-wide-scope-teaching-tools-design.md §1).
 *
 * Pinned: every field of the plan is there for every style × language; the
 * main activity is one round per unit in each style; the introduction states
 * the scope and what is left out; the Arabic teacher fields are first person,
 * future (the same detector `lessonPlanTeacherVoice.test.ts` uses); and the
 * scope's label is never spliced into a lesson-shaped sentence. On the
 * generator: only a request WITH a scope takes this path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { buildRevisionPlan, revisionPlanFromRequest, ROUND_MARK_AR, ROUND_MARK_EN } from '../ai/lessonPlanRevision.ts';
import { leftOutSentence, revisionPhrase, revisionUnits, REVISION_SHOWN_PER_UNIT } from '../revisionScope.ts';
import { scopeLabel, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G = 'grade-10';
const sem1: ScopeSelection = { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 };
const sem2: ScopeSelection = { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 2 };
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'mathematics' };
const chemBook: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'chemistry' };
// The vectors unit has three lessons: it fits one session, nothing is left out.
const vectors: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: unitsInScope(sem2)[2]!.id };
const SCOPES = [sem1, sem2, book, chemBook, vectors];
const LANGS = ['ar', 'en'] as const;

/** Every text field of `LessonPlanOutput` a plan must fill. */
const TEXT_FIELDS = [
  'introduction', 'mainActivity', 'guidedPractice', 'independentPractice',
  'closure', 'assessment', 'differentiation', 'homework',
] as const;
/** The fields the teacher acts in (homework is the students'). Same list as lessonPlanTeacherVoice.test.ts, minus priorReview. */
const TEACHER_FIELDS = TEXT_FIELDS.filter(f => f !== 'homework');

const plan = (sel: ScopeSelection, lang: 'ar' | 'en', style: string) =>
  buildRevisionPlan({ units: revisionUnits(sel, lang), phrase: revisionPhrase(sel, lang), lang, style, duration: 45 });

const roundsIn = (text: string, lang: 'ar' | 'en') =>
  (text.match(new RegExp(`^${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} \\d+ — `, 'gm')) ?? []).length;

describe('buildRevisionPlan', () => {
  for (const lang of LANGS) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${lang} · ${style}: every field is filled, for every scope`, () => {
        for (const sel of SCOPES) {
          const p = plan(sel, lang, style);
          for (const f of TEXT_FIELDS) assert.ok(p[f].trim().length > 0, `${f} empty`);
          assert.ok(p.objectives.length > 0 && p.objectives.every(o => o.trim()), 'objectives');
          assert.ok(p.materials.length > 0 && p.materials.every(m => m.trim()), 'materials');
        }
      });

      it(`${lang} · ${style}: one round per unit, each naming its unit`, () => {
        for (const sel of SCOPES) {
          const units = revisionUnits(sel, lang);
          const p = plan(sel, lang, style);
          assert.equal(roundsIn(p.mainActivity, lang), units.length, p.mainActivity);
          units.forEach((u, i) => {
            const mark = `${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} ${i + 1} — ${lang === 'ar' ? `«${u.title}»` : `“${u.title}”`}`;
            assert.ok(p.mainActivity.includes(mark), `round ${i + 1} is not «${u.title}»`);
          });
        }
      });

      it(`${lang} · ${style}: the introduction states the scope and, when anything is cut, what`, () => {
        for (const sel of SCOPES) {
          const units = revisionUnits(sel, lang);
          const p = plan(sel, lang, style);
          assert.ok(p.introduction.includes(revisionPhrase(sel, lang)), p.introduction);
          const left = leftOutSentence(units, REVISION_SHOWN_PER_UNIT, lang);
          if (left) assert.ok(p.introduction.includes(left), `left-out sentence missing: ${p.introduction}`);
        }
        assert.equal(leftOutSentence(revisionUnits(vectors, lang), REVISION_SHOWN_PER_UNIT, lang), '', 'probe: vectors fits');
        assert.ok(leftOutSentence(revisionUnits(book, lang), REVISION_SHOWN_PER_UNIT, lang), 'probe: the book does not fit');
      });

      it(`${lang} · ${style}: the scope label is never spliced into a lesson-shaped sentence`, () => {
        for (const sel of SCOPES) {
          const p = plan(sel, lang, style);
          const all = [...TEXT_FIELDS.map(f => p[f]), ...p.objectives, ...p.materials].join('\n');
          assert.ok(!all.includes('المفهوم الرئيسي'), 'lesson-shaped «المفهوم الرئيسي»');
          assert.ok(!/key concept of/i.test(all), 'lesson-shaped "key concept of"');
          // A unit's label is its title, which the rounds name on purpose; a semester or book label must never appear.
          if (sel.kind !== 'unit') assert.ok(!all.includes(scopeLabel(sel, lang)), `label «${scopeLabel(sel, lang)}» spliced in`);
        }
      });
    }
  }

  for (const style of LESSON_STYLE_IDS) {
    it(`ar · ${style}: the teacher fields are first person, future`, () => {
      for (const sel of SCOPES) {
        const p = plan(sel, 'ar', style);
        for (const f of TEACHER_FIELDS) {
          assert.deepEqual(imperativesIn(p[f]), [], `${f} addresses the teacher in the imperative:\n${p[f]}`);
        }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) {
          assert.match(norm(p[f]), FIRST_PERSON, `${f} never says «سأ…»:\n${p[f]}`);
        }
      }
    });
  }

  it('the three styles build three different main activities, in both languages', () => {
    for (const lang of LANGS) {
      const mains = LESSON_STYLE_IDS.map(s => plan(sem1, lang, s).mainActivity);
      assert.equal(new Set(mains).size, LESSON_STYLE_IDS.length, lang);
    }
  });

  it('an unknown style is read as direct', () => {
    assert.deepEqual(plan(sem1, 'ar', 'lecture'), plan(sem1, 'ar', 'direct'));
  });

  it('the teacher\'s own objectives are used verbatim; otherwise every unit has one', () => {
    const units = revisionUnits(book, 'ar');
    const own = buildRevisionPlan({ units, phrase: 'x', lang: 'ar', style: 'direct', duration: 45, customObjectives: 'هدف أ\n\nهدف ب' });
    assert.deepEqual(own.objectives, ['هدف أ', 'هدف ب']);
    const auto = plan(book, 'ar', 'direct');
    for (const u of units) assert.ok(auto.objectives.some(o => o.startsWith(`${u.title}: `)), `${u.title} has no objective`);
  });
});

const base = { grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', duration: 45, teachingStyle: 'inquiry' } as const;
const wideReq = (sel: ScopeSelection, extra: Partial<AIRequest> = {}): AIRequest => ({
  ...base, topic: scopeLabel(sel, 'ar'), ...extra, ...buildScopeRequest(sel, 'ar')!.fields,
} as AIRequest);

describe('generateLessonPlan — the wide branch', () => {
  it('a request with a scope gets the revision plan, built from its lesson table', async () => {
    const out = await aiService.generateLessonPlan(wideReq(sem1));
    assert.equal(roundsIn(out.mainActivity, 'ar'), revisionUnits(sem1, 'ar').length);
    assert.equal(out.title, 'موضوعات الفصل الأول – خطة حصة مراجعة');
    assert.equal(out.duration, 45);
  });

  it('never produces a prior-knowledge review, whatever the request asks', async () => {
    const out = await aiService.generateLessonPlan(wideReq(sem1, {
      includePriorReview: true, priorKnowledge: ['مفهوم سابق'], priorTopicsNotes: 'أعد شرح الكسور',
    }));
    assert.equal('priorReview' in out, false);
  });

  it('without a lesson table it rebuilds the units from the scope key', async () => {
    const { coverage: _c, ...noTable } = wideReq(sem2);
    const out = await aiService.generateLessonPlan(noTable as AIRequest);
    assert.equal(roundsIn(out.mainActivity, 'ar'), revisionUnits(sem2, 'ar').length);
  });

  it('refuses a scope it cannot read rather than plan about nothing', () => {
    const req = { ...base, topic: 'x', scope: { kind: 'unit', scopeKey: 'unit:gone', unitIds: [] } } as AIRequest;
    assert.throws(() => revisionPlanFromRequest(req), /lessons of its scope/);
  });

  it('a request with NO scope never takes the wide branch, even with a lesson table attached', async () => {
    const { scope: _s, ...noScope } = wideReq(sem1);
    const lessonPlan = await aiService.generateLessonPlan(noScope as AIRequest);
    assert.equal(roundsIn(lessonPlan.mainActivity, 'ar'), 0, 'a lesson request was built as a revision');
    assert.ok(lessonPlan.title.endsWith('– خطة درس'), lessonPlan.title);
  });

  it('an offline Regenerate says honestly that the revision plan could not change', async () => {
    const req = wideReq(vectors);
    await aiService.generateLessonPlan(req);
    const again = await aiService.generateLessonPlan({ ...req, regenerate: true });
    assert.deepEqual(again.repeated, { count: 8, of: 8 });
  });
});
```

Create `artifacts/mobile/services/__tests__/lessonPlanRevisionLive.test.ts` (the two-places pin; it imports the api-server prompt builders by relative path, as `coverageLivePrompt.test.ts` does, and so needs Task 2):

```ts
/**
 * One revision session, two builders (CLAUDE.md: "two places move together").
 *
 * The offline plan (`lessonPlanRevision.ts`) runs a round per unit over the
 * units it rebuilds from the request's lesson table; the live prompt
 * (`revisionClauseAr/En(b, 'plan')`) lists the same table and points the model
 * at the digest's «الوحدة:» headings for its rounds. For the same request they
 * must agree on which lessons are in scope and how many units there are.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AIRequest } from '../ai/AIService.ts';
import { revisionPlanFromRequest, ROUND_MARK_AR, ROUND_MARK_EN } from '../ai/lessonPlanRevision.ts';
import { revisionUnitsFromLessons } from '../revisionScope.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import type { ScopeSelection } from '../scopeSelection.ts';
import { lessonPlanPromptAr, lessonPlanPromptEn } from '../../../api-server/src/lib/prompts.ts';
import { revisionClauseAr, revisionClauseEn } from '../../../api-server/src/lib/revision.ts';

const G = 'grade-10';
const SCOPES: ScopeSelection[] = [
  { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 },
  { kind: 'book', gradeId: G, subjectId: 'mathematics' },
  { kind: 'book', gradeId: G, subjectId: 'chemistry' },
];

for (const lang of ['ar', 'en'] as const) {
  describe(`offline plan and live prompt agree (${lang})`, () => {
    for (const sel of SCOPES) {
      it(`${sel.kind}:${sel.subjectId}`, () => {
        const req = {
          grade: 'Grade 10', subject: sel.subjectId === 'chemistry' ? 'Chemistry' : 'Mathematics', topic: 'label',
          language: lang === 'ar' ? 'arabic' : 'english', duration: 45, teachingStyle: 'direct',
          ...buildScopeRequest(sel, lang)!.fields,
        } as AIRequest;
        const prompt = (lang === 'ar' ? lessonPlanPromptAr : lessonPlanPromptEn)(req as unknown as Record<string, unknown>);
        const clause = (lang === 'ar' ? revisionClauseAr : revisionClauseEn)(req as unknown as Record<string, unknown>, 'plan');
        assert.ok(clause && prompt.includes(clause), 'the live plan prompt carries no revision clause');
        const units = revisionUnitsFromLessons(req.coverage!.lessons.map(l => l.id), lang);
        // Every lesson the offline plan draws on is listed by the live clause itself (not only by the digest).
        for (const u of units) for (const l of u.lessons) assert.ok(clause.includes(`- ${l.title}`), `live clause lacks «${l.title}»`);
        // The live prompt's unit headings (from the digest) are the offline plan's rounds.
        const headings = (prompt.match(new RegExp(`^${lang === 'ar' ? 'الوحدة' : 'Unit'}: `, 'gm')) ?? []).length;
        const plan = revisionPlanFromRequest(req);
        const rounds = (plan.mainActivity.match(new RegExp(`^${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} \\d+ — `, 'gm')) ?? []).length;
        assert.equal(rounds, units.length);
        assert.equal(headings, units.length, 'the digest names a different number of units than the offline plan rounds');
      });
    }
  });
}
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonPlanRevision.test.ts services/__tests__/lessonPlanRevisionLive.test.ts`
Expected: FAIL — `Cannot find module '…/services/ai/lessonPlanRevision.ts'`.

- [ ] **Step 3: Implement**

(a) Create `artifacts/mobile/services/ai/lessonPlanRevision.ts`:

```ts
/**
 * The offline lesson plan for a unit, a semester or the whole book: ONE
 * revision session over the units in scope (spec
 * `2026-10-14-wide-scope-teaching-tools-design.md`, §1).
 *
 * It keeps the plan's own fields (no new ones — the viewer, the saved-plan type
 * and the exports are untouched) and the teaching style's shape, but the main
 * activity is a round per unit in that style's own form: `direct` a short
 * worked review per unit, `inquiry` one guiding question per unit,
 * `collaborative` one group card per unit. The introduction states the scope
 * and what the session leaves out (`leftOutSentence`). No prior-knowledge
 * review is produced: it belongs to one lesson's unit.
 *
 * The live twin is `revisionClauseAr/En(b, 'plan')` in
 * `artifacts/api-server/src/lib/revision.ts` — change one, change the other.
 * The Arabic teacher fields are first person, future («سأراجع… ثم سأطرح…»),
 * per the voice rule (`lessonPlanTeacherVoice.test.ts`); `homework` is the
 * students' and stays addressed to them.
 *
 * Deterministic: an offline Regenerate of a revision plan returns the same plan,
 * and `freshOnRegenerate` reports it as repeated rather than pretending.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { AIRequest, LessonPlanOutput } from './AIService.ts';
import { arMinutes } from './lessonPlanTypes.ts';
import {
  leftOutSentence, revisionPhrase, revisionUnits, revisionUnitsFromLessons, scopeFromKey, splitShown,
  REVISION_SHOWN_PER_UNIT, type RevisionUnit,
} from '../revisionScope.ts';

export type RevisionStyle = 'direct' | 'inquiry' | 'collaborative';

export type RevisionPlanInput = {
  units: RevisionUnit[];
  /** `revisionPhrase(sel, lang)` — «موضوعات الفصل الأول». */
  phrase: string;
  lang: 'ar' | 'en';
  /** Any other value is read as `direct`, as `buildLessonStyleBlueprint` does. */
  style: string;
  duration: number;
  /** The teacher's own objectives, one per line — used verbatim, as on a single-lesson plan. */
  customObjectives?: string;
};

export type RevisionPlanFields = Pick<
  LessonPlanOutput,
  'objectives' | 'materials' | 'introduction' | 'mainActivity' | 'guidedPractice'
  | 'independentPractice' | 'closure' | 'assessment' | 'differentiation' | 'homework'
>;

/** The mark that opens each round of the main activity — one per unit. Tests count it. */
export const ROUND_MARK_AR = 'الجولة';
export const ROUND_MARK_EN = 'Round';

function styleOf(style: string): RevisionStyle {
  return style === 'inquiry' || style === 'collaborative' ? style : 'direct';
}

/** «وحدة واحدة» / «وحدتان» / «3 وحدات» / «11 وحدةً». */
function arUnits(n: number): string {
  if (n === 1) return 'وحدة واحدة';
  if (n === 2) return 'وحدتان';
  if (n >= 3 && n <= 10) return `${n} وحدات`;
  return `${n} وحدةً`;
}

type Ctx = {
  units: RevisionUnit[];
  isAr: boolean;
  min: (share: number) => number;
  label: (n: number) => string;
  q: (s: string) => string;
  list: (items: string[]) => string;
  roundMin: number;
};

function ctxFor(input: RevisionPlanInput): Ctx {
  const isAr = input.lang === 'ar';
  const min = (share: number) => Math.max(1, Math.round(input.duration * share));
  return {
    units: input.units,
    isAr,
    min,
    label: n => (isAr ? arMinutes(n) : `${n} min`),
    q: s => (isAr ? `«${s}»` : `“${s}”`),
    list: items => items.join(isAr ? '، ' : ', '),
    roundMin: Math.max(1, Math.floor(min(0.4) / Math.max(1, input.units.length))),
  };
}

/** The lessons a round names, quoted. */
function shownTitles(c: Ctx, u: RevisionUnit): string {
  return c.list(splitShown(u, REVISION_SHOWN_PER_UNIT).shown.map(l => c.q(l.title)));
}

function roundHead(c: Ctx, u: RevisionUnit, i: number): string {
  return `${c.isAr ? ROUND_MARK_AR : ROUND_MARK_EN} ${i + 1} — ${c.q(u.title)} (${c.label(c.roundMin)})`;
}

function objectives(input: RevisionPlanInput, c: Ctx): string[] {
  const own = input.customObjectives?.trim();
  if (own) return own.split('\n').map(s => s.trim()).filter(Boolean);
  // Every unit gets a line; with few units, more of each unit's outcomes fit.
  const perUnit = c.units.length <= 2 ? 3 : 1;
  return c.units.flatMap(u => (u.outcomes.length
    ? u.outcomes.slice(0, perUnit).map(o => `${u.title}: ${o}`)
    : [c.isAr ? `مراجعة الأفكار الرئيسة في وحدة ${c.q(u.title)}` : `Review the key ideas of the ${c.q(u.title)} unit`]));
}

function introduction(input: RevisionPlanInput, c: Ctx): string {
  const left = leftOutSentence(c.units, REVISION_SHOWN_PER_UNIT, input.lang);
  const titles = c.list(c.units.map(u => c.q(u.title)));
  const n = c.units.length;
  const body = c.isAr
    ? `(${c.label(c.min(0.1))}) سأعلن في بداية الحصة أنها حصة مراجعة واحدة تغطي ${input.phrase}`
      + (n > 1 ? `، وهي ${arUnits(n)}: ${titles}.` : '.')
      + ' ثم سيكتب كل طالب في دقيقة واحدة أصعب فكرة يتذكّرها منها، وسأبدأ بما يتكرّر في الإجابات.'
    : `(${c.label(c.min(0.1))}) Announce that this is one revision session covering ${input.phrase}`
      + (n > 1 ? ` — ${n} units: ${titles}.` : '.')
      + ' Each student then writes, in one minute, the hardest idea they remember from it; start from what comes up most.';
  return left ? `${body} ${left}` : body;
}

function conceptsOf(c: Ctx, u: RevisionUnit, n: number): string {
  const cs = u.concepts.slice(0, n);
  return cs.length ? c.list(cs.map(c.q)) : (c.isAr ? 'الفكرة الرئيسة في هذه الوحدة' : 'the key idea of this unit');
}

function guidingQuestion(c: Ctx, u: RevisionUnit): string {
  const [a, b] = u.concepts;
  if (c.isAr) {
    if (a && b) return `ما العلاقة بين ${a} و${b}؟ ومتى نحتاج كلًّا منهما؟`;
    if (a) return `متى نحتاج ${a}؟ وكيف نعرف أن النتيجة صحيحة؟`;
    return 'ما أهم فكرة في هذه الوحدة؟ وأين نحتاجها؟';
  }
  if (a && b) return `How are ${a} and ${b} related, and when do we need each?`;
  if (a) return `When do we need ${a}, and how do we know the result is right?`;
  return 'What is the most important idea in this unit, and where do we need it?';
}

function mainActivity(style: RevisionStyle, c: Ctx): string {
  const m = c.label(c.min(0.4));
  if (c.isAr) {
    if (style === 'inquiry') {
      return `(${m}) – مراجعة استقصائية، سؤال موجّه واحد لكل وحدة (ثلاثيات):\n\n`
        + c.units.map((u, i) => `${roundHead(c, u, i)}: سأطرح سؤالًا موجّهًا دون أن أذكّر بالقاعدة: «${guidingQuestion(c, u)}» ثم يكتب كل ثلاثي إجابته مع دليل من دروس ${shownTitles(c, u)}.`).join('\n');
    }
    if (style === 'collaborative') {
      return `(${m}) – مراجعة تعاونية، بطاقة مجموعة لكل وحدة (مجموعات 3-4):\n\n`
        + 'سأعطي كل مجموعة بطاقة وحدة، وإن زادت المجموعات على الوحدات تكرّرت البطاقة:\n'
        + c.units.map((u, i) => `${roundHead(c, u, i)}: بطاقة فيها ${conceptsOf(c, u, 3)} من دروس ${shownTitles(c, u)}؛ تُعِدّ المجموعة ملخّصًا ومثالًا واحدًا، ثم تعرضه على الصف.`).join('\n')
        + '\nوبعد كل عرض سأسحب رقمًا: يجيب صاحبه عن سؤال من بطاقة مجموعة أخرى.';
    }
    return `(${m}) – مراجعة مباشرة، جولة لكل وحدة («أنا أفعل» ثم سؤال سريع):\n\n`
      + c.units.map((u, i) => `${roundHead(c, u, i)}: سأراجع دروس ${shownTitles(c, u)} بشرح قصير يتناول ${conceptsOf(c, u, 2)} ومثال واحد من الكتاب، ثم سأطرح سؤالًا سريعًا يجيب عنه الصف معًا.`).join('\n');
  }
  if (style === 'inquiry') {
    return `(${m}) – Inquiry review, one guiding question per unit (groups of three):\n\n`
      + c.units.map((u, i) => `${roundHead(c, u, i)}: pose a guiding question without restating the rule — "${guidingQuestion(c, u)}" — and each trio writes its answer with evidence from ${shownTitles(c, u)}.`).join('\n');
  }
  if (style === 'collaborative') {
    return `(${m}) – Collaborative review, one group card per unit (groups of 3-4):\n\n`
      + 'Give each group a unit card; with more groups than units, cards repeat:\n'
      + c.units.map((u, i) => `${roundHead(c, u, i)}: a card on ${conceptsOf(c, u, 3)} from ${shownTitles(c, u)}; the group prepares a summary and one example, then presents it.`).join('\n')
      + '\nAfter each presentation draw a number: that student answers a question from another group\'s card.';
  }
  return `(${m}) – Direct review, one round per unit (I do, then a quick check):\n\n`
    + c.units.map((u, i) => `${roundHead(c, u, i)}: review ${shownTitles(c, u)} with a short explanation of ${conceptsOf(c, u, 2)} and one textbook example, then pose a quick question the class answers together.`).join('\n');
}

function practice(style: RevisionStyle, c: Ctx): Pick<RevisionPlanFields, 'guidedPractice' | 'independentPractice'> {
  const g = c.label(c.min(0.2));
  const ind = c.label(c.min(0.15));
  const titles = c.list(c.units.map(u => c.q(u.title)));
  if (c.isAr) {
    if (style === 'inquiry') {
      return {
        guidedPractice: `(${g}) – اختبار الإجابات:\n\n• سأعرض إجابات الثلاثيات لكل وحدة جنبًا إلى جنب، وسأسأل: «ما دليلك؟ هل ينطبق هذا على مثال من الكتاب؟»\n• وسأقدّم لكل وحدة حالة تكشف خطأً شائعًا، ويعدّل الثلاثي إجابته بنفسه.\n• بعد أن يستقر الصف على صياغة، سأكتبها على السبورة تحت اسم وحدتها.`,
        independentPractice: `(${ind}) – حالة جديدة من كل وحدة:\n\n• يعمل كل طالب بمفرده على حالة لم تُناقَش من كل وحدة (${titles})، ويكتب: هل صمدت الصياغة التي توصّلنا إليها؟ وإن لم تصمد، ما الشرط الناقص؟\n• سأقبل الإجابة «لم تصمد» إن كان التبرير سليمًا.`,
      };
    }
    if (style === 'collaborative') {
      return {
        guidedPractice: `(${g}) – نقد متبادل بين المجموعات:\n\n• ستتبادل كل مجموعتين ملخّصيهما وتكتب كل منهما نقطة قوية واحدة وسؤالًا حقيقيًا واحدًا.\n• تردّ كل مجموعة على سؤال الأخرى أمام الصف في دقيقة واحدة.\n• سأدير الحوار ولن أقدّم الإجابة، وسأسأل: «هل أقنعك ردّهم؟ لماذا؟»`,
        independentPractice: `(${ind}) – مساءلة فردية:\n\n• الآن فقط يعمل كل طالب بمفرده وبصمت على ورقة قصيرة فيها سؤال من **كل** وحدة (${titles})، لا من بطاقة مجموعته وحدها.\n• وسأسحب رقمًا: يعرض صاحبه إجابته عن وحدة غير وحدة مجموعته.`,
      };
    }
    return {
      guidedPractice: `(${g}) – «نحن نفعل»:\n\n• سأختار من كل وحدة سؤالًا واحدًا من أسئلة الكتاب، وسنحلّه معًا والطلبة يوجّهون كل خطوة.\n• سأطرح أسئلة استرشادية: «من أي وحدة هذا السؤال؟ وما الذي نحتاجه منها؟»\n• وسأصحّح الأخطاء الشائعة فور ظهورها.`,
      independentPractice: `(${ind}) – «أنت تفعل»:\n\n• يعمل كل طالب بمفرده على ورقة مراجعة قصيرة فيها سؤال من كل وحدة (${titles}).\n• سأتجوّل وأقدّم تلميحات مكتوبة دون أن أعطي الحل.`,
    };
  }
  if (style === 'inquiry') {
    return {
      guidedPractice: `(${g}) – Testing the answers:\n\n• Post each unit's trio answers side by side and ask: "What is your evidence? Does it hold for an example from the book?"\n• Offer each unit one case that exposes a common error; the trio revises its own answer.\n• Once the class settles on a wording, write it on the board under its unit.`,
      independentPractice: `(${ind}) – A new case from every unit:\n\n• Each student works alone on an undiscussed case from each unit (${titles}) and writes: did our wording hold? If not, what condition was missing?\n• "It did not hold" is a fully acceptable answer when the reasoning is sound.`,
    };
  }
  if (style === 'collaborative') {
    return {
      guidedPractice: `(${g}) – Group-to-group critique:\n\n• Groups swap summaries in pairs and each writes one genuine strength and one genuine question.\n• Each group answers the other's question in front of the class, in one minute.\n• Run the exchange without supplying the answer: "Did their reply convince you? Why?"`,
      independentPractice: `(${ind}) – Individual accountability:\n\n• Only now does each student work alone and in silence, on a short sheet with a question from **every** unit (${titles}) — not just their group's card.\n• Draw a number: that student reports their answer on a unit other than their group's.`,
    };
  }
  return {
    guidedPractice: `(${g}) – We Do:\n\n• Pick one textbook question from each unit and solve it together, with students directing each step.\n• Guiding questions: "Which unit is this from? What do we need from it?"\n• Correct common errors the moment they surface.`,
    independentPractice: `(${ind}) – You Do:\n\n• Each student works alone on a short review sheet with a question from each unit (${titles}).\n• Circulate with written hints rather than answers.`,
  };
}

function assessment(style: RevisionStyle, c: Ctx): string {
  if (c.isAr) {
    if (style === 'inquiry') return 'المقياس جودة الاستدلال في كل وحدة لا سرعة الإجابة.\nتكويني: سأصنّف إجابات الثلاثيات: مبنية على دليل من الدروس، أم على تذكّر، أم على تخمين.\nختامي: سأنظر في ورقة الحالة الجديدة لكل وحدة: هل فحص الطالب الصياغة أم طبّقها دون تحقّق؟';
    if (style === 'collaborative') return 'سأقيّم المجموعة بورقة الفرد الذي سُحب رقمه، لا بأفضل أفرادها.\nتكويني: سأراجع ملخّصات المجموعات بحثًا عن وحدة ضعيفة باستمرار — تلك هي التي سأعيد شرحها للصف كله.\nختامي: سأرصد نتيجة الورقة الفردية لكل وحدة على حدة.';
    return 'تكويني: سأراقب في «نحن نفعل» أيّ الوحدات يتعثّر فيها الطلبة.\nختامي: سأصحّح ورقة المراجعة الفردية وأرصد النتيجة لكل وحدة على حدة، لا علامة واحدة للحصة.\nبطاقة الخروج: سأعدّ الوحدات التي يذكرها الطلبة لأقرّر ما أعيده.';
  }
  if (style === 'inquiry') return 'The measure is the quality of the reasoning in each unit, not the speed of answering.\nFormative: sort the trios\' answers — grounded in evidence from the lessons, in recall, or in guessing.\nSummative: the new-case sheet for each unit — did the student test the wording or apply it unchecked?';
  if (style === 'collaborative') return 'Grade the group on the sheet of the student whose number was drawn, not on its strongest member.\nFormative: scan the summaries for a unit that is consistently weak — that is the one to re-teach to the whole class.\nSummative: record the individual sheet\'s result for each unit separately.';
  return 'Formative: watch the We-Do stage for the units students stumble on.\nSummative: mark the individual review sheet and record the result per unit, not one mark for the session.\nExit ticket: count the units students name, to decide what to revisit.';
}

function differentiation(style: RevisionStyle, c: Ctx): string {
  const [u0, u1] = c.units;
  const pair = u0 && u1 ? `${c.q(u0.title)} ${c.isAr ? 'و' : 'and '}${c.q(u1.title)}` : '';
  if (c.isAr) {
    const link = pair ? `سؤال يربط وحدتين (مثل ${pair})` : 'سؤال يربط درسين من الوحدة';
    if (style === 'inquiry') return `دعم: سأضيّق السؤال الموجّه وأعطي بادئة جملة للإجابة.\nتحدٍّ: ${link} مع الشرط الذي يجعل الصياغة تصمد.\nالمبدأ: الجميع يستقصي — سأراعي الفروق في ضيق السؤال لا في من يُسمح له بالتفكير.`;
    if (style === 'collaborative') return `سأعطي بطاقات الوحدات بقصد لا عشوائيًا: البطاقة الأقصر لمجموعة تحتاج دعمًا، وتبقى مسؤولة عن جزء حقيقي يعتمد عليه الصف.\nتحدٍّ: ${link}، أو صياغة سؤال امتحان يغطي الوحدات كلها.`;
    return `دعم: سأعطي من يحتاج بطاقة مثال لكل وحدة يرجع إليها في الورقة الفردية.\nتحدٍّ: ${link}.\nالمبدأ: سأقلّل الحمل المعرفي بالأمثلة أولًا ثم أزيلها تدريجيًا.`;
  }
  const link = pair ? `a question that links two units (such as ${pair})` : 'a question that links two lessons of the unit';
  if (style === 'inquiry') return `Support: narrow the guiding question and give a sentence stem for the answer.\nStretch: ${link}, with the condition that makes the wording hold.\nThe principle: everyone investigates — differentiate the narrowness of the question, never who is allowed to think.`;
  if (style === 'collaborative') return `Hand out the unit cards deliberately, not at random: the shortest card to a group that needs support — it still owns a real part the class depends on.\nStretch: ${link}, or writing an exam question that covers every unit.`;
  return `Support: an example card per unit for students who need it during the individual sheet.\nStretch: ${link}.\nThe principle: cut cognitive load with examples first, then withdraw them.`;
}

function homework(input: RevisionPlanInput, c: Ctx): string {
  const left = c.units.some(u => splitShown(u, REVISION_SHOWN_PER_UNIT).left.length > 0);
  if (c.isAr) {
    return 'لكل وحدة من وحدات المراجعة: اكتب الفكرة الرئيسة في جملتين، وحلّ سؤالًا واحدًا من أسئلة مراجعتها في الكتاب.'
      + (left ? ' وابدأ بالدروس التي لم تتّسع لها الحصة.' : '');
  }
  return 'For each unit reviewed: write its key idea in two sentences and solve one question from its review exercises in the book.'
    + (left ? ' Start with the lessons the session could not fit.' : '');
}

const MATERIALS: Record<'ar' | 'en', Record<RevisionStyle, string[]>> = {
  ar: {
    direct: ['الكتاب المدرسي (صفحات مراجعة كل وحدة)', 'السبورة وأقلام ملوّنة', 'بطاقة مثال لكل وحدة', 'ورقة مراجعة فردية فيها سؤال من كل وحدة'],
    inquiry: ['بطاقة سؤال موجّه لكل وحدة', 'ورق كبير وأقلام لتسجيل الإجابات', 'الكتاب المدرسي (يُفتح بعد المحاولة لا قبلها)', 'ورقة حالة جديدة من كل وحدة'],
    collaborative: ['بطاقة وحدة لكل مجموعة', 'لوح إجابة لكل مجموعة', 'أقلام ملوّنة وشريط لاصق', 'كيس أرقام للمساءلة العشوائية', 'ورقة مراجعة فردية تغطي الوحدات كلها'],
  },
  en: {
    direct: ['Textbook (each unit\'s review pages)', 'Board and coloured markers', 'An example card per unit', 'Individual review sheet with a question from each unit'],
    inquiry: ['A guiding-question card per unit', 'Chart paper and markers for recording answers', 'Textbook (opened after the attempt, not before)', 'A new-case sheet from each unit'],
    collaborative: ['One unit card per group', 'One answer board per group', 'Coloured markers and tape', 'Number draw for random accountability', 'Individual review sheet covering every unit'],
  },
};

/** Every text field of a revision plan, for the units given. */
export function buildRevisionPlan(input: RevisionPlanInput): RevisionPlanFields {
  const c = ctxFor(input);
  const style = styleOf(input.style);
  return {
    objectives: objectives(input, c),
    materials: [...MATERIALS[input.lang][style]],
    introduction: introduction(input, c),
    mainActivity: mainActivity(style, c),
    ...practice(style, c),
    closure: c.isAr
      ? `(${c.label(c.min(0.1))}) سأختم ببطاقة خروج لكل طالب: «أي وحدة ما زلت تحتاج إلى مراجعتها؟ ولماذا؟» وسأجمع البطاقات لأبني عليها المراجعة القادمة.`
      : `(${c.label(c.min(0.1))}) Exit ticket for every student: "Which unit do you still need to review, and why?" Collect them to plan the next review.`,
    assessment: assessment(style, c),
    differentiation: differentiation(style, c),
    homework: homework(input, c),
  };
}

/**
 * The whole plan for a revision request, as `lessonPlanOnce` returns it.
 *
 * Units come from the request's lesson table (`coverage.lessons` ids — the
 * table the live prompt lists too), else from its scope key; the phrase from
 * the scope key. Never from `topic`: that is the scope's label, and it grounds
 * to the wrong lesson. Throws when neither yields a lesson, rather than
 * building a plan about nothing.
 */
export function revisionPlanFromRequest(req: AIRequest): LessonPlanOutput {
  const lang: 'ar' | 'en' = req.language === 'arabic' ? 'ar' : 'en';
  const sel = req.scope ? scopeFromKey(req.scope.scopeKey) : null;
  const fromTable = req.coverage?.lessons?.length
    ? revisionUnitsFromLessons(req.coverage.lessons.map(l => l.id), lang)
    : [];
  const units = fromTable.length ? fromTable : sel ? revisionUnits(sel, lang) : [];
  if (units.length === 0) {
    throw new Error('A revision plan needs the lessons of its scope, and none could be read from the request.');
  }
  const phrase = sel ? revisionPhrase(sel, lang) : (lang === 'ar' ? 'موضوعات المراجعة' : 'the review topics');
  const duration = req.duration ?? 45;
  const fields = buildRevisionPlan({
    units, phrase, lang, style: req.teachingStyle ?? 'direct', duration, customObjectives: req.objectives,
  });
  return {
    title: lang === 'ar'
      ? `${phrase} – خطة حصة مراجعة`
      : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} – Revision Lesson Plan`,
    grade: req.grade,
    subject: req.subject,
    duration,
    ...fields,
  };
}
```

(b) `artifacts/mobile/services/ai/generators.ts` — three edits, each anchor occurs once.

Replace `import { AIService } from './AIService.ts';` with:

```ts
import { AIService, isRevisionRequest } from './AIService.ts';
```

After `import { buildLessonStyleBlueprint, type LessonDocContext } from './lessonPlanBlueprints.ts';` add:

```ts
import { revisionPlanFromRequest } from './lessonPlanRevision.ts';
```

Replace

```ts
  private async lessonPlanOnce(req: AIRequest): Promise<LessonPlanOutput> {
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
```

with

```ts
  private async lessonPlanOnce(req: AIRequest): Promise<LessonPlanOutput> {
    // A unit, a semester or the whole book: one revision session over the units
    // in scope, built from the request's lesson ids. It must come before
    // `groundedKb`, which would ground the scope's LABEL («الفصل الأول كاملًا», a
    // unit title) to one lesson — another grade's, for a unit title. No prior
    // review on this path: it belongs to a single lesson's unit.
    if (isRevisionRequest(req)) return revisionPlanFromRequest(req);
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
```

Nothing else in `lessonPlanOnce` changes, so a request without `scope` runs exactly the code it ran before.

- [ ] **Step 4: Run them and confirm they pass**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonPlanRevision.test.ts services/__tests__/lessonPlanRevisionLive.test.ts services/__tests__/lessonPlanTeacherVoice.test.ts services/__tests__/lessonPlanStyle.test.ts services/__tests__/lessonPlanVariants.test.ts services/__tests__/lessonPlanRegenerateStems.test.ts services/__tests__/mockLessonPlanPriorReview.test.ts services/__tests__/generatorRequests.test.ts`
Expected: PASS — the new files (36 + 6 tests) and every existing lesson-plan test unchanged (they are the lesson-scope byte-identity check: they exercise the untouched path).

Prove the pins bite (then revert each): (1) in `lessonPlanRevision.ts` change `سأراجع دروس` to `راجع دروس` — the voice test fails on `direct`; (2) in `generators.ts` change the gate to `if (isRevisionRequest(req) || req.coverage)` — *"a request with NO scope never takes the wide branch"* fails; (3) drop the last unit from `mainActivity` (`c.units.slice(0, -1).map(…)`) — the round count fails in both files; (4) in `revision.ts` make `lessonListAr` return `''` — the live pin fails («live clause lacks …»), although the digest still lists every title.

Then: `cd artifacts/mobile && pnpm test 2>&1 | tail -6` — expect `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/lessonPlanRevision.ts artifacts/mobile/services/ai/generators.ts artifacts/mobile/services/__tests__/lessonPlanRevision.test.ts artifacts/mobile/services/__tests__/lessonPlanRevisionLive.test.ts
git commit -m "feat: offline lesson plan for a unit, semester or book — one revision session"
```
(Commit message ends with the two trailers from Global Constraints.)

---

### Task 4: Lesson-plan screen — unit, semester and book scopes

**Files:**
- Modify: `artifacts/mobile/services/wideScopeRequest.ts` (the `./generatorRequests.ts` import; insert `buildWideLessonPlanRequest` after `buildScopeRequest`)
- Modify: `artifacts/mobile/app/ai-tools/lesson-plan.tsx` (anchors quoted below)
- Test: `artifacts/mobile/services/__tests__/lessonPlanWideRequest.test.ts`

**Interfaces:**
- Consumes: Task 1's `buildScopeRequest`, `scopeFormState` (existing), `useWideScope(params, { gradeId, subjectId })` (existing hook), `scopeLabel` (existing), existing `buildLessonPlanRequest(form, grounding)`, `LessonPlanForm`, `GeneratorGrounding`, `captureGenerationScope`, `reopenedGenerationScope`, `useGeneratorExport({ …, noFigures })`, `GeneratorResultActions hideRelated`, `ExportMenu onMinistry?`, `TopicSelector allowedKinds / onScopeChange / offlineWideScope`, i18n key `wideScopeUngrounded` (exists, ar + en).
- Produces:
  ```ts
  // wideScopeRequest.ts
  export function buildWideLessonPlanRequest(form: LessonPlanForm, sel: ScopeSelection): AIRequest | null;
  ```
  The screen itself produces nothing other tasks consume.

The screen cannot be unit-tested (React Native). Its one decision worth testing — which request a wide plan sends — is `buildWideLessonPlanRequest`, tested below. The rest is verified by typecheck, the suite and the read-through checklist in Step 5.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/lessonPlanWideRequest.test.ts`:

```ts
/**
 * The lesson-plan screen's request for a unit / semester / book.
 *
 * The screen itself cannot be loaded by `node --test`; this is the decision it
 * delegates to: the form's own request, the teacher's text kept and kept
 * private, nothing re-derived from the scope's label, no prior review.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWideLessonPlanRequest, buildScopeRequest } from '../wideScopeRequest.ts';
import { buildAdaptationsDirective } from '../kbContext.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import type { LessonPlanForm } from '../generatorRequests.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const form = (over: Partial<LessonPlanForm> = {}): LessonPlanForm => ({
  gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: 'الفصل الأول كاملًا', lang: 'ar',
  durationMinutes: 45, teachingStyle: 'collaborative', objectives: '', adaptations: '', priorTopicsNotes: '',
  includePriorReview: false, ...over,
});

describe('buildWideLessonPlanRequest', () => {
  it('carries the form\'s own fields and the scope, with no lesson re-derived from the label', () => {
    const req = buildWideLessonPlanRequest(form(), sem1)!;
    assert.equal(req.teachingStyle, 'collaborative');
    assert.equal(req.duration, 45);
    assert.equal(req.topic, 'الفصل الأول كاملًا');
    assert.equal(req.ministryRoles, true);
    assert.equal(req.scope?.scopeKey, 'sem:grade-10:mathematics:1');
    assert.deepEqual(req.coverage?.lessons.map(l => l.id), lessonsInScope(sem1).map(l => l.id));
    assert.equal(req.lessonId, undefined);
    assert.equal(req.unitId, undefined);
    assert.equal(req.bookFigureCount, 0);
    assert.equal(req.contextSource, 'curriculum');
    assert.equal(req.additionalContext, buildScopeRequest(sem1, 'ar')!.grounding.context);
  });

  it('a typed objective keeps the plan the teacher\'s, and is sent as the objective', () => {
    const req = buildWideLessonPlanRequest(form({ objectives: 'أن يربط الطالب بين الوحدات' }), sem1)!;
    assert.equal(req.objectives, 'أن يربط الطالب بين الوحدات');
    assert.equal(req.contextSource, 'teacher');
  });

  it('a typed adaptation rides after the digest and keeps the plan the teacher\'s', () => {
    const adaptations = 'بسّط الشرح';
    const req = buildWideLessonPlanRequest(form({ adaptations }), sem1)!;
    const directive = buildAdaptationsDirective(adaptations, 'ar').trim();
    assert.ok(directive.length > 0, 'probe: the directive is not empty');
    assert.ok(req.additionalContext!.endsWith(directive), req.additionalContext);
    assert.ok(req.additionalContext!.startsWith('📚'), 'the digest comes first');
    assert.equal(req.contextSource, 'teacher');
  });

  it('never asks for a prior review, and notes that are not sent do not make the plan private', () => {
    const req = buildWideLessonPlanRequest(form({ includePriorReview: true, priorTopicsNotes: 'الكسور' }), sem1)!;
    assert.equal(req.includePriorReview, undefined);
    assert.equal(req.priorKnowledge, undefined);
    assert.equal(req.priorTopicsNotes, undefined);
    assert.equal(req.contextSource, 'curriculum');
  });

  it('a Regenerate carries the regeneration fields through', () => {
    const req = buildWideLessonPlanRequest(form({ regenerate: true, previous: { mainActivity: 'x' } }), sem1)!;
    assert.equal(req.regenerate, true);
  });

  it('is null for a lesson scope and for one that does not ground', () => {
    const lessonId = lessonsInScope(sem1)[0]!.id;
    assert.equal(buildWideLessonPlanRequest(form(), { kind: 'lesson', gradeId: 'grade-10', subjectId: 'mathematics', lessonId }), null);
    assert.equal(buildWideLessonPlanRequest(form(), { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'gone' }), null);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonPlanWideRequest.test.ts`
Expected: FAIL — `buildWideLessonPlanRequest` is not exported by `../wideScopeRequest.ts`.

- [ ] **Step 3: Implement**

(a) `artifacts/mobile/services/wideScopeRequest.ts` — replace

```ts
import { scopeRequestFields } from './generatorRequests.ts';
```

with

```ts
import { buildLessonPlanRequest, scopeRequestFields, type LessonPlanForm } from './generatorRequests.ts';
import type { GeneratorGrounding } from './kbContext.ts';
```

and insert directly after the closing `}` of `buildScopeRequest` (before `/** The picker's counts.`):

```ts
/**
 * Inert grounding for a wide request: no lesson, no lesson context, so
 * `buildLessonPlanRequest` contributes only the form's own fields and the
 * teacher's text — never ids, figures or a prior review re-derived from the
 * scope's label.
 */
const SCOPE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };

/**
 * The lesson-plan screen's request for a unit / semester / book: the form's
 * own request (style, duration, objectives, adaptations, Ministry roles,
 * regeneration) with the scope's fields merged LAST.
 *
 * A wide plan has no prior-knowledge review (it belongs to one lesson's unit),
 * so `includePriorReview` and `priorTopicsNotes` are dropped here, before the
 * teacher-text rule runs: notes that are not sent must not make the plan
 * private. Null when `buildScopeRequest` is (a lesson scope, or one that does
 * not ground) — the screen then refuses with `wideScopeUngrounded`.
 */
export function buildWideLessonPlanRequest(form: LessonPlanForm, sel: ScopeSelection): AIRequest | null {
  const own = buildLessonPlanRequest({ ...form, priorTopicsNotes: '', includePriorReview: false }, SCOPE_GROUNDING);
  const wide = buildScopeRequest(sel, form.lang, { additionalContext: own.additionalContext, contextSource: own.contextSource });
  return wide ? { ...own, ...wide.fields } : null;
}
```

(b) `artifacts/mobile/app/ai-tools/lesson-plan.tsx` — each Find occurs exactly once.

(b1) Find:
```tsx
import { getUnitPriorKnowledge, resolveGeneratorGrounding } from '@/services/kbContext';
```
Replace:
```tsx
import { getUnitPriorKnowledge, resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
```

(b2) Find:
```tsx
import { buildLessonPlanRequest, groundLessonPlanTopic } from '@/services/generatorRequests';
```
Replace:
```tsx
import { buildLessonPlanRequest, groundLessonPlanTopic } from '@/services/generatorRequests';
import { useWideScope } from '@/hooks/useWideScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { buildWideLessonPlanRequest, scopeFormState } from '@/services/wideScopeRequest';
```

(b3) Find:
```tsx
const STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;
```
Replace:
```tsx
const STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;
/**
 * What a unit / semester / book plan is anchored to: the scope itself, never one
 * lesson its label happens to match. A full grounding because `captureGenerationScope`
 * freezes it; a null lesson means no lesson id, no figures, no Ministry unit.
 */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
```

(b4) Find (note the file's own odd indentation on the first line):
```tsx
   includePriorReview?: string;
  }>();
```
Replace:
```tsx
   includePriorReview?: string;
    scope?: string; distribution?: string;
  }>();
```

(b5) Find:
```tsx
  useWarmGrounding(topic, lang);
```
Replace:
```tsx
  useWarmGrounding(topic, lang);
  // The teaching tools ignore `distribution`: a revision session has no question slots.
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /** The wide scope the plan on screen was generated under — what Save records, and what hides the Ministry form. */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(
    () => (wideScope.isWide ? wideScope.scopeSel! : null),
  );
```
(It must sit above the `generated` state, whose initializer reads `wideFrozen`.)

(b6) Find:
```tsx
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => (params.savedId ? reopenedGenerationScope(initialScope, topic, lang) : null),
  );
```
Replace:
```tsx
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => {
      if (!params.savedId) return null;
      // A restored wide plan is anchored to the scope, not to whichever lesson its
      // label («الفصل الأول كاملًا», a unit title) would ground to if looked up again.
      if (wideFrozen && topic.trim()) {
        return captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING);
      }
      return reopenedGenerationScope(initialScope, topic, lang);
    },
  );
```

(b7) Find:
```tsx
  const groundedLesson: string | null = generated?.lesson
    ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
    : null;
  /** KB id of that lesson — the Ministry form needs its unit and period count. */
  const groundedLessonId: string | null = generated?.lesson?.id ?? null;
```
Replace:
```tsx
  // A wide plan has no single lesson: name its scope instead of leaving the notice's tail empty.
  const groundedLesson: string | null = wideFrozen
    ? scopeLabel(wideFrozen, outLang)
    : generated?.lesson
      ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
      : null;
  /** KB id of that lesson — the Ministry form needs its unit and period count. A wide plan has none. */
  const groundedLessonId: string | null = wideFrozen ? null : (generated?.lesson?.id ?? null);
```

(b8) Find:
```tsx
  const priorKnowledge = (() => {
    if (!topic.trim()) return [] as string[];
```
Replace:
```tsx
  const priorKnowledge = (() => {
    // A wide scope has no single lesson, and its label must not be looked up as one:
    // the review option would light up for whichever lesson the label happens to match.
    if (!topic.trim() || wideScope.isWide) return [] as string[];
```

(b9) Find:
```tsx
  useEffect(() => {
    if (!priorReviewAvailable && includePriorReview) setIncludePriorReview(false);
  }, [priorReviewAvailable, includePriorReview]);
```
Replace:
```tsx
  // Not on a wide scope: there the box is hidden and the request drops the review
  // anyway, so a detour through a unit must not cost the teacher their tick.
  useEffect(() => {
    if (!wideScope.isWide && !priorReviewAvailable && includePriorReview) setIncludePriorReview(false);
  }, [wideScope.isWide, priorReviewAvailable, includePriorReview]);
```

(b10) Find:
```tsx
    const held = { result, editedFields, generated };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // plan — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError('');
```
Replace:
```tsx
    const held = { result, editedFields, generated, wideFrozen };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // plan — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    const form = {
      gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
      subjectName: subjects[subjectIdx].name,
      topic,
      lang,
      durationMinutes: DURATION_VALUES[durationIdx],
      teachingStyle: STYLE_IDS[styleIdx],
      objectives, adaptations, priorTopicsNotes, includePriorReview,
      regenerate: opts?.regenerate === true,
      previous,
    };
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson only.
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wideSel = wideScope.isWide ? wideScope.scopeSel! : null;
    const wideReq = wideSel ? buildWideLessonPlanRequest(form, wideSel) : null;
    if (wideSel && !wideReq) { setError(t('wideScopeUngrounded')); return; }
    if (!wideReq) {
      const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setError('');
```

(b11) Find:
```tsx
    try {
      const form = {
        gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        subjectName: subjects[subjectIdx].name,
        topic,
        lang,
        durationMinutes: DURATION_VALUES[durationIdx],
        teachingStyle: STYLE_IDS[styleIdx],
        objectives, adaptations, priorTopicsNotes, includePriorReview,
        regenerate: opts?.regenerate === true,
        previous,
      };
      const grounding = groundLessonPlanTopic(form, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
      const out = await aiService.generateLessonPlan(
        buildLessonPlanRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setResult(out);
```
Replace:
```tsx
    try {
      // Wide: the topic is never grounded — it is the scope's label.
      const grounding = wideReq
        ? WIDE_GROUNDING
        : groundLessonPlanTopic(form, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
      const out = await aiService.generateLessonPlan(
        wideReq ?? buildLessonPlanRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setWideFrozen(wideReq ? wideSel : null);
      setResult(out);
```
(The lesson path is the same calls in the same order; only `form` moved above the checks, unchanged.)

(b12) Find:
```tsx
        setEditedFields(held.editedFields);
        setGenerated(held.generated);
      }
```
Replace:
```tsx
        setEditedFields(held.editedFields);
        setGenerated(held.generated);
        setWideFrozen(held.wideFrozen);
      }
```

(b13) Find:
```tsx
      includePriorReview: includePriorReview ? '1' : '0',
    };
```
Replace:
```tsx
      includePriorReview: includePriorReview ? '1' : '0',
      // From the frozen scope, not the live picker (a teacher can move it after generating).
      // `distribution` is written by the shared helper and ignored by this tool.
      ...scopeFormState(wideFrozen, 'balanced'),
    };
```

(b14) Find:
```tsx
  const getExportTitle = () => outLang === 'ar' ? `خطة درس: ${scope.topic}` : `Lesson Plan: ${scope.topic}`;
```
Replace:
```tsx
  const getExportTitle = () => (wideFrozen
    ? (outLang === 'ar' ? `خطة حصة مراجعة: ${scope.topic}` : `Revision Lesson Plan: ${scope.topic}`)
    : (outLang === 'ar' ? `خطة درس: ${scope.topic}` : `Lesson Plan: ${scope.topic}`));
```

(b15) Find (inside the `useGeneratorExport({ … })` call):
```tsx
    lessonId: scope.lesson?.id,
    lang: outLang,
    getTitle: getExportTitle,
```
Replace:
```tsx
    lessonId: scope.lesson?.id,
    // A wide plan has no figures of its own; see `noFigures`.
    noFigures: wideFrozen !== null,
    lang: outLang,
    getTitle: getExportTitle,
```

(b16) Find:
```tsx
  const handleMinistry = async () => {
    if (!result) return;
```
Replace:
```tsx
  const handleMinistry = async () => {
    // Hidden for a wide plan (the form needs one lesson's unit, periods and prior learning).
    if (!result || wideFrozen) return;
```

(b17) Find (the `TopicSelector` props):
```tsx
          hasError={!!error && !topic}
          t={t}
        />

        {/* The three optional boxes fold away
```
Replace:
```tsx
          hasError={!!error && !topic}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          t={t}
        />

        {/* The three optional boxes fold away
```

(b18) The prior-topics box: Find
```tsx
            not an instruction about how to deliver today's new material. */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('priorTopicsLabel')}
        </Text>
```
Replace:
```tsx
            not an instruction about how to deliver today's new material.
            Hidden on a wide scope: a revision session has no prior review. */}
        {wideScope.isWide ? null : (
          <>
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('priorTopicsLabel')}
        </Text>
```
and Find
```tsx
            value={priorTopicsNotes}
            onChangeText={setPriorTopicsNotes}
            multiline
          />
        </View>
```
Replace:
```tsx
            value={priorTopicsNotes}
            onChangeText={setPriorTopicsNotes}
            multiline
          />
        </View>
          </>
        )}
```

(b19) The prior-review checkbox: Find
```tsx
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: priorReviewAvailable ? 1 : 0.55 }]}>
```
Replace:
```tsx
        {wideScope.isWide ? null : (
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: priorReviewAvailable ? 1 : 0.55 }]}>
```
and Find
```tsx
              {t('priorReviewPlanUnavailableNote')}
            </Text>
          ) : null}
        </View>
```
Replace:
```tsx
              {t('priorReviewPlanUnavailableNote')}
            </Text>
          ) : null}
        </View>
        )}
```

(b20) Find (the `GeneratorResultActions` props):
```tsx
          materialType="lesson"
          toolId="lesson-plan"
          topic={scope.topic}
        />
```
Replace:
```tsx
          materialType="lesson"
          toolId="lesson-plan"
          topic={scope.topic}
          // Its chips open other tools with this label as a bare topic they re-ground.
          hideRelated={wideFrozen !== null}
        />
```

(b21) Find (the `ExportMenu` props):
```tsx
      onMinistry={handleMinistry}
```
Replace:
```tsx
      // The Ministry form needs one lesson's unit, periods and prior learning (spec open item 1).
      onMinistry={wideFrozen ? undefined : handleMinistry}
```
(`ExportMenu` drops the Ministry row when `onMinistry` is undefined — `components/ui/ExportMenu.tsx`, `...(onMinistry && labels.ministryLabel ? [...] : [])`.)

Untouched on purpose: `GroundingNotice` (it now gets `scopeLabel` via `groundedLesson`), `BookFiguresPanel` (it receives `getExportFigures()`, which is `[]` under `noFigures`, and renders `null` for an empty list — `BookFiguresPanel.tsx`: `if (!figures.length) return null;`), `useWarmGrounding`, `useEnglishRefresh` (its `generate()` takes the wide branch from `wideScope`). No `KeyboardAvoidingView` is added (CLAUDE.md).

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonPlanWideRequest.test.ts services/__tests__/scopeRequestTeaching.test.ts services/__tests__/materialLessonId.test.ts`
Expected: PASS.

Prove the pins bite (then revert): (1) drop `priorTopicsNotes: ''` from the spread in `buildWideLessonPlanRequest` — *"notes that are not sent do not make the plan private"* fails; (2) merge `{ ...wide.fields, ...own }` instead — the "no lesson re-derived" test fails on `additionalContext`.

Then: `cd /home/user/Iqraa && pnpm run typecheck` (expect exit 0) and `cd artifacts/mobile && pnpm test 2>&1 | tail -6` (expect `# fail 0`).

- [ ] **Step 5: Adversarial read-through of `lesson-plan.tsx` (the screen has no unit test)**

Open the edited file and check each line; any "no" is a defect to fix before committing.

1. Every `resolveGeneratorGrounding`, `groundLessonPlanTopic`, `getUnitPriorKnowledge` and `groundedSubjectConflict` call is unreachable for a wide scope: `priorKnowledge` returns `[]` first; `generate` uses `WIDE_GROUNDING` and skips the conflict check when `wideReq` is set; nothing else in the file grounds `topic` (grep the file for each name).
2. `useWideScope` is called with `{ gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id }` (stale restored scope guard), and `wideFrozen`'s `useState` comes **before** `generated`'s (its initializer reads `wideFrozen`).
3. On reopen of a saved wide plan, `generated` is `captureGenerationScope(…, WIDE_GROUNDING)` — never `reopenedGenerationScope` (which re-grounds the label).
4. `groundedLesson` is `scopeLabel(wideFrozen, outLang)` for a wide plan; `groundedLessonId` is `null`, so the Ministry form could never read a lesson even if reached.
5. `useGeneratorExport` gets `noFigures: wideFrozen !== null`; `lessonId: scope.lesson?.id` is `undefined` for a wide plan (WIDE_GROUNDING has no lesson); `BookFiguresPanel` therefore renders nothing.
6. The Ministry row is absent from the export menu for a wide plan (`onMinistry` undefined) and `handleMinistry` returns early as a second guard.
7. `GeneratorResultActions` has `hideRelated={wideFrozen !== null}`.
8. Save writes `...scopeFormState(wideFrozen, 'balanced')` from the FROZEN scope, not `wideScope.scopeSel`; `topic` saved is the label, and `withLessonId` (workspace.ts → `materialLessonId.ts`) declines to stamp a lesson id because `isWideScopeFormState` is true.
9. Cancel / failure restores `wideFrozen` together with `result`, `editedFields`, `generated` (the `held` object and the restore block).
10. `TopicSelector` has `allowedKinds={['lesson', 'unit', 'semester', 'book']}`, `onScopeChange={wideScope.setScopeSel}` and `offlineWideScope`.
11. On a wide scope the prior-topics box and the prior-review checkbox are hidden, the request carries neither (`buildWideLessonPlanRequest`), and the clamp effect does not clear the hidden tick.
12. A wide scope that does not ground sets `wideScopeUngrounded` and returns before `setLoading(true)` — no request is sent.
13. Regenerate on a wide plan calls `generate({ regenerate: true })`, which builds the wide request again with the regeneration fields (they ride in `own` through `buildLessonPlanRequest`).
14. A lesson-scope generation executes exactly the old calls (`groundLessonPlanTopic` → `buildLessonPlanRequest` → `generateLessonPlan`) and `setWideFrozen(null)`.
15. No `KeyboardAvoidingView` was added; no new `EXPO_PUBLIC_*` key; no native module (so `app.json`'s `version` does not move).

Not run here: a click-through on the web preview (pick «الفصل الأول كاملًا», a unit, «الكتاب كاملًا»; generate in each style; save, reopen, export; confirm no Ministry row and no Related tools). The spec's rollout section requires someone to do it before merging; record it in STATUS with the other screens.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/wideScopeRequest.ts artifacts/mobile/app/ai-tools/lesson-plan.tsx artifacts/mobile/services/__tests__/lessonPlanWideRequest.test.ts
git commit -m "feat: lesson-plan screen — unit, semester and book scopes as one revision session"
```
(Commit message ends with the two trailers from Global Constraints.)

---

### Section self-check

**Identifiers this section introduces, and where:**

| Identifier | Defined in |
| --- | --- |
| `RevisionLesson` (`{ id, title, thin }`), `RevisionUnit`, `REVISION_SHOWN_PER_UNIT`, `LEFT_OUT_NAMES`, `revisionUnitsFromLessons`, `revisionUnits`, `splitShown`, `scopeFromKey`, `revisionPhrase`, `leftOutSentence` | Task 1, `artifacts/mobile/services/revisionScope.ts` |
| `ScopeRequestFields`, `ScopeRequest`, `buildScopeRequest` | Task 1, `artifacts/mobile/services/wideScopeRequest.ts` |
| `isRevisionRequest`; `ClassroomActivityRequest.scope?`, `.coverage?` | Task 1, `artifacts/mobile/services/ai/AIService.ts` |
| `RevisionKind`, `revisionClauseAr`, `revisionClauseEn` | Task 2, `artifacts/api-server/src/lib/revision.ts` |
| `classroomActivityPrompt` | Task 2, `artifacts/api-server/src/lib/classroomPrompts.ts` |
| `RevisionStyle`, `RevisionPlanInput`, `RevisionPlanFields`, `ROUND_MARK_AR`, `ROUND_MARK_EN`, `buildRevisionPlan`, `revisionPlanFromRequest` | Task 3, `artifacts/mobile/services/ai/lessonPlanRevision.ts` |
| `buildWideLessonPlanRequest` (and the module-private `SCOPE_GROUNDING`) | Task 4, `artifacts/mobile/services/wideScopeRequest.ts` |
| `WIDE_GROUNDING`, `wideScope`, `wideFrozen` | Task 4, `artifacts/mobile/app/ai-tools/lesson-plan.tsx` (screen-local) |

**Identifiers consumed from outside this section (all verified to exist on the branch):**

| Identifier | Where it lives / contract line relied on |
| --- | --- |
| `ScopeSelection`, `lessonsInScope`, `unitsInScope`, `parseScope`, `scopeKey`, `scopeLabel` | `services/scopeSelection.ts` (piece 1) |
| `resolveScopeGrounding`, `ScopeGrounding` | `services/scopeGrounding.ts` (piece 1) — digest headings «الوحدة:» / "Unit:" |
| `scopeRequestFields`, `buildLessonPlanRequest`, `LessonPlanForm`, `groundLessonPlanTopic` | `services/generatorRequests.ts` |
| `coverageLessons`, `CoverageLesson` | `services/coveragePlan.ts` (piece 2) |
| `buildWideRequest`, `scopeFormState`, `scopeFromParam` | `services/wideScopeRequest.ts` (piece 2) — unchanged |
| `curriculumObjectivesFor`, `buildAdaptationsDirective`, `GeneratorGrounding` | `services/kbContext.ts` |
| `getLessonById`, `getUnitForLesson`, `KB_UNITS`, `KB_BOOKS` | `services/knowledgeBase.ts` |
| `arMinutes` | `services/ai/lessonPlanTypes.ts` |
| `LESSON_STYLE_IDS` | `services/ai/lessonPlanBlueprints.ts` |
| `FIRST_PERSON`, `imperativesIn`, `norm` | `services/__tests__/teacherVoiceCheck.ts` |
| `useWideScope(params, current)` | `hooks/useWideScope.ts` — contract: "`useWideScope(params, current)` → `{ scopeSel, setScopeSel, distribution, setDistribution, isWide }` — the teaching tools IGNORE `distribution`" |
| `useGeneratorExport({ noFigures })`, `GeneratorResultActions hideRelated`, `TopicSelector offlineWideScope / onScopeChange / allowedKinds`, `captureGenerationScope`, `reopenedGenerationScope`, `isWideScopeFormState` / `withLessonId` | piece 2, unchanged |
| `parseWideScope` | `artifacts/api-server/src/lib/grounding.ts` |
| `parseCoverage` | `artifacts/api-server/src/lib/coverage.ts` — lessons `{ code, id, title }` (no `unitId`; see decision 1) |
| `classroomPromptAr/En`, `classroomSetupClause`, `CLASSROOM_ACTIVITY_TYPES` | `artifacts/api-server/src/lib/classroomPrompts.ts` |
| `lessonPlanPromptAr/En`, `activityPromptAr/En` | `artifacts/api-server/src/lib/prompts.ts` |
| i18n `wideScopeUngrounded` | `services/i18n.ts` (ar + en) |

Contract lines this section implements as written: `revisionUnits`, `revisionPhrase`, `leftOutSentence`, `buildScopeRequest` (fields, null cases, merge-last), `isRevisionRequest`, the `ClassroomActivityRequest` extension, `revisionClauseAr/En(b, kind)` (signature, `''` unless `parseWideScope`, leading `"\n"`). Where it departs: decisions 1–3 at the top of this section.


## Drafting notes — Activity and classroom builder (Tasks 5–7)

**Section overview.** These three tasks make the activity generator and the classroom builder honour a unit, a semester or the whole book as **one revision session** (spec §2–§3), consuming Task 1's `buildScopeRequest`, `isRevisionRequest`, `revisionPhrase`, `scopeFromKey` and the `ClassroomActivityRequest.scope/coverage` fields. Task 5 adds two pure modules and a wide branch to `buildOfflineActivity`. `services/ai/activityRevision.ts` builds a **composite `KBLesson`** from the lessons in `req.coverage.lessons`, with concepts, rules, outcomes and terms interleaved across units, so the **unchanged** blueprints read a slice that spans units. It also draws bank items **one unit at a time** through an injected `take`. `services/ai/revisionWording.ts` rewrites the few blueprint sentences that claim a single lesson («من درس «…»», «من الحصة السابقة»). The rewrite runs after the template, so nothing in the blueprints changes. `nextActivityVariant` gets the scope key in its key, and a lesson request keeps a byte-identical key. Task 6 brings `app/ai-tools/activity.tsx` onto the piece-2 guard list (copied from the final `quiz.tsx` and `worksheet.tsx`). It merges `buildScopeRequest` fields last, with `own` taken from `buildActivityRequest`, so a typed objective keeps `contextSource: 'teacher'`. Task 7 sends the classroom builder's seven types through the same revision source. The phrase replaces the label, the banked types draw across units, and a classroom rewording table handles the fixed-template sentences that assume one lesson. `classroom/builder.tsx` skips its unscoped grounding calls for a wide scope and merges the scope fields last.

**Decisions this section takes (the assembler should reconcile):**
1. The composite is built from KB rows, not from Task 1's `revisionUnitsFromLessons`. `RevisionUnit` has no rules and no term definitions, and it caps each unit at 3 entries. The blueprints read `rulesAr` and `keyTerms[0].definitionAr`, and a one-unit scope needs more than 3 concepts to fill a jigsaw.
2. The phrase comes from Task 1's `revisionPhrase(scopeFromKey(req.scope.scopeKey), lang)`. The generator holds only the request, and `scopeFromKey` is the one shared reader of a scope key (Section A, Task 1).
3. With the blueprints unchanged, **discussion** and **hands-on** build on a single item, claim or rule, so one activity cannot span two units. The tests therefore pin each version naming ≥1 unit of the scope, and Regenerate (variant 0..n−1) walking ≥2 units. The other four formats pin ≥2 units in one activity. This is a deliberate narrowing of spec §7 ("every format … draws from ≥2 units").
4. One-lesson sentences get a **post-template rewording table**, applied only when `scope` is present, instead of edits inside the templates. Every entry is the template text with the phrase in place of the topic. Tests fail on a dead entry, and on any entry that survives in wide output.
5. A request with `scope` and no lesson table still takes the revision path, with nothing to draw from. It is never re-grounded from its label.
6. `buildOfflineActivity` gains an optional third parameter `probe` (a test seam that records which lesson each bank item came from).
7. `requireQuestionBank` is refactored onto a new `lessonHasOfflineBank` predicate. The behaviour is identical.
8. Saving a wide activity writes `scopeFormState(wideFrozen, 'balanced')`, which also stores a `distribution` key that teaching tools ignore. It is harmless and keeps one form-state helper.
9. The end-to-end pin (spec §7, last bullet) assumes Task 2's `revisionClauseAr(b, 'activity')` prints each lesson's title the way `parseCoverage` reads it, for a 4-lesson unit with short titles (`kbu-math-s1-nccd-u2`, الدائرة).
10. Classroom `escape-challenge` and `error-detective` keep their fixed quadratic-equation content. That is already true for every non-quadratics lesson. Only the phrase changes for them.

---

### Task 5: Activity offline — a wide scope is a revision drawn across units

**Files:**
- Create: `artifacts/mobile/services/ai/activityRevision.ts`
- Create: `artifacts/mobile/services/ai/revisionWording.ts`
- Modify: `artifacts/mobile/services/ai/generators.ts` (imports; `requireQuestionBank`; new revision section after `offlineWideScope`; `nextActivityVariant`; `buildOfflineActivity`)
- Test: `artifacts/mobile/services/__tests__/activityRevision.test.ts`
- Test: `artifacts/mobile/services/__tests__/activityWideScope.test.ts`

**Interfaces:**
- Consumes (Task 1, Section A final): `isRevisionRequest(req: { scope?: { kind: string } | null }): boolean` from `services/ai/AIService.ts`; `revisionPhrase(sel: ScopeSelection, lang: 'ar' | 'en'): string` and `scopeFromKey(scopeKey: string): ScopeSelection | null` from `services/revisionScope.ts`; `buildScopeRequest(sel, lang, own?): ScopeRequest | null` from `services/wideScopeRequest.ts` (tests only). Task 2: `revisionClauseAr(b: Record<string, unknown>, kind: 'plan' | 'activity' | 'classroom'): string` from `artifacts/api-server/src/lib/revision.ts` (test only). Existing: `scopeKey`, `scopeLabel`, `lessonsInScope`, `unitsInScope` (`services/scopeSelection.ts`); `getLessonById`, `getBookForLesson`, `KBLesson` (`services/knowledgeBase.ts`); `buildActivityBlueprint` (unchanged); `takeConcreteMath`, `takeConcreteChem`, `isMathContext`, `isChemContext`, `hasMathBank`, `DiffTier`, `PracticeWQ`; `parseCoverage` (`api-server/src/lib/coverage.ts`).
- Produces:
  ```ts
  // services/ai/activityRevision.ts
  export type RevisionLessonGroup = { unitId: string; lessons: KBLesson[] };
  export type RevisionDrawLesson = { id: string; unitId: string; topic: string; kb: KBLesson };
  export type RevisionLessonOptions = { title: { ar: string; en: string }; termsStartUnit?: number };
  export function revisionLessonsByUnit(lessonIds: readonly string[]): RevisionLessonGroup[];
  export function revisionActivityLesson(groups: readonly RevisionLessonGroup[], scopeKey: string, opts: RevisionLessonOptions): KBLesson;
  export function drawAcrossUnits<T>(units: ReadonlyArray<ReadonlyArray<RevisionDrawLesson>>, want: number, startUnit: number, take: (lesson: RevisionDrawLesson, index: number) => T | null): T[];
  // services/ai/revisionWording.ts
  export type Reword = [string, string];
  export function activityRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[];
  export function reviseWording<T>(value: T, rewords: readonly Reword[]): T;
  // services/ai/generators.ts
  export type RevisionProbe = { drawn: Array<{ lessonId: string; unitId: string; text: string }> };
  export function activityVariantKey(req: AIRequest): string;
  export function buildOfflineActivity(req: AIRequest, variant?: number, probe?: RevisionProbe): ActivityOutput;
  // internal to generators.ts, used again by Task 7:
  type RevisionSource = { phrase: string; phrases: { ar: string; en: string }; scopeKey: string; groups: RevisionLessonGroup[]; banked: RevisionDrawLesson[][] };
  function revisionSource(req: { scope?: AIRequest['scope']; coverage?: AIRequest['coverage']; subject?: string }, lang: Lang): RevisionSource | null;
  function revisionPractice(rev: RevisionSource, want: number, startUnit: number, lang: Lang, subject: string | undefined,
    opts?: { type?: 'short_answer' | 'multiple_choice'; tier?: (i: number) => DiffTier; points?: number; probe?: RevisionProbe }): PracticeWQ[];
  function lessonHasOfflineBank(topic: string, kb: KBLesson | null, subject?: string): boolean;
  ```

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/activityRevision.test.ts`:

```ts
/**
 * The pure pieces a revision activity is built from.
 *
 * A wide scope reaches the offline activity as a lesson table. These helpers
 * turn it into what the unchanged blueprints read — one composite lesson whose
 * concepts, rules, outcomes and terms are interleaved across the units — and
 * draw bank items one unit after another. Each test names the mutation it
 * catches.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawAcrossUnits, revisionActivityLesson, revisionLessonsByUnit,
  type RevisionDrawLesson, type RevisionLessonGroup,
} from '../ai/activityRevision.ts';
import { reviseWording } from '../ai/revisionWording.ts';
import { getBookForLesson, getLessonById, type KBLesson } from '../knowledgeBase.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';

const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const circle: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'kbu-math-s1-nccd-u2' };
const TITLE = { ar: 'موضوعات الفصل الأول', en: 'Semester 1 topics' };

const ids = (sel: ScopeSelection) => lessonsInScope(sel).map(l => l.id);
/** The units of `groups` whose lessons hold `value` in the field `read` returns. */
const ownersOf = (groups: readonly RevisionLessonGroup[], read: (l: KBLesson) => readonly string[], value: string) =>
  groups.filter(g => g.lessons.some(l => read(l).includes(value))).map(g => g.unitId);

describe('revisionLessonsByUnit', () => {
  it('groups the table by unit in book order, dropping unknown and repeated ids', () => {
    const table = ids(mathSem1);
    const groups = revisionLessonsByUnit([...table, table[0]!, 'kbl-does-not-exist']);
    const known = table.map(id => getLessonById(id)).filter((l): l is KBLesson => !!l);
    assert.deepEqual(groups.map(g => g.unitId), [...new Set(known.map(l => l.unitId))]);
    assert.equal(groups.flatMap(g => g.lessons).length, known.length);
    for (const g of groups) for (const l of g.lessons) assert.equal(l.unitId, g.unitId);
  });
});

describe('revisionActivityLesson — the composite a blueprint reads', () => {
  const groups = revisionLessonsByUnit(ids(mathSem1));
  const kb = revisionActivityLesson(groups, scopeKey(mathSem1), { title: TITLE });

  it('is filed under the scope, and under a real unit of its book', () => {
    assert.equal(kb.id, 'scope:sem:grade-10:mathematics:1');
    assert.equal(kb.unitId, groups[0]!.unitId);
    // Mutation caught: an empty unitId — `getBookForLesson` would then find no
    // subject, and the hands-on format and `isMathContext` would fall back to
    // the screen's subject NAME (CLAUDE.md: generators branch on it).
    assert.equal(getBookForLesson(kb)?.subjectId, 'mathematics');
    assert.equal(kb.titleAr, TITLE.ar);
    assert.equal(kb.titleEn, TITLE.en);
  });

  it('its first concepts, rules and outcomes come one per unit', () => {
    assert.ok(groups.length >= 3, 'probe: semester 1 has several units');
    const fields: Array<[string, readonly string[], (l: KBLesson) => readonly string[]]> = [
      ['keyConceptsAr', kb.keyConceptsAr, l => l.keyConceptsAr],
      ['rulesAr', kb.rulesAr ?? [], l => l.rulesAr ?? []],
      ['objectives', kb.objectives, l => l.objectives],
    ];
    for (const [name, list, read] of fields) {
      const lead = list.slice(0, groups.length);
      // Mutation caught: concatenating unit by unit instead of interleaving puts
      // the first unit's entries first, and every one-concept slot names it.
      const owners = new Set(lead.flatMap(v => ownersOf(groups, read, v)));
      assert.equal(owners.size, groups.length, `${name}: ${lead.join(' | ')}`);
    }
  });

  it('its terms start at the unit it is told', () => {
    const terms = (l: KBLesson) => l.keyTerms.map(t => t.ar);
    const shifted = revisionActivityLesson(groups, scopeKey(mathSem1), { title: TITLE, termsStartUnit: 1 });
    assert.deepEqual(ownersOf(groups, terms, kb.keyTerms[0]!.ar), [groups[0]!.unitId]);
    assert.deepEqual(ownersOf(groups, terms, shifted.keyTerms[0]!.ar), [groups[1]!.unitId]);
  });

  it('a lesson whose book lists no outcomes is represented by its key concepts', () => {
    const hist = revisionLessonsByUnit(ids(histSem1));
    assert.ok(hist.every(g => g.lessons.every(l => l.objectives.length === 0)), 'probe: the history book lists no outcomes');
    const h = revisionActivityLesson(hist, scopeKey(histSem1), { title: TITLE });
    assert.ok(h.objectives.length >= 2, `${h.objectives.length}`);
    for (const o of h.objectives) assert.ok(hist.some(g => g.lessons.some(l => l.keyConceptsAr.includes(o))), o);
    assert.equal(new Set(h.objectives.flatMap(o => ownersOf(hist, l => l.keyConceptsAr, o))).size, hist.length);
  });

  it('a single unit still offers enough to fill a jigsaw', () => {
    const one = revisionActivityLesson(revisionLessonsByUnit(ids(circle)), scopeKey(circle), { title: TITLE });
    // Mutation caught: a fixed two entries per unit — a one-unit revision would
    // then have two concepts, and the jigsaw pads its four parts with
    // phrase-shaped fillers.
    assert.ok(one.keyConceptsAr.length >= 4, `${one.keyConceptsAr.length}`);
  });
});

describe('drawAcrossUnits', () => {
  const fake = (unit: string, n: number): RevisionDrawLesson[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${unit}-l${i}`, unitId: unit, topic: `${unit}-l${i}`, kb: {} as KBLesson }));

  it('takes one unit after another from the start unit, and a unit\'s next lesson on its next turn', () => {
    assert.deepEqual(
      drawAcrossUnits([fake('A', 2), fake('B', 1), fake('C', 2)], 5, 1, l => l.id),
      ['B-l0', 'C-l0', 'A-l0', 'B-l0', 'C-l1'],
    );
  });

  it('passes over a unit with no bank', () => {
    assert.deepEqual(drawAcrossUnits([fake('A', 1), [], fake('C', 1)], 3, 1, l => l.id), ['C-l0', 'A-l0', 'C-l0']);
  });

  it('tells the take which item it is drawing, for its tier', () => {
    const seen: number[] = [];
    drawAcrossUnits([fake('A', 3)], 3, 0, (_l, i) => { seen.push(i); return i; });
    assert.deepEqual(seen, [0, 1, 2]);
  });

  it('skips a lesson whose bank answers nothing, and stops rather than loop', () => {
    let calls = 0;
    assert.deepEqual(drawAcrossUnits([fake('A', 1), fake('B', 1)], 3, 0, () => { calls++; return null; }), []);
    assert.ok(calls <= 6, `${calls} calls`);
    assert.deepEqual(drawAcrossUnits([fake('A', 2)], 2, 0, l => (l.id === 'A-l0' ? null : l.id)), ['A-l1', 'A-l1']);
  });

  it('draws nothing from nothing', () => {
    assert.deepEqual(drawAcrossUnits([], 3, 0, l => l.id), []);
    assert.deepEqual(drawAcrossUnits([[], []], 3, 0, l => l.id), []);
  });
});

describe('reviseWording', () => {
  it('rewrites every string inside, in table order, and copies the rest', () => {
    const value = { a: 'x من درس «P» y من درس «P»', b: ['من درس «P»', 3], c: { d: null, e: true } };
    assert.deepEqual(
      reviseWording(value, [['من درس «P»', 'من P'], ['من P', 'عن P']]),
      { a: 'x عن P y عن P', b: ['عن P', 3], c: { d: null, e: true } },
    );
  });
});
```

Create `artifacts/mobile/services/__tests__/activityWideScope.test.ts`:

```ts
/**
 * An activity for a unit, a semester or the whole book is a revision session.
 *
 * Every format keeps its own structure (the blueprints are not touched); what
 * changes is where its content comes from — the concepts, rules, outcomes and
 * bank items of the units in scope — and the topic it names: the scope's
 * revision phrase, never the picker's label grounded to one lesson.
 *
 * A unit "is in" an activity when the activity's text holds a concept, rule,
 * outcome or term definition that only that unit's lessons have, or a bank
 * item the probe saw drawn from it.
 *
 * `buildOfflineActivity` has no simulated latency, so nothing here waits.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { activityVariantKey, buildOfflineActivity, nextActivityVariant, type RevisionProbe } from '../ai/generators.ts';
import type { ActivityOutput, AIRequest } from '../ai/AIService.ts';
import { activityRevisionRewords } from '../ai/revisionWording.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { lessonsInScope, scopeLabel, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { parseCoverage } from '../../../api-server/src/lib/coverage.ts';
import { revisionClauseAr } from '../../../api-server/src/lib/revision.ts';

const FORMATS = ['individual', 'group', 'discussion', 'hands-on', 'game', 'warmup'] as const;
type Format = typeof FORMATS[number];
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', chemistry: 'Chemistry', history: 'History' };

const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const chemSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'chemistry', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const book10: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics' };
const book9: ScopeSelection = { kind: 'book', gradeId: 'grade-9', subjectId: 'mathematics' };
const circle: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'kbu-math-s1-nccd-u2' };

/** The form fields a format needs: a warm-up is the 'warmup' variant of a short activity. */
const formatFields = (format: Format): Partial<AIRequest> => (format === 'warmup'
  ? { activityType: 'group', activityVariant: 'warmup', duration: 8 }
  : { activityType: format, duration: 30 });

function wideReq(sel: ScopeSelection, format: Format, lang: 'ar' | 'en' = 'ar', extra: Partial<AIRequest> = {}): AIRequest {
  const wide = buildScopeRequest(sel, lang);
  assert.ok(wide, `probe: ${sel.kind} ${sel.subjectId} should ground`);
  return {
    grade: 'الصف العاشر', subject: SUBJECT[sel.subjectId]!, topic: scopeLabel(sel, lang),
    language: lang === 'ar' ? 'arabic' : 'english',
    ...formatFields(format), ...wide.fields, ...extra,
  } as AIRequest;
}

const textOf = (a: ActivityOutput): string => [
  a.title, a.objective, a.groupSize, ...a.materials,
  ...a.steps.flatMap(s => [s.title, s.description]),
  ...a.teacherTips, a.differentiation, a.assessment,
].join('\n');

function unitsIn(a: ActivityOutput, sel: ScopeSelection, probe: RevisionProbe): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const lesson of lessonsInScope(sel)) {
    const kb = getLessonById(lesson.id);
    if (!kb) continue;
    for (const raw of [...kb.keyConceptsAr, ...(kb.rulesAr ?? []), ...kb.objectives, ...kb.keyTerms.map(t => t.definitionAr)]) {
      const s = raw?.trim();
      if (!s || s.length < 4) continue;
      const set = owners.get(s) ?? new Set<string>();
      set.add(kb.unitId);
      owners.set(s, set);
    }
  }
  const text = textOf(a);
  const units = new Set<string>();
  for (const [s, us] of owners) if (us.size === 1 && text.includes(s)) units.add([...us][0]!);
  for (const d of probe.drawn) if (text.includes(d.text)) units.add(d.unitId);
  return units;
}

const fresh = (): RevisionProbe => ({ drawn: [] });

describe('offline activity — a wide scope is a revision session', () => {
  it('every format names the revision phrase, never the label, and keeps its structure', () => {
    const phrase = revisionPhrase(mathSem1, 'ar');
    for (const f of FORMATS) {
      const a = buildOfflineActivity(wideReq(mathSem1, f));
      assert.ok(a.title.startsWith(`${phrase} – `), `${f}: ${a.title}`);
      // Mutation caught: leaving `topic = req.topic` on the wide path.
      assert.ok(!textOf(a).includes(scopeLabel(mathSem1, 'ar')), `${f} spliced the label`);
      assert.equal(a.activityType, f);
      assert.equal(a.steps.reduce((s, x) => s + x.durationMin, 0), a.totalDuration, f);
    }
  });

  it('the multi-item formats draw from two units or more in one activity', () => {
    for (const f of ['individual', 'group', 'game', 'warmup'] as const) {
      const probe = fresh();
      const units = unitsIn(buildOfflineActivity(wideReq(mathSem1, f), 0, probe), mathSem1, probe);
      // Mutation caught: drawing every item from the first unit (startUnit 0 for
      // the warm-up, or a per-lesson batch) — the warm-up's recall prompt and
      // its check then name the same unit.
      assert.ok(units.size >= 2, `${f}: ${[...units].join(', ')}`);
    }
  });

  it('discussion and hands-on build on one item, and each Regenerate moves to another unit', () => {
    const n = unitsInScope(mathSem1).length;
    for (const f of ['discussion', 'hands-on'] as const) {
      const seen = new Set<string>();
      for (let v = 0; v < n; v++) {
        const probe = fresh();
        const units = unitsIn(buildOfflineActivity(wideReq(mathSem1, f), v, probe), mathSem1, probe);
        assert.ok(units.size >= 1, `${f} v${v} names no unit of the scope`);
        units.forEach(u => seen.add(u));
      }
      // Mutation caught: a fixed start unit for the items (ignoring `variant`).
      assert.ok(seen.size >= 2, `${f}: every version is about ${[...seen].join(', ')}`);
    }
  });

  it('maths items come from the scope\'s lessons, one unit after another', () => {
    const probe = fresh();
    const a = buildOfflineActivity(wideReq(mathSem1, 'group'), 0, probe);
    const inScope = new Set(lessonsInScope(mathSem1).map(l => l.id));
    assert.equal(probe.drawn.length, 4, 'the jigsaw takes four items');
    for (const d of probe.drawn) {
      assert.ok(inScope.has(d.lessonId), `foreign lesson ${d.lessonId}`);
      assert.ok(textOf(a).includes(d.text), 'a drawn item is not on the activity');
    }
    assert.ok(new Set(probe.drawn.map(d => d.unitId)).size >= 3);
  });

  it('a chemistry scope stays chemistry, even when the screen sends the maths subject name', () => {
    const chem = new Set(lessonsInScope(chemSem1).map(l => l.id));
    for (const subject of ['Chemistry', 'Mathematics']) {
      const probe = fresh();
      const a = buildOfflineActivity(wideReq(chemSem1, 'hands-on', 'ar', { subject }), 0, probe);
      assert.ok(probe.drawn.length >= 1, `${subject}: no chemistry item`);
      for (const d of probe.drawn) assert.ok(chem.has(d.lessonId), `${subject}: ${d.lessonId}`);
      // The build-a-model branch — not the protractor (geometry) or the card tiles (maths).
      assert.ok(a.materials.some(m => m.includes('كرات وعيدان')), `${subject}: ${a.materials.join(' | ')}`);
      assert.ok(!a.materials.some(m => m.includes('منقلة')), subject);
    }
  });

  it('a scope with no bank still makes every format, with no items and no error', () => {
    for (const f of FORMATS) {
      const probe = fresh();
      const a = buildOfflineActivity(wideReq(histSem1, f), 0, probe);
      assert.equal(probe.drawn.length, 0, f);
      assert.ok(a.steps.length >= 3, f);
      assert.ok(unitsIn(a, histSem1, probe).size >= 1, `${f} names no unit`);
    }
  });

  it('the one-lesson sentences are reworded for a revision, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      const table = activityRevisionRewords(phrase, lang);
      // Live: a lesson request whose topic happens to BE the phrase (no scope, so
      // no rewording) prints every entry somewhere. A dead entry fails here.
      let before = '';
      for (const f of FORMATS) {
        for (const v of [0, 1, 2]) {
          before += textOf(buildOfflineActivity({
            grade: 'الصف العاشر', subject: 'History', topic: phrase,
            language: lang === 'ar' ? 'arabic' : 'english', ...formatFields(f),
          } as AIRequest, v)) + '\n';
        }
      }
      for (const [from] of table) assert.ok(before.includes(from), `${lang}: dead entry «${from}»`);
      // Applied: no wide activity keeps one. Mutation caught: dropping the
      // `reviseWording` call (the hands-on sort task keeps «من درس «…»»).
      for (const f of FORMATS) {
        for (const v of [0, 1, 2]) {
          const t = textOf(buildOfflineActivity(wideReq(histSem1, f, lang), v));
          for (const [from] of table) assert.ok(!t.includes(from), `${lang} ${f} v${v}: «${from}»`);
          assert.ok(!t.includes(scopeLabel(histSem1, lang)), `${lang} ${f} v${v} spliced the label`);
        }
      }
    }
  });
});

describe('offline activity — a lesson is unchanged', () => {
  it('a lesson request with a lesson table but no scope is built exactly as without one', () => {
    const coverage = buildScopeRequest(mathSem1, 'ar')!.fields.coverage;
    const lesson = { grade: 'الصف العاشر', subject: 'English', topic: 'الكتابة: تدوينة', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7' } as const;
    for (const f of FORMATS) {
      for (const v of [0, 3]) {
        const req = { ...lesson, ...formatFields(f) } as AIRequest;
        // Mutation caught: keying the revision branch on `coverage` instead of `scope`.
        assert.deepEqual(buildOfflineActivity({ ...req, coverage }, v), buildOfflineActivity(req, v), `${f} v${v}`);
      }
    }
  });
});

describe('nextActivityVariant — a wide scope keys its own counter', () => {
  it('a lesson\'s key is what it always was', () => {
    const req = { grade: 'x', subject: 'English', topic: 'الكتابة: تدوينة', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7', activityType: 'game' } as AIRequest;
    assert.equal(activityVariantKey(req), 'arabic|game|kbl-eng-s1-nccd-u2_l7|الكتابة: تدوينة');
    assert.equal(activityVariantKey({ ...req, activityVariant: 'warmup' }), 'arabic|warmup|kbl-eng-s1-nccd-u2_l7|الكتابة: تدوينة');
  });

  it('two grades\' «الكتاب كاملًا» do not share a regenerate counter', () => {
    const g10 = wideReq(book10, 'game');
    const g9 = wideReq(book9, 'game');
    assert.equal(g10.topic, g9.topic, 'probe: the two books share a label — the trap');
    assert.equal(activityVariantKey(g10), `arabic|game||${g10.topic}|book:grade-10:mathematics`);
    assert.equal(nextActivityVariant(g10), 0);
    assert.equal(nextActivityVariant({ ...g10, regenerate: true }), 1);
    assert.equal(nextActivityVariant({ ...g10, regenerate: true }), 2);
    // Mutation caught: leaving the scope key out — grade 9 would continue at 3.
    assert.equal(nextActivityVariant({ ...g9, regenerate: true }), 1, 'grade 9 continued grade 10\'s count');
  });
});

describe('the live clause lists every lesson the offline activity drew from', () => {
  it('for a unit whose lessons all have a bank', () => {
    const req = wideReq(circle, 'group');
    const probe = fresh();
    buildOfflineActivity(req, 0, probe);
    const body = req as unknown as Record<string, unknown>;
    const table = parseCoverage(body);
    assert.ok(table, 'the server reads no lesson table from this request');
    const clause = revisionClauseAr(body, 'activity');
    assert.notEqual(clause, '');
    assert.equal(probe.drawn.length, 4);
    for (const d of probe.drawn) {
      const row = table.lessons.find(l => l.id === d.lessonId);
      assert.ok(row, `${d.lessonId} is not in the table the server reads`);
      assert.ok(clause.includes(row.title), `the live clause does not list «${row.title}»`);
    }
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/activityRevision.test.ts services/__tests__/activityWideScope.test.ts`
Expected: FAIL. Both files stop at load with `ERR_MODULE_NOT_FOUND … services/ai/activityRevision.ts` (and `revisionWording.ts`). If instead it fails on `revisionScope.ts`, `buildScopeRequest` or `api-server/src/lib/revision.ts`, Tasks 1 or 2 are missing. Stop and finish them first.

- [ ] **Step 3: Implement**

(a) Create `artifacts/mobile/services/ai/activityRevision.ts`:

```ts
/**
 * A unit, a semester or the whole book, as the offline activity and classroom
 * makers read it: one revision session over the units in scope.
 *
 * The activity blueprints (`activityBlueprints.ts`) and the classroom
 * templates were written around ONE lesson: they read `keyConceptsAr`,
 * `rulesAr`, `objectives` and `keyTerms` off a `KBLesson` and splice a topic
 * phrase into sentences. Rather than give any format a second, wide shape
 * (piece-3 spec, decision 4), a wide request hands them a composite lesson
 * built from the units in scope, interleaved — every unit's first entry, then
 * every unit's second — so whichever slice a format reads (its first concept,
 * its first three, its first four) comes from as many units as it can.
 *
 * Bank items still come from real lessons: `drawAcrossUnits` takes one per
 * unit in turn, through whatever `take` the caller passes (generators.ts
 * passes the maths and chemistry banks). A scope with no bankable lesson gets
 * no items. An activity, unlike a quiz, does not need a bank, so that is not
 * an error.
 *
 * Free of react-native so `node --test` can load it.
 */
import { getLessonById, type KBLesson } from '../knowledgeBase.ts';

/** The lessons of one unit in scope, in the order the request listed them. */
export type RevisionLessonGroup = { unitId: string; lessons: KBLesson[] };

/** A lesson a bank item can be drawn from: its own title (the bank routes on it) and KB row. */
export type RevisionDrawLesson = { id: string; unitId: string; topic: string; kb: KBLesson };

export type RevisionLessonOptions = {
  /** The scope's revision phrase in both languages — the composite's title. */
  title: { ar: string; en: string };
  /** The unit the key terms start from (default 0). See `buildOfflineActivity`. */
  termsStartUnit?: number;
};

/** About how many entries of each kind the composite holds in all; at least two per unit. */
const REVISION_POOL = 6;

/** The request's lesson ids as KB rows, grouped by unit in the order the units first appear. */
export function revisionLessonsByUnit(lessonIds: readonly string[]): RevisionLessonGroup[] {
  const groups: RevisionLessonGroup[] = [];
  const seen = new Set<string>();
  for (const id of lessonIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const lesson = getLessonById(id);
    if (!lesson) continue;
    let group = groups.find(g => g.unitId === lesson.unitId);
    if (!group) {
      group = { unitId: lesson.unitId, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  return groups;
}

function rotated<T>(list: readonly T[], by: number): T[] {
  if (list.length === 0) return [];
  const k = ((by % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** One unit's entries: each lesson's first, then each lesson's second…, without repeats. */
function unitEntries<T>(
  lessons: readonly KBLesson[],
  read: (l: KBLesson) => readonly T[] | undefined,
  key: (v: T) => string,
): T[] {
  const lists = lessons.map(l => read(l) ?? []);
  const longest = Math.max(0, ...lists.map(l => l.length));
  const seen = new Set<string>();
  const out: T[] = [];
  for (let k = 0; k < longest; k++) {
    for (const list of lists) {
      const v = list[k];
      if (v === undefined) continue;
      const id = key(v).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
  }
  return out;
}

/** Up to `depth` entries of every unit, round-robin across units, starting at unit `start`. */
function acrossUnits<T>(perUnit: readonly T[][], depth: number, start: number): T[] {
  const units = rotated(perUnit, start);
  const out: T[] = [];
  for (let k = 0; k < depth; k++) {
    for (const list of units) if (k < list.length) out.push(list[k]!);
  }
  return out;
}

/**
 * The lesson a blueprint reads for a revision over `groups`.
 *
 * `id` is `scope:<scopeKey>`, which no KB lookup resolves. `unitId` is the first
 * unit's, a real unit, so `getBookForLesson` finds the scope's book and
 * subject. The hands-on format and `isMathContext` read it, and the screen's
 * subject NAME is then never what decides maths vs chemistry.
 */
export function revisionActivityLesson(
  groups: readonly RevisionLessonGroup[],
  scopeKey: string,
  opts: RevisionLessonOptions,
): KBLesson {
  const depth = Math.max(2, Math.ceil(REVISION_POOL / Math.max(1, groups.length)));
  const pool = <T>(read: (l: KBLesson) => readonly T[] | undefined, key: (v: T) => string, start = 0): T[] =>
    acrossUnits(groups.map(g => unitEntries(g.lessons, read, key)), depth, start);
  const text = (s: string) => s;
  return {
    id: `scope:${scopeKey}`,
    unitId: groups[0]?.unitId ?? '',
    order: 0,
    titleAr: opts.title.ar,
    titleEn: opts.title.en,
    summaryAr: '',
    summaryEn: '',
    keyConceptsAr: pool(l => l.keyConceptsAr, text),
    keyConceptsEn: pool(l => l.keyConceptsEn, text),
    keyTerms: pool(l => l.keyTerms, t => t.ar, opts.termsStartUnit ?? 0),
    // A lesson whose book lists no outcomes (history, …) is represented by its
    // key concepts, so a warm-up's recall prompt and a quick check still name
    // the units instead of falling back to the scope's phrase.
    objectives: pool(l => (l.objectives.length ? l.objectives : l.keyConceptsAr), text),
    periods: null,
    rulesAr: pool(l => l.rulesAr, text),
    rulesEn: pool(l => l.rulesEn, text),
  };
}

/**
 * `want` items, one unit after another starting at `startUnit`; a unit's
 * second turn takes its next lesson. A unit with no lesson is passed over, and
 * a `take` that answers null is skipped (as the bank's batch functions skip
 * one). `take` is told the index of the item it is drawing, for its tier.
 *
 * Each lesson is offered at most `want` times, so a bank that keeps answering
 * null cannot loop forever.
 */
export function drawAcrossUnits<T>(
  units: ReadonlyArray<ReadonlyArray<RevisionDrawLesson>>,
  want: number,
  startUnit: number,
  take: (lesson: RevisionDrawLesson, index: number) => T | null,
): T[] {
  const out: T[] = [];
  const n = units.length;
  if (n === 0 || want <= 0) return out;
  const visits = new Array<number>(n).fill(0);
  const start = ((startUnit % n) + n) % n;
  const budget = want * units.reduce((s, u) => s + Math.max(1, u.length), 0);
  for (let step = 0; out.length < want && step < budget; step++) {
    const u = (start + step) % n;
    const lessons = units[u]!;
    if (lessons.length === 0) continue;
    const lesson = lessons[visits[u]! % lessons.length]!;
    visits[u] = visits[u]! + 1;
    const item = take(lesson, out.length);
    if (item !== null) out.push(item);
  }
  return out;
}
```

(b) Create `artifacts/mobile/services/ai/revisionWording.ts`:

```ts
/**
 * The offline sentences that assume ONE lesson, reworded for a revision.
 *
 * A unit, a semester or the whole book reaches the offline makers as a
 * revision session whose topic is the scope's phrase («موضوعات الفصل الأول»),
 * never the picker's label. Most sentences read correctly with it
 * («موضوعات الفصل الأول – عمل فردي»). A few were written for one lesson and
 * would claim one: «من درس «موضوعات الفصل الأول»», «من الحصة السابقة».
 * Those, and only those, are rewritten here after the template has run. The
 * templates stay exactly as a lesson needs them, because no format gets a
 * second blueprint (piece-3 spec, decision 4).
 *
 * Each entry is the template's exact text with the phrase in place of the
 * topic. Editing one of those template sentences makes its entry dead. The
 * tests fail on a dead entry, so the table cannot quietly stop applying.
 *
 * Free of react-native so `node --test` can load it.
 */

export type Reword = [string, string];

/** The activity blueprints' one-lesson sentences (`activityBlueprints.ts`). */
export function activityRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[] {
  const p = phrase;
  return lang === 'ar'
    ? [
        [`من درس «${p}»`, `من ${p}`],
        [`عن ${p} من الحصة السابقة`, `عن ${p} من الحصص السابقة`],
        [`ما أهم ما تعلّمته عن ${p} في الحصة السابقة؟`, `ما أهم ما تعلّمته عن ${p} في الحصص السابقة؟`],
        [`قبل الدخول في ${p}`, `قبل مراجعة ${p}`],
        [`واليوم سنستخدمه لـ ${p}`, `واليوم سنستخدمه في مراجعة ${p}`],
      ]
    : [
        [`from the “${p}” lesson`, `from ${p}`],
        [`about ${p} from last lesson`, `about ${p} from earlier lessons`],
        [`learned about ${p} last lesson?`, `learned about ${p} in earlier lessons?`],
        [`before ${p} begins`, `before the revision of ${p} begins`],
        [`today we use it for ${p}.`, `today we use it to revise ${p}.`],
      ];
}

/** Every string inside `value` with each `from` replaced by its `to`, in table order. Other values are copied as they are. */
export function reviseWording<T>(value: T, rewords: readonly Reword[]): T {
  const fix = (s: string) => rewords.reduce((acc, [from, to]) => acc.split(from).join(to), s);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
```

(c) `generators.ts`, imports. Task 3 (Section A) has already changed the `./AIService.ts` value import to

```ts
import { AIService, isRevisionRequest } from './AIService.ts';
```

Confirm it with `grep -n "from './AIService.ts';" artifacts/mobile/services/ai/generators.ts`; do **not** add a second import of `isRevisionRequest`. Only if the line still reads `import { AIService } from './AIService.ts';` (Task 3 not landed), change it to the line above. In the `./mathPractice.ts` import, replace

```ts
  completionSplit,
  type DiffTier,
} from './mathPractice.ts';
```

with

```ts
  completionSplit,
  type DiffTier,
  type PracticeWQ,
} from './mathPractice.ts';
```

Directly after `import { planCoverage, type CoverageLesson } from '../coveragePlan.ts';` add:

```ts
import {
  drawAcrossUnits, revisionActivityLesson, revisionLessonsByUnit,
  type RevisionDrawLesson, type RevisionLessonGroup,
} from './activityRevision.ts';
import { activityRevisionRewords, reviseWording } from './revisionWording.ts';
import { revisionPhrase, scopeFromKey } from '../revisionScope.ts';
```

Section A's Task 3 imports `./lessonPlanRevision.ts` into `generators.ts`, not `../revisionScope.ts`, so the third line is new. Check with `grep -n "revisionScope" artifacts/mobile/services/ai/generators.ts` first. If any import from `'../revisionScope.ts'` already exists, add `revisionPhrase, scopeFromKey` to that statement's braces (keeping whatever it already imports) instead of adding the third line, because a second binding of either name does not compile.

(d) `requireQuestionBank`. Replace

```ts
function requireQuestionBank(topic: string, kb: KBLesson | null, subject?: string): void {
  if (!questionBankPolicy.required || isChemContext(topic, kb, subject)) return;
  // A maths lesson is covered only when the bank has items ABOUT it — Grade 7–9
  // lessons and lessons the generators cannot ask (geometry, data, money…) are
  // refused like any other subject, not served the grade's default arithmetic.
  if (isMathContext(topic, kb, subject) && hasMathBank(topic, kb)) return;
  throw new NoQuestionBankError(topic);
}
```

with

```ts
/**
 * Whether the offline banks hold real items for this lesson. Chemistry always
 * does. A maths lesson does only when the bank has items ABOUT it: Grade 7–9
 * lessons and lessons the generators cannot ask (geometry, data, money…) do
 * not, and get no stand-in from the grade's default arithmetic.
 */
function lessonHasOfflineBank(topic: string, kb: KBLesson | null, subject?: string): boolean {
  return isChemContext(topic, kb, subject) || (isMathContext(topic, kb, subject) && hasMathBank(topic, kb));
}

function requireQuestionBank(topic: string, kb: KBLesson | null, subject?: string): void {
  if (!questionBankPolicy.required || lessonHasOfflineBank(topic, kb, subject)) return;
  throw new NoQuestionBankError(topic);
}
```

(The order of evaluation is unchanged: policy, then chemistry, then maths plus bank. The behaviour is identical.)

(e) Directly after the end of `offlineWideScope`, i.e. after

```ts
  return { drawer: new ScopeDrawer(plan.map(i => usable[i]!), usable, spentOpts), lessons: usable, skipped };
}
```

insert:

```ts

// ─── Revision: a wide scope on a teaching tool ───────────────────────────────

/** Where each bank item of a revision came from. Filled only when a test passes one. */
export type RevisionProbe = { drawn: Array<{ lessonId: string; unitId: string; text: string }> };

/**
 * A wide-scope request as the offline activity and classroom makers read it.
 * Null for every other request, which then takes the single-lesson path
 * exactly as before.
 */
type RevisionSource = {
  /** The scope's phrase in the request's language — «موضوعات الفصل الأول». */
  phrase: string;
  phrases: { ar: string; en: string };
  scopeKey: string;
  /** The request's lessons grouped by unit, book order. */
  groups: RevisionLessonGroup[];
  /** Per unit, in `groups` order: its lessons that have an offline bank; [] for a unit with none. */
  banked: RevisionDrawLesson[][];
};

/** Only if a scope key cannot be read back. The screen built it from a selection, so this is never expected. */
const REVISION_FALLBACK_PHRASES = { ar: 'موضوعات المراجعة', en: 'the revision topics' };

/**
 * Null unless the request carries a wide scope. A wide request whose lesson
 * table is missing is still a revision, with nothing to draw on. It is never
 * turned back into its label grounded to one lesson (a unit title grounds to
 * another grade's lesson; piece 2 measured 18 of 35).
 */
function revisionSource(
  req: { scope?: AIRequest['scope']; coverage?: AIRequest['coverage']; subject?: string },
  lang: Lang,
): RevisionSource | null {
  if (!isRevisionRequest(req) || !req.scope) return null;
  const groups = revisionLessonsByUnit((req.coverage?.lessons ?? []).map(l => l.id));
  const sel = scopeFromKey(req.scope.scopeKey);
  const phrases = sel ? { ar: revisionPhrase(sel, 'ar'), en: revisionPhrase(sel, 'en') } : REVISION_FALLBACK_PHRASES;
  const banked = groups.map(g => g.lessons
    .map(kb => ({ id: kb.id, unitId: g.unitId, topic: lang === 'ar' ? kb.titleAr : kb.titleEn, kb }))
    .filter(l => lessonHasOfflineBank(l.topic, l.kb, req.subject)));
  return { phrase: phrases[lang], phrases, scopeKey: req.scope.scopeKey, groups, banked };
}

/**
 * `want` bank items for a revision: one unit after another from `startUnit`,
 * each unit's banked lessons in turn, at the batch functions' tiers (the first
 * easy, the last hard) unless `tier` says otherwise. Each item comes from its
 * own lesson's bank — maths or chemistry, by that lesson's own subject. A scope
 * with no bank gets [], never `NoQuestionBankError`.
 */
function revisionPractice(
  rev: RevisionSource,
  want: number,
  startUnit: number,
  lang: Lang,
  subject: string | undefined,
  opts: { type?: 'short_answer' | 'multiple_choice'; tier?: (i: number) => DiffTier; points?: number; probe?: RevisionProbe } = {},
): PracticeWQ[] {
  const type = opts.type ?? 'short_answer';
  const tierAt = opts.tier ?? ((i: number): DiffTier => (i === 0 ? 'easy' : i === want - 1 ? 'hard' : 'medium'));
  const points = opts.points ?? 4;
  return drawAcrossUnits(rev.banked, want, startUnit, (l, i) => {
    const item = isMathContext(l.topic, l.kb, subject)
      ? takeConcreteMath(type, l.topic, l.kb, tierAt(i), lang, points)
      : takeConcreteChem(type, l.topic, l.kb, tierAt(i), lang, points);
    if (item) opts.probe?.drawn.push({ lessonId: l.id, unitId: l.unitId, text: item.text });
    return item;
  });
}
```

(f) `nextActivityVariant`. Replace

```ts
export function nextActivityVariant(req: AIRequest): number {
  const kind = req.activityVariant === 'warmup' ? 'warmup' : (req.activityType ?? 'group');
  const key = [req.language, kind, req.lessonId ?? '', req.topic].join('|');
```

with

```ts
/**
 * The regenerate counter's key. A wide scope adds its scope key, because two
 * grades' «الكتاب كاملًا» share a label (and have no lesson id) and must not
 * share a counter. A lesson's key is exactly what it always was.
 */
export function activityVariantKey(req: AIRequest): string {
  const kind = req.activityVariant === 'warmup' ? 'warmup' : (req.activityType ?? 'group');
  const parts = [req.language, kind, req.lessonId ?? '', req.topic];
  if (req.scope?.scopeKey) parts.push(req.scope.scopeKey);
  return parts.join('|');
}

export function nextActivityVariant(req: AIRequest): number {
  const key = activityVariantKey(req);
```

(The rest of `nextActivityVariant`, from `const next = req.regenerate === true ? …` on, is unchanged.)

(g) `buildOfflineActivity`. Replace the whole function, from `export function buildOfflineActivity(req: AIRequest, variant = 0): ActivityOutput {` to its closing `}` just before the `/**` of "What this service last handed out for a request", with:

```ts
export function buildOfflineActivity(req: AIRequest, variant = 0, probe?: RevisionProbe): ActivityOutput {
  // The lesson flow generates a warm-up and then the main activity. Both
  // used to reset the session, so both drew the SAME three problems and the
  // teacher posed each of them twice in one lesson. `continueMathPractice`
  // lets the second call carry on from where the first stopped.
  if (!req.continueMathPractice) beginMathPracticeSession();

  const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
  // A unit, a semester or the whole book is a revision session (piece-3 spec
  // §2). Its concepts, rules, outcomes and items come from every unit in
  // scope, and its topic is the scope's phrase. Its label («الفصل الأول كاملًا»)
  // is never grounded: that would land on one lesson, often another grade's.
  const rev = revisionSource(req, lang);
  const units = Math.max(1, rev?.groups.length ?? 1);
  const kb = rev
    ? revisionActivityLesson(rev.groups, rev.scopeKey, { title: rev.phrases, termsStartUnit: (variant + 1) % units })
    : groundedKb(req.topic, lang, req.lessonId);
  const topic = rev ? rev.phrase : req.topic;
  const isWarmup = req.activityVariant === 'warmup';
  const actType = isWarmup ? 'warmup' : (req.activityType ?? 'group');
  const duration = req.duration ?? (isWarmup ? 8 : 30);
  const math = isMathContext(topic, kb, req.subject);
  // A warm-up poses one item; the main activity needs three (worked
  // example, faded item, unaided item / game rounds) and the jigsaw four,
  // one per member of a home group.
  const wantItems = isWarmup ? 1 : actType === 'group' ? 4 : 3;
  // A revision's items, and its terms, start one unit after the one its lead
  // concept and outcome come from (the blueprint rotates those by `variant`).
  // That way even the one-item warm-up touches two units, and each Regenerate
  // moves everything on by one unit.
  const practice = rev
    ? revisionPractice(rev, wantItems, variant + 1, lang, req.subject, { probe })
    : math
      ? takeConcreteMathBatch(wantItems, topic, kb, lang, 'medium')
      : isChemContext(topic, kb, req.subject)
        ? takeConcreteChemBatch(wantItems, topic, kb, lang, 'medium')
        : [];

  const blueprint = buildActivityBlueprint(actType, {
    topic, lang, math, practice, kb, duration, variant,
    // The lesson's own subject id, else the caller's name — see `handsOnKind`.
    // A revision's composite lesson sits in a real unit, so this is the scope's.
    subject: (kb ? getBookForLesson(kb)?.subjectId : undefined) ?? req.subject,
  });

  const activity = plainActivity({
    title: `${topic} – ${blueprint.titleSuffix}`,
    // Report the type the caller asked for, verbatim. `activityTypeLabel`
    // already falls back to the raw value for anything the form never
    // offered, so an unrecognised type stays honest instead of being
    // relabelled as the `group` fallback the blueprint used.
    activityType: actType,
    // Taken from the steps, not from `duration`: the two disagreed before
    // (a "10 minute" warm-up whose steps summed to 20), and a request for
    // fewer minutes than the format has steps cannot be honoured exactly.
    totalDuration: blueprint.steps.reduce((sum, s) => sum + s.durationMin, 0),
    objective: req.objectives?.trim() || blueprint.objective,
    groupSize: blueprint.groupSize,
    materials: blueprint.materials,
    steps: blueprint.steps,
    teacherTips: blueprint.teacherTips,
    differentiation: blueprint.differentiation,
    assessment: blueprint.assessment,
  });
  // The blueprints were written for one lesson; the few sentences that say so
  // («من درس …», «من الحصة السابقة») are reworded for a revision. A lesson's
  // activity is returned exactly as before.
  return rev ? reviseWording(activity, activityRevisionRewords(rev.phrase, lang)) : activity;
}
```

- [ ] **Step 4: Run them and confirm they pass; the blueprint and prompt pins still pass untouched**

Run:
```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
  services/__tests__/activityRevision.test.ts services/__tests__/activityWideScope.test.ts \
  services/__tests__/activityBlueprints.test.ts services/__tests__/activityRegenerate.test.ts \
  services/__tests__/chemActivity.test.ts services/__tests__/handsOnActivity.test.ts \
  services/__tests__/activityOutput.test.ts services/__tests__/activityType.test.ts
cd ../api-server && node --experimental-strip-types --test src/lib/__tests__/activityPrompts.test.ts
cd ../mobile && pnpm test 2>&1 | tail -8
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15
```
Expected: all PASS, 0 failures, no new type errors. `git diff --stat` must show `activityBlueprints.ts`, `activityBlueprints.test.ts` and `activityPrompts.test.ts` **unchanged**. If the live-clause pin fails only on `clause.includes(row.title)`, Task 2's clause does not print lesson titles as `parseCoverage` reads them. Reconcile with Task 2; do not weaken this test. If "a dead entry" fails for the reword table, `revisionPhrase` grounded as a lesson title on the lesson path. Print `before` and fix the table entry to the real template text.

Prove the pins are not vacuous before committing. Try each mutation, confirm the named test fails, then revert:
- In `buildOfflineActivity`, `revisionPractice(rev, wantItems, 0, …)` (fixed start). "discussion and hands-on … each Regenerate moves" and the warm-up case of "multi-item formats" fail.
- In `revisionActivityLesson`, `unitId: ''`. "a chemistry scope stays chemistry …" (the `Mathematics` iteration) and "is filed under … a real unit" fail.
- Delete the `reviseWording` call. "the one-lesson sentences are reworded" fails.
- In `activityVariantKey`, delete the `if (req.scope?.scopeKey) …` line. "two grades' «الكتاب كاملًا» …" fails.
- In `revisionSource`, test `req.coverage` instead of `req.scope`. "a lesson request with a lesson table but no scope …" fails.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/activityRevision.ts artifacts/mobile/services/ai/revisionWording.ts \
  artifacts/mobile/services/ai/generators.ts \
  artifacts/mobile/services/__tests__/activityRevision.test.ts artifacts/mobile/services/__tests__/activityWideScope.test.ts
git commit -m "feat: offline activity on a wide scope is a revision drawn across the units"
```
(The commit message ends with the two trailers from Global Constraints.)

---

### Task 6: The activity screen (`activity.tsx`)

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/activity.tsx`

The screen is not unit-testable (React Native). Every rule it applies is a pure function already pinned: `buildScopeRequest` (Task 1), `buildActivityRequest`, `scopeFormState`, `withLessonId`'s wide refusal, `useGeneratorExport`'s `noFigures`, and the generator (Task 5). Verify with the typecheck, the suite and the read-through below.

**Interfaces:**
- Consumes: Task 1 `buildScopeRequest(sel, lang, own?)`; existing `useWideScope(params, current)`, `scopeFormState(sel, mode)`, `scopeLabel(sel, lang)`, `captureGenerationScope`, `reopenedGenerationScope`, `buildActivityRequest(form, grounding)`, `ActivityForm`, `GeneratorGrounding`, `GeneratorResultActions.hideRelated`, `useGeneratorExport({ …, noFigures })`, `TopicSelector`'s `allowedKinds` / `onScopeChange` / `offlineWideScope`, i18n key `wideScopeUngrounded`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Imports, the inert grounding, params, state**

(a) Replace `import { resolveGeneratorGrounding } from '@/services/kbContext';` with:

```ts
import { resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
```

Replace `import { buildActivityRequest } from '@/services/generatorRequests';` with:

```ts
import { buildActivityRequest, type ActivityForm } from '@/services/generatorRequests';
```

Directly after `import { nextFrame } from '@/services/nextFrame';` add:

```ts
import { useWideScope } from '@/hooks/useWideScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { buildScopeRequest, scopeFormState } from '@/services/wideScopeRequest';
```

(b) Directly after `const DURATION_VALUES = [20, 30, 45, 60];` add:

```ts
/** What a unit / semester / book activity is anchored to: the scope itself, never one lesson its label happens to match. */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
```

(c) In the `useLocalSearchParams<{ … }>()` type, replace

```ts
    gradeIdx?: string; subjectIdx?: string; activityTypeIdx?: string; durationIdx?: string; objective?: string;
  }>();
```

with

```ts
    gradeIdx?: string; subjectIdx?: string; activityTypeIdx?: string; durationIdx?: string; objective?: string;
    scope?: string; distribution?: string;
  }>();
```

(d) Directly after `useWarmGrounding(topic, lang);` add:

```ts
  // The structured scope the topic picker reports, seeded from a reopened
  // material's saved form. The pickers are passed so a scope saved for another
  // grade or subject reads as not wide (piece 2: stale restored scope).
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /** The wide scope the activity on screen was generated under — what Save records and the notice names. */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(() => (wideScope.isWide ? wideScope.scopeSel : null));
```

(This sits above the `generated` state on purpose: its initializer reads `wideFrozen`.)

(e) Replace

```ts
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => (params.savedId ? reopenedGenerationScope(initialScope, topic, lang) : null),
  );
```

with

```ts
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => {
      if (!params.savedId) return null;
      // A restored wide activity is anchored to the scope, not to whichever
      // lesson its label («الفصل الأول كاملًا», a unit title) would ground to if
      // looked up again.
      if (wideFrozen && topic.trim()) {
        return captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING);
      }
      return reopenedGenerationScope(initialScope, topic, lang);
    },
  );
```

(f) Replace

```ts
  const groundedLesson: string | null = generated?.lesson
    ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
    : null;
```

with

```ts
  // A wide activity has no single lesson: name its scope instead of leaving the notice's tail empty.
  const groundedLesson: string | null = wideFrozen
    ? scopeLabel(wideFrozen, outLang)
    : generated?.lesson
      ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
      : null;
```

- [ ] **Step 2: `generate()` — never ground a wide label; merge the scope last; keep the teacher's `contextSource`**

Replace the whole `generate` function, from `  const generate = async (opts?: { regenerate?: boolean }) => {` to its closing `  };` just before `  /** Stop the in-flight request and hand the teacher their form back. */`, with:

```ts
  const generate = async (opts?: { regenerate?: boolean }) => {
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    const previous = result;
    // What a failed or cancelled run must hand back. It used to be cleared
    // up front and never restored, so a failed regenerate threw away the
    // unsaved activity the teacher was looking at. The frozen scope goes back
    // with it, so Save and the notice describe the restored activity.
    const held = { result, generated, builtWith, wideFrozen };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    // The body comes from generatorRequests, like the worksheet's and the
    // plan's, so the pregenerate script and this screen hash the same
    // artifact. It also carries the localised grade name — this screen
    // sent "Grade 10" into an Arabic activity.
    const form: ActivityForm = {
      gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
      subjectName: subjects[subjectIdx].name,
      topic,
      lang,
      activityType: ACTIVITY_TYPE_IDS[activityTypeIdx],
      durationMinutes: DURATION_VALUES[durationIdx],
      objective,
      regenerate: opts?.regenerate === true,
      previous,
    };
    // A unit, a semester or the whole book is a revision session. Its topic is
    // a label («الفصل الأول كاملًا»), not a lesson, so it is never grounded: the
    // request is built against the inert WIDE_GROUNDING, and the scope's fields
    // (digest, lesson table, explicit-undefined lesson ids) merge over it last.
    // `own` carries what this screen decided: a typed objective keeps the
    // request the teacher's (`contextSource: 'teacher'`, never pooled).
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wideOwn = wideScope.isWide ? buildActivityRequest(form, WIDE_GROUNDING) : null;
    const wide = wideOwn
      ? buildScopeRequest(wideScope.scopeSel!, lang as 'ar' | 'en', {
          additionalContext: wideOwn.additionalContext,
          contextSource: wideOwn.contextSource,
        })
      : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // activity — the KB serves that lesson's own content while the header
    // claims the picked subject. Refuse and name the real subject instead.
    // The check reads a lesson, so it applies to a single lesson only.
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setResult(null); setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    try {
      const grounding = wide
        ? WIDE_GROUNDING
        : resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en', { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
      const out = await aiService.generateActivity(
        // Last: the scope's fields replace the single-lesson ones.
        wide && wideOwn ? { ...wideOwn, ...wide.fields } : buildActivityRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setWideFrozen(wide ? wideScope.scopeSel : null);
      setBuiltWith({ activityTypeIdx, durationIdx, objective });
      setResult(out);
      // A regenerated activity is a new copy: leave the saved one alone, and
      // let «حفظ» create it. The star belonged to the saved material.
      if (opts?.regenerate === true && savedId) setFavorited(false);
      setSavedId(prev => savedIdAfterGeneration(prev, opts));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of.
      if (isAbortError(e)) setCancelled(true);
      else setError(aiErrorText(e, t));
      if (held.result) {
        setResult(held.result);
        setGenerated(held.generated);
        setBuiltWith(held.builtWith);
        setWideFrozen(held.wideFrozen);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Save the frozen scope; no figures, no Related tools on a wide activity**

(a) In `handleSave`, replace

```ts
    const formState = { gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic, ...(builtWith ?? { activityTypeIdx, durationIdx, objective }) };
```

with

```ts
    const formState = {
      gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic,
      ...(builtWith ?? { activityTypeIdx, durationIdx, objective }),
      // From the frozen scope, not the live picker (a teacher can move it after
      // generating). A lesson activity adds nothing — its form is unchanged —
      // and `withLessonId` declines to stamp a lesson id on a wide one.
      ...scopeFormState(wideFrozen, 'balanced'),
    };
```

(b) In the `useGeneratorExport({ … })` call, replace

```ts
    lessonId: scope.lesson?.id,
    lang: outLang,
```

with

```ts
    lessonId: scope.lesson?.id,
    // A wide activity has no figures of its own; without this an absent lesson
    // id falls back to grounding the label (see `noFigures`).
    noFigures: wideFrozen !== null,
    lang: outLang,
```

(c) On `<GeneratorResultActions … />`, replace

```tsx
          toolId="activity"
          topic={scope.topic}
        />
```

with

```tsx
          toolId="activity"
          topic={scope.topic}
          // Its chips open other tools with this label as a bare topic they re-ground.
          hideRelated={wideFrozen !== null}
        />
```

- [ ] **Step 4: The form**

On the `TopicSelector`, replace

```tsx
          onChange={text => { setTopic(text); setError(''); }}
          lang={lang}
```

with

```tsx
          onChange={text => { setTopic(text); setError(''); }}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          lang={lang}
```

No distribution picker and no count picker are added (spec non-goals). `wideScope.distribution` is not read anywhere on this screen.

- [ ] **Step 5: Typecheck, suite, adversarial read-through**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors, 0 failures.

Then read `git diff artifacts/mobile/app/ai-tools/activity.tsx` and confirm each item below. Write the answers in the report.
1. **Lesson path byte-identical.** With `wideScope.isWide` false: `wideOwn` and `wide` are `null`, `groundedSubjectConflict` runs as before, `grounding` is `resolveGeneratorGrounding(…, { scope })` as before, and the body is `buildActivityRequest(form, grounding)`, the same object the old inline literal produced. `setWideFrozen(null)`. `scopeFormState(null, …)` adds `{}`.
2. **No label grounding on a wide scope.** On the wide path, `generate()` calls none of `resolveGeneratorGrounding`, `generatorLessonId`, `buildGeneratorContext`, `generatorUnitId` or `generatorFigureCount`. `groundedSubjectConflict` is skipped. `useWarmGrounding(topic, lang)` only warms a cache and decides nothing.
3. **Merge order.** `{ ...wideOwn, ...wide.fields }`: the scope's `scope`, `coverage`, `additionalContext`, `contextSource`, explicit-undefined `unitId` / `lessonId` and `bookFigureCount: 0` win.
4. **Teacher text.** A typed objective gives `wideOwn.contextSource === 'teacher'`, which is passed as `own.contextSource`. The merged request still says `'teacher'` (`buildScopeRequest`'s contract). The objective itself travels in `objectives`, untouched by the merge.
5. **Refusal.** A wide scope that `buildScopeRequest` cannot ground sets `wideScopeUngrounded` and returns before `setLoading(true)`.
6. **Frozen scope.** `wideFrozen` is set on success, cleared for a lesson activity, and restored with `held` on failure or cancel. Save, the notice title (`scopeLabel`), `noFigures` and `hideRelated` all read `wideFrozen`, never the live picker.
7. **Reopen.** A saved wide activity reopens with `generated` from `captureGenerationScope(…, WIDE_GROUNDING)`, so the notice reads "grounded in «الفصل الأول كاملًا»". It does not show a lesson re-derived from the label. `useWideScope(params, current)` refuses a scope from another grade or subject.
8. **Derived, not effects.** No `useEffect` was added. `isWide` is derived in the hook.
9. **Figures.** `BookFiguresPanel` receives `getExportFigures()`, which is `[]` under `noFigures`, and the panel renders nothing for `[]`.
10. **Nothing else moved.** There is no `KeyboardAvoidingView` (CLAUDE.md), no new picker, and no new plan field.

State in the report that no browser was available, so the picker, the reopen and the Related-tools hiding were **not** clicked through.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/app/ai-tools/activity.tsx
git commit -m "feat: activity screen — unit, semester and book scopes as a revision session"
```
(The commit message ends with the two trailers from Global Constraints.)

---

### Task 7: Classroom builder — seven types on a wide scope

**Files:**
- Modify: `artifacts/mobile/services/ai/revisionWording.ts` (add `classroomRevisionRewords`)
- Modify: `artifacts/mobile/services/ai/generators.ts` (`revisionWording` import; `classroomActivityOnce` split into a wrapper and `classroomActivityBody`; the quick-check draw)
- Modify: `artifacts/mobile/app/ai-tools/classroom/builder.tsx`
- Test: `artifacts/mobile/services/__tests__/classroomWideScope.test.ts`

**Interfaces:**
- Consumes: Task 1's `ClassroomActivityRequest.scope?: AIRequest['scope']` / `coverage?: AIRequest['coverage']`, `buildScopeRequest`, `revisionPhrase`. Task 5's `revisionSource`, `revisionPractice`, `RevisionSource`, `revisionActivityLesson`, `reviseWording`, `Reword`. Existing `ACTIVITY_CARDS` (`services/classroomRouting.ts`), `useWideScope`, `TopicSelector` props.
- Produces: `export function classroomRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[]` in `revisionWording.ts`.

- [ ] **Step 1: Confirm Task 1's type, then write the failing test**

Run: `grep -n "scope?: AIRequest\['scope'\]\|coverage?: AIRequest\['coverage'\]" artifacts/mobile/services/ai/AIService.ts`
Expected: two lines inside `interface ClassroomActivityRequest`. If they are missing, stop: Task 1 is incomplete. Do not add them here.

The seven types are the `ACTIVITY_CARDS` ids: `escape-challenge`, `quick-check`, `error-detective`, `exit-ticket`, `bingo`, `relay`, `gallery-walk`. Create `artifacts/mobile/services/__tests__/classroomWideScope.test.ts`:

```ts
/**
 * The classroom builder on a unit, a semester or the whole book.
 *
 * Its seven types were written for one lesson and splice the topic into
 * sentences («بينجو الفصل الأول كاملًا», «عرّف المفهوم الرئيسي لـ…»). On a wide
 * scope the topic is the scope's revision phrase, never its label; the banked
 * types (quick check, bingo, relay on maths) draw their items from the scope's
 * lessons one unit after another; and the fixed-template sentences that claim
 * one lesson are reworded. A lesson's activity is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';
import { classroomRevisionRewords } from '../ai/revisionWording.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { lessonsInScope, scopeLabel, type ScopeSelection } from '../scopeSelection.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { ACTIVITY_CARDS } from '../classroomRouting.ts';

// The mock service's simulated latency is 1–2 s per call; nothing here needs it.
(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const TYPES = ACTIVITY_CARDS.map(c => c.id);
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', history: 'History' };
const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };

function classReq(sel: ScopeSelection, activityType: string, lang: 'ar' | 'en' = 'ar'): ClassroomActivityRequest {
  const wide = buildScopeRequest(sel, lang);
  assert.ok(wide, `probe: ${sel.subjectId} semester 1 should ground`);
  return {
    grade: 'Grade 10', subject: SUBJECT[sel.subjectId]!, topic: scopeLabel(sel, lang), activityType,
    duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'revision',
    language: lang === 'ar' ? 'arabic' : 'english',
    ...wide.fields,
  };
}

const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
};
const textOf = (a: ClassroomActivity) => strings(a).join('\n');

describe('offline classroom activity — a wide scope', () => {
  it('there are seven types', () => {
    assert.deepEqual([...TYPES].sort(), ['bingo', 'error-detective', 'escape-challenge', 'exit-ticket', 'gallery-walk', 'quick-check', 'relay']);
  });

  const cases: Array<[ScopeSelection, 'ar' | 'en']> = [[mathSem1, 'ar'], [histSem1, 'ar'], [histSem1, 'en']];
  for (const [sel, lang] of cases) {
    it(`${sel.subjectId} (${lang}): every type names the phrase, never the label, and no one-lesson sentence`, async () => {
      const phrase = revisionPhrase(sel, lang);
      const label = scopeLabel(sel, lang);
      const table = classroomRevisionRewords(phrase, lang);
      for (const type of TYPES) {
        const a = await aiService.generateClassroomActivity(classReq(sel, type, lang));
        const text = textOf(a);
        assert.equal(a.activityType, type);
        // Mutation caught: leaving `topic = req.topic` on the wide path.
        assert.equal(a.lesson, phrase, type);
        assert.ok(a.activityName.endsWith(phrase), `${type}: ${a.activityName}`);
        assert.ok(!text.includes(label), `${type} spliced the label «${label}»`);
        // Mutation caught: dropping the `reviseWording` call in `classroomActivityOnce`.
        for (const [from] of table) assert.ok(!text.includes(from), `${type}: «${from}»`);
        assert.ok(a.slides.length >= 3, type);
      }
    });
  }

  it('every reworded sentence is a real template sentence (a dead entry fails here)', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      let text = '';
      for (const type of TYPES) {
        // A lesson request whose topic happens to BE the phrase: no scope, so no rewording.
        const req: ClassroomActivityRequest = { ...classReq(histSem1, type, lang), scope: undefined, coverage: undefined, topic: phrase };
        text += textOf(await aiService.generateClassroomActivity(req)) + '\n';
      }
      for (const [from] of classroomRevisionRewords(phrase, lang)) assert.ok(text.includes(from), `${lang}: dead entry «${from}»`);
    }
  });

  it('a maths scope takes the banked forms of quick check, bingo and relay', async () => {
    const qc = await aiService.generateClassroomActivity(classReq(mathSem1, 'quick-check'));
    const questions = qc.slides.filter(s => s.type === 'question');
    // Mutation caught: the quick check's per-lesson loop left in place on a
    // revision, which draws from the composite lesson and finds no family.
    assert.ok(questions.length >= 2, `quick check: ${questions.length} bank questions`);
    for (const s of questions) assert.ok((s.options?.length ?? 0) >= 2);
    const bingo = await aiService.generateClassroomActivity(classReq(mathSem1, 'bingo'));
    assert.ok(bingo.activityName.startsWith('بينجو مسائل'), bingo.activityName);
    assert.ok(bingo.slides.filter(s => s.type === 'bingo-call').length >= 4);
    const relay = await aiService.generateClassroomActivity(classReq(mathSem1, 'relay'));
    assert.ok(relay.learningObjective.startsWith('حل أربع مسائل محددة'), relay.learningObjective);
  });

  it('a scope with no bank asks open questions drawn from two units or more', async () => {
    const qc = await aiService.generateClassroomActivity(classReq(histSem1, 'quick-check'));
    const owner = new Map<string, string>();
    for (const l of lessonsInScope(histSem1)) {
      const kb = getLessonById(l.id);
      for (const c of kb?.keyConceptsAr ?? []) owner.set(c, kb!.unitId);
    }
    const units = new Set(qc.slides
      .filter(s => s.type === 'challenge')
      .flatMap(s => [...owner].filter(([c]) => (s.content ?? '').includes(c)).map(([, u]) => u)));
    assert.ok(units.size >= 2, `${[...units].join(', ')}`);
  });
});

describe('offline classroom activity — a lesson is unchanged', () => {
  it('a lesson request with a lesson table but no scope is built exactly as without one', async () => {
    const coverage = buildScopeRequest(histSem1, 'ar')!.fields.coverage;
    const lesson = getLessonById('kbl-hist-s1-nccd-u1_l1')!;
    for (const type of TYPES) {
      const req: ClassroomActivityRequest = {
        grade: 'Grade 10', subject: 'History', topic: lesson.titleAr, lessonId: lesson.id, activityType: type,
        duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'practice', language: 'arabic',
      };
      // Mutation caught: keying the revision branch on `coverage` instead of `scope`.
      assert.deepEqual(await aiService.generateClassroomActivity({ ...req, coverage }), await aiService.generateClassroomActivity(req), type);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classroomWideScope.test.ts`
Expected: FAIL at load, with `SyntaxError: The requested module '../ai/revisionWording.ts' does not provide an export named 'classroomRevisionRewords'`.

- [ ] **Step 3: Implement**

(a) In `artifacts/mobile/services/ai/revisionWording.ts`, add after `activityRevisionRewords`:

```ts
/**
 * The classroom templates' one-lesson sentences (`classroomActivityOnce` in
 * generators.ts): the vocabulary bingo's clues, the unbanked relay's chain,
 * the gallery walk's stations and the exit ticket's three questions. Each
 * assumes a single concept or method («المفهوم الرئيسي لـ…», «أسلوب … الذي
 * درسناه اليوم», «من وحدة …»).
 */
export function classroomRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[] {
  const p = phrase;
  return lang === 'ar'
    ? [
        [`المصطلح 1: تعريف ${p}`, `المصطلح 1: مصطلح من ${p} وتعريفه`],
        [`المصطلح 2: خاصية ${p}`, `المصطلح 2: خاصية من ${p}`],
        [`المصطلح 3: تطبيق ${p}`, `المصطلح 3: تطبيق من ${p}`],
        [`فكّر في تعريف ${p}`, `فكّر في تعريفات ${p}`],
        [`من وحدة ${p}`, `من ${p}`],
        [`خاصية: ${p} يُستخدم عندما…`, `خاصية: مفهوم من ${p} يُستخدم عندما…`],
        [`ما الفرق بين المفهومين الرئيسيين في ${p}؟`, `ما الفرق بين مفهومين من وحدتين مختلفتين في ${p}؟`],
        [`الفرق بين مفهومَي ${p}`, `الفرق بين مفهومين من ${p}`],
        [`أي خاصية من خصائص ${p} تنطبق`, `أي خاصية مما راجعناه في ${p} تنطبق`],
        [`طبّق ${p} على المعطيات التالية`, `طبّق قاعدة من ${p} على المعطيات التالية`],
        [`القيمة الأولى (أ) من تطبيق ${p}`, `القيمة الأولى (أ) من تطبيق قاعدة من ${p}`],
        [`الآن طبّق ${p} مرة أخرى مع (أ)`, `الآن طبّق قاعدة من وحدة أخرى في ${p} مع (أ)`],
        [`طبّق خاصية ${p} الثانية مع (ب)`, `طبّق خاصية من ${p} مع (ب)`],
        [`طبّق ${p} بالكامل لإيجاد الإجابة النهائية`, `اجمع ما طبّقته من ${p} لإيجاد الإجابة النهائية`],
        [`اليوم طبّقتم ${p} في سلسلة متكاملة`, `اليوم راجعتم ${p} في سلسلة متكاملة`],
        [`طبّق التعريف الأساسي لـ${p}`, `طبّق تعريفًا أساسيًا من ${p}`],
        [`تطبيق مباشر للتعريف الأساسي لـ${p}`, `تطبيق مباشر لتعريف أساسي من ${p}`],
        [`كيف يُستخدم ${p} لحل هذا الموقف الحياتي؟`, `كيف يُستخدم مفهوم من ${p} لحل هذا الموقف الحياتي؟`],
        [`بين مفهومين رئيسيين في ${p}؟`, `بين مفهومين رئيسيين من وحدتين مختلفتين في ${p}؟`],
        [`عرّف المفهوم الرئيسي لـ${p}.`, `اختر مفهومًا رئيسيًا من ${p} وعرّفه.`],
        [`تعريف دقيق بكلمات الطالب لـ${p}`, `تعريف دقيق بكلمات الطالب لمفهوم من ${p}`],
        [`طبّق ${p} على مثال من الكتاب المدرسي`, `طبّق قاعدة من ${p} على مثال من الكتاب المدرسي`],
        [`متى لا ينجح أسلوب ${p} الذي درسناه اليوم؟`, `متى لا تنجح قاعدة من ${p} راجعناها اليوم؟`],
        [`اذكر موقفًا حياتيًا يستخدم ${p}.`, `اذكر موقفًا حياتيًا يستخدم مفهومًا من ${p}.`],
      ]
    : [
        [`Term 1: definition of ${p}`, `Term 1: a term from ${p} and its definition`],
        [`Term 2: property of ${p}`, `Term 2: a property from ${p}`],
        [`Term 3: application of ${p}`, `Term 3: an application from ${p}`],
        [`Think about the definition of ${p}`, `Think about the definitions in ${p}`],
        [`from the ${p} unit`, `from ${p}`],
        [`Property: ${p} is used when…`, `Property: a concept from ${p} is used when…`],
        [`What is the main difference between the two key concepts in ${p}?`, `What is the difference between two key concepts from different units of ${p}?`],
        [`The distinction between the two concepts in ${p}`, `The distinction between two concepts from ${p}`],
        [`Which property of ${p} applies`, `Which property from ${p} applies`],
        [`Apply ${p} to the given data`, `Apply a rule from ${p} to the given data`],
        [`First value (a) from applying ${p}`, `First value (a) from applying a rule from ${p}`],
        [`Now apply ${p} again with (a)`, `Now apply a rule from another unit of ${p} with (a)`],
        [`Apply the second property of ${p} with (b)`, `Apply a property from ${p} with (b)`],
        [`Apply the full ${p} process to find the final answer`, `Combine what you applied from ${p} to find the final answer`],
        [`Today you applied ${p} across a full connected chain`, `Today you revised ${p} across a full connected chain`],
        [`Apply the core definition of ${p}`, `Apply a core definition from ${p}`],
        [`Direct application of the core ${p} definition`, `Direct application of a core definition from ${p}`],
        [`How does ${p} apply to this real-world scenario?`, `How does a concept from ${p} apply to this real-world scenario?`],
        [`between the two key concepts in ${p}?`, `between two key concepts from different units of ${p}?`],
        [`Define the main concept of ${p}.`, `Pick one key concept from ${p} and define it.`],
        [`An accurate student-worded definition of ${p}`, `An accurate student-worded definition of a concept from ${p}`],
        [`Apply ${p} to an example from the textbook`, `Apply a rule from ${p} to an example from the textbook`],
        [`When does the ${p} method we learned today NOT work?`, `When does a rule from ${p} that we revised today NOT work?`],
        [`Name a real-world situation that uses ${p}.`, `Name a real-world situation that uses a concept from ${p}.`],
      ];
}
```

(Every entry was checked against the current templates with the phrase «موضوعات الفصل الأول» / "Semester 1 topics". The dead-entry test keeps it that way.)

(b) In `generators.ts`, replace the Task 5 import line

```ts
import { activityRevisionRewords, reviseWording } from './revisionWording.ts';
```

with

```ts
import { activityRevisionRewords, classroomRevisionRewords, reviseWording } from './revisionWording.ts';
```

(c) In `generators.ts`, replace the head of `classroomActivityOnce`, from

```ts
  private async classroomActivityOnce(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    beginMathPracticeSession();
    const isAr = req.language === 'arabic';
    const topic = req.topic;
    const kb = groundedKb(topic, isAr ? 'ar' : 'en', req.lessonId);
```

through

```ts
    const batch = (n: number) =>
      math
        ? takeConcreteMathBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
        : chem
          ? takeConcreteChemBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
          : [];
```

with

```ts
  private async classroomActivityOnce(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    // A unit, a semester or the whole book is a revision (piece-3 spec §3). The
    // templates below take the scope's phrase and its units' composite lesson,
    // never the picker's label, and the sentences in them that claim one lesson
    // are reworded afterwards. A lesson's activity is returned untouched.
    const rev = revisionSource(req, lang);
    const out = await this.classroomActivityBody(req, rev);
    return rev ? reviseWording(out, classroomRevisionRewords(rev.phrase, lang)) : out;
  }

  private async classroomActivityBody(req: ClassroomActivityRequest, rev: RevisionSource | null): Promise<ClassroomActivity> {
    beginMathPracticeSession();
    const isAr = req.language === 'arabic';
    const topic = rev ? rev.phrase : req.topic;
    const kb = rev
      ? revisionActivityLesson(rev.groups, rev.scopeKey, { title: rev.phrases })
      : groundedKb(topic, isAr ? 'ar' : 'en', req.lessonId);
    const dur = req.duration ?? 20;
    const slideDuration = Math.round((dur * 60) / 5);
    const actType = req.activityType ?? 'escape-challenge';
    // A revision's composite lesson sits in a real unit of the scope's book, so
    // these read the scope's subject, not the screen's subject name.
    const math = isMathContext(topic, kb, req.subject);
    const chem = !math && isChemContext(topic, kb, req.subject);
    const batch = (n: number) =>
      rev
        // One item per unit in turn, from the units' banked lessons.
        ? revisionPractice(rev, n, 0, isAr ? 'ar' : 'en', req.subject)
        : math
          ? takeConcreteMathBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
          : chem
            ? takeConcreteChemBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
            : [];
```

(`dur`, `slideDuration` and `actType` keep their original lines and meaning. They are repeated above only because the replaced range spans them. The rest of the old body, from `const bingoItems = …` to the end of the English escape challenge, now belongs to `classroomActivityBody` unchanged except for (d). `generateClassroomActivity` still calls `this.classroomActivityOnce(req)`.)

(d) In the quick-check branch of the same body, replace

```ts
      const mcqs: { text: string; options: string[]; answer: string }[] = [];
      if (math || chem) {
```

with

```ts
      const mcqs: { text: string; options: string[]; answer: string }[] = [];
      if (rev) {
        // A revision asks one question per unit in turn, each from its own lesson's bank.
        const drawn = revisionPractice(rev, wanted, 0, isAr ? 'ar' : 'en', req.subject, {
          type: 'multiple_choice', tier: () => tier, points: 0,
        });
        for (const q of drawn) if (q.options?.length) mcqs.push({ text: q.text, options: q.options, answer: q.answer });
      } else if (math || chem) {
```

(The `for (let i = 0; i < wanted; i++) { … }` loop and the closing `}` that followed stay. They are now the `else if` branch.)

(e) `artifacts/mobile/app/ai-tools/classroom/builder.tsx`. Add after `import { ACTIVITY_CARDS, cardMetaLabel, ClassroomSetup, resolveActivityType } from '@/services/classroomRouting';`:

```ts
import { useWideScope } from '@/hooks/useWideScope';
import { buildScopeRequest } from '@/services/wideScopeRequest';
```

Directly after `const [topic, setTopic] = useState('');` add:

```ts
  // The structured scope the topic picker reports. This screen opens from the
  // activity cards with no saved scope, so it starts empty; the pickers are
  // passed so a scope left over from another grade or subject reads as not wide.
  const wideScope = useWideScope({}, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
```

In `generate`, replace

```ts
    const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
```

with

```ts
    // A unit, a semester or the whole book is a revision. Its topic is a label
    // («الفصل الأول كاملًا»), not a lesson; this screen's grounding calls are
    // UNSCOPED, so a unit title would ground to another grade's lesson. A wide
    // scope skips them all and merges the scope's fields last. One that cannot
    // be grounded is refused here, never generated mislabeled.
    const wide = wideScope.isWide ? buildScopeRequest(wideScope.scopeSel!, lang, { contextSource: 'curriculum' }) : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
```

and replace

```ts
      const additionalContext = buildGeneratorContext(topic.trim(), lang);
```

with

```ts
      const additionalContext = wide ? undefined : buildGeneratorContext(topic.trim(), lang);
```

and replace

```ts
        unitId: generatorUnitId(topic.trim(), lang),
        lessonId: generatorLessonId(topic.trim(), lang),
        bookFigureCount: generatorFigureCount(topic.trim(), lang),
        contextSource: 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
      }, { signal: controller.signal });
```

with

```ts
        unitId: wide ? undefined : generatorUnitId(topic.trim(), lang),
        lessonId: wide ? undefined : generatorLessonId(topic.trim(), lang),
        bookFigureCount: wide ? 0 : generatorFigureCount(topic.trim(), lang),
        contextSource: 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
        // Last: the scope's digest, its lesson table and the explicit-undefined
        // lesson ids replace the single-lesson fields.
        ...(wide ? wide.fields : {}),
      }, { signal: controller.signal });
```

On the `TopicSelector`, replace

```tsx
          onChange={v => { setTopic(v); setError(''); }}
          lang={lang}
```

with

```tsx
          onChange={v => { setTopic(v); setError(''); }}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          lang={lang}
```

Of the piece-2 guard list, only some items apply to this screen. **Applies:** `useWideScope(…, current)`; skipping the grounding calls and `groundedSubjectConflict` for a wide scope; the `wideScopeUngrounded` refusal; `buildScopeRequest` fields merged last; the `TopicSelector` kinds and `offlineWideScope`. **Does not apply,** because the screen has none of these: a grounding notice (`GroundingNotice`), a figures panel, `useGeneratorExport` / `noFigures`, `GeneratorResultActions` / `hideRelated`, Save / `scopeFormState` / reopen / `captureGenerationScope` / `WIDE_GROUNDING`. The result goes straight to the presentation via `setPendingClassroomActivity`, and the screen has no reopen route params.

- [ ] **Step 4: Run it and confirm it passes; the type and card pins still pass**

Run:
```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
  services/__tests__/classroomWideScope.test.ts services/__tests__/classroomRouting.test.ts \
  services/__tests__/cardMetaLabel.test.ts services/__tests__/chemActivity.test.ts \
  services/__tests__/activityWideScope.test.ts
cd ../api-server && node --experimental-strip-types --test src/lib/__tests__/classroomPrompts.test.ts
cd ../mobile && pnpm test 2>&1 | tail -8
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15
```
Expected: all PASS, 0 failures, no new type errors. `classroomPrompts.ts` and its test are untouched by this task.

Mutations to try, then revert. Each must fail the named test:
- In `classroomActivityBody`, `const topic = req.topic;`. "every type names the phrase …" fails (`a.lesson` is the label).
- Remove the `rev ? reviseWording(…) : out` in `classroomActivityOnce`. "every type … no one-lesson sentence" fails on history (exit ticket, gallery walk, vocabulary bingo, unbanked relay).
- Remove the `if (rev) { … } else` in the quick-check branch. "a maths scope takes the banked forms" fails, because the composite lesson matches no maths family and the quick check falls to open questions.
- In `revisionSource`, test `req.coverage` instead of `req.scope`. "a lesson request with a lesson table but no scope …" fails.

Then read `git diff artifacts/mobile/app/ai-tools/classroom/builder.tsx` and confirm:
1. With `wideScope.isWide` false, the request object is exactly what it was. `wide` is `null`, `buildGeneratorContext` / `generatorUnitId` / `generatorLessonId` / `generatorFigureCount` are called as before, and the spread adds nothing.
2. With a wide scope, none of those four nor `groundedSubjectConflict` is called with the label.
3. `...(wide ? wide.fields : {})` is the last entry.
4. The ungrounded refusal returns before `setLoading(true)`, and its message renders in the screen's error line above the button.

State that no browser was available, so the picker and the presentation were not clicked through.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/revisionWording.ts artifacts/mobile/services/ai/generators.ts \
  artifacts/mobile/app/ai-tools/classroom/builder.tsx artifacts/mobile/services/__tests__/classroomWideScope.test.ts
git commit -m "feat: classroom builder — unit, semester and book scopes as a revision"
```
(The commit message ends with the two trailers from Global Constraints.)

---

### Section self-check

**Identifiers introduced, and where each is defined:**

| Identifier | Defined in |
| --- | --- |
| `RevisionLessonGroup`, `RevisionDrawLesson`, `RevisionLessonOptions` (types) | Task 5 Step 3(a), `services/ai/activityRevision.ts` |
| `revisionLessonsByUnit`, `revisionActivityLesson`, `drawAcrossUnits` | Task 5 Step 3(a), `services/ai/activityRevision.ts` |
| private `REVISION_POOL`, `rotated`, `unitEntries`, `acrossUnits` | Task 5 Step 3(a), same file |
| `Reword`, `activityRevisionRewords`, `reviseWording` | Task 5 Step 3(b), `services/ai/revisionWording.ts` |
| `classroomRevisionRewords` | Task 7 Step 3(a), `services/ai/revisionWording.ts` |
| `lessonHasOfflineBank` (internal) | Task 5 Step 3(d), `generators.ts` |
| `RevisionProbe` (exported type), `RevisionSource` (internal type), `REVISION_FALLBACK_PHRASES`, `revisionSource`, `revisionPractice` | Task 5 Step 3(e), `generators.ts` |
| `activityVariantKey` (exported) | Task 5 Step 3(f), `generators.ts` |
| `buildOfflineActivity(req, variant?, probe?)` (third parameter added) | Task 5 Step 3(g), `generators.ts` |
| `classroomActivityBody` (private method) | Task 7 Step 3(c), `generators.ts` |
| `WIDE_GROUNDING`, `wideScope`, `wideFrozen` / `setWideFrozen`, `form`, `wideOwn`, `wide` (screen locals) | Task 6 Steps 1–2, `activity.tsx` |
| `wideScope`, `wide` (screen locals) | Task 7 Step 3(e), `classroom/builder.tsx` |

**Identifiers consumed from outside this section, and the contract line each relies on:**

| Identifier | Source and contract line |
| --- | --- |
| `isRevisionRequest(req: { scope?: { kind: string } \| null }): boolean` | Task 1 (Section A Step 3(c)): `return !!req.scope`. Task 3 already adds it to `generators.ts`'s `./AIService.ts` import; Task 5 only confirms it |
| `scopeFromKey(scopeKey: string): ScopeSelection \| null` | Task 1 (Section A, `services/revisionScope.ts`): reads `book:g:s`, `sem:g:s:n`, `unit:<id>`, `lesson:<id>`, and returns null for junk or an empty scope. Used by Task 5's `revisionSource`, which Task 7 reuses |
| `revisionPhrase(sel, lang): string` | Task 1 (Section A): semester «موضوعات الفصل الأول» / "Semester 1 topics"; book «موضوعات الكتاب كله» / "whole-book topics"; unit «موضوعات وحدة «…»». The reword tables are built from whatever it returns, so the exact wording does not matter to them |
| `buildScopeRequest(sel, lang, own = {})` returning `{ fields, grounding, units } \| null`; `fields.coverage = { lessons }` (no slots); explicit-undefined `unitId` / `lessonId`; `bookFigureCount: 0`; `contextSource` is `'teacher'` when `own.contextSource === 'teacher'`, or when `own.additionalContext` has text and `own.contextSource` is absent | Task 1 (Section A Step 3). Both callers here always state `own.contextSource` (activity: from `buildActivityRequest`; classroom: `'curriculum'`), so the fail-closed extension never changes their result |
| `ClassroomActivityRequest.scope?: AIRequest['scope']`, `.coverage?: AIRequest['coverage']` | Task 1. Contract: "ClassroomActivityRequest gains optional: scope?: AIRequest['scope']; coverage?: AIRequest['coverage']" (Task 7 Step 1 greps for them) |
| `revisionClauseAr(b, 'activity')`, non-empty for a valid wide scope, listing the units' lessons | Task 2. Contract: "artifacts/api-server/src/lib/revision.ts — NEW … a clause that … lists the units (grouped from parseCoverage(b).lessons by unitId; titles bounded)". This section assumes each lesson title prints as `parseCoverage` reads it (decision 9). |
| `useWideScope(params, current)` returning `{ scopeSel, setScopeSel, isWide }` (`distribution` ignored) | Existing, piece 2. Contract: "Screen-facing shared state is hooks/useWideScope.ts … the teaching tools IGNORE distribution" |
| `scopeFormState`, `scopeLabel`, `scopeKey`, `lessonsInScope`, `unitsInScope`, `captureGenerationScope`, `reopenedGenerationScope`, `buildActivityRequest`, `ActivityForm`, `GeneratorGrounding`, `parseCoverage`, `ACTIVITY_CARDS`, `TopicSelector` (`allowedKinds` / `onScopeChange` / `offlineWideScope`), `GeneratorResultActions.hideRelated`, `useGeneratorExport.noFigures`, i18n `wideScopeUngrounded` | Existing on the branch (pieces 1–2), each verified by reading the file |
| Task 5 internals consumed by Task 7: `revisionSource`, `revisionPractice`, `RevisionSource`, `revisionActivityLesson`, `reviseWording`, `Reword` | Task 5 Interfaces → Produces |


## Drafting notes — Slides, lesson-flow, STATUS (Tasks 8–10)

### Section overview

These three tasks use what Tasks 1–7 built: `buildScopeRequest` / `ScopeRequest` / `ScopeRequestFields`, `revisionUnits` / `revisionPhrase`, the `scope` + `coverage` fields on `ClassroomActivityRequest`, and the wide offline results of `generateLessonPlan` (Task 3), `generateActivity` (Task 5) and `generateClassroomActivity` quick-check (Task 7). None of them is reimplemented here.

**Task 8 (slides).** The deck builder is a new pure `buildRevisionDeck`, kept separate from `buildLessonDeck`, chosen after reading the real code. `buildLessonDeck(…, { lesson: null })` never projects `plan.mainActivity`: that field only feeds `chartForLesson`. A null-lesson deck would therefore contain **no unit at all**. Its fallbacks also splice the title into lesson-shaped sentences: `learningObjective` becomes «شرح درس «…» على الشاشة» and the closure becomes «أنهينا درس «…»». Making it wide-aware would mean branching six sections of a 600-line function that is pinned by about 50 tests. A separate builder in the same module adds lines and removes none, so the lesson deck stays byte-identical by construction (Step 4 checks this with `git diff`). It also reuses the module's private `asCheckSlide`, `splitChecks`, `splitWarmup` and `rebuildAnswerKey`. The units come from `ScopeRequest.units`, which is curriculum data. They are **not** parsed out of the plan's prose. The two request bodies and the decision to skip the teaching call go into a new pure `services/slidesRequests.ts`. That way a test can pin that a lesson body is unchanged, that a wide body carries the scope on **both** calls, and that the teaching request is `null` for a wide deck.

**Task 9 (lesson-flow).** The runner gets `questionStepFields(req)`, which only steps 5–6 spread. Then the screen is changed.

**Task 10.** Updates STATUS and runs the full verification.

---

### Task 8: Slides — the revision deck, its request bodies, and the screen

**Files:**
- Modify: `artifacts/mobile/services/lessonSlides.ts` (add a type import, then append `RevisionDeckOptions` and `buildRevisionDeck` at the end of the file. No existing line changes.)
- Create: `artifacts/mobile/services/slidesRequests.ts`
- Modify: `artifacts/mobile/app/ai-tools/slides.tsx`
- Test: `artifacts/mobile/services/__tests__/revisionDeck.test.ts` (new)
- Test: `artifacts/mobile/services/__tests__/slidesRequests.test.ts` (new)

**Interfaces:**
- Consumes:
  - Task 1 (contract): `RevisionUnit`, `revisionUnits(sel, lang): RevisionUnit[]`, `revisionPhrase(sel, lang): string` (in `services/revisionScope.ts`); `ScopeRequestFields`, `ScopeRequest = { fields, grounding, units }`, `buildScopeRequest(sel, lang, own?): ScopeRequest | null` (in `services/wideScopeRequest.ts`); optional `scope` / `coverage` on `ClassroomActivityRequest`.
  - Task 3: `aiService.generateLessonPlan` returns a wide plan for a request carrying `scope` + `coverage`.
  - Task 7: `aiService.generateClassroomActivity({ activityType: 'quick-check', …scope fields })` returns wide check slides.
  - Existing: `splitChecks`, `splitWarmup`, `rebuildAnswerKey`, the private `asCheckSlide` / `bullets` / `nonEmpty` (same module); `EXIT_TICKET_MAX`, `MID_LESSON_CHECK_MAX`; `buildLessonTeachingRequest(form, grounding, regen)`; `GeneratorGrounding`; `useWideScope(params, current)`; `scopeFormState(sel, mode)`; `scopeLabel(sel, lang)`; `captureGenerationScope`, `reopenedGenerationScope`.
- Produces:
  - `export interface RevisionDeckOptions { units: readonly RevisionUnit[]; phrase: string; plan?: LessonPlanOutput | null; checks?: ActivitySlide[]; subject?: string; grade?: string; includePractice?: boolean }`
  - `export function buildRevisionDeck(isAr: boolean, opts: RevisionDeckOptions): ClassroomActivity`
  - `export type SlidesForm = { gradeName: string; subjectName: string; topic: string; isAr: boolean }`
  - `export type SlidesLessonFields = { additionalContext?: string; unitId?: string; lessonId?: string; bookFigureCount?: number }`
  - `export function slidesPlanRequest(form: SlidesForm, lesson: SlidesLessonFields, wide: ScopeRequestFields | null): AIRequest`
  - `export function slidesChecksRequest(form: SlidesForm, lesson: SlidesLessonFields, wide: ScopeRequestFields | null): ClassroomActivityRequest`
  - `export function slidesTeachingRequest(form: SlidesForm, grounding: GeneratorGrounding, regen: ReturnType<typeof regenerationFields>, wide: ScopeRequestFields | null): AIRequest | null`

**What a wide deck contains, slide by slide** (this is the spec of `buildRevisionDeck`):
1. `intro`, titled «مراجعة {revisionPhrase}» / "Revision: {phrase}"; the content is `subject · grade`.
2. `intro` «🗂️ ما نراجعه اليوم». The content is one bullet per unit title. The teacher panel holds the plan's `introduction`, which states the scope and what is left out. It is omitted here when slide 4 already carries it.
3. `intro` «🎯 أهداف المراجعة», built from `plan.objectives`. Only present if there are any.
4. `intro` «✨ تمهيد», built by the `splitWarmup` rule of the lesson deck. Only present if the plan asks a question.
5. For each unit, in book order: a `divider` titled with the unit title, whose content is «الجولة i من n» (or «جولة المراجعة» when there is only one unit). Then an `intro` titled «💡 {unit title}», whose bullets are the unit's outcomes plus its concepts (deduplicated, at most 6). If both are empty, it uses the unit's lesson titles. The teacher panel lists the unit's lessons and up to 3 key terms.
6. The mid-lesson checks, «✋ تحقّق سريع i». They come after all the rounds, because a generated check is not tied to one round.
7. The teacher-led guided and independent practice from the plan, when `includePractice` is set (same wording as the lesson deck).
8. `summary` «🎉 ملخص المراجعة»: «راجعنا اليوم:» followed by the unit list. The plan's `closure` goes in the teacher panel.
9. When there are exit checks: a `divider` «غلق الحصة», then «🎫 غلق الحصة i».
10. `intro` «🏠 الواجب», using the plan's `homework` only (no exercise-book line). Only present when `includePractice` is set.

A wide deck never contains: `media` (book figure) slides, a `sideImageUrl`, a `graph` or chart slide, «📖 مفردات الدرس», «📐 القاعدة», «لنبدأ الشرح», «مثال n», «من كتاب التمارين», «🎉 ملخص الدرس» or «غلق الدرس».

- [ ] **Step 1: Write the failing test for `buildRevisionDeck`**

Create `artifacts/mobile/services/__tests__/revisionDeck.test.ts`:

```ts
/**
 * The unit / semester / whole-book deck (`buildRevisionDeck`).
 *
 * A wide deck is one revision session: a round per unit, the generated checks,
 * the plan's connective tissue — and nothing that belongs to a single lesson.
 * Built on real G10 maths units (`revisionUnits`), so the round count tracks the
 * curriculum rather than a fixture.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { revisionPhrase, revisionUnits } from '../revisionScope.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import type { ActivitySlide, ClassroomActivity, LessonPlanOutput } from '../ai/AIService.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const UNITS = revisionUnits(sem1, 'ar');
const PHRASE = revisionPhrase(sem1, 'ar');

/** A wide plan: first-person-future teacher text, a quoted warm-up question. */
const PLAN: LessonPlanOutput = {
  title: 'مراجعة',
  grade: 'الصف العاشر',
  subject: 'الرياضيات',
  duration: 45,
  objectives: ['أن يستذكر الطالب الفكرة الرئيسة لكل وحدة'],
  materials: ['سبورة'],
  introduction: 'سأعرض على الطلبة الوحدات التي نراجعها، ثم سأسأل: «ما أصعب فكرة مرّت بنا هذا الفصل؟» ولن نتناول اليوم الدروس الأخيرة من كل وحدة.',
  mainActivity: 'جولة لكل وحدة.',
  guidedPractice: 'سأحلّ مع الطلبة سؤالًا من كل وحدة.',
  independentPractice: 'سيحلّ الطلبة سؤالين بمفردهم.',
  closure: 'سأطلب من كل طالب فكرة واحدة من كل وحدة.',
  assessment: 'أسئلة الغلق.',
  differentiation: 'سأعطي المتقدمين سؤالًا يربط وحدتين.',
  homework: 'حلّ سؤالين من كل وحدة.',
};
/** The same plan with no question to lift: its introduction must still reach the teacher. */
const PLAN_NO_QUESTION: LessonPlanOutput = {
  ...PLAN,
  introduction: 'سأعرض على الطلبة الوحدات التي نراجعها، ولن نتناول اليوم الدروس الأخيرة من كل وحدة.',
};

function mcq(n: number): ActivitySlide {
  return {
    slideNumber: n,
    type: 'question',
    title: `سؤال ${n}`,
    content: `سؤال رقم ${n}؟`,
    options: [`أ${n}`, `ب${n}`, `ج${n}`, `د${n}`],
    correctIndex: 1,
    verified: true,
    verifiedBy: 'bank',
    durationSeconds: 45,
  };
}
const FIVE_CHECKS = [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)];

const deckOf = (plan: LessonPlanOutput | null, checks: ActivitySlide[] = []) =>
  buildRevisionDeck(true, {
    units: UNITS, phrase: PHRASE, plan, checks,
    subject: 'الرياضيات', grade: 'الصف العاشر', includePractice: true,
  });

/** Everything that belongs to ONE lesson and so has no place on a revision deck. */
const LESSON_ONLY_TITLES = ['📖 مفردات الدرس', '📐 القاعدة', 'لنبدأ الشرح', 'من كتاب الطالب', '🎉 ملخص الدرس', 'غلق الدرس'];
function lessonOnlySlides(deck: ClassroomActivity): ActivitySlide[] {
  return deck.slides.filter(s =>
    s.type === 'media'
    || s.type === 'graph'
    || !!s.sideImageUrl
    || LESSON_ONLY_TITLES.some(t => s.title.startsWith(t))
    || /^مثال \d/.test(s.title)
    || s.content.includes('من كتاب التمارين'));
}

const unitDividers = (deck: ClassroomActivity) =>
  deck.slides.filter(s => s.type === 'divider' && UNITS.some(u => u.title === s.title));

describe('buildRevisionDeck — a round per unit', () => {
  it('has one divider per unit, in book order, each followed by that unit\'s ideas', () => {
    assert.ok(UNITS.length >= 2, `semester 1 should have several units, got ${UNITS.length}`);
    const deck = deckOf(PLAN, FIVE_CHECKS);
    assert.deepEqual(unitDividers(deck).map(s => s.title), UNITS.map(u => u.title));
    for (const unit of UNITS) {
      const at = deck.slides.findIndex(s => s.type === 'divider' && s.title === unit.title);
      const ideas = deck.slides[at + 1]!;
      assert.equal(ideas.title, `💡 ${unit.title}`);
      const expected = (unit.outcomes[0] ?? unit.concepts[0] ?? unit.lessons[0]!.title).trim();
      assert.ok(ideas.content.includes(expected), `${unit.title}: ${ideas.content}`);
      assert.ok(ideas.teacher?.expectedAnswer.includes(unit.lessons[0]!.title), 'the teacher panel lists the unit\'s lessons');
    }
  });

  it('a unit scope is one round, not «الجولة 1 من 1»', () => {
    const unitSel: ScopeSelection = {
      kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics',
      unitId: getUnitsForSubjectGrade('mathematics', 'grade-10')[0]!.id,
    };
    const units = revisionUnits(unitSel, 'ar');
    assert.equal(units.length, 1);
    const deck = buildRevisionDeck(true, { units, phrase: revisionPhrase(unitSel, 'ar'), plan: PLAN });
    const dividers = deck.slides.filter(s => s.type === 'divider');
    assert.equal(dividers.length, 1);
    assert.equal(dividers[0]!.content, 'جولة المراجعة');
  });
});

describe('buildRevisionDeck — nothing that belongs to one lesson', () => {
  it('the detector is not vacuous: a lesson deck trips it', () => {
    const lesson = lessonsInScope(sem1)[0]!;
    const lessonDeck = buildLessonDeck(lesson.titleAr, true, {
      lesson, plan: PLAN, figureUri: () => 'stub://figure',
    });
    assert.ok(lessonOnlySlides(lessonDeck).length > 0);
  });

  it('has no figures slide, no vocabulary / rule / example slide and no exercise-book line', () => {
    assert.deepEqual(lessonOnlySlides(deckOf(PLAN, FIVE_CHECKS)).map(s => s.title), []);
    assert.deepEqual(lessonOnlySlides(deckOf(null)).map(s => s.title), []);
  });

  it('never splices the scope into a lesson-shaped phrase, even with no plan objectives', () => {
    for (const plan of [{ ...PLAN, objectives: [] }, null]) {
      const deck = deckOf(plan);
      const text = JSON.stringify(deck);
      assert.doesNotMatch(text, /درس «|أنهينا درس|ملخص الدرس|مفردات الدرس|غلق الدرس/);
      assert.equal(deck.activityName, `مراجعة ${PHRASE}`);
      assert.equal(deck.learningObjective, plan?.objectives[0] ?? `مراجعة ${PHRASE}`);
    }
  });

  it('in English, too', () => {
    const deck = buildRevisionDeck(false, {
      units: revisionUnits(sem1, 'en'), phrase: revisionPhrase(sem1, 'en'), plan: null,
    });
    assert.equal(deck.slides[0]!.title, `Revision: ${revisionPhrase(sem1, 'en')}`);
    assert.doesNotMatch(JSON.stringify(deck), /Lesson Summary|Key Vocabulary|Teach “|We finished/);
  });
});

describe('buildRevisionDeck — the checks and the plan', () => {
  it('places the generated questions: two mid-session after the rounds, three as the exit ticket', () => {
    const deck = deckOf(PLAN, FIVE_CHECKS);
    const mid = deck.slides.filter(s => s.title.startsWith('✋ تحقّق سريع'));
    const exit = deck.slides.filter(s => s.title.startsWith('🎫 غلق الحصة'));
    assert.deepEqual(mid.map(s => s.content), ['سؤال رقم 1؟', 'سؤال رقم 2؟']);
    assert.deepEqual(exit.map(s => s.content), ['سؤال رقم 3؟', 'سؤال رقم 4؟', 'سؤال رقم 5؟']);
    assert.deepEqual(mid[0]!.options, ['أ1', 'ب1', 'ج1', 'د1']);
    const lastRound = deck.slides.map(s => s.title).lastIndexOf(`💡 ${UNITS[UNITS.length - 1]!.title}`);
    assert.ok(lastRound >= 0 && deck.slides.indexOf(mid[0]!) > lastRound, 'checks follow the last round');
    const summary = deck.slides.findIndex(s => s.type === 'summary');
    assert.ok(deck.slides.indexOf(exit[0]!) > summary, 'the exit ticket follows the summary');
    assert.ok(deck.answerKey.some(k => k.includes('ب1')), 'the answer key is rebuilt from the slides');
  });

  it('projects the scope; the plan\'s introduction (what is left out) goes to the teacher', () => {
    const deck = deckOf(PLAN_NO_QUESTION);
    const scopeSlide = deck.slides[1]!;
    assert.equal(scopeSlide.title, '🗂️ ما نراجعه اليوم');
    for (const u of UNITS) assert.ok(scopeSlide.content.includes(u.title), u.title);
    assert.equal(scopeSlide.teacher?.teachingTips, PLAN_NO_QUESTION.introduction);
    assert.ok(!deck.slides.some(s => s.title === '✨ تمهيد'), 'no question, no warm-up slide');
  });

  it('lifts the plan\'s warm-up question, and then carries the introduction there instead', () => {
    const deck = deckOf(PLAN);
    const warm = deck.slides.find(s => s.title === '✨ تمهيد')!;
    assert.equal(warm.content, 'ما أصعب فكرة مرّت بنا هذا الفصل؟');
    assert.ok(warm.teacher?.teachingTips?.includes(PLAN.introduction));
    assert.equal(deck.slides[1]!.teacher?.teachingTips, undefined);
  });

  it('still makes a numbered deck with a summary when the plan failed and no checks came', () => {
    const deck = deckOf(null);
    assert.deepEqual(deck.slides.map(s => s.slideNumber), deck.slides.map((_, i) => i + 1));
    assert.ok(deck.slides.length >= 2 + UNITS.length * 2 + 1);
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.ok(summary.content.startsWith('راجعنا اليوم:'));
    for (const u of UNITS) assert.ok(summary.content.includes(u.title));
  });
});
```

These tests are not vacuous, and each can be shown to fail by a specific mutation of the implementation:
- Emitting one combined slide for all units fails the first test.
- Delegating to `buildLessonDeck(phrase, isAr, { lesson: null, plan })` fails the rounds test, because no unit divider is produced.
- Copying the lesson deck's `learningObjective` fallback fails the splice test.
- Placing the checks before the rounds fails the placement test.
- Dropping the `!hasWarmup` guard fails the warm-up test (the introduction then appears on both slides).

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/revisionDeck.test.ts`
Expected: the test fails to load with `SyntaxError: The requested module '../lessonSlides.ts' does not provide an export named 'buildRevisionDeck'`.

- [ ] **Step 3: Implement `buildRevisionDeck`**

In `artifacts/mobile/services/lessonSlides.ts`, directly after the line `import type { KBLesson } from './knowledgeBase.ts';`, add:

```ts
import type { RevisionUnit } from './revisionScope.ts';
```

This is type-only, so `node --test` erases it and the module gains no runtime import. Then append the following at the **end of the file**, after `splitExample`:

```ts
// ─── Revision deck — a unit, a semester or the whole book ─────────────────

/** What a unit / semester / whole-book deck is built from — see `buildRevisionDeck`. */
export interface RevisionDeckOptions {
  /** The units in scope, in book order — `ScopeRequest.units` (`revisionUnits`). */
  units: readonly RevisionUnit[];
  /** `revisionPhrase(sel, lang)` — «موضوعات الفصل الأول»: a noun phrase, used inside the title. */
  phrase: string;
  /** The wide (revision) plan; null when its call failed — the units alone still make a deck. */
  plan?: LessonPlanOutput | null;
  /** The wide quick-check's slides, already generated. The deck places them; it never invents one. */
  checks?: ActivitySlide[];
  subject?: string;
  grade?: string;
  /** Practice and homework slides, as on a lesson deck. */
  includePractice?: boolean;
}

/**
 * A projectable deck for ONE revision session over several units.
 *
 * Not a branch of `buildLessonDeck`. That builder is book-first around one
 * `KBLesson`, and a wide scope has none: handed `lesson: null` it keeps only
 * the plan's connective tissue and never projects the plan's main activity, so
 * a semester deck had no unit in it at all — and its fallbacks splice the title
 * into lesson-shaped sentences («شرح درس «…» على الشاشة», «أنهينا درس «…»»).
 * Kept separate, the lesson deck is untouched byte for byte.
 *
 * Slide by slide: the title; what the session covers (the unit names — the
 * plan's introduction, which states what is left out, goes to the teacher); the
 * plan's goals; its warm-up question when it asks one; per unit a divider and
 * one slide of that unit's official outcomes and key ideas, straight from the
 * curriculum data; the checks; the plan's practice (teacher-led, as on a lesson
 * deck); a summary naming the units; the exit ticket; the plan's homework.
 *
 * Never: book figures, vocabulary, rules, worked examples, a graph or chart, or
 * an exercise-book reference — each belongs to one lesson.
 */
export function buildRevisionDeck(isAr: boolean, opts: RevisionDeckOptions): ClassroomActivity {
  const { units, plan = null } = opts;
  const includePractice = opts.includePractice !== false;
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const phrase = nonEmpty(opts.phrase);
  const title = phrase ? L(`مراجعة ${phrase}`, `Revision: ${phrase}`) : L('حصة مراجعة', 'Revision session');
  const subject = nonEmpty(opts.subject) || nonEmpty(plan?.subject);
  // No «الصف العاشر» default here: a wrong grade on a revision cover is worse than none.
  const grade = nonEmpty(opts.grade) || nonEmpty(plan?.grade);
  const unitList = units.map(u => nonEmpty(u.title)).filter(Boolean).map(u => `• ${u}`).join('\n');

  const slides: ActivitySlide[] = [];
  const push = (slide: Omit<ActivitySlide, 'slideNumber'>) => {
    slides.push({ ...slide, slideNumber: slides.length + 1 } as ActivitySlide);
  };
  const { mid: midChecks, exit: exitChecks } = splitChecks(opts.checks);

  // The warm-up projects only a question the plan actually asks — the same rule
  // as the lesson deck's §3. When it does, its slide carries the introduction.
  const intro = nonEmpty(plan?.introduction);
  const warm = intro ? splitWarmup(intro) : null;
  const hasWarmup = !!warm && warm.notes.length > 0;

  // ── 1. Title ────────────────────────────────────────────────────────────
  push({
    type: 'intro',
    title,
    content: subject && grade ? `${subject} · ${grade}` : subject || grade,
    durationSeconds: 0,
  });

  // ── 2. What the session covers ──────────────────────────────────────────
  if (unitList) {
    push({
      type: 'intro',
      title: L('🗂️ ما نراجعه اليوم', '🗂️ What we revise today'),
      content: unitList,
      durationSeconds: 0,
      teacher: {
        expectedAnswer: L('لا إجابة محددة — الغرض أن يعرف الطلبة ما تشمله المراجعة.',
          'No set answer — the point is that the class knows what the revision covers.'),
        ...(intro && !hasWarmup ? { teachingTips: intro } : {}),
      },
    });
  }

  // ── 3. Goals ────────────────────────────────────────────────────────────
  const objectives = bullets(plan?.objectives);
  if (objectives.length > 0) {
    push({
      type: 'intro',
      title: L('🎯 أهداف المراجعة', '🎯 Revision Goals'),
      content: objectives.map(o => `• ${o}`).join('\n'),
      durationSeconds: 0,
    });
  }

  // ── 4. Warm-up ──────────────────────────────────────────────────────────
  if (warm && hasWarmup) {
    push({
      type: 'intro',
      title: L('✨ تمهيد', '✨ Warm-up'),
      content: warm.projected,
      durationSeconds: 0,
      teacher: {
        expectedAnswer: L('لا توجد إجابة واحدة — الهدف تفعيل المعرفة السابقة.',
          'No single answer — the point is to activate prior knowledge.'),
        teachingTips: [warm.notes, L('اسأل ثم انتظر بصمت خمس ثوانٍ قبل استقبال أي إجابة.',
          'Ask, then wait five silent seconds before taking any answer.')].join('\n\n'),
      },
    });
  }

  // ── 5. One round per unit, in book order ────────────────────────────────
  // The unit's own outcomes and key ideas, as the curriculum states them —
  // `RevisionUnit` already caps each at three, one per lesson first.
  units.forEach((unit, i) => {
    const unitTitle = nonEmpty(unit.title);
    if (!unitTitle) return;
    push({
      type: 'divider',
      title: unitTitle,
      content: units.length > 1
        ? L(`الجولة ${i + 1} من ${units.length}`, `Round ${i + 1} of ${units.length}`)
        : L('جولة المراجعة', 'Revision round'),
      durationSeconds: 0,
    });
    const lessonTitles = unit.lessons.map(l => nonEmpty(l.title)).filter(Boolean);
    const ideas = [...new Set([...unit.outcomes, ...unit.concepts].map(s => nonEmpty(s)).filter(Boolean))].slice(0, 6);
    const shown = ideas.length > 0 ? ideas : lessonTitles.slice(0, 6);
    if (shown.length === 0) return;
    const terms = bullets(unit.terms, 3);
    push({
      type: 'intro',
      title: `💡 ${unitTitle}`,
      content: shown.map(s => `• ${s}`).join('\n'),
      durationSeconds: 0,
      teacher: {
        expectedAnswer: lessonTitles.length > 0
          ? L(`دروس الوحدة في هذه المراجعة: ${lessonTitles.join('، ')}`,
            `This unit's lessons in the revision: ${lessonTitles.join(', ')}`)
          : unitTitle,
        ...(terms.length > 0
          ? { teachingTips: L(`مصطلحات تستحق السؤال عنها: ${terms.join('، ')}`, `Terms worth asking about: ${terms.join(', ')}`) }
          : {}),
      },
    });
  });

  // ── 6. Checks — after the rounds: a generated check is about the scope, not one round ──
  midChecks.forEach((check, i) => {
    push(asCheckSlide(check, L(`✋ تحقّق سريع ${i + 1}`, `Quick Check ${i + 1}`)));
  });

  // ── 7. Practice — teacher-led, as on the lesson deck (§8 there) ─────────
  if (includePractice) {
    const guided = nonEmpty(plan?.guidedPractice);
    if (guided) {
      push({
        type: 'intro',
        title: L('🤝 تدريب موجّه', '🤝 Guided Practice'),
        content: L('لنحلّ هذا معًا خطوة بخطوة.', "Let's work through this together, step by step."),
        durationSeconds: 0,
        teacherLed: true,
        teacher: {
          expectedAnswer: L('لا توجد إجابة واحدة ثابتة — راقب تنفيذ الطلبة ووجّههم أثناء العمل.',
            'There is no single fixed answer — monitor the class and guide them as they work.'),
          teachingTips: guided,
        },
      });
    }
    const independent = nonEmpty(plan?.independentPractice);
    if (independent) {
      push({
        type: 'intro',
        title: L('✍️ تدريب مستقل', '✍️ Independent Practice'),
        content: L('حان دوركم — حاولوا بمفردكم.', "Now it's your turn — try it on your own."),
        durationSeconds: 0,
        teacherLed: true,
        teacher: {
          expectedAnswer: L('تختلف الإجابات باختلاف المسألة المطروحة — راجعها بعد وقت العمل الفردي.',
            'Answers vary with the problem given — review them after independent work time.'),
          teachingTips: independent,
        },
      });
    }
  }

  // ── 8. Summary — the units, which is what the session covered ───────────
  const closure = nonEmpty(plan?.closure);
  push({
    type: 'summary',
    title: L('🎉 ملخص المراجعة', '🎉 Revision Summary'),
    content: unitList ? L(`راجعنا اليوم:\n${unitList}`, `Today we revised:\n${unitList}`) : title,
    durationSeconds: 0,
    teacher: closure ? {
      expectedAnswer: L('لا حاجة لإجابة محددة هنا — المهم أن يذكر الصف ما راجعه.',
        'No specific answer needed — what matters is that the class can say what it revised.'),
      teachingTips: closure,
    } : undefined,
  });

  // ── 9. Exit ticket ──────────────────────────────────────────────────────
  if (exitChecks.length > 0) {
    push({ type: 'divider', title: L('غلق الحصة', 'Exit Ticket'), content: title, durationSeconds: 0 });
    exitChecks.forEach((check, i) => {
      push(asCheckSlide(check, L(`🎫 غلق الحصة ${i + 1}`, `Exit Ticket ${i + 1}`)));
    });
  }

  // ── 10. Homework — the plan's only: no single lesson, so no exercise-book line ──
  const homework = includePractice ? nonEmpty(plan?.homework) : '';
  if (homework) {
    push({ type: 'intro', title: L('🏠 الواجب', '🏠 Homework'), content: homework, durationSeconds: 0 });
  }

  return {
    activityName: title,
    activityType: 'lesson-slides',
    grade,
    subject,
    lesson: title,
    duration: plan?.duration ?? 45,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: objectives[0] ?? title,
    materials: bullets(plan?.materials).length > 0 ? bullets(plan?.materials) : [L('شاشة عرض', 'Projector')],
    teacherPreparation: L(
      'أفكار الوحدات في هذه الشرائح مأخوذة من بيانات المنهاج، وما سواها (التمهيد والتدريب والأسئلة) مولّد — راجعها قبل الحصة وعدّل ما يلزم.',
      'The unit ideas on these slides come from the curriculum data; everything else (warm-up, practice, questions) is generated — review and adjust before class.',
    ),
    teacherNotes: bullets(plan?.differentiation ? [plan.differentiation] : []),
    answerKey: rebuildAnswerKey(slides, isAr),
    printables: [],
    assessment: nonEmpty(plan?.assessment),
    extensionChallenge: '',
    slides,
  };
}
```

`asCheckSlide`, `splitChecks`, `splitWarmup`, `bullets`, `nonEmpty` and `rebuildAnswerKey` are all declared in this same file. `asCheckSlide` is a function declaration, so it is hoisted and can be used here.

- [ ] **Step 4: Run it and confirm it passes; show that the lesson deck is untouched**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/revisionDeck.test.ts services/__tests__/lessonSlides.test.ts`
Expected: every test passes, including all of the existing `lessonSlides.test.ts`.

Run: `cd /home/user/Iqraa && git diff -U0 -- artifacts/mobile/services/lessonSlides.ts | grep -E '^-[^-]' ; echo "removed-lines-exit:$?"`
Expected: it prints only `removed-lines-exit:1`. That means grep found no removed line, so `buildLessonDeck` is byte-identical. If any `-` line shows up, revert that hunk.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/lessonSlides.ts artifacts/mobile/services/__tests__/revisionDeck.test.ts
git commit -m "feat: revision deck — a round per unit for a unit, semester or book"
```
The commit message ends with the two trailers from Global Constraints.

- [ ] **Step 6: Write the failing test for the request bodies**

Create `artifacts/mobile/services/__tests__/slidesRequests.test.ts`:

```ts
/**
 * Slides Maker's three model calls.
 *
 * A lesson deck's bodies must be EXACTLY what the screen built inline before
 * (the shared pool keys on them — a changed body orphans every stored plan and
 * check). A wide deck's plan AND checks carry the scope (the checks call had
 * its own request shape and would otherwise have gone out lesson-shaped, with
 * the scope label for a topic), and the explanation call is not made at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import {
  buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding,
} from '../kbContext.ts';
import { buildLessonTeachingRequest } from '../generatorRequests.ts';
import { regenerationFields } from '../ai/regeneration.ts';
import {
  slidesChecksRequest, slidesPlanRequest, slidesTeachingRequest, type SlidesLessonFields,
} from '../slidesRequests.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { buildRevisionDeck } from '../lessonSlides.ts';
import { aiService } from '../ai/generators.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const grade = getPickerGrades().find(g => g.nameAr === 'الصف العاشر')!;
const subject = getPickerSubjects().find(s => s.name === 'Mathematics')!;
const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const LABEL = 'الفصل الأول كاملًا';

function* grade10MathTopics(): Generator<string> {
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) yield lesson.titleAr.trim();
  }
}
const formFor = (topic: string) => ({ gradeName: grade.nameAr, subjectName: subject.name, topic, isAr: true });
const lessonFieldsFor = (topic: string): SlidesLessonFields => ({
  additionalContext: buildGeneratorContext(topic, 'ar'),
  unitId: generatorUnitId(topic, 'ar'),
  lessonId: generatorLessonId(topic, 'ar'),
  bookFigureCount: generatorFigureCount(topic, 'ar'),
});

describe('slides requests — a single lesson is unchanged', () => {
  it('sends exactly the plan and checks bodies slides.tsx built inline', () => {
    let checked = 0;
    for (const topic of grade10MathTopics()) {
      const legacyPlan = {
        grade: grade.nameAr, subject: subject.name, topic, language: 'arabic',
        additionalContext: buildGeneratorContext(topic, 'ar'),
        unitId: generatorUnitId(topic, 'ar'),
        lessonId: generatorLessonId(topic, 'ar'),
        bookFigureCount: generatorFigureCount(topic, 'ar'),
        contextSource: 'curriculum',
      };
      const legacyChecks = {
        grade: grade.nameAr, subject: subject.name, topic,
        activityType: 'quick-check', duration: 10, difficulty: 'standard',
        groupType: 'whole-class', teachingGoal: 'assessment', language: 'arabic',
        numQuestions: 5,
        additionalContext: buildGeneratorContext(topic, 'ar'),
        unitId: generatorUnitId(topic, 'ar'),
        lessonId: generatorLessonId(topic, 'ar'),
        contextSource: 'curriculum',
      };
      const plan = slidesPlanRequest(formFor(topic), lessonFieldsFor(topic), null);
      const checks = slidesChecksRequest(formFor(topic), lessonFieldsFor(topic), null);
      assert.deepStrictEqual(plan, legacyPlan, topic);
      assert.deepStrictEqual(checks, legacyChecks, topic);
      // Key order too: the body is serialised as built.
      assert.equal(JSON.stringify(plan), JSON.stringify(legacyPlan), topic);
      assert.equal(JSON.stringify(checks), JSON.stringify(legacyChecks), topic);
      checked++;
    }
    assert.ok(checked >= 20, `expected a real lesson list, got ${checked}`);
  });

  it('asks for the explanation exactly as before', () => {
    const topic = [...grade10MathTopics()][0]!;
    const grounding = resolveGeneratorGrounding(topic, 'ar');
    const regen = regenerationFields(true, { variantId: 'v1' });
    assert.deepStrictEqual(
      slidesTeachingRequest(formFor(topic), grounding, regen, null),
      buildLessonTeachingRequest({ gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' }, grounding, regen),
    );
  });
});

describe('slides requests — a wide scope', () => {
  const wide = buildScopeRequest(sem1, 'ar')!;

  it('the plan and the checks both carry the scope, its digest and its lesson table — and no lesson', () => {
    for (const req of [
      slidesPlanRequest(formFor(LABEL), {}, wide.fields),
      slidesChecksRequest(formFor(LABEL), {}, wide.fields),
    ]) {
      assert.deepEqual(req.scope, wide.fields.scope);
      assert.equal(req.additionalContext, wide.fields.additionalContext);
      assert.ok(req.coverage && req.coverage.lessons.length > 0, 'the lesson table travels');
      assert.equal(req.coverage!.slots, undefined, 'a teaching tool sends no slot plan');
      assert.ok('lessonId' in req && req.lessonId === undefined);
      assert.ok('unitId' in req && req.unitId === undefined);
      assert.equal(req.bookFigureCount, 0);
      assert.equal(req.contextSource, 'curriculum');
    }
    const checks = slidesChecksRequest(formFor(LABEL), {}, wide.fields);
    assert.equal(checks.activityType, 'quick-check');
    assert.equal(checks.numQuestions, 5);
  });

  it('the scope fields win over any lesson fields the screen still held (merged last)', () => {
    const stale: SlidesLessonFields = { additionalContext: 'درس آخر', unitId: 'kbu-x', lessonId: 'kbl-x', bookFigureCount: 3 };
    for (const req of [
      slidesPlanRequest(formFor(LABEL), stale, wide.fields),
      slidesChecksRequest(formFor(LABEL), stale, wide.fields),
    ]) {
      assert.equal(req.lessonId, undefined);
      assert.equal(req.unitId, undefined);
      assert.equal(req.additionalContext, wide.fields.additionalContext);
      assert.equal(req.bookFigureCount, 0);
    }
  });

  it('makes no explanation call: it is single-lesson by design', () => {
    const grounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
    assert.equal(slidesTeachingRequest(formFor(LABEL), grounding, {}, wide.fields), null);
  });

  it('end to end, offline: the wide plan and checks make a deck with a round per unit and its checks', async () => {
    const [plan, checks] = await Promise.all([
      aiService.generateLessonPlan(slidesPlanRequest(formFor(LABEL), {}, wide.fields)),
      aiService.generateClassroomActivity(slidesChecksRequest(formFor(LABEL), {}, wide.fields)).then(a => a.slides),
    ]);
    const deck = buildRevisionDeck(true, {
      units: wide.units, phrase: revisionPhrase(sem1, 'ar'), plan, checks,
      subject: 'الرياضيات', grade: 'الصف العاشر', includePractice: true,
    });
    const rounds = deck.slides.filter(s => s.type === 'divider' && wide.units.some(u => u.title === s.title));
    assert.equal(rounds.length, wide.units.length);
    assert.ok(deck.slides.some(s => s.title.startsWith('✋ تحقّق سريع') || s.title.startsWith('🎫 غلق الحصة')),
      'the offline wide quick-check gave the deck at least one usable check');
    assert.ok(!deck.slides.some(s => s.type === 'media' || !!s.sideImageUrl), 'no book figure');
    assert.doesNotMatch(JSON.stringify(deck), /درس «|لـ ?الفصل الأول كاملًا/);
  });
});
```

The end-to-end test exercises Task 3's and Task 7's offline wide paths through the deck. If it fails on rounds or checks, the defect is in `generateLessonPlan` or the quick-check's wide branch. Fix it there, not by loosening this test.

These tests can be shown to fail by mutation:
- Reordering a key in `slidesPlanRequest` fails the `JSON.stringify` check.
- Spreading the wide fields first fails the merge-last test.
- Making `slidesTeachingRequest` ignore `wide` fails the null test.
- Leaving `wide` off `slidesChecksRequest` fails the first wide test.

- [ ] **Step 7: Run it and confirm it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/slidesRequests.test.ts`
Expected: the test fails to load with `ERR_MODULE_NOT_FOUND` for `services/slidesRequests.ts`.

- [ ] **Step 8: Implement `services/slidesRequests.ts`**

```ts
/**
 * The model calls Slides Maker makes for a deck: its plan, its formative
 * checks, and — for a single lesson only — its explanation.
 *
 * Lifted out of `app/ai-tools/slides.tsx` so `node --test` can pin them. A
 * single-lesson body must stay byte-identical (the shared pool keys on it); a
 * unit / semester / book body must carry the scope on BOTH calls, merged last
 * so its explicit-undefined `lessonId` / `unitId` clear anything lesson-shaped.
 *
 * Free of react-native.
 */
import type { AIRequest, ClassroomActivityRequest } from './ai/AIService.ts';
import { regenerationFields } from './ai/regeneration.ts';
import { buildLessonTeachingRequest } from './generatorRequests.ts';
import type { GeneratorGrounding } from './kbContext.ts';
import { EXIT_TICKET_MAX, MID_LESSON_CHECK_MAX } from './lessonSlides.ts';
import type { ScopeRequestFields } from './wideScopeRequest.ts';

export type SlidesForm = {
  /** Localised grade name — display only, carried into the content verbatim. */
  gradeName: string;
  /** English subject name — the string the generators branch on. */
  subjectName: string;
  /** Trimmed. For a wide scope, its label; nothing re-grounds it. */
  topic: string;
  isAr: boolean;
};

/** What a single-lesson deck anchors its calls to, resolved once by the screen; `{}` for a wide deck. */
export type SlidesLessonFields = {
  additionalContext?: string;
  unitId?: string;
  lessonId?: string;
  bookFigureCount?: number;
};

/** The lesson plan the deck's connective tissue comes from. */
export function slidesPlanRequest(
  form: SlidesForm,
  lesson: SlidesLessonFields,
  wide: ScopeRequestFields | null,
): AIRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic,
    language: form.isAr ? 'arabic' : 'english',
    additionalContext: lesson.additionalContext,
    unitId: lesson.unitId,
    lessonId: lesson.lessonId,
    bookFigureCount: lesson.bookFigureCount,
    contextSource: 'curriculum',
    ...(wide ?? {}),
  };
}

/**
 * The formative checks: two mid-session checks plus a three-question exit
 * ticket, so exactly what the deck places is asked for and nothing is thrown away.
 */
export function slidesChecksRequest(
  form: SlidesForm,
  lesson: SlidesLessonFields,
  wide: ScopeRequestFields | null,
): ClassroomActivityRequest {
  return {
    grade: form.gradeName,
    subject: form.subjectName,
    topic: form.topic,
    activityType: 'quick-check',
    duration: 10,
    difficulty: 'standard',
    groupType: 'whole-class',
    teachingGoal: 'assessment',
    language: form.isAr ? 'arabic' : 'english',
    numQuestions: MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX,
    additionalContext: lesson.additionalContext,
    unitId: lesson.unitId,
    lessonId: lesson.lessonId,
    contextSource: 'curriculum',
    ...(wide ?? {}),
  };
}

/**
 * The explanation section (`/generate/lesson-teaching`), or null for a wide
 * deck: its prompt is single-lesson by design («التزم بهذا الدرس وحده») and it
 * is the one call with no offline twin, so a revision deck does without it.
 */
export function slidesTeachingRequest(
  form: SlidesForm,
  grounding: GeneratorGrounding,
  regen: ReturnType<typeof regenerationFields>,
  wide: ScopeRequestFields | null,
): AIRequest | null {
  if (wide) return null;
  return buildLessonTeachingRequest({
    gradeName: form.gradeName,
    subjectName: form.subjectName,
    topic: form.topic,
    lang: form.isAr ? 'ar' : 'en',
  }, grounding, regen);
}
```

The key order of both bodies is the order `slides.tsx` used inline (lines «grade … contextSource» of the plan call and «grade … contextSource» of the checks call). The checks call has never sent `bookFigureCount`, and it still does not.

- [ ] **Step 9: Run it and confirm it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/slidesRequests.test.ts services/__tests__/lessonTeachingRequest.test.ts`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add artifacts/mobile/services/slidesRequests.ts artifacts/mobile/services/__tests__/slidesRequests.test.ts
git commit -m "feat: slides request bodies — scope on the plan and the checks, no explanation call for a wide deck"
```
The commit message ends with the two trailers from Global Constraints.

- [ ] **Step 11: The screen (`app/ai-tools/slides.tsx`)**

This step cannot be unit-tested, because the file imports react-native. Its logic lives in Steps 3 and 8. Apply each edit by finding the quoted text exactly.

(a) Imports. Replace
```ts
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding } from '@/services/kbContext';
import { buildLessonDeck, EXIT_TICKET_MAX, MID_LESSON_CHECK_MAX } from '@/services/lessonSlides';
```
with
```ts
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
import { buildLessonDeck, buildRevisionDeck } from '@/services/lessonSlides';
```
Then replace
```ts
import { buildLessonTeachingRequest } from '@/services/generatorRequests';
```
with
```ts
import { slidesChecksRequest, slidesPlanRequest, slidesTeachingRequest, type SlidesLessonFields } from '@/services/slidesRequests';
```
Then, directly after `import { nextFrame } from '@/services/nextFrame';`, add
```ts
import { useWideScope } from '@/hooks/useWideScope';
import { revisionPhrase } from '@/services/revisionScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { buildScopeRequest, scopeFormState } from '@/services/wideScopeRequest';
```
Finally, directly after `const ACCENT = palette.primary;`, add
```ts
/** What a unit / semester / book deck is anchored to: the scope itself, never one lesson its label happens to match. */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
```

(b) Params. Replace
```ts
    savedId?: string;
    includeExamples?: string; includePractice?: string; includeAttachments?: string;
  }>();
```
with
```ts
    savedId?: string;
    includeExamples?: string; includePractice?: string; includeAttachments?: string;
    // A saved wide deck's scope (`scopeFormState`), so a reopen restores it.
    scope?: string;
  }>();
```

(c) Scope state, and the lesson id the side panels read. Replace
```ts
  useWarmGrounding(topic, lang);
  // Live as the teacher types, not gated behind pressing Generate — same
  // timing as `LessonResources`' own `topic` prop just below it.
  const groundedLessonId = useMemo(
    () => resolveGeneratorGrounding(topic.trim(), lang).lesson?.id ?? '',
    [topic, lang],
  );
```
with
```ts
  useWarmGrounding(topic, lang);
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /**
   * The unit / semester / book the deck on screen was built for — what Save
   * records and a reopen restores. Frozen at generation, like `generated`.
   */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(
    () => (wideScope.isWide ? wideScope.scopeSel : null),
  );
  // Live as the teacher types, not gated behind pressing Generate — same
  // timing as `LessonResources`' own `topic` prop just below it. Empty for a
  // wide scope: the lookup is unscoped, and a unit title lands on another
  // grade's lesson, whose attachments and lab items would then be offered.
  const groundedLessonId = useMemo(
    () => (wideScope.isWide ? '' : resolveGeneratorGrounding(topic.trim(), lang).lesson?.id ?? ''),
    [topic, lang, wideScope.isWide],
  );
```

(d) Save. Replace
```ts
    return {
      gradeIdx: s.gradeIdx, subjectIdx: s.subjectIdx, topic: s.topic,
      ...(generated?.options ?? { includeExamples, includePractice, includeAttachments }),
    };
```
with
```ts
    return {
      gradeIdx: s.gradeIdx, subjectIdx: s.subjectIdx, topic: s.topic,
      ...(generated?.options ?? { includeExamples, includePractice, includeAttachments }),
      // From the frozen scope, not the live picker. A lesson deck records nothing
      // here, as before; a wide one is then never filed under a lesson (`withLessonId`).
      ...scopeFormState(wideFrozen, 'balanced'),
    };
```

(e) Reopen. Replace
```ts
      const regrounded = reopenedGenerationScope(initialScope, topic, lang);
```
with
```ts
      // A wide deck is anchored to its scope: its label («الفصل الأول كاملًا», a
      // unit title) is never looked up again — it grounds to some lesson.
      const regrounded = wideFrozen && topic.trim()
        ? captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING)
        : reopenedGenerationScope(initialScope, topic, lang);
```
Then, in the same effect, replace
```ts
      setGroundedLesson(scope.lesson ? (deckIsAr(scope) ? scope.lesson.titleAr : scope.lesson.titleEn) : '');
```
with
```ts
      setGroundedLesson(wideFrozen
        ? scopeLabel(wideFrozen, deckIsAr(scope) ? 'ar' : 'en')
        : scope.lesson ? (deckIsAr(scope) ? scope.lesson.titleAr : scope.lesson.titleEn) : '');
```
`wideFrozen` here is the first render's value, which is the restored scope. `workspace.adopt(id, loaded, deckIdentity(loaded, scope))` already follows these lines, so it now adopts under the wide-captured scope. It needs no edit.

(f) The grade/subject reset. Replace
```ts
      setGenerated(null);
      setTeachingVariantId(undefined);
```
with
```ts
      setGenerated(null);
      setWideFrozen(null);
      setTeachingVariantId(undefined);
```
This pair occurs only in the reset effect; there is exactly one `setGenerated(null);` in the file.

(g) Snapshot and restore. In `type DeckSnapshot = {`, replace
```ts
    generated: typeof generated;
    teachingVariantId: string | undefined;
```
with
```ts
    generated: typeof generated;
    wideFrozen: ScopeSelection | null;
    teachingVariantId: string | undefined;
```
In `restoreDeck`, replace
```ts
    setGenerated(prev.generated);
    setTeachingVariantId(prev.teachingVariantId);
```
with
```ts
    setGenerated(prev.generated);
    setWideFrozen(prev.wideFrozen);
    setTeachingVariantId(prev.teachingVariantId);
```
In `generate`, in the `previous` snapshot object, replace
```ts
      generated,
      teachingVariantId,
      verifyDone,
```
with
```ts
      generated,
      wideFrozen,
      teachingVariantId,
      verifyDone,
```

(h) `generate()`: validation. Replace
```ts
    const conflict = groundedSubjectConflict(trimmed, lang, subjects[subjectIdx].id);
    if (conflict) { refuse(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
```
with
```ts
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson
    // only. A wide scope that cannot be grounded is refused, never built mislabeled.
    const wideSel = wideScope.isWide ? wideScope.scopeSel! : null;
    const wide = wideSel ? buildScopeRequest(wideSel, lang) : null;
    if (wideSel && !wide) { refuse(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(trimmed, lang, subjects[subjectIdx].id);
      if (conflict) { refuse(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
```

(i) `generate()`: grounding. Replace
```ts
    const grounding = resolveGeneratorGrounding(trimmed, lang);
    const generatorContext = buildGeneratorContext(trimmed, lang);
    const unitId = generatorUnitId(trimmed, lang);
    const lessonId = generatorLessonId(trimmed, lang);
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');
```
with
```ts
    // A wide deck never grounds its label: these lookups are unscoped, and a
    // unit title lands on another grade's lesson (piece 2 measured 18 of 35).
    const grounding = wide ? WIDE_GROUNDING : resolveGeneratorGrounding(trimmed, lang);
    const lessonFields: SlidesLessonFields = wide ? {} : {
      additionalContext: buildGeneratorContext(trimmed, lang),
      unitId: generatorUnitId(trimmed, lang),
      lessonId: generatorLessonId(trimmed, lang),
      bookFigureCount: generatorFigureCount(trimmed, lang),
    };
    const form = {
      gradeName: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
      subjectName: subjects[subjectIdx].name,
      topic: trimmed,
      isAr,
    };
    setGrounded(grounding.grounded);
    setGroundedLesson(wideSel
      ? scopeLabel(wideSel, lang)
      : grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');
```
The preliminary book-only draft (`if (grounding.lesson) { … }`) needs no edit, because `WIDE_GROUNDING.lesson` is `null`.

(j) The checks call. Replace
```ts
      const checksPromise = aiService
        .generateClassroomActivity({
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          activityType: 'quick-check',
          duration: 10,
          difficulty: 'standard',
          groupType: 'whole-class',
          teachingGoal: 'assessment',
          language: isAr ? 'arabic' : 'english',
          // Two mid-lesson checks plus a three-question exit ticket. Asking
          // for exactly what the deck places means no question is generated
          // and then thrown away.
          numQuestions: MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX,
          // The same anchoring the teaching and plan calls send. Without the
          // ids the server re-inferred the unit from the title — the lesson-
          // title trap in CLAUDE.md — and wrote checks for a neighbouring one.
          additionalContext: generatorContext,
          unitId,
          lessonId,
          contextSource: 'curriculum',
        }, { signal: controller.signal })
        .then(a => a.slides)
        .catch((): ActivitySlide[] => []);
```
with
```ts
      // The body (and why it asks for exactly five) is `slidesChecksRequest`.
      // The same anchoring the plan call sends: without the ids the server
      // re-inferred the unit from the title and wrote checks for a neighbouring
      // one; a wide deck sends its scope on this call too.
      const checksPromise = aiService
        .generateClassroomActivity(slidesChecksRequest(form, lessonFields, wide?.fields ?? null), { signal: controller.signal })
        .then(a => a.slides)
        .catch((): ActivitySlide[] => []);
```
Keep the comment block above `const checksPromise` as it is.

(k) The explanation call. Replace
```ts
      const teachingPromise = aiService
        .generateLessonTeaching(buildLessonTeachingRequest({
          gradeName: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subjectName: subjects[subjectIdx].name,
          topic: trimmed,
          lang,
        }, grounding, regen), { signal: controller.signal })
        .catch((): LessonTeachingOutput | null => null);
```
with
```ts
      // Not for a wide deck: the prompt is single-lesson by design and the call
      // has no offline twin (`slidesTeachingRequest` answers null).
      const teachingReq = slidesTeachingRequest(form, grounding, regen, wide?.fields ?? null);
      const teachingPromise = teachingReq
        ? aiService
          .generateLessonTeaching(teachingReq, { signal: controller.signal })
          .catch((): LessonTeachingOutput | null => null)
        : Promise.resolve<LessonTeachingOutput | null>(null);
```

(l) The plan call. Replace
```ts
        lessonPlan = await aiService.generateLessonPlan({
          // Localised: this string is carried into generated content verbatim —
          // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
          // compared anywhere, only displayed and passed through, so translating it
          // is safe. `subject` is deliberately left in English: it feeds
          // isMathContext and ~30 other call sites.
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: generatorContext,
          unitId,
          lessonId,
          bookFigureCount: generatorFigureCount(trimmed, lang),
          contextSource: 'curriculum',
        }, { signal: controller.signal });
```
with
```ts
        // `form.gradeName` is localised (it is carried into the content
        // verbatim); `form.subjectName` stays English — it feeds isMathContext.
        lessonPlan = await aiService.generateLessonPlan(
          slidesPlanRequest(form, lessonFields, wide?.fields ?? null),
          { signal: controller.signal },
        );
```
After (i)–(l), the identifiers `generatorContext`, `unitId` and `lessonId` no longer exist in `generate`. Run `grep -n "generatorContext\|[^.]unitId,\|[^.]lessonId," app/ai-tools/slides.tsx`; it must print nothing.

(m) A wide deck survives a failed plan. Replace
```ts
      if (!lessonPlan && !grounding.lesson) {
```
with
```ts
      // A wide deck is still built from its units (curriculum data, as the book
      // is for a lesson deck) when the plan fails.
      if (!lessonPlan && !grounding.lesson && !wide) {
```

(n) Build the deck. Replace
```ts
      const builtBase = buildLessonDeck(trimmed, isAr, {
```
with
```ts
      const builtBase = wide
        // A unit / semester / book deck: the plan's introduction, a round per
        // unit, the checks and the closure — no lesson, so no figures,
        // vocabulary, rules or worked examples (`buildRevisionDeck`).
        ? buildRevisionDeck(isAr, {
          units: wide.units,
          phrase: revisionPhrase(wideSel!, lang),
          plan: lessonPlan,
          checks,
          subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
          grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
          includePractice,
        })
        : buildLessonDeck(trimmed, isAr, {
```
Leave the original `buildLessonDeck` option lines and its closing `});` unchanged; the ternary closes on that `});`. Then replace
```ts
      const built = {
        ...builtBase,
        slides: insertLabSlides(
          insertLessonResources(builtBase.slides, attachedResources, isAr),
          labSlidesFor(labPicks, isAr),
        ),
      };
```
with
```ts
      // The teacher's pinned resources and lab picks belong to one lesson; a
      // wide deck has none, so it takes neither.
      const built = wide ? builtBase : {
        ...builtBase,
        slides: insertLabSlides(
          insertLessonResources(builtBase.slides, attachedResources, isAr),
          labSlidesFor(labPicks, isAr),
        ),
      };
```
Then, directly after the `setGenerated({ scope: captureGenerationScope(…), options: { … } });` statement, add
```ts
      setWideFrozen(wideSel);
```

(o) Media. Replace
```ts
          const wantVideo = shouldSearchForVideo(attachedResources);
```
with
```ts
          // No video for a wide deck: one explainer cannot stand for a semester,
          // and the query would be the scope label. The photos still come.
          const wantVideo = !wide && shouldSearchForVideo(attachedResources);
```

(p) The form. In the `<TopicSelector` element, replace
```tsx
            onChange={v => { setTopic(v); setError(''); setValidationError(''); }}
            lang={lang}
```
with
```tsx
            onChange={v => { setTopic(v); setError(''); setValidationError(''); }}
            allowedKinds={['lesson', 'unit', 'semester', 'book']}
            onScopeChange={wideScope.setScopeSel}
            offlineWideScope
            lang={lang}
```
Then replace
```tsx
          <LessonResources topic={topic.trim()} onChange={setAttached} />
```
with
```tsx
          {/* Keyed by the topic string: for a wide scope that is the label, shared
              by every grade's «الكتاب كاملًا». Nothing to pin to. */}
          {!wideScope.isWide && <LessonResources topic={topic.trim()} onChange={setAttached} />}
```
`LessonAttachments` and `LessonLabItems` stay as they are; they render nothing for the empty `groundedLessonId` from (c). Then replace
```tsx
            <Toggle label={t('slidesIncludeExamples')} value={includeExamples} onChange={setIncludeExamples} />
            <Toggle label={t('slidesIncludePractice')} value={includePractice} onChange={setIncludePractice} />
            {hasAttachments ? (
```
with
```tsx
            {/* A wide deck has no book examples and takes no attachments (see generate). */}
            {!wideScope.isWide && (
              <Toggle label={t('slidesIncludeExamples')} value={includeExamples} onChange={setIncludeExamples} />
            )}
            <Toggle label={t('slidesIncludePractice')} value={includePractice} onChange={setIncludePractice} />
            {hasAttachments && !wideScope.isWide ? (
```

- [ ] **Step 12: Typecheck, suite, adversarial read-through**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors and 0 test failures.

Then read the diff (`git diff -- artifacts/mobile/app/ai-tools/slides.tsx`) and tick each item:
- [ ] **Lesson path unchanged.** With `wide === null`, `grounding` and `lessonFields` are computed by the same four functions with the same arguments as before. `slidesPlanRequest` and `slidesChecksRequest` receive `null`, so Step 6 pins them to the legacy bodies. `slidesTeachingRequest` returns `buildLessonTeachingRequest(…)` with the same form, grounding and `regen`. The `buildLessonDeck` call and the resource/lab insertion are as before.
- [ ] **No lookup on a wide label.** `resolveGeneratorGrounding`, `buildGeneratorContext`, `generatorUnitId`, `generatorLessonId` and `generatorFigureCount` are reachable in `generate` only when `wide` is null. The `groundedLessonId` memo returns `''` when `wideScope.isWide`. The reopen effect uses `WIDE_GROUNDING` when `wideFrozen`. `grep -n "resolveGeneratorGrounding\|reopenedGenerationScope" app/ai-tools/slides.tsx` lists exactly three sites (the memo, the reopen, `generate`), and every one is guarded.
- [ ] **Validation.** `groundedSubjectConflict` is skipped for a wide scope only. An ungrounded wide scope is refused through `refuse(...)` (the validation line by the form), not through `GenerationStatus`.
- [ ] **The scope rides both calls**, merged last inside the helpers. `generateLessonTeaching` is never called for a wide deck. `teachingVariantId` then stays undefined, so «بلّغ عن مشكلة» stays hidden.
- [ ] **Save** writes `scopeFormState(wideFrozen, …)` from the frozen value, not the live picker. `wideFrozen` is set only after a successful build. It is restored by `restoreDeck` and cleared by the grade/subject reset. Because `formState.scope` is present, `withLessonId` (`services/materialLessonId.ts`) stamps no lesson id.
- [ ] **Reopen.** `params.scope` is typed and `useWideScope(params, { gradeId, subjectId })` guards a stale scope. The grounding notice reads `scopeLabel(...)`. `workspace.adopt` receives the identity built from the wide-captured scope.
- [ ] **Side panels.** `LessonResources` is hidden on a wide scope. `LessonAttachments` and `LessonLabItems` get `''`. The attachments and examples toggles are hidden. A wide deck inserts no resources or lab slides.
- [ ] **Media.** No video search for a wide deck; the photo search is unchanged.
- [ ] **Not applicable.** `noFigures` and `hideRelated` do not apply on this screen. Check with `grep -n "useGeneratorExport\|<GeneratorResultActions" app/ai-tools/slides.tsx`, which must print nothing (Slides has its own `DeckActions`, which has no Related-tools links). No `KeyboardAvoidingView` was added.
- [ ] **No browser.** State in the report that no browser was available, so the scope picker, the deck, Save, reopen and Present were **not** clicked through.

- [ ] **Step 13: Commit**

```bash
git add artifacts/mobile/app/ai-tools/slides.tsx
git commit -m "feat: slides screen — unit, semester and book scopes as a revision deck"
```
The commit message ends with the two trailers from Global Constraints.

---

### Task 9: Lesson-flow — the scope on every step, and no slot plan on the question steps

**Files:**
- Modify: `artifacts/mobile/services/ai/lessonFlowRunner.ts` (add `questionStepFields`; change the `worksheet` and `exitTicket` cases)
- Modify: `artifacts/mobile/app/ai-tools/lesson-flow.tsx`
- Test: `artifacts/mobile/services/__tests__/lessonFlowScope.test.ts` (new; the existing `lessonFlowRunner.test.ts` is unchanged and must still pass)

**Interfaces:**
- Consumes:
  - Task 1: `buildScopeRequest(sel, lang): ScopeRequest | null`, `ScopeRequest`.
  - Task 3: a wide `generateLessonPlan`.
  - Task 5: a wide `generateActivity`, including `activityVariant: 'warmup'`.
  - Piece 2: offline `generateWorksheet` / `generateQuiz` draw from `coverage.lessons` (`offlineWideScope`, which re-plans and never reads `slots`); server `parseCoverage` renders `distribution: 'random'` as uncounted.
  - Existing: `useWideScope`, `scopeFormState`, `RunnerAIService`, `runLessonFlowFrom`.
- Produces: `export function questionStepFields(req: AIRequest): Pick<AIRequest, 'distribution' | 'coverage'>`.

**Facts this task relies on (verified by reading the code):**
- Offline: `offlineWideScope(req, lang, count)` in `services/ai/generators.ts` returns null unless `req.scope` and `req.coverage.lessons` are present. It re-plans with `planCoverage(pool, count, req.distribution ?? 'balanced', …)` and never reads `slots`. An **absent** `distribution` therefore plans *balanced* offline.
- Server: `parseCoverage` (`artifacts/api-server/src/lib/coverage.ts`) yields `counts: null` when `distribution === 'random'` **or** there are no `slots`. The clause then says «وزّع الأسئلة على هذه الدروس اختيارًا عشوائيًا» with no per-lesson counts. `distribution` is in the strict cache key.

So the question steps send `distribution: 'random'` explicitly with the lesson table and no `slots`. The live prompt and the offline plan then agree: both random. The flow's 5 and 3 never meet a plan made for another count. The runner receives the scope the way it receives everything else, as fields on the `req` it already spreads. `questionStepFields` overrides only `distribution` and `coverage`, and only on steps 5–6.

**Reopen, as it really works.** Lesson-flow has no content reload. `app/workspace/view.tsx`'s «تعديل» pushes `/ai-tools/lesson-flow` with `{ savedId, ...item.formState }`, and the screen reads only `topic`, `gradeIdx` and `subjectIdx` to prefill its form (no `savedId` handling). Today's `formState` has neither index, so `scopeFromParams` grounds the topic to guess them. For a wide label that grounding is unscoped and lands on another grade. A wide flow therefore saves its picker positions and `scopeFormState`. The reopened form then comes back on the right grade/subject with the scope restored by `useWideScope(params, …)`, and pressing Build makes a wide flow. Nothing more is invented.

**«ابدأ الحصة»** sends the label to `/ai-tools/classroom`, which would re-ground it. The spec lists this as a known limit that is *not fixed*. This task **hides the button on a wide flow** instead: it is one condition and removes the drift. STATUS (Task 10) records that it is hidden.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/lessonFlowScope.test.ts`:

```ts
/**
 * Lesson-flow on a unit / semester / book scope.
 *
 * Steps 1–3 (plan, warm-up, activity) carry the scope as the request has it.
 * Steps 5–6 (a 5-question worksheet, a 3-question exit ticket) carry the scope
 * and the lesson table, but ask for the `random` distribution and never a slot
 * plan: a plan made for another count would make the live prompt contradict
 * the step's own numQuestions. A single-lesson flow's requests are unchanged.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  questionStepFields, runLessonFlowFrom, STEP_ORDER, type RunnerAIService, type StepKey,
} from '../ai/lessonFlowRunner.ts';
import type { AIRequest } from '../ai/AIService.ts';
import { aiService } from '../ai/generators.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const MOCK_PLAN = {
  title: 'P', grade: 'Grade 10', subject: 'Math', duration: 45, objectives: ['o'], materials: [],
  introduction: 'i', mainActivity: 'm', guidedPractice: 'g', independentPractice: 'ip', closure: 'c',
  assessment: 'a', differentiation: '', homework: '',
};
const MOCK_ACTIVITY = {
  title: 'A', activityType: 'group', totalDuration: 10, objective: 'o', groupSize: 'pairs', materials: [],
  steps: [{ stepNumber: 1, title: 's', description: 'd', durationMin: 10 }], teacherTips: [], differentiation: '', assessment: '',
};
const MOCK_WORKSHEET = { title: 'W', instructions: '', sections: [], answerKey: [] };
const MOCK_QUIZ = { title: 'Q', duration: 10, totalPoints: 0, questions: [] };

const BASE_REQ: AIRequest = { grade: 'Grade 10', subject: 'Mathematics', topic: 'Quadratic Equations', language: 'english' };
const LESSONS = [
  { code: 'L1', id: 'kbl-a', unitId: 'kbu-1', title: 'أ' },
  { code: 'L2', id: 'kbl-b', unitId: 'kbu-2', title: 'ب' },
];
/** A wide request that DOES carry a slot plan, as a caller might: the question steps must drop it. */
const WIDE_REQ: AIRequest = {
  ...BASE_REQ,
  topic: 'الفصل الأول كاملًا',
  scope: { kind: 'semester', scopeKey: 'sem:grade-10:mathematics:1', unitIds: ['u1', 'u2'] },
  coverage: { lessons: LESSONS, slots: ['L1', 'L2', 'L1', 'L2', 'L1'] },
  lessonId: undefined,
  unitId: undefined,
  bookFigureCount: 0,
};

type Seen = { step: StepKey; req: AIRequest };
function recording(): { ai: RunnerAIService; seen: Seen[] } {
  const seen: Seen[] = [];
  const ai: RunnerAIService = {
    generateLessonPlan: async req => { seen.push({ step: 'objectives', req }); return { ...MOCK_PLAN }; },
    generateActivity: async req => {
      seen.push({ step: req.activityVariant === 'warmup' ? 'warmup' : 'activity', req });
      return { ...MOCK_ACTIVITY };
    },
    generateWorksheet: async req => { seen.push({ step: 'worksheet', req }); return { ...MOCK_WORKSHEET }; },
    generateQuiz: async req => { seen.push({ step: 'exitTicket', req }); return { ...MOCK_QUIZ }; },
  };
  return { ai, seen };
}
const noop = { onStepStart: () => {}, onStepDone: () => {} };
const reqFor = (seen: Seen[], step: StepKey) => seen.find(s => s.step === step)!.req;

describe('questionStepFields', () => {
  it('adds nothing to a single-lesson request', () => {
    assert.deepStrictEqual(questionStepFields(BASE_REQ), {});
  });

  it('asks a wide request for random over the lesson table, with no slot plan', () => {
    assert.deepStrictEqual(questionStepFields(WIDE_REQ), { distribution: 'random', coverage: { lessons: LESSONS } });
  });
});

describe('runLessonFlowFrom — what each step is sent', () => {
  it('a single-lesson flow sends exactly what it always did', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', BASE_REQ, ai, {}, noop);
    assert.deepStrictEqual(reqFor(seen, 'worksheet'), { ...BASE_REQ, numQuestions: 5 });
    assert.deepStrictEqual(reqFor(seen, 'exitTicket'), { ...BASE_REQ, numQuestions: 3 });
    assert.deepStrictEqual(reqFor(seen, 'objectives'), BASE_REQ);
  });

  it('steps 1–3 carry the scope and the lesson table as the request has them', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', WIDE_REQ, ai, {}, noop);
    for (const step of ['objectives', 'warmup', 'activity'] as const) {
      const req = reqFor(seen, step);
      assert.deepEqual(req.scope, WIDE_REQ.scope, step);
      assert.equal(req.coverage, WIDE_REQ.coverage, step);
      assert.equal(req.distribution, undefined, step);
      assert.equal(req.lessonId, undefined, step);
    }
  });

  it('steps 5–6 keep the scope but ask for random, with no slots, at their own counts', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', WIDE_REQ, ai, {}, noop);
    for (const [step, n] of [['worksheet', 5], ['exitTicket', 3]] as const) {
      const req = reqFor(seen, step);
      assert.deepEqual(req.scope, WIDE_REQ.scope, step);
      assert.equal(req.distribution, 'random', step);
      assert.deepStrictEqual(req.coverage, { lessons: LESSONS }, step);
      assert.equal(req.numQuestions, n, step);
    }
  });

  it('end to end, offline: a semester flow runs all six steps, and its questions come from the scope', async () => {
    const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
    const wide = buildScopeRequest(sem1, 'ar')!;
    const req: AIRequest = {
      grade: 'Grade 10', subject: 'Mathematics', topic: 'الفصل الأول كاملًا', language: 'arabic', duration: 45,
      ...wide.fields,
    };
    const sent: AIRequest[] = [];
    const live: RunnerAIService = {
      generateLessonPlan: r => { sent.push(r); return aiService.generateLessonPlan(r); },
      generateActivity: r => { sent.push(r); return aiService.generateActivity(r); },
      generateWorksheet: r => { sent.push(r); return aiService.generateWorksheet(r); },
      generateQuiz: r => { sent.push(r); return aiService.generateQuiz(r); },
    };
    const done: StepKey[] = [];
    const out = await runLessonFlowFrom('objectives', req, live, {}, {
      onStepStart: () => {}, onStepDone: key => { done.push(key); },
    });
    assert.deepEqual(done, [...STEP_ORDER]);
    const inScope = new Set(wide.fields.coverage!.lessons.map(l => l.id));
    const worksheetQs = out.worksheet!.sections.flatMap(s => s.questions);
    const tagged = worksheetQs.filter(q => q.lessonId);
    assert.ok(tagged.length >= 3, `only ${tagged.length} worksheet questions say their lesson`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!), `worksheet: foreign lesson ${q.lessonId}`);
    assert.ok(out.exitTicket!.questions.length > 0);
    for (const q of out.exitTicket!.questions) assert.ok(q.lessonId && inScope.has(q.lessonId), `exit ticket: ${q.lessonId}`);
    const questionSteps = sent.filter(r => r.numQuestions === 5 || r.numQuestions === 3);
    assert.equal(questionSteps.length, 2);
    for (const r of questionSteps) assert.equal(r.distribution, 'random');
  });
});
```

These tests can be shown to fail by mutation:
- Removing `...questionStepFields(req)` from the worksheet case leaves `distribution` undefined and the slots still in `coverage`, so the steps 5–6 test fails.
- Spreading `questionStepFields` on steps 1–3 fails the steps 1–3 test, because `distribution` becomes `'random'` there.
- Returning `{ distribution: undefined }` for a lesson request fails `deepStrictEqual(…, {})` and the byte-identity test.
- Dropping `coverage` from the question steps makes the offline worksheet fall back to grounding the label, so the end-to-end lesson-id assertions fail.

The end-to-end test also exercises Tasks 3 and 5 offline. If it fails at `objectives`, `warmup` or `activity`, fix that task's wide branch.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonFlowScope.test.ts`
Expected: the test fails to load with `SyntaxError: The requested module '../ai/lessonFlowRunner.ts' does not provide an export named 'questionStepFields'`.

- [ ] **Step 3: Implement in the runner**

In `artifacts/mobile/services/ai/lessonFlowRunner.ts`, directly before the `// ─── Runner ───` banner comment, add:

```ts
// ─── Wide scope ───────────────────────────────────────────────────────────────

/**
 * What the two question steps (worksheet, exit ticket) change on a wide request.
 *
 * The flow asks for a 5-question worksheet and a 3-question exit ticket whatever
 * count a `coverage.slots` plan was made for, so a plan travelling with the
 * request would have the live prompt state per-lesson counts for another total.
 * These steps ask for the `random` distribution over the lesson table instead:
 * the server renders random with no counts (`parseCoverage`), and the offline
 * generators re-plan from the table (`offlineWideScope`). `distribution` is sent
 * explicitly because the offline planner reads an absent one as `balanced`.
 *
 * `{}` for a single-lesson request, so its body is exactly what it was.
 */
export function questionStepFields(req: AIRequest): Pick<AIRequest, 'distribution' | 'coverage'> {
  if (!req.scope || !req.coverage?.lessons?.length) return {};
  return { distribution: 'random', coverage: { lessons: req.coverage.lessons } };
}
```

Then replace
```ts
          const worksheet = await aiService.generateWorksheet({
            ...req,
            numQuestions: 5,
          });
```
with
```ts
          const worksheet = await aiService.generateWorksheet({
            ...req,
            numQuestions: 5,
            ...questionStepFields(req),
          });
```
and replace
```ts
          const exitTicket = await aiService.generateQuiz({
            ...req,
            numQuestions: 3,
          });
```
with
```ts
          const exitTicket = await aiService.generateQuiz({
            ...req,
            numQuestions: 3,
            ...questionStepFields(req),
          });
```

`AIRequest` is already imported (type-only) at the top of this file. `questionStepFields` adds no runtime import.

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonFlowScope.test.ts services/__tests__/lessonFlowRunner.test.ts`
Expected: all tests pass, and the existing runner tests are unchanged.

- [ ] **Step 5: Commit the runner**

```bash
git add artifacts/mobile/services/ai/lessonFlowRunner.ts artifacts/mobile/services/__tests__/lessonFlowScope.test.ts
git commit -m "feat: lesson-flow runner — question steps ask a wide scope for random, never a slot plan"
```
The commit message ends with the two trailers from Global Constraints.

- [ ] **Step 6: The screen (`app/ai-tools/lesson-flow.tsx`)**

This step cannot be unit-tested, because the file imports react-native.

(a) Imports. Directly after `import { palette } from '@/constants/colors';`, add
```ts
import { useWideScope } from '@/hooks/useWideScope';
import type { AIRequest } from '@/services/ai/AIService';
import type { ScopeSelection } from '@/services/scopeSelection';
import { buildScopeRequest, scopeFormState, type ScopeRequest } from '@/services/wideScopeRequest';
```

(b) Params. Replace
```ts
  const params = useLocalSearchParams<{
    topic?: string; gradeIdx?: string; subjectIdx?: string;
  }>();
```
with
```ts
  const params = useLocalSearchParams<{
    topic?: string; gradeIdx?: string; subjectIdx?: string;
    // A saved wide flow's scope (`scopeFormState`), restored by «تعديل».
    scope?: string;
  }>();
```

(c) State. Directly after `const [durationIdx, setDurationIdx] = useState(0);`, add
```ts
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx]?.id ?? '', subjectId: subjects[subjectIdx]?.id ?? '' });
  /** The unit / semester / book the flow on screen was built for; null for a lesson flow. Save records it. */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(null);
  /** The wide fields every step is built from, held for a Retry (state would be stale inside `executeFlow`). */
  const wideReqRef = useRef<ScopeRequest | null>(null);
```

(d) `handleBuild`. Replace
```ts
    const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('building');
```
with
```ts
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson
    // only. A wide scope that cannot be grounded is refused, never built mislabeled.
    const wideSel = wideScope.isWide ? wideScope.scopeSel! : null;
    const wide = wideSel ? buildScopeRequest(wideSel, lang) : null;
    if (wideSel && !wide) { setError(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    // Frozen for the whole flow: a Retry runs from the same request.
    wideReqRef.current = wide;
    setWideFrozen(wideSel);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('building');
```

(e) `executeFlow`. Replace
```ts
    try {
      const kbCtx = await buildGeneratorContext(topic, lang === 'ar' ? 'ar' : 'en');
      const unitId = generatorUnitId(topic, lang === 'ar' ? 'ar' : 'en');
      const req = {
        grade, subject, topic, language, duration, additionalContext: kbCtx, unitId,
        lessonId: generatorLessonId(topic, lang === 'ar' ? 'ar' : 'en'),
        bookFigureCount: generatorFigureCount(topic, lang === 'ar' ? 'ar' : 'en'),
        // Every step of the flow is built from the lesson alone, so each one
        // can be served from — and fill — the shared pool.
        contextSource: 'curriculum' as const,
      };
```
with
```ts
    try {
      const wide = wideReqRef.current;
      let req: AIRequest;
      if (wide) {
        // A unit / semester / book flow is built from the scope's ids. Its topic
        // is a label and the lookups below are unscoped: a unit title grounds to
        // some lesson, possibly another grade's. The runner keeps the two
        // question steps off any slot plan (`questionStepFields`).
        req = { grade, subject, topic, language, duration, ...wide.fields };
      } else {
        const kbCtx = await buildGeneratorContext(topic, lang === 'ar' ? 'ar' : 'en');
        const unitId = generatorUnitId(topic, lang === 'ar' ? 'ar' : 'en');
        req = {
          grade, subject, topic, language, duration, additionalContext: kbCtx, unitId,
          lessonId: generatorLessonId(topic, lang === 'ar' ? 'ar' : 'en'),
          bookFigureCount: generatorFigureCount(topic, lang === 'ar' ? 'ar' : 'en'),
          // Every step of the flow is built from the lesson alone, so each one
          // can be served from — and fill — the shared pool.
          contextSource: 'curriculum' as const,
        };
      }
```

(f) Save. Replace
```ts
    const title = lang === 'ar'
      ? `مسار درس: ${topic}`
      : `Lesson Flow: ${topic}`;
```
with
```ts
    // A wide flow is a revision session, not one lesson's path.
    const title = wideFrozen
      ? (lang === 'ar' ? `مسار مراجعة: ${topic}` : `Revision Flow: ${topic}`)
      : lang === 'ar'
        ? `مسار درس: ${topic}`
        : `Lesson Flow: ${topic}`;
```
Then replace
```ts
        formState: { grade, subject, topic, language: lang === 'ar' ? 'arabic' : 'english', duration },
```
with
```ts
        formState: {
          grade, subject, topic, language: lang === 'ar' ? 'arabic' : 'english', duration,
          // A wide flow reopens on its scope. Its label grounds to no lesson (or to
          // another grade's), so «تعديل» could not recover the pickers from it:
          // their positions are saved with the scope. A lesson flow saves what it
          // always did. With `scope` present, `withLessonId` stamps no lesson id.
          ...(wideFrozen ? { gradeIdx, subjectIdx, ...scopeFormState(wideFrozen, 'balanced') } : {}),
        },
```

(g) PDF. Replace
```ts
        bookFigureRefsForLesson(
          resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en').lesson?.id,
          lang === 'ar',
        ),
```
with
```ts
        // A wide flow has no single lesson, so no figure appendix: its label
        // would ground (unscoped) to some lesson, possibly another grade's.
        wideFrozen
          ? []
          : bookFigureRefsForLesson(
            resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en').lesson?.id,
            lang === 'ar',
          ),
```

(h) «ابدأ الحصة». Replace
```tsx
            {/* Launch Classroom */}
            <Pressable
              onPress={handleLaunchClassroom}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#4F46E5', opacity: pressed ? 0.85 : 1, flex: 1 }]}
            >
              <Ionicons name="tv-outline" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: 'ReadexPro_600SemiBold' }]} numberOfLines={1}>
                {t('lessonFlowLaunchClassroom')}
              </Text>
            </Pressable>
```
with
```tsx
            {/* Launch Classroom. Not for a wide flow: it hands the topic to the
                classroom builder as a bare label, which that screen would ground
                to one lesson (possibly another grade's). */}
            {!wideFrozen && (
              <Pressable
                onPress={handleLaunchClassroom}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#4F46E5', opacity: pressed ? 0.85 : 1, flex: 1 }]}
              >
                <Ionicons name="tv-outline" size={16} color="#fff" />
                <Text style={[styles.actionBtnText, { fontFamily: 'ReadexPro_600SemiBold' }]} numberOfLines={1}>
                  {t('lessonFlowLaunchClassroom')}
                </Text>
              </Pressable>
            )}
```

(i) The picker. In the `<TopicSelector` element, replace
```tsx
              onChange={setTopic}
              lang={lang}
```
with
```tsx
              onChange={setTopic}
              allowedKinds={['lesson', 'unit', 'semester', 'book']}
              onScopeChange={wideScope.setScopeSel}
              offlineWideScope
              lang={lang}
```

- [ ] **Step 7: Typecheck, suite, adversarial read-through**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15; cd artifacts/mobile && pnpm test 2>&1 | tail -6`
Expected: no new type errors and 0 test failures.

Then read `git diff -- artifacts/mobile/app/ai-tools/lesson-flow.tsx` and tick each item:
- [ ] **Lesson flow unchanged.** The `else` branch builds the same object, with the same keys in the same order, as before. `handleBuild` runs the same `groundedSubjectConflict(topic.trim(), lang, subjectId)` for a lesson. Its `formState` and title are what they were. The PDF figures and «ابدأ الحصة» are untouched for a lesson.
- [ ] **No lookup on a wide label.** `buildGeneratorContext`, `generatorUnitId`, `generatorLessonId`, `generatorFigureCount` and `resolveGeneratorGrounding` run only for a lesson flow. `grep -n "resolveGeneratorGrounding\|generatorLessonId" app/ai-tools/lesson-flow.tsx` lists only guarded sites.
- [ ] **Retry.** `wideReqRef` is set in `handleBuild` before `executeFlow`, and Retry reuses it, so the scope cannot change mid-flow. `wideFrozen` drives Save, the PDF and the button hide, and is set in the same place.
- [ ] **Steps 5–6.** They get `questionStepFields` from the runner; the screen does not repeat it.
- [ ] **Reopen.** `params.scope` is typed. `useWideScope(params, { gradeId, subjectId })` restores it, guarded against a stale book. `scopeFromParams` now finds the saved `gradeIdx`/`subjectIdx` for a wide flow. A lesson flow reopens exactly as before.
- [ ] **No new reopen path.** There was no content reload before and none was added.
- [ ] **Not applicable.** This screen has no `GeneratorResultActions` and no `useGeneratorExport`, so `hideRelated` and `noFigures` do not apply. Check with `grep -n "GeneratorResultActions\|useGeneratorExport" app/ai-tools/lesson-flow.tsx`, which must print nothing. No `KeyboardAvoidingView` was added.
- [ ] **No browser.** State that no browser was available, so build, retry, Save, «تعديل» and the PDF were **not** clicked through.

- [ ] **Step 8: Commit the screen**

```bash
git add artifacts/mobile/app/ai-tools/lesson-flow.tsx
git commit -m "feat: lesson-flow screen — unit, semester and book scopes"
```
The commit message ends with the two trailers from Global Constraints.

---

### Task 10: Record it (`STATUS.md`) and final verification

**Files:**
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: everything Tasks 1–9 landed. The bullet below describes it, and **every claim in it must be checked against the code before committing** (Step 2).

- [ ] **Step 1: Add one bullet at the top of "What works today", and correct two older sentences**

(a) Directly under the heading `## What works today (verified, not assumed)` and its blank line, **before** the bullet that starts `- **Quiz, worksheet, homework and game take a unit, semester or whole book`, insert:

```markdown
- **Lesson plan, slides, activity, lesson-flow and the classroom builder take a
  unit, semester or whole book — as one revision session (2026-10-14; spec
  `docs/superpowers/specs/2026-10-14-wide-scope-teaching-tools-design.md`,
  builds on pieces 1–2).** The five screens used to offer «الوحدة كاملةً» and
  «الكتاب كاملًا» as label strings and re-ground them (on slides, lesson-flow
  and the builder unscoped, so a unit title could land on another grade's
  lesson); they now take the structured scope, add the semester, and never look
  the label up. A wide request carries the scope, the curriculum digest plus
  whatever the teacher typed (which keeps `contextSource: 'teacher'`), and the
  scope's lesson table with no slot plan (`buildScopeRequest`). **A wide scope
  means one selective revision session:** the lesson plan keeps its eight
  sections and runs the main activity as a round per unit in each teaching
  style's own form, its introduction names the scope and what the session leaves
  out, and it offers no prior-knowledge review and no Ministry-form export; every
  activity format (and the warm-up) keeps its structure and draws its content
  across the units, with the regenerate counter keyed by the scope; the
  classroom builder's offline types take a revision phrase («موضوعات الفصل
  الأول») instead of the label; the live prompts get one revision clause each,
  present only with `scope` (a lesson request stays byte-identical, pinned by
  tests). **Slides** builds a wide deck from the wide plan and the wide
  quick-check only (`buildRevisionDeck`): title, the units covered, the plan's
  goals and warm-up question, a divider and an ideas slide per unit (its official
  outcomes and key ideas from the curriculum data), the checks, practice, a
  summary naming the units, the exit ticket and the plan's homework — no book
  figures, vocabulary, rules, worked examples, AI explanation
  (`generateLessonTeaching` is skipped: single-lesson by design), pinned
  resources, uploads, lab items or video search; a failed plan still leaves the
  unit rounds. **Lesson-flow** sends the scope to all six steps, but its 5-question
  worksheet and 3-question exit ticket ask for the `random` distribution with no
  slot plan (`questionStepFields`), so the live prompt never states per-lesson
  counts for another total; a wide flow saves its scope and picker positions
  («تعديل» reopens the form on them — lesson-flow has never reloaded a saved
  flow's content), prints no book figures, is titled «مسار مراجعة», and **hides
  «ابدأ الحصة»**, which would hand the label to the classroom builder. On every
  screen a wide result names its scope in the grounding notice, is not filed
  under a lesson (`withLessonId`), shows no book figures and no Related tools, and
  a saved scope whose grade/subject no longer matches the pickers reads as a
  single lesson (`useWideScope`). Tested: `buildScopeRequest`; the wide lesson
  plan (eight sections, a round per unit for each style, the left-out sentence,
  first-person-future Arabic); every activity format drawing from two or more
  units; the classroom types; the live clauses present only with `scope`;
  `buildRevisionDeck` (a round per unit, no figure or lesson-only slide, the
  checks placed, no lesson-shaped label phrase) and the slides request bodies
  (lesson bodies byte-identical, scope on both calls, no explanation call); the
  runner's step fields and a whole semester flow run offline end to end.
  **Before merging — a manual check nobody has done:** `offlineWideScope` is on
  for all five screens, so the web build (production runs `DEMO_MODE`) offers the
  unit, semester and book entries the moment this merges, and they were never
  run in a browser (none in the build container). **Someone must click through
  each of the five screens on the web preview before merging**: pick a unit, a
  semester and the whole book; generate; Regenerate; Save; reopen from موادي;
  export — and on slides, Present; on lesson-flow, a Retry and the PDF.
  **Not verified / known limits:** the screens are checked by reading and
  typecheck only; the live model's adherence to the revision clause is
  untestable here; the "what is left out" sentence is the model's / offline
  builder's own statement and is not checked against the lessons. Presentation →
  whiteboard still passes the deck's or activity's `lesson` field (the scope
  label, or «مراجعة موضوعات …» for a deck) as a bare topic, which the
  whiteboard can re-ground; lesson-flow's «ابدأ الحصة» is hidden on a wide
  flow rather than fixed. A reopened wide material keeps its scope but
  `TopicSelector`'s dropdowns show their placeholders. A wide deck has less
  per-concept narration than a lesson deck (no explanation call), and a unit
  round shows at most three outcomes and three key ideas. On lesson-flow the
  random question steps need not touch every unit. The infographic and the chat
  (`iqra.tsx`) still take a label; evaluations (exams) still take one lesson.
```

(b) In the piece-2 bullet (the one beginning `- **Quiz, worksheet, homework and game take a unit, semester or whole book`), replace
```markdown
  re-ground to a lesson); the game has no Related panel. Evaluations (exams) still take a
  single lesson, and so do lesson plan, slides, activity, lesson-flow,
  infographic and the classroom builder (piece 3). Papers above 30 questions
  are not built.
```
with
```markdown
  re-ground to a lesson); the game has no Related panel. Evaluations (exams) and
  the infographic still take a single lesson (the five teaching tools took the
  same scopes in piece 3 — the bullet above). Papers above 30 questions
  are not built.
```

(c) In the foundation bullet (the one beginning `- **Wide-scope selection, foundation only (2026-10-13; spec`), replace
```markdown
  **Since 2026-10-14 quiz, worksheet, homework and game opt in** (the bullet above);
  every other screen still does not, so there «الوحدة كاملةً» sets the unit
  title as the topic, which `resolveGeneratorGrounding` grounds to one lesson or
  none (not to the unit), and «الكتاب كاملًا» stays ungrounded — its topic text
  matches nothing. **Piece 3 (the rest) still has to adopt `onScopeChange` +
  `scopeRequestFields`.** Restoring a saved / reopened scope (spec §6, goal 5)
  is wired for those four via `parseScope`, with the limits in the bullet above.
```
with
```markdown
  **Since 2026-10-14 quiz, worksheet, homework and game opt in, and so do lesson
  plan, slides, activity, lesson-flow and the classroom builder** (the two
  bullets above). Only the chat (`iqra.tsx`) still does not, so there «الوحدة
  كاملةً» sets the unit title as the topic, which `resolveGeneratorGrounding`
  grounds to one lesson or none (not to the unit), and «الكتاب كاملًا» stays
  ungrounded — its topic text matches nothing. Restoring a saved / reopened
  scope (spec §6, goal 5) is wired via `parseScope` on the screens that read
  `scope` from their route, with the limits in the bullets above.
```

Each of the three anchors is quoted from the current `STATUS.md`. Another session has uncommitted edits in that file, so match on the text, not on line numbers. If an anchor no longer matches exactly, find the sentence it quotes and make the same correction.

- [ ] **Step 2: Verify every claim in the new bullet against the code (mandatory)**

The bullet describes Tasks 3–7, which were written by other sections. Run each check below from `artifacts/mobile` (or the repo root where shown). When a check does not hold, **change the bullet** to what the code does. Do not change the code here. Record each change in the commit message body.

| Claim | Check (must hold) |
| --- | --- |
| The five screens take the structured scope plus the semester | `grep -c "allowedKinds={\['lesson', 'unit', 'semester', 'book'\]}" app/ai-tools/{lesson-plan,slides,activity,lesson-flow}.tsx app/ai-tools/classroom/builder.tsx` gives 1 for each file; the same for `onScopeChange={` and `offlineWideScope` |
| …and never look the label up | on each of the five screens, every `resolveGeneratorGrounding(` / `buildGeneratorContext(` / `generatorLessonId(` / `generatorUnitId(` / `generatorFigureCount(` call is unreachable when the scope is wide (read each site) |
| Teacher text keeps `'teacher'` | `buildScopeRequest`'s test asserts `contextSource: 'teacher'` when `own.contextSource === 'teacher'` (`grep -n "teacher" services/__tests__/*ScopeRequest*.test.ts services/__tests__/wideScopeRequest.test.ts`) |
| Eight sections, a round per unit per style, introduction names scope and left-out | the Task 3 test file asserts all three for `direct`, `inquiry`, `collaborative` |
| No prior-review and no Ministry export on a wide plan | `grep -n "isWide\|wideFrozen" app/ai-tools/lesson-plan.tsx` shows both controls guarded |
| Activity formats draw across units; counter keyed by scope | Task 5's test asserts at least 2 units per format; `grep -n "scopeKey" services/ai/generators.ts` near `nextActivityVariant` |
| Classroom offline types take a revision phrase | `grep -n "revisionPhrase" services/ai/*.ts services/*.ts` reaches the classroom generator |
| Live clause present only with `scope`; lesson prompt byte-identical | `grep -n "revisionClause" artifacts/api-server/src/lib/*.ts` and the api-server tests with `replace(clause, '')` identity |
| Slides deck content, no explanation call | `services/__tests__/revisionDeck.test.ts`, `slidesRequests.test.ts`; `grep -n "slidesTeachingRequest" app/ai-tools/slides.tsx` |
| Lesson-flow steps 5–6 random, no slots; saves scope + pickers; button hidden; no PDF figures | `services/__tests__/lessonFlowScope.test.ts`; `grep -n "wideFrozen" app/ai-tools/lesson-flow.tsx` shows Save, PDF and the button |
| Wide result shows no Related tools and no figures | on lesson-plan and activity: `grep -n "hideRelated=\|noFigures:" app/ai-tools/{lesson-plan,activity}.tsx`; on the builder, whatever Related/figure surface it has is hidden (read it; if it has none, the sentence still holds) |
| Stale saved scope reads as a lesson | `grep -n "useWideScope(params, {" app/ai-tools/{lesson-plan,slides,activity,lesson-flow}.tsx app/ai-tools/classroom/builder.tsx`. If the builder calls `useWideScope({}, …)` (no reopen, like `game.tsx`), the foundation-bullet sentence in (c) still holds; the new bullet's "a saved scope … reads as a single lesson" then applies to the four screens, so say so |
| Not filed under a lesson | each screen's saved `formState` spreads `scopeFormState(` (`grep -n "scopeFormState(" app/ai-tools/{lesson-plan,slides,activity,lesson-flow}.tsx app/ai-tools/classroom/builder.tsx`) |

- [ ] **Step 3: Full verification — run each command and read the output**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd /home/user/Iqraa/artifacts/mobile && pnpm test
cd /home/user/Iqraa/artifacts/api-server && pnpm build && pnpm test
cd /home/user/Iqraa && git diff --stat origin/main -- artifacts/mobile/app
```

Expected:
- **Typecheck** is clean. If it is not, it shows only errors that already existed; state how many, and confirm that none mentions a file this plan touched.
- **Mobile `pnpm test`** reports 0 failures (about 4 minutes), including `revisionDeck.test.ts`, `slidesRequests.test.ts`, `lessonFlowScope.test.ts` and the unchanged `lessonSlides.test.ts`, `lessonFlowRunner.test.ts` and `lessonTeachingRequest.test.ts`.
- **api-server** builds first and then reports 0 failures, with the mount-order suite **running** (not skipped).
- **`git diff --stat origin/main -- artifacts/mobile/app`** lists exactly `ai-tools/activity.tsx`, `ai-tools/classroom/builder.tsx`, `ai-tools/lesson-flow.tsx`, `ai-tools/lesson-plan.tsx` and `ai-tools/slides.tsx`. Alongside them it lists the four files pieces 1–2 already changed on this branch: `ai-tools/game.tsx`, `ai-tools/quiz.tsx`, `ai-tools/worksheet.tsx` and `workspace/view.tsx`. Nothing else should appear under `app`. If `origin/main` has moved, first check that any extra path comes from a merged main commit and not from this branch: `git log origin/main..HEAD -- <path>` is empty for it.

- [ ] **Step 4: Commit**

```bash
git add STATUS.md
git commit -m "docs: STATUS — wide-scope lesson plan, slides, activity, lesson-flow and classroom builder"
```
The commit message ends with the two trailers from Global Constraints. Use the body to list any sentence Step 2 forced you to change. Before staging, run `git diff STATUS.md`: it must show only the three edits from Step 1. If another session's uncommitted edits are also in the file, do not commit them under this message. Stop and ask the coordinator to land or drop them first; interactive staging (`git add -p`) is not available here.

---

### Section self-check

**Identifiers this section introduces**

| Identifier | Defined in |
| --- | --- |
| `RevisionDeckOptions`, `buildRevisionDeck` | `services/lessonSlides.ts` — Task 8 Step 3 |
| `SlidesForm`, `SlidesLessonFields`, `slidesPlanRequest`, `slidesChecksRequest`, `slidesTeachingRequest` | `services/slidesRequests.ts` — Task 8 Step 8 |
| `WIDE_GROUNDING` (module constant), `wideScope`, `wideFrozen` (`ScopeSelection \| null`), `lessonFields`, `form`, `wideSel`, `wide`, `teachingReq` | `app/ai-tools/slides.tsx` — Task 8 Step 11 |
| `questionStepFields` | `services/ai/lessonFlowRunner.ts` — Task 9 Step 3 |
| `wideScope`, `wideFrozen`, `wideReqRef`, `wideSel`, `wide` | `app/ai-tools/lesson-flow.tsx` — Task 9 Step 6 |
| tests `revisionDeck.test.ts`, `slidesRequests.test.ts`, `lessonFlowScope.test.ts` | `services/__tests__/` (inside the mobile glob) |

**Identifiers consumed from outside this section**

| Identifier | Contract line relied on |
| --- | --- |
| `RevisionUnit` (`unitId`, `title`, `lessons[{id,title}]`, `outcomes`, `concepts`, `terms`) | `revisionScope.ts — export type RevisionUnit = {…}` |
| `revisionUnits(sel, lang)` | `export function revisionUnits(sel, lang): RevisionUnit[]` — tests only |
| `revisionPhrase(sel, lang)` | `export function revisionPhrase(sel, lang): string` — the slides title, inside a sentence |
| `ScopeRequestFields`, `ScopeRequest` (`fields`, `units`), `buildScopeRequest(sel, lang, own?)` | `wideScopeRequest.ts — ADD` block (coverage `{ lessons }` with no slots, explicit-undefined `unitId`/`lessonId`, `bookFigureCount: 0`, `null` for a lesson or ungrounded scope) |
| `ClassroomActivityRequest.scope` / `.coverage` | `AIService.ts — ClassroomActivityRequest gains optional scope / coverage` |
| wide `generateLessonPlan` / `generateActivity` / quick-check `generateClassroomActivity` | Task 3 / Task 5 / Task 7 (the brief: they return wide results for a request carrying `scope` + `coverage`) |
| `useWideScope(params, current)` → `{ scopeSel, setScopeSel, isWide }` | "Screen-facing shared state is `hooks/useWideScope.ts`" |
| `scopeFormState`, `scopeLabel`, `captureGenerationScope`, `reopenedGenerationScope`, `GeneratorGrounding`, `splitChecks`, `splitWarmup`, `rebuildAnswerKey`, `EXIT_TICKET_MAX`, `MID_LESSON_CHECK_MAX`, `buildLessonTeachingRequest`, `regenerationFields`, `withLessonId` | existing code (read on 2026-10-14) |
| `isRevisionRequest`, `leftOutSentence`, `revisionUnitsFromLessons` | **not used** by this section |


---

## Self-Review

**Spec coverage.** Decisions 1–4 → Tasks 1–10 (revision session: Tasks 1–3 and the clauses of Task 2; five tools: Tasks 4, 6, 7, 8, 9; same eight plan sections: Task 3; all activity formats: Task 5). §0 shared pieces → Task 1 and the guard list inside every screen task. §1 lesson plan → Tasks 2–4. §2 activity → Tasks 2, 5, 6. §3 classroom → Tasks 2, 7. §4 slides → Task 8. §5 lesson-flow → Task 9. §6 server → Task 2. §7 tests → each task's own tests; the end-to-end pin is in Task 5. Rollout / known limits → Task 10 (STATUS). Open items 1–5 were taken as proposed (Ministry export hidden; slides skip `generateLessonTeaching`; "left out" in the introduction; lesson-flow question steps use `random`; the order above).

**Deviations from the spec made while drafting** (the spec was reconciled to match): the clause lists lessons flat rather than grouped by unit; discussion and hands-on activities are pinned at ≥1 unit per version and ≥2 across regenerates; «ابدأ الحصة» is hidden on a wide lesson-flow; the offline wide lesson plan is deterministic.

**Placeholder scan.** No "TBD" / "TODO" / "implement later". Screen tasks end in an explicit adversarial read-through checklist because the screens cannot be run.

**Type consistency.** `ScopeRequest` / `ScopeRequestFields` / `buildScopeRequest` / `isRevisionRequest` / `scopeFromKey` / `revisionUnitsFromLessons` (Task 1) are the names Tasks 3–9 use; `revisionClauseAr/En(b, kind)` and `classroomActivityPrompt` (Task 2) are not redefined elsewhere; `buildWideLessonPlanRequest` (Task 4), `buildRevisionDeck` and `slides*Request` (Task 8) and `questionStepFields` (Task 9) are each defined once. Executors must still grep for these names after each task: the sections were drafted separately and reconciled once.

**Known risk.** This plan is long (~6,000 lines because it carries the code). Drafters ran their snippets in a scratch copy of the branch (Section A: full mobile and api-server suites green with its tasks applied); Sections B and C were checked by prototypes and reading, so their test files may need small fixes at RED/GREEN — the review loop is the net.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-14-wide-scope-teaching-tools.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.

**2. Inline Execution** — run the tasks in this session with checkpoints.
