# Wide-Scope Selection — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `TopicSelector` offer a whole semester (plus working whole-unit / whole-book) as a structured, id-based scope that is grounded from the real lessons, carried in the API request, and keyed in the artifact pool — without any generator screen changing behaviour yet.

**Architecture:** A pure `scopeSelection.ts` model (what a scope *is* and which lessons it covers) and a pure `scopeGrounding.ts` (a size-tiered digest for the prompt). `AIRequest` gains an optional `scope`; the server validates it, pools book passages across the scope's NCCD units, and hashes `scopeKey` into the cache keys. `TopicSelector` gains `allowedKinds` + `onScopeChange`; with neither prop it behaves exactly as today.

**Tech Stack:** TypeScript, `node --test` (strip-types), Expo/React Native (component only), Express api-server, `@workspace/curriculum`.

**Spec:** `docs/superpowers/specs/2026-10-13-wide-scope-selection-design.md`

## Global Constraints

- Mobile pure modules are loaded directly by `node --test`: **explicit `.ts` extensions on relative imports**, and **no `react-native` / `expo-*` import at module scope** (CLAUDE.md). `TopicSelector.tsx` cannot be unit-tested; its logic lives in the pure modules.
- New mobile tests go inside `artifacts/mobile/services/__tests__/` (the only glob mobile runs); api-server tests inside `src/**/__tests__/`. Do not narrow either glob.
- Compute in latin; Arabic is the product language; UI is RTL-first (CLAUDE.md).
- Keep the **grounding trap rules**: a scope is carried as ids, never re-derived from a title; a wide scope must never fall back to a title/fuzzy lookup (fail closed or label honestly).
- `contextSource: 'curriculum'` for a digest (it is KB-derived, not teacher-pasted).
- Routers mounted without a path prefix see every request: this plan adds **no** `router.use`; the server change is inside the existing explicit `withGrounding` call.
- **Rollout invariant (spec §Rollout):** no generator screen changes behaviour in this PR. `TopicSelector` without the new props must behave byte-for-byte as today.
- Decisions from review: «الفصل كاملًا» is hidden when a grade+subject has < 2 semesters; the new `semester` kind is off under `DEMO_MODE`.
- Every commit message ends with the two attribution trailers from the session instructions (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01S49tDeDJyomhJFC71MHJo1`). Do not put a model identifier anywhere else in the repo.

## Deviations from the spec (found while planning — Task 1 amends the spec)

1. **Legacy default, not `['lesson']`.** With `allowedKinds` absent the selector keeps today's entries (`lesson`, `unit` = «الوحدة كاملةً», `book`). Defaulting to `['lesson']` would *remove* options teachers see today, contradicting "piece 1 changes nothing visible".
2. **`DEMO_MODE` strips only `semester`** (the new capability). Today's book/unit entries stay as they are; piece 2 is what fixes them.
3. **No `PROMPT_VERSION` bump.** `generationKeys` drops undefined fields before hashing, so a request with no `scope` hashes exactly as before; bumping would discard the whole pool for nothing.
4. **No `lessonIds` on the wire.** Only `kind`, `scopeKey`, `unitIds` (≤ 24 NCCD ids) — the server never needs lesson ids and an English book has 100 lessons.
5. **Measured, not guessed (probed 2026-10-13):** G10 maths = 4 units / 18 lessons per semester; G10 chemistry S1 9 / S2 8; G9 chemistry 4 / 4; G10 English S1 65 lessons in 35 units, S2 35 in 5. One-semester pair for tests: `grade-10` + `financial-literacy`. Hence the digest is **tiered** (Task 2).

## File Structure

| File | Responsibility |
| --- | --- |
| Create `artifacts/mobile/services/scopeSelection.ts` | `ScopeSelection` type; which units/lessons a scope covers; key, label, availability, (de)serialisation. Pure. |
| Create `artifacts/mobile/services/scopeGrounding.ts` | `resolveScopeGrounding`: tiered, size-capped digest + NCCD unit ids. Pure. |
| Modify `artifacts/mobile/services/kbContext.ts` | Extract `curriculumObjectivesFor` (shared by the lesson serializer and the digest). |
| Modify `artifacts/mobile/services/ai/AIService.ts` | `AIRequest.scope`. |
| Modify `artifacts/mobile/services/generatorRequests.ts` | `scopeRequestFields(grounding)` — the request fragment for a wide scope. |
| Modify `artifacts/mobile/components/ui/TopicSelector.tsx` | Semester entries, `allowedKinds`, `onScopeChange`. |
| Modify `artifacts/api-server/src/lib/grounding.ts` | `parseWideScope`, shared `pooledGrounding`, wide branch in `groundingFor`. |
| Modify `artifacts/api-server/src/lib/generationKey.ts` | `scopeKeyOf`; `scope` in both keys. |
| Modify `artifacts/api-server/src/routes/generate.ts` | `lessonRefOf` returns `scopeKey` for a wide scope. |
| Tests | `services/__tests__/scopeSelection.test.ts`, `scopeGrounding.test.ts`, `scopeRequest.test.ts`; `api-server/src/lib/__tests__/grounding.test.ts` (append), `generationKey.test.ts` (append). |
| Modify `STATUS.md`, the spec | Record what landed / the deviations. |

---

### Task 1: The scope model (`scopeSelection.ts`)

**Files:**
- Create: `artifacts/mobile/services/scopeSelection.ts`
- Test: `artifacts/mobile/services/__tests__/scopeSelection.test.ts`
- Modify: `docs/superpowers/specs/2026-10-13-wide-scope-selection-design.md` (deviations)

**Interfaces:**
- Consumes: `getUnitsForSubjectGrade(subjectId, gradeId): KBUnit[]`, `getLessonsForUnit(unitId): KBLesson[]`, `hasKBContent(subjectId, gradeId): boolean`, `KB_BOOKS` from `./knowledgeBase.ts`.
- Produces (later tasks rely on these exact names):
  ```ts
  export type ScopeKind = 'lesson' | 'unit' | 'semester' | 'book';
  export type Semester = 1 | 2;
  export type ScopeSelection = { kind: ScopeKind; gradeId: string; subjectId: string; unitId?: string; semester?: Semester; lessonId?: string };
  export const LEGACY_SCOPE_KINDS: readonly ScopeKind[];            // ['lesson','unit','book']
  export function unitsInScope(sel: ScopeSelection): KBUnit[];
  export function lessonsInScope(sel: ScopeSelection): KBLesson[];
  export function semestersAvailable(gradeId: string, subjectId: string): Semester[];
  export function availableKinds(gradeId: string, subjectId: string, allowed?: readonly ScopeKind[], demoMode?: boolean): ScopeKind[];
  export function scopeKey(sel: ScopeSelection): string;            // throws on a selection missing its id
  export function scopeLabel(sel: ScopeSelection, lang: 'ar' | 'en'): string;
  export function parseScope(raw: unknown): ScopeSelection | null;  // validates against the KB
  ```

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/scopeSelection.test.ts`:

```ts
/**
 * What a "scope" is, and which lessons it covers.
 *
 * Run: pnpm --filter @workspace/mobile test  (or node --test on this file via
 * the package's test script, which registers the `@workspace/*` alias).
 *
 * The assertions are derived from the KB itself rather than hard-coded lesson
 * ids, so they keep holding when a book's lessons change.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableKinds, lessonsInScope, LEGACY_SCOPE_KINDS, parseScope, scopeKey, scopeLabel,
  semestersAvailable, unitsInScope, type ScopeSelection,
} from '../scopeSelection.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';
const S = 'mathematics';
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: S };
const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: S, semester: n });
const firstUnit = getUnitsForSubjectGrade(S, G)[0]!;

describe('lessonsInScope', () => {
  it('the two semesters are non-empty and, in order, make up the book', () => {
    const all = lessonsInScope(book).map(l => l.id);
    const s1 = lessonsInScope(sem(1)).map(l => l.id);
    const s2 = lessonsInScope(sem(2)).map(l => l.id);
    assert.ok(s1.length > 0 && s2.length > 0, 'a semester of the maths book is empty');
    assert.deepEqual([...s1, ...s2], all);
  });

  it('a unit is exactly its own lessons, in order', () => {
    const sel: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id };
    assert.deepEqual(
      lessonsInScope(sel).map(l => l.id),
      getLessonsForUnit(firstUnit.id).map(l => l.id),
    );
  });

  it('a lesson is just that lesson', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    const sel: ScopeSelection = { kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id };
    assert.deepEqual(lessonsInScope(sel).map(l => l.id), [lesson.id]);
  });

  it('an id that is not in this grade+subject covers nothing', () => {
    assert.deepEqual(lessonsInScope({ kind: 'unit', gradeId: G, subjectId: S, unitId: 'no-such-unit' }), []);
    assert.deepEqual(lessonsInScope({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: 'no-such-lesson' }), []);
    // A real maths unit asked for under another subject must not leak across.
    assert.deepEqual(lessonsInScope({ kind: 'unit', gradeId: G, subjectId: 'chemistry', unitId: firstUnit.id }), []);
  });
});

describe('unitsInScope', () => {
  it('a semester only holds units of that semester\'s book', () => {
    const s1 = unitsInScope(sem(1));
    const s2 = unitsInScope(sem(2));
    assert.ok(s1.length > 0 && s2.length > 0);
    assert.equal(s1.filter(u => s2.some(v => v.id === u.id)).length, 0);
  });
});

describe('semestersAvailable / availableKinds', () => {
  it('maths has both semesters; a one-book subject has one', () => {
    assert.deepEqual(semestersAvailable(G, S), [1, 2]);
    assert.deepEqual(semestersAvailable(G, 'financial-literacy'), [1]);
  });

  it('hides the semester entry when there is only one semester (it would equal the whole book)', () => {
    assert.ok(availableKinds(G, S, ['lesson', 'unit', 'semester', 'book']).includes('semester'));
    assert.ok(!availableKinds(G, 'financial-literacy', ['lesson', 'unit', 'semester', 'book']).includes('semester'));
  });

  it('keeps `semester` off under DEMO_MODE, and leaves today\'s kinds alone', () => {
    const all = ['lesson', 'unit', 'semester', 'book'] as const;
    assert.deepEqual(availableKinds(G, S, all, true), ['lesson', 'unit', 'book']);
  });

  it('defaults to exactly what the picker offers today', () => {
    assert.deepEqual(availableKinds(G, S), [...LEGACY_SCOPE_KINDS]);
  });

  it('offers nothing when the grade+subject has no book', () => {
    assert.deepEqual(availableKinds('grade-10', 'no-such-subject'), []);
  });
});

describe('scopeKey', () => {
  it('is id-only, stable, and distinct per scope', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    const keys = [
      scopeKey(book), scopeKey(sem(1)), scopeKey(sem(2)),
      scopeKey({ kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id }),
      scopeKey({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id }),
    ];
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(scopeKey(sem(1)), scopeKey(sem(1)));
    assert.equal(scopeKey(sem(1)), `sem:${G}:${S}:1`);
  });

  it('refuses a selection that is missing the id its kind needs', () => {
    assert.throws(() => scopeKey({ kind: 'semester', gradeId: G, subjectId: S }));
    assert.throws(() => scopeKey({ kind: 'unit', gradeId: G, subjectId: S }));
    assert.throws(() => scopeKey({ kind: 'lesson', gradeId: G, subjectId: S }));
  });
});

describe('scopeLabel', () => {
  it('names a wide scope in Arabic and English', () => {
    assert.equal(scopeLabel(book, 'ar'), 'الكتاب كاملًا');
    assert.equal(scopeLabel(sem(1), 'ar'), 'الفصل الأول كاملًا');
    assert.equal(scopeLabel(sem(2), 'ar'), 'الفصل الثاني كاملًا');
    assert.equal(scopeLabel(book, 'en'), 'Entire book');
    assert.equal(scopeLabel(sem(2), 'en'), 'Entire semester 2');
  });

  it('uses the unit / lesson title for those kinds', () => {
    const lesson = getLessonsForUnit(firstUnit.id)[0]!;
    assert.equal(scopeLabel({ kind: 'unit', gradeId: G, subjectId: S, unitId: firstUnit.id }, 'ar'), firstUnit.titleAr);
    assert.equal(scopeLabel({ kind: 'lesson', gradeId: G, subjectId: S, lessonId: lesson.id }, 'en'), lesson.titleEn);
  });
});

describe('parseScope', () => {
  it('round-trips a valid selection through JSON', () => {
    const back = parseScope(JSON.parse(JSON.stringify(sem(2))));
    assert.deepEqual(back, sem(2));
  });

  it('rejects junk and selections that cover nothing', () => {
    assert.equal(parseScope(null), null);
    assert.equal(parseScope('book'), null);
    assert.equal(parseScope({ kind: 'galaxy', gradeId: G, subjectId: S }), null);
    assert.equal(parseScope({ kind: 'unit', gradeId: G, subjectId: S, unitId: 'no-such-unit' }), null);
    assert.equal(parseScope({ kind: 'semester', gradeId: G, subjectId: S, semester: 3 }), null);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeSelection.test.ts`
Expected: FAIL — `Cannot find module '../scopeSelection.ts'`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/scopeSelection.ts`:

```ts
/**
 * What a teacher picked in the topic picker — as ids, never as a title.
 *
 * The picker used to hand every generator a topic *string*: a lesson title,
 * a unit title, or «الكتاب كاملًا». Generators then re-grounded that string to
 * ONE lesson (or none), so a whole-book paper was silently ungrounded or built
 * from whichever lesson the text happened to resemble — the "a lesson title
 * does not identify a lesson" trap in CLAUDE.md. A `ScopeSelection` carries
 * the ids instead, and this module is the one place that knows which lessons
 * "semester 2" means.
 *
 * Free of react-native so `node --test` can load it.
 */
import {
  getLessonsForUnit,
  getUnitsForSubjectGrade,
  hasKBContent,
  KB_BOOKS,
  type KBLesson,
  type KBUnit,
} from './knowledgeBase.ts';

export type ScopeKind = 'lesson' | 'unit' | 'semester' | 'book';
export type Semester = 1 | 2;

export type ScopeSelection = {
  kind: ScopeKind;
  gradeId: string;
  subjectId: string;
  /** kind 'unit': the KB unit id. */
  unitId?: string;
  /** kind 'semester'. */
  semester?: Semester;
  /** kind 'lesson': the KB lesson id — never a title. */
  lessonId?: string;
};

/** What the picker offers today. A screen that names no kinds gets exactly this. */
export const LEGACY_SCOPE_KINDS: readonly ScopeKind[] = ['lesson', 'unit', 'book'];

function semesterOf(unit: KBUnit): Semester {
  return (KB_BOOKS.find(b => b.id === unit.bookId)?.semester ?? 1) as Semester;
}

/** The units a selection covers, in book order (semester 1 first). */
export function unitsInScope(sel: ScopeSelection): KBUnit[] {
  const units = getUnitsForSubjectGrade(sel.subjectId, sel.gradeId);
  switch (sel.kind) {
    case 'book':
      return units;
    case 'semester':
      return units.filter(u => semesterOf(u) === sel.semester);
    case 'unit':
      return units.filter(u => u.id === sel.unitId);
    case 'lesson':
      return units.filter(u => getLessonsForUnit(u.id).some(l => l.id === sel.lessonId));
  }
}

/** The lessons a selection covers, in book order. Empty for an id this grade+subject does not hold. */
export function lessonsInScope(sel: ScopeSelection): KBLesson[] {
  const lessons = unitsInScope(sel).flatMap(u => getLessonsForUnit(u.id));
  return sel.kind === 'lesson' ? lessons.filter(l => l.id === sel.lessonId) : lessons;
}

/** The semesters this grade+subject has a book for. */
export function semestersAvailable(gradeId: string, subjectId: string): Semester[] {
  const seen = new Set<Semester>();
  for (const u of getUnitsForSubjectGrade(subjectId, gradeId)) seen.add(semesterOf(u));
  return ([1, 2] as const).filter(s => seen.has(s));
}

/**
 * The kinds the picker may offer for this grade+subject.
 *
 * `semester` is dropped when there is only one semester (it would equal «الكتاب
 * كاملًا») and under DEMO_MODE (the offline generators cannot yet honour it).
 * The other kinds are left exactly as the screen asked: they already exist
 * today, and piece 2 is what makes them work.
 */
export function availableKinds(
  gradeId: string,
  subjectId: string,
  allowed: readonly ScopeKind[] = LEGACY_SCOPE_KINDS,
  demoMode = false,
): ScopeKind[] {
  if (!hasKBContent(subjectId, gradeId)) return [];
  const offerSemester = !demoMode && semestersAvailable(gradeId, subjectId).length >= 2;
  return allowed.filter(k => k !== 'semester' || offerSemester);
}

/** A stable id-only key — for the cache key, saved state and equality. */
export function scopeKey(sel: ScopeSelection): string {
  switch (sel.kind) {
    case 'book':
      return `book:${sel.gradeId}:${sel.subjectId}`;
    case 'semester':
      if (sel.semester !== 1 && sel.semester !== 2) throw new Error('scopeKey: semester scope without a semester');
      return `sem:${sel.gradeId}:${sel.subjectId}:${sel.semester}`;
    case 'unit':
      if (!sel.unitId) throw new Error('scopeKey: unit scope without a unitId');
      return `unit:${sel.unitId}`;
    case 'lesson':
      if (!sel.lessonId) throw new Error('scopeKey: lesson scope without a lessonId');
      return `lesson:${sel.lessonId}`;
  }
}

/**
 * The display / topic text for a selection. The literals match i18n's
 * `entireBook` and the semester names; this module stays free of the i18n
 * table (which pulls in React Native) so it can be tested.
 */
export function scopeLabel(sel: ScopeSelection, lang: 'ar' | 'en'): string {
  const isAr = lang === 'ar';
  switch (sel.kind) {
    case 'book':
      return isAr ? 'الكتاب كاملًا' : 'Entire book';
    case 'semester':
      if (isAr) return sel.semester === 2 ? 'الفصل الثاني كاملًا' : 'الفصل الأول كاملًا';
      return `Entire semester ${sel.semester === 2 ? 2 : 1}`;
    case 'unit': {
      const u = unitsInScope(sel)[0];
      return u ? (isAr ? u.titleAr : u.titleEn) : '';
    }
    case 'lesson': {
      const l = lessonsInScope(sel)[0];
      return l ? (isAr ? l.titleAr : l.titleEn) : '';
    }
  }
}

/** Rebuild a selection from saved / untrusted state. Null unless it still covers lessons. */
export function parseScope(raw: unknown): ScopeSelection | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kinds: readonly string[] = ['lesson', 'unit', 'semester', 'book'];
  if (typeof r.kind !== 'string' || !kinds.includes(r.kind)) return null;
  if (typeof r.gradeId !== 'string' || typeof r.subjectId !== 'string') return null;
  const sel: ScopeSelection = { kind: r.kind as ScopeKind, gradeId: r.gradeId, subjectId: r.subjectId };
  if (typeof r.unitId === 'string') sel.unitId = r.unitId;
  if (r.semester === 1 || r.semester === 2) sel.semester = r.semester;
  if (typeof r.lessonId === 'string') sel.lessonId = r.lessonId;
  try {
    scopeKey(sel);
  } catch {
    return null;
  }
  return lessonsInScope(sel).length > 0 ? sel : null;
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeSelection.test.ts`
Expected: all PASS. If `deepEqual([...s1, ...s2], all)` fails on ordering, the book ids no longer sort s1 < s2 — read `getUnitsForSubjectGrade` (it sorts books by id) and fix the test's assumption rather than the model.

- [ ] **Step 5: Amend the spec with the deviations**

In `docs/superpowers/specs/2026-10-13-wide-scope-selection-design.md`: replace the `allowedKinds` bullet in §2 ("default `['lesson']` until a screen opts in") with "default = today's kinds `['lesson','unit','book']`; `semester` only when a screen passes it"; in Decisions item 2 change "intersects `allowedKinds` with `['lesson']`" to "removes `semester` (today's book/unit entries are unchanged until piece 2)"; in §4 delete `lessonIds` from the `scope` shape and in §5 replace "bump `PROMPT_VERSION`" with "no bump needed — an absent `scope` leaves existing keys unchanged"; in *Risks* replace the "Digest size" bullet with the measured numbers from *Deviations* item 5 above and "the digest is tiered"; in §Rollout replace "single-lesson path now carries the id" with "screens adopt `onScopeChange` in piece 2".

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/scopeSelection.ts artifacts/mobile/services/__tests__/scopeSelection.test.ts docs/superpowers/specs/2026-10-13-wide-scope-selection-design.md
git commit -m "feat: ScopeSelection model for semester / unit / book scopes"
```

---

### Task 2: Grounding a wide scope (`scopeGrounding.ts`)

**Files:**
- Create: `artifacts/mobile/services/scopeGrounding.ts`
- Modify: `artifacts/mobile/services/kbContext.ts` (extract `curriculumObjectivesFor`; `serializeLessonContext` uses it)
- Test: `artifacts/mobile/services/__tests__/scopeGrounding.test.ts`

**Interfaces:**
- Consumes: Task 1's `ScopeSelection`, `ScopeKind`, `lessonsInScope`, `unitsInScope`, `scopeKey`, `scopeLabel`; `getLessonsForUnit`; from `kbContext.ts`: `nccdUnitId(unitId): string | undefined`, `resolveGeneratorGrounding(topic, lang, options)`.
- Produces:
  ```ts
  export const DIGEST_CHAR_BUDGET = 6000;
  export type ScopeGrounding = {
    kind: ScopeKind; scopeKey: string; grounded: boolean;
    lessons: KBLesson[]; context: string;
    unitIds: string[];            // NCCD ids only, in book order, de-duplicated
    truncated: boolean; ungroundedNote: string;
  };
  export function resolveScopeGrounding(sel: ScopeSelection, lang: 'ar' | 'en'): ScopeGrounding;
  // kbContext.ts:
  export function curriculumObjectivesFor(lesson: KBLesson): string[];
  ```

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/scopeGrounding.test.ts`:

```ts
/**
 * A wide scope is grounded from the lessons it covers — never from a title
 * search — and the prompt block it produces is bounded.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DIGEST_CHAR_BUDGET, resolveScopeGrounding } from '../scopeGrounding.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';
const maths = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: n });
const book = (subjectId: string): ScopeSelection => ({ kind: 'book', gradeId: G, subjectId });

describe('resolveScopeGrounding — wide scopes', () => {
  it('is grounded without any title lookup and lists every lesson in range', () => {
    const g = resolveScopeGrounding(maths(1), 'ar');
    assert.equal(g.grounded, true);
    assert.equal(g.kind, 'semester');
    assert.equal(g.scopeKey, scopeKey(maths(1)));
    assert.deepEqual(g.lessons.map(l => l.id), lessonsInScope(maths(1)).map(l => l.id));
    assert.equal(g.ungroundedNote, '');
    for (const l of g.lessons) assert.ok(g.context.includes(l.titleAr), `missing lesson «${l.titleAr}»`);
  });

  it('the two semesters give different contexts and disjoint lessons', () => {
    const a = resolveScopeGrounding(maths(1), 'ar');
    const b = resolveScopeGrounding(maths(2), 'ar');
    assert.notEqual(a.context, b.context);
    assert.equal(a.lessons.filter(l => b.lessons.some(m => m.id === l.id)).length, 0);
  });

  it('names the scope at the top of the block, in the asked language', () => {
    assert.ok(resolveScopeGrounding(maths(1), 'ar').context.startsWith('📚 النطاق: الفصل الأول كاملًا'));
    assert.ok(resolveScopeGrounding(maths(2), 'en').context.startsWith('📚 Scope: Entire semester 2'));
  });

  it('always fits the budget, and says so when it had to cut — even for a 100-lesson English book', () => {
    for (const sel of [maths(1), book('mathematics'), book('chemistry'), book('english')]) {
      const g = resolveScopeGrounding(sel, 'en');
      assert.ok(g.context.length <= DIGEST_CHAR_BUDGET + 200, `${scopeKey(sel)}: ${g.context.length} chars`);
    }
    const english = resolveScopeGrounding(book('english'), 'en');
    if (english.truncated) assert.ok(/not listed|omitted/i.test(english.context), 'truncated but not said');
  });

  it('degrades detail before it drops lessons: a full maths semester still lists every lesson', () => {
    const g = resolveScopeGrounding(book('mathematics'), 'ar');
    assert.equal(g.truncated, false);
    for (const l of g.lessons) assert.ok(g.context.includes(l.titleAr));
  });

  it('carries only NCCD unit ids (a subject without them yields none, but is still grounded)', () => {
    const m = resolveScopeGrounding(maths(1), 'ar');
    assert.ok(m.unitIds.length > 0);
    assert.ok(m.unitIds.every(id => id.startsWith('kbu-') && id.includes('-nccd-')), m.unitIds.join());
    assert.equal(new Set(m.unitIds).size, m.unitIds.length);
  });

  it('an unknown scope is ungrounded with the standard note — it never falls back to a title search', () => {
    const g = resolveScopeGrounding({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar');
    assert.equal(g.grounded, false);
    assert.equal(g.context, '');
    assert.deepEqual(g.lessons, []);
    assert.equal(g.ungroundedNote, resolveGeneratorGrounding('', 'ar').ungroundedNote);
    assert.ok(g.ungroundedNote.length > 0);
  });
});

describe('resolveScopeGrounding — a single lesson is today\'s grounding', () => {
  it('matches resolveGeneratorGrounding for the same lesson id', () => {
    const lesson = getLessonsForUnit(getUnitsForSubjectGrade('mathematics', G)[0]!.id)[0]!;
    const sel: ScopeSelection = { kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id };
    const g = resolveScopeGrounding(sel, 'ar');
    const today = resolveGeneratorGrounding(lesson.titleAr, 'ar', { lessonId: lesson.id });
    assert.equal(g.grounded, today.grounded);
    assert.equal(g.context, today.context);
    assert.deepEqual(g.lessons.map(l => l.id), [lesson.id]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeGrounding.test.ts`
Expected: FAIL — cannot find module `../scopeGrounding.ts`.

- [ ] **Step 3: Extract `curriculumObjectivesFor` in `kbContext.ts`**

In `artifacts/mobile/services/kbContext.ts`, add above `serializeLessonContext`:

```ts
/**
 * The official outcomes for a lesson: NCCD semester-2 data, else semester-1,
 * else the KB's own list. One place, so the single-lesson serializer and the
 * wide-scope digest can never disagree about which outcomes a lesson has.
 */
export function curriculumObjectivesFor(lesson: KBLesson): string[] {
  const s2 = findNccdLessonByKbId(lesson.id);
  if (s2?.objectives?.length) return s2.objectives;
  const s1 = findNccdSem1LessonByKbId(lesson.id);
  if (s1?.objectives?.length) return s1.objectives;
  return lesson.objectives?.length ? lesson.objectives : [];
}
```

and in `serializeLessonContext` replace the existing

```ts
  const curriculumObjectives = nccdS2?.objectives?.length
    ? nccdS2.objectives
    : nccdS1?.objectives?.length
      ? nccdS1.objectives
      : (lesson.objectives?.length ? lesson.objectives : []);
```

with

```ts
  const curriculumObjectives = curriculumObjectivesFor(lesson);
```

(`nccdS2` / `nccdS1` stay: `vocabulary` still reads them.)

- [ ] **Step 4: Implement `scopeGrounding.ts`**

Create `artifacts/mobile/services/scopeGrounding.ts`:

```ts
/**
 * The prompt context for a scope of many lessons.
 *
 * `resolveGeneratorGrounding` is exact for ONE lesson and stays that way. For a
 * unit / semester / book the lessons are known (ids, from `ScopeSelection`), so
 * nothing is searched: this builds a digest of them. A full semester of G10
 * maths is 18 lessons and G10 English is 100, so the digest is tiered — it
 * drops detail (concepts, then outcomes) before it ever drops a lesson, and
 * only past that does it cut the list, saying so.
 *
 * Free of react-native so `node --test` can load it.
 */
import { curriculumObjectivesFor, nccdUnitId, resolveGeneratorGrounding } from './kbContext.ts';
import { getLessonsForUnit, type KBLesson } from './knowledgeBase.ts';
import { lessonsInScope, scopeKey, scopeLabel, unitsInScope, type ScopeKind, type ScopeSelection } from './scopeSelection.ts';

/** Mirrors the server's PASSAGE_CHAR_BUDGET: an unbounded prompt is a budget problem first. */
export const DIGEST_CHAR_BUDGET = 6000;

export type ScopeGrounding = {
  kind: ScopeKind;
  scopeKey: string;
  grounded: boolean;
  lessons: KBLesson[];
  /** The prompt block; '' when ungrounded. */
  context: string;
  /** NCCD unit ids only (the ones the server can fetch book pages for), in book order. */
  unitIds: string[];
  /** True when even the titles-only digest had to drop lessons. */
  truncated: boolean;
  /** Set only when ungrounded — never claim curriculum grounding then. */
  ungroundedNote: string;
};

type Tier = 'full' | 'short' | 'titles';
const TIERS: readonly Tier[] = ['full', 'short', 'titles'];

function lessonLines(l: KBLesson, isAr: boolean, tier: Tier): string[] {
  const sep = isAr ? '؛ ' : '; ';
  const out = [`- ${isAr ? l.titleAr : l.titleEn}`];
  if (tier === 'titles') return out;
  const outcomes = curriculumObjectivesFor(l).slice(0, tier === 'full' ? 3 : 1);
  if (outcomes.length) out.push(`  ${isAr ? 'النتاجات' : 'Outcomes'}: ${outcomes.join(sep)}`);
  if (tier === 'full') {
    const concepts = (isAr ? l.keyConceptsAr : l.keyConceptsEn).slice(0, 3);
    if (concepts.length) out.push(`  ${isAr ? 'المفاهيم' : 'Concepts'}: ${concepts.join(sep)}`);
  }
  return out;
}

function render(sel: ScopeSelection, lang: 'ar' | 'en', total: number, tier: Tier): string[] {
  const isAr = lang === 'ar';
  const lines = [
    `${isAr ? '📚 النطاق' : '📚 Scope'}: ${scopeLabel(sel, lang)} (${total} ${isAr ? 'درسًا' : 'lessons'})`,
  ];
  for (const unit of unitsInScope(sel)) {
    lines.push('', `${isAr ? 'الوحدة' : 'Unit'}: ${isAr ? unit.titleAr : unit.titleEn}`);
    for (const l of getLessonsForUnit(unit.id)) lines.push(...lessonLines(l, isAr, tier));
  }
  return lines;
}

export function resolveScopeGrounding(sel: ScopeSelection, lang: 'ar' | 'en'): ScopeGrounding {
  const lessons = lessonsInScope(sel);
  const key = (() => {
    try { return scopeKey(sel); } catch { return ''; }
  })();

  if (lessons.length === 0) {
    return {
      kind: sel.kind, scopeKey: key, grounded: false, lessons: [], context: '', unitIds: [], truncated: false,
      // The same sentence an ungrounded single lesson gets — one wording to keep.
      ungroundedNote: resolveGeneratorGrounding('', lang).ungroundedNote,
    };
  }

  const unitIds = [...new Set(
    unitsInScope(sel).map(u => nccdUnitId(u.id)).filter((id): id is string => !!id),
  )];

  if (sel.kind === 'lesson') {
    const lesson = lessons[0]!;
    const g = resolveGeneratorGrounding(lang === 'ar' ? lesson.titleAr : lesson.titleEn, lang, { lessonId: lesson.id });
    return {
      kind: 'lesson', scopeKey: key, grounded: g.grounded, lessons: [lesson], context: g.context, unitIds,
      truncated: false, ungroundedNote: g.ungroundedNote,
    };
  }

  let lines: string[] = [];
  for (const tier of TIERS) {
    lines = render(sel, lang, lessons.length, tier);
    if (lines.join('\n').length <= DIGEST_CHAR_BUDGET) {
      return { kind: sel.kind, scopeKey: key, grounded: true, lessons, context: lines.join('\n'), unitIds, truncated: false, ungroundedNote: '' };
    }
  }

  // Even titles do not fit: keep as many whole lines as the budget allows, and say what was cut.
  const note = lang === 'ar' ? '[…بقية الدروس غير مُدرجة]' : '[…remaining lessons not listed]';
  const kept: string[] = [];
  let spent = note.length;
  for (const line of lines) {
    if (spent + line.length + 1 > DIGEST_CHAR_BUDGET) break;
    kept.push(line);
    spent += line.length + 1;
  }
  kept.push(note);
  return { kind: sel.kind, scopeKey: key, grounded: true, lessons, context: kept.join('\n'), unitIds, truncated: true, ungroundedNote: '' };
}
```

- [ ] **Step 5: Run the new test, then the whole mobile suite (the `kbContext` refactor must change nothing)**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeGrounding.test.ts && pnpm test 2>&1 | tail -15`
Expected: new tests PASS; `pnpm test` reports 0 fail (it includes `kbContext.test.ts`, `generatorGrounding.test.ts`).
If the "100-lesson English book" case produces `truncated: false` with a context ≤ budget, that is fine — the assertion only requires the cut to be *said* when it happens.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/scopeGrounding.ts artifacts/mobile/services/kbContext.ts artifacts/mobile/services/__tests__/scopeGrounding.test.ts
git commit -m "feat: tiered, size-capped grounding digest for wide scopes"
```

---

### Task 3: The request fragment (`AIRequest.scope`)

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (add `scope?` after `lessonId?`)
- Modify: `artifacts/mobile/services/generatorRequests.ts` (add `scopeRequestFields`)
- Test: `artifacts/mobile/services/__tests__/scopeRequest.test.ts`

**Interfaces:**
- Consumes: Task 2's `ScopeGrounding`.
- Produces:
  ```ts
  // AIService.ts
  scope?: { kind: 'unit' | 'semester' | 'book'; scopeKey: string; unitIds: string[] };
  // generatorRequests.ts
  export function scopeRequestFields(g: ScopeGrounding): Pick<AIRequest, 'scope' | 'additionalContext' | 'contextSource'>;
  ```
  A lesson-kind grounding returns `{}` — the caller keeps the lesson fields it builds today, so a lesson request is unchanged.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/scopeRequest.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scopeRequestFields } from '../generatorRequests.ts';
import { resolveScopeGrounding } from '../scopeGrounding.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';

describe('scopeRequestFields', () => {
  it('a wide scope sends the digest as curriculum context, plus its key and NCCD units', () => {
    const g = resolveScopeGrounding({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 }, 'ar');
    const f = scopeRequestFields(g);
    assert.deepEqual(f.scope, { kind: 'semester', scopeKey: g.scopeKey, unitIds: g.unitIds });
    assert.equal(f.additionalContext, g.context);
    assert.equal(f.contextSource, 'curriculum');
  });

  it('an ungrounded wide scope sends the honest note and no scope', () => {
    const g = resolveScopeGrounding({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar');
    const f = scopeRequestFields(g);
    assert.equal(f.scope, undefined);
    assert.equal(f.additionalContext, g.ungroundedNote);
    assert.equal(f.contextSource, 'curriculum');
  });

  it('a single lesson adds nothing — the request stays exactly what it is today', () => {
    const lesson = getLessonsForUnit(getUnitsForSubjectGrade('mathematics', G)[0]!.id)[0]!;
    const g = resolveScopeGrounding({ kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id }, 'ar');
    assert.deepEqual(scopeRequestFields(g), {});
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeRequest.test.ts`
Expected: FAIL — `scopeRequestFields` is not exported.

- [ ] **Step 3: Add the type**

In `artifacts/mobile/services/ai/AIService.ts`, directly after `lessonId?: string;` (and its comment block) add:

```ts
  /**
   * A scope wider than one lesson — a unit, a semester or the whole book.
   *
   * `scopeKey` is id-only and part of the artifact pool's cache key, so a
   * «الفصل الأول كاملًا» paper is never served as one lesson's. `unitIds` are
   * the NCCD units in range (the server pools book pages across them); the
   * digest itself travels in `additionalContext`. Absent for a single lesson,
   * which keeps using `lessonId` / `unitId` exactly as before.
   */
  scope?: { kind: 'unit' | 'semester' | 'book'; scopeKey: string; unitIds: string[] };
```

- [ ] **Step 4: Add the builder**

In `artifacts/mobile/services/generatorRequests.ts` add (imports at the top: `import type { ScopeGrounding } from './scopeGrounding.ts';` — use the file's existing import-extension style; if the file imports without `.ts`, match it, but `generatorRequests.test.ts` loads this file under node so keep `.ts`):

```ts
/**
 * The request fields a wide scope adds on top of a screen's own.
 *
 * Empty for a single lesson: the screen already sends `lessonId` / `unitId` and
 * its lesson context, and this PR must not change that request.
 */
export function scopeRequestFields(
  g: ScopeGrounding,
): Pick<AIRequest, 'scope' | 'additionalContext' | 'contextSource'> {
  if (g.kind === 'lesson') return {};
  return {
    scope: g.grounded && g.kind !== 'lesson'
      ? { kind: g.kind, scopeKey: g.scopeKey, unitIds: g.unitIds }
      : undefined,
    additionalContext: (g.grounded ? g.context : g.ungroundedNote) || undefined,
    contextSource: 'curriculum',
  };
}
```

(`AIRequest` is already imported in this file — `buildWorksheetRequest` returns it.)

- [ ] **Step 5: Run it and confirm it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scopeRequest.test.ts services/__tests__/generatorRequests.test.ts`
Expected: PASS (the existing `generatorRequests` tests prove the lesson request is unchanged).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/generatorRequests.ts artifacts/mobile/services/__tests__/scopeRequest.test.ts
git commit -m "feat: AIRequest.scope and the wide-scope request fragment"
```

---

### Task 4: Server — validate, ground and key a wide scope

**Files:**
- Modify: `artifacts/api-server/src/lib/grounding.ts`
- Modify: `artifacts/api-server/src/lib/generationKey.ts`
- Modify: `artifacts/api-server/src/routes/generate.ts` (`lessonRefOf`, ~line 593)
- Test: `artifacts/api-server/src/lib/__tests__/grounding.test.ts` (append), `generationKey.test.ts` (append)

**Interfaces:**
- Consumes: the wire shape `scope: { kind, scopeKey, unitIds }` from Task 3.
- Produces:
  ```ts
  // grounding.ts
  export interface WideScope { kind: 'unit' | 'semester' | 'book'; scopeKey: string; unitIds: string[] }
  export function parseWideScope(raw: unknown): WideScope | null;
  // groundingFor input gains `scope?: unknown`; behaviour below.
  // generationKey.ts
  export function scopeKeyOf(body: Record<string, unknown>): string | undefined;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `artifacts/api-server/src/lib/__tests__/grounding.test.ts`. First extend its import line to `import { groundingFor, groundingForObjectives, parseWideScope, withGrounding } from "../grounding.ts";`, then add at the end:

```ts
describe("parseWideScope", () => {
  const ok = { kind: "unit", scopeKey: "unit:x", unitIds: [CIRCLE] };

  it("accepts a well-formed wide scope", () => {
    assert.deepEqual(parseWideScope(ok), { kind: "unit", scopeKey: "unit:x", unitIds: [CIRCLE] });
  });

  it("rejects what is not a wide scope", () => {
    assert.equal(parseWideScope(null), null);
    assert.equal(parseWideScope("book"), null);
    assert.equal(parseWideScope({ ...ok, kind: "lesson" }), null); // a lesson uses lessonId/unitId
    assert.equal(parseWideScope({ ...ok, kind: "galaxy" }), null);
    assert.equal(parseWideScope({ ...ok, scopeKey: "" }), null);
    assert.equal(parseWideScope({ ...ok, scopeKey: "x".repeat(201) }), null);
  });

  it("keeps only real NCCD unit ids, once each (request-controlled input)", () => {
    const parsed = parseWideScope({ ...ok, unitIds: [CIRCLE, CIRCLE, "kbu-chem-1", 7, "'; drop table", NO_SUCH_UNIT] });
    assert.deepEqual(parsed?.unitIds, [CIRCLE, NO_SUCH_UNIT]);
  });
});

describe("groundingFor — wide scope", () => {
  const scope = (unitIds: string[]) => ({ kind: "semester", scopeKey: "sem:grade-10:mathematics:1", unitIds });

  it("pulls book pages from the scope's own units, ignoring the topic text", () => {
    const g = groundingFor({ scope: scope([CIRCLE]), topic: "الفصل الأول كاملًا" }, true);
    assert.ok(g, "no grounding for a wide scope whose unit has extracted text");
    assert.equal(g.unitId, CIRCLE);
    assert.ok(g.sources.length > 0 && g.sources.length <= 6);
  });

  it("fails closed: a scope with no usable unit never falls back to the topic", () => {
    // CIRCLE_LESSON would resolve a unit by title on the ordinary path.
    assert.ok(groundingFor({ topic: CIRCLE_LESSON }, true), "precondition: this title grounds normally");
    assert.equal(groundingFor({ scope: scope([NO_SUCH_UNIT]), topic: CIRCLE_LESSON }, true), null);
    assert.equal(groundingFor({ scope: scope([]), topic: CIRCLE_LESSON }, true), null);
  });

  it("pools across several units and stays inside the page cap", () => {
    const g = groundingFor({ scope: scope([CIRCLE, FINLIT]), topic: "x" }, true);
    assert.ok(g);
    assert.ok(g.sources.length > 0 && g.sources.length <= 6);
  });

  it("an unparseable scope is ignored and the ordinary path runs", () => {
    const g = groundingFor({ scope: { kind: "lesson" }, topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    assert.equal(g.unitId, CIRCLE);
  });
});
```

Append to `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` (it already defines `base` and `keys`):

```ts
describe("scope in the cache key", () => {
  const wide = (scopeKey: string) => ({ ...base, scope: { kind: "semester", scopeKey, unitIds: [] } });

  it("different scopes never share a slot, in either key", () => {
    const a = keys(wide("sem:grade-10:mathematics:1"));
    const b = keys(wide("sem:grade-10:mathematics:2"));
    assert.notEqual(a.strictKey, b.strictKey);
    assert.notEqual(a.coarseKey, b.coarseKey);
  });

  it("a scoped request never lands on the plain-lesson slot", () => {
    const plain = keys(base);
    const scoped = keys(wide("sem:grade-10:mathematics:1"));
    assert.notEqual(plain.strictKey, scoped.strictKey);
    assert.notEqual(plain.coarseKey, scoped.coarseKey);
  });

  it("a request without a scope hashes exactly as before (no pool-wide invalidation)", () => {
    assert.deepEqual(keys(base), keys({ ...base, scope: undefined }));
    assert.deepEqual(keys(base), keys({ ...base, scope: { kind: "book" } })); // no scopeKey → ignored
  });

  it("the same scope is the same key", () => {
    assert.deepEqual(keys(wide("book:grade-10:mathematics")), keys(wide("book:grade-10:mathematics")));
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/grounding.test.ts src/lib/__tests__/generationKey.test.ts`
Expected: FAIL — `parseWideScope` is not exported; the key tests fail on `scope` being ignored.

- [ ] **Step 3: `generationKey.ts`**

Add after `contextSourceOf`:

```ts
/**
 * The id-only key of a wide scope («الفصل الأول كاملًا», «الكتاب كاملًا»), when
 * the request carries one. It is part of both keys: a semester paper is not a
 * lesson's, and a topic string alone («الفصل الأول كاملًا») is the same for
 * every grade and subject. Absent for a single lesson, which is why adding it
 * leaves every existing key — and so the whole pool — untouched.
 */
export function scopeKeyOf(body: Record<string, unknown>): string | undefined {
  const scope = body.scope;
  if (typeof scope !== "object" || scope === null) return undefined;
  const key = (scope as Record<string, unknown>).scopeKey;
  return typeof key === "string" && key.length > 0 && key.length <= 200 ? key : undefined;
}
```

and in `generationKeys`, inside the `shared` object after `lesson:`:

```ts
    // Only present for a unit / semester / book request — see `scopeKeyOf`.
    scope: normalizeValue(scopeKeyOf(body)),
```

(`PROMPT_VERSION` is deliberately not bumped.)

- [ ] **Step 4: `grounding.ts`**

Replace `groundingForObjectives` with a thin wrapper over a shared helper, and add the scope code. After `PASSAGE_CHAR_BUDGET`:

```ts
/** Wide scopes: two pages per unit so one unit cannot crowd out the rest, six in all. */
const WIDE_PER_UNIT = 2;
const WIDE_PASSAGE_LIMIT = 6;
/** Units honoured from a request — it is request-controlled input. */
const MAX_SCOPE_UNITS = 24;

export interface WideScope {
  kind: "unit" | "semester" | "book";
  scopeKey: string;
  unitIds: string[];
}

/**
 * A unit / semester / book scope from a request body, or null.
 *
 * `lesson` is not a wide scope — a single lesson travels as `lessonId` /
 * `unitId` — so it parses to null and the ordinary path runs. Unit ids are
 * filtered through `isNccdUnitId`: anything else would reach `passagesForUnit`.
 */
export function parseWideScope(raw: unknown): WideScope | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "unit" && r.kind !== "semester" && r.kind !== "book") return null;
  if (typeof r.scopeKey !== "string" || r.scopeKey.length === 0 || r.scopeKey.length > 200) return null;
  const ids = Array.isArray(r.unitIds) ? r.unitIds : [];
  const unitIds = [...new Set(ids.filter((u): u is string => typeof u === "string" && isNccdUnitId(u)))]
    .slice(0, MAX_SCOPE_UNITS);
  return { kind: r.kind, scopeKey: r.scopeKey, unitIds };
}
```

Replace the body of `groundingForObjectives` with:

```ts
export function groundingForObjectives(
  objectives: readonly { unitId: string }[],
  isAr: boolean,
): Grounding | null {
  const unitIds = [...new Set(objectives.map(o => o.unitId).filter(isNccdUnitId))];
  return pooledGrounding(unitIds, isAr, PASSAGE_LIMIT, PASSAGE_LIMIT);
}

/**
 * Pages pooled across units, re-ranked by the one score. Scores from
 * `passagesForUnit` are comparable only within one query, but the scale is the
 * same function of the same term lengths, so across units of one corpus this
 * orders sensibly. Ties break on id then page so a paper generated twice reads
 * the same pages twice.
 */
function pooledGrounding(unitIds: string[], isAr: boolean, perUnit: number, total: number): Grounding | null {
  if (!unitIds.length) return null;
  const pooled = unitIds
    .flatMap(unitId => passagesForUnit({ unitId, limit: perUnit, quotableOnly: true }))
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId) || a.page - b.page)
    .slice(0, total);
  if (!pooled.length) return null;

  const { block, used } = renderBlock(pooled, isAr);
  if (!block) return null;
  return {
    unitId: unitIds[0]!,
    block,
    sources: used.map(p => ({ sourceId: p.sourceId, titleAr: labelFor(p.sourceId, true), page: p.page })),
  };
}
```

(Delete the old inline body — `pooledGrounding` is its exact logic, including the existing explanatory comment, moved. Keep `groundingForObjectives`'s doc comment.)

Change `groundingFor`'s signature and add the wide branch at its top:

```ts
export function groundingFor(
  input: { unitId?: unknown; topic?: unknown; scope?: unknown },
  isAr: boolean,
): Grounding | null {
  // A wide scope names its own units. Its topic is a label («الفصل الأول
  // كاملًا»), not a lesson — resolving it by title would attach some other
  // unit's book to a prompt that reads as authoritative, so there is no
  // fall-back: no usable unit means no grounding.
  const wide = parseWideScope(input.scope);
  if (wide) return pooledGrounding(wide.unitIds, isAr, WIDE_PER_UNIT, WIDE_PASSAGE_LIMIT);

  // …existing body unchanged from here…
```

- [ ] **Step 5: `routes/generate.ts` — `lessonRefOf`**

Add `scopeKeyOf` to the existing import from `../lib/generationKey` and change `lessonRefOf` to:

```ts
function lessonRefOf(body: Record<string, unknown>): string {
  const scope = scopeKeyOf(body);
  if (scope) return scope;
  const id = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  if (id) return id;
  return typeof body.topic === "string" ? normalizeText(body.topic).slice(0, 200) : "";
}
```

- [ ] **Step 6: Run the tests and build**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/grounding.test.ts src/lib/__tests__/generationKey.test.ts && pnpm build && pnpm test 2>&1 | tail -15`
Expected: PASS; `pnpm test` reports 0 fail (the mount-order suite runs because the bundle was built first).

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/lib/grounding.ts artifacts/api-server/src/lib/generationKey.ts artifacts/api-server/src/routes/generate.ts artifacts/api-server/src/lib/__tests__/grounding.test.ts artifacts/api-server/src/lib/__tests__/generationKey.test.ts
git commit -m "feat(api): ground and key a unit / semester / book scope"
```

---

### Task 5: `TopicSelector` — semester entries, `allowedKinds`, `onScopeChange`

**Files:**
- Modify: `artifacts/mobile/components/ui/TopicSelector.tsx`

Not unit-testable (React Native); the logic it relies on is covered by Tasks 1–2. Verified by typecheck plus the manual check in Step 6.

**Interfaces:**
- Consumes: Task 1's `availableKinds`, `semestersAvailable`, `scopeLabel`, `ScopeKind`, `ScopeSelection`, `Semester`; `DEMO_MODE` from `@/services/ai/demoMode`.
- Produces: two optional props — `allowedKinds?: readonly ScopeKind[]` (absent ⇒ today's entries) and `onScopeChange?: (sel: ScopeSelection | null) => void`.

- [ ] **Step 1: Imports and constants**

After the `@/services/knowledgeBase` import add:

```ts
import { DEMO_MODE } from '@/services/ai/demoMode';
import {
  availableKinds, scopeLabel, semestersAvailable,
  type ScopeKind, type ScopeSelection, type Semester,
} from '@/services/scopeSelection';
```

and after `const ENTIRE_UNIT = '__entire_unit__';`:

```ts
/** Pseudo unit ids for «الفصل كاملًا»; they never reach getLessonsForUnit. */
const entireSemesterId = (s: Semester) => `__entire_sem_${s}__`;
const semesterFromId = (id: string | null): Semester | null =>
  id === entireSemesterId(1) ? 1 : id === entireSemesterId(2) ? 2 : null;
```

- [ ] **Step 2: Props**

In `interface Props` add (after `onSelectionDetail`):

```ts
  /**
   * Which scopes to offer. Absent = what the picker has always offered (lesson,
   * entire unit, entire book). `'semester'` is opt-in, and is dropped when
   * there is only one semester or DEMO_MODE is on — see `availableKinds`.
   */
  allowedKinds?: readonly ScopeKind[];
  /** The structured selection (ids, not a title); null when nothing complete is picked. */
  onScopeChange?: (selection: ScopeSelection | null) => void;
```

and add `allowedKinds, onScopeChange,` to the destructured props of `TopicSelector`.

- [ ] **Step 3: Derived values**

After `const unitGroups = useMemo(...)` add:

```ts
  const kinds = availableKinds(gradeId, subjectId, allowedKinds, DEMO_MODE);
  const semesters = kinds.includes('semester') ? semestersAvailable(gradeId, subjectId) : [];
```

Replace the existing `lessons` definition with:

```ts
  const pickedSemester = semesterFromId(selectedUnitId);
  // «الكتاب كاملًا» and «الفصل كاملًا» pick no single unit, so no lesson picker follows.
  const isWide = selectedUnitId === ENTIRE_BOOK || pickedSemester !== null;
  const lessons = selectedUnitId && !isWide ? getLessonsForUnit(selectedUnitId) : [];
```

- [ ] **Step 4: The derive effect — replace it whole**

Replace the whole `useEffect(() => { const noDetail … }, [selectedUnitId, selectedLessonId, lang]);` block with:

```ts
  useEffect(() => {
    const noDetail: TopicSelectionDetail = { unitOrder: null, unitTitle: null, lessonTitle: null, lessonId: null };
    const base = { gradeId, subjectId };
    if (!kbAvailable) return;
    if (!selectedUnitId) {
      // Mount with a topic already passed in: leave it alone. Only a selection
      // the teacher actually made and then cleared should empty the field.
      if (!touched.current) return;
      onChange('');
      onSelectionDetail?.(noDetail);
      onScopeChange?.(null);
      return;
    }

    if (selectedUnitId === ENTIRE_BOOK) {
      onChange(t('entireBook'));
      onSelectionDetail?.(noDetail);
      onScopeChange?.({ kind: 'book', ...base });
      return;
    }

    const semester = semesterFromId(selectedUnitId);
    if (semester) {
      const sel: ScopeSelection = { kind: 'semester', ...base, semester };
      onChange(scopeLabel(sel, lang));
      onSelectionDetail?.(noDetail);
      onScopeChange?.(sel);
      return;
    }

    const unit = units.find(u => u.id === selectedUnitId);
    if (!unit) return;
    const unitTitle = lang === 'ar' ? unit.titleAr : unit.titleEn;

    // Unit chosen but no lesson yet → wait for lesson picker
    if (!selectedLessonId) {
      onChange('');
      onSelectionDetail?.({ unitOrder: unit.order, unitTitle, lessonTitle: null, lessonId: null });
      onScopeChange?.(null);
      return;
    }

    if (selectedLessonId === ENTIRE_UNIT) {
      onChange(unitTitle);
      onSelectionDetail?.({ unitOrder: unit.order, unitTitle, lessonTitle: unitTitle, lessonId: null });
      onScopeChange?.({ kind: 'unit', ...base, unitId: unit.id });
      return;
    }

    const lesson = lessons.find(l => l.id === selectedLessonId);
    if (lesson) {
      // Lesson title alone for precise KB / NCCD matching
      const lessonTitle = lang === 'ar' ? lesson.titleAr : lesson.titleEn;
      onChange(lessonTitle);
      onSelectionDetail?.({ unitOrder: unit.order, unitTitle, lessonTitle, lessonId: lesson.id });
      onScopeChange?.({ kind: 'lesson', ...base, lessonId: lesson.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId, selectedLessonId, lang]);
```

- [ ] **Step 5: Render changes**

(a) `selectedUnit` — change `selectedUnitId && selectedUnitId !== ENTIRE_BOOK` to `selectedUnitId && !isWide`.

(b) `unitDisplayValue` — replace with:

```ts
  const unitDisplayValue = selectedUnitId === ENTIRE_BOOK
    ? t('entireBook')
    : pickedSemester
      ? scopeLabel({ kind: 'semester', gradeId, subjectId, semester: pickedSemester }, lang)
      : selectedUnit
        ? (selectedSemesterLabel ? `${selectedSemesterLabel} · ${unitTitle}` : unitTitle)
        : '';
```

(c) In the unit dropdown, replace the single «📚 الكتاب كاملًا» `DropdownItem` with:

```tsx
            {kinds.includes('book') && (
              <DropdownItem
                label={`📚  ${t('entireBook')}`}
                selected={selectedUnitId === ENTIRE_BOOK}
                onPress={() => handleUnitSelect(ENTIRE_BOOK)}
                accent={accent} colors={colors} isRTL={isRTL}
              />
            )}
            {semesters.map(semester => (
              <DropdownItem
                key={`entire-sem-${semester}`}
                label={`🗓️  ${scopeLabel({ kind: 'semester', gradeId, subjectId, semester }, lang)}`}
                selected={selectedUnitId === entireSemesterId(semester)}
                onPress={() => handleUnitSelect(entireSemesterId(semester))}
                accent={accent} colors={colors} isRTL={isRTL}
              />
            ))}
```

(d) The lesson picker block condition `selectedUnitId && selectedUnitId !== ENTIRE_BOOK && (` becomes `selectedUnitId && !isWide && (`.

(e) In the lesson dropdown wrap the «📖 الوحدة كاملةً» `DropdownItem` in `{kinds.includes('unit') && ( … )}`.

- [ ] **Step 6: Typecheck, run the suites, and check it by hand**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15 && (cd artifacts/mobile && pnpm test 2>&1 | tail -6)`
Expected: typecheck clean; 0 test failures.

Then confirm the invariant — *no screen changed*: `git diff --stat main -- artifacts/mobile/app` must print nothing (no generator screen is edited, so none passes `allowedKinds`, so none shows a semester entry).

Manual check (a throwaway check, nothing committed): temporarily pass `allowedKinds={['lesson','unit','semester','book']}` in `artifacts/mobile/app/ai-tools/worksheet.tsx`, run `EXPO_PUBLIC_DEMO_MODE=false pnpm run dev:mobile:web`, pick Grade 10 → Mathematics: the first dropdown lists «الكتاب كاملًا», «الفصل الأول كاملًا», «الفصل الثاني كاملًا» then the units; choosing a semester shows it in the field, hides the lesson picker, and sets the topic to «الفصل الأول كاملًا». Under Grade 10 → Financial literacy there is no semester entry. With `EXPO_PUBLIC_DEMO_MODE` unset the semester entries are absent. **Revert the worksheet edit** (`git checkout artifacts/mobile/app/ai-tools/worksheet.tsx`) before committing, and report what you saw — if the web build cannot be run here, say so rather than claiming it was checked.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/ui/TopicSelector.tsx
git commit -m "feat: TopicSelector offers a whole semester and emits a structured scope"
```

---

### Task 6: Record it (`STATUS.md`) and final verification

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Add one bullet under "What works today"**

```markdown
- **Wide-scope selection, foundation only (2026-10-13; spec
  `docs/superpowers/specs/2026-10-13-wide-scope-selection-design.md`).**
  `services/scopeSelection.ts` (what a unit / semester / book scope covers),
  `services/scopeGrounding.ts` (tiered, ≤ 6 000-char digest), `AIRequest.scope`,
  server-side page pooling and `scopeKey` in the artifact cache key all exist
  and are tested, and `TopicSelector` can offer «الفصل كاملًا». **No generator
  screen opts in yet**, so nothing a teacher sees has changed: «الكتاب كاملًا»
  and «الوحدة كاملةً» still only set a topic string and are still ungrounded
  until pieces 2 (quiz, worksheet, homework, game) and 3 (the rest) adopt
  `onScopeChange` + `scopeRequestFields`.
```

- [ ] **Step 2: Full verification before claiming done**

Run each and read the output (do not summarise from memory):
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
cd ../api-server && pnpm build && pnpm test
git diff --stat main -- artifacts/mobile/app            # must be empty
```
Expected: typecheck clean; both suites 0 failures; the last command prints nothing.

- [ ] **Step 3: Commit and push**

```bash
git add STATUS.md
git commit -m "docs: STATUS — wide-scope foundation landed, no screen opted in"
git push -u origin ccr-c46c10c5-ctxbp3
```
Then update PR #1045's title/description from "spec" to "spec + foundation (piece 1)" and watch CI.

---

## Self-Review

**Spec coverage**
- §1 selection type + helpers → Task 1 (`ScopeSelection`, `lessonsInScope`, `scopeLabel`, `scopeKey`, plus `unitsInScope`, `availableKinds`, `parseScope`).
- §2 `TopicSelector` (semester entries, `onScopeChange`, `allowedKinds`) → Task 5; «hidden with one semester» and «off under DEMO_MODE» → `availableKinds` (Task 1) tested.
- §3 grounding (bounded digest, never fuzzy, lesson delegates) → Task 2.
- §4 API request + server pooling, `isNccdUnitId` validation, list cap → Tasks 3–4 (the cap's `.slice(0, 24)` is implemented but not asserted: 24 distinct valid NCCD ids are not available as fixtures; it is a one-line bound on request-controlled input).
- §5 cache key → Task 4 (`scopeKeyOf`, `lessonRefOf`). Deviation (no `PROMPT_VERSION` bump) is justified and tested ("hashes exactly as before").
- §6 saved/reopened materials → `parseScope` + `scopeKey` give screens the round-trip (tested); wiring each screen's saved form state is piece 2 (spec's rollout already defers screen adoption). Called out in STATUS.
- §7 existing book/unit entries → they now emit structured selections via `onScopeChange`; their *behaviour* is fixed when screens adopt it (piece 2). Called out in STATUS, not claimed as fixed.
- Rollout invariant "no visible change" → `git diff --stat main -- artifacts/mobile/app` empty; lesson request unchanged (`scopeRequestFields` returns `{}`; existing `generatorRequests` tests).

**Placeholder scan:** none — every code step has the code; the only prose-described edit is the spec amendment in Task 1 Step 5 (documentation, with the exact replacements named).

**Type consistency:** `ScopeSelection`/`ScopeKind`/`Semester` (Task 1) are the types Tasks 2, 3 and 5 import; `ScopeGrounding.unitIds`/`scopeKey`/`kind` (Task 2) are what `scopeRequestFields` (Task 3) reads; the wire shape `{ kind, scopeKey, unitIds }` is identical in `AIRequest.scope` (Task 3), `parseWideScope`/`WideScope` and `scopeKeyOf` (Task 4). `kinds`/`semesters`/`isWide`/`pickedSemester` are defined in Task 5 Step 3 before their use in Steps 4–5.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-13-wide-scope-selection-foundation.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.
2. **Inline Execution** — run the tasks in this session with checkpoints.
