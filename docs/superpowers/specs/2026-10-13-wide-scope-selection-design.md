# Wide-scope selection — foundation (piece 1 of 3)

Status: draft for review · 2026-10-13

## Problem

A teacher picking a topic in any generator can choose one lesson, or one of two
extra entries in `TopicSelector`: «الكتاب كاملًا» and «الوحدة كاملةً». They asked
to also choose **a whole semester** (and have the whole-book / whole-unit options
actually work), on every generator.

Those two entries do not do what they say today. Verified by reading the code
(not by running the app):

- `TopicSelector` sets the topic *string* to «الكتاب كاملًا» (book) or to the
  unit's title (unit). Nothing else is carried.
- The eight generator screens (`quiz`, `worksheet`, `activity`, `lesson-plan`,
  `lesson-flow`, `game`, `slides`, `classroom/builder`) take only that string
  (they do not use `onSelectionDetail`; only the chat screen does) and call
  `resolveGeneratorGrounding(topic)`. That resolves **one lesson or none**
  (`resolveGroundedKbLesson`: exact title, else a confident fuzzy hit).
- So «الكتاب كاملًا» grounds to nothing (or, worse, to whichever lesson the
  string happens to be closest to), and a unit title grounds to a single lesson
  or nothing. The paper is then ungrounded or silently built from one lesson.
  This is the "a lesson title does not identify a lesson" trap in CLAUDE.md.

Adding a semester entry the same way would be a third entry with the same defect.

## Goals

1. `TopicSelector` offers, for the picked grade + subject: **one lesson**,
   **a whole unit**, **a whole semester** (S1 / S2, only those that exist), and
   **the whole book**.
2. The selection is a **structured value**, not a string. Nothing downstream
   re-derives it from a title.
3. Grounding for a wide scope is built from the real lessons in range: a bounded
   digest for the prompt, plus book passages the server already knows how to
   pool across units.
4. The shared artifact pool never serves a wide-scope artifact to a different
   scope (or a single lesson's to a wide scope).
5. Reopening a saved material restores its scope.

## Non-goals (pieces 2 and 3, each with its own spec)

- Spreading questions across the lessons in range, per-lesson quotas, math-bank
  sampling (piece 2: quiz, worksheet/homework, game, evaluations).
- What "a whole semester" means for lesson plan, slides, activity, lesson-flow,
  classroom builder (piece 3: overview / revision variants in both the offline
  blueprint and the live prompt).
- Until pieces 2 and 3 land, a tool that has not been taught a wide scope
  **hides the wide options** rather than guessing (see *Rollout*).

## Design

### 1. The selection type

New pure module `artifacts/mobile/services/scopeSelection.ts` (no React Native
imports, so `node --test` can load it, like `generationScope.ts`):

```ts
export type ScopeKind = 'lesson' | 'unit' | 'semester' | 'book';

export type ScopeSelection = {
  kind: ScopeKind;
  gradeId: string;
  subjectId: string;
  /** kind 'unit': the KB unit id. */
  unitId?: string;
  /** kind 'semester': 1 | 2. */
  semester?: 1 | 2;
  /** kind 'lesson': the KB lesson id (never a title). */
  lessonId?: string;
};
```

Plus pure helpers:

- `lessonsInScope(sel): KBLesson[]` — the KB lessons the selection covers, in
  book order, built from `getUnitsForSubjectGrade` / `getLessonsForUnit` /
  `KB_BOOKS[].semester`. This is the one place that knows what "semester 2"
  means; everything else calls it.
- `scopeLabel(sel, lang): string` — display/topic text («الفصل الأول كاملًا»,
  «الوحدة: …», or the lesson title). This replaces the strings
  `TopicSelector` writes into `topic` today.
- `scopeKey(sel): string` — stable, id-only key (`book:<grade>:<subject>`,
  `sem:<grade>:<subject>:1`, `unit:<unitId>`, `lesson:<lessonId>`). Used for the
  cache key, saved state, and equality.

`kind: 'lesson'` is exactly today's single-lesson behaviour, but now carries the
id instead of re-deriving it — which also fixes the title-drift trap for the
single-lesson case on these screens.

### 2. `TopicSelector`

- Adds «الفصل الأول كاملًا» / «الفصل الثاني كاملًا» entries to the first
  dropdown, between «الكتاب كاملًا» and the unit list (only semesters that have
  a visible book for this grade + subject; `groupUnitsBySemester` already knows).
- Replaces `onChange(topic: string)`-only with a new `onScopeChange(sel | null)`.
  `onChange(topic)` stays (computed from `scopeLabel`) so the screens that have
  not migrated keep compiling; `onSelectionDetail` is kept for chat.
- A new prop `allowedKinds: ScopeKind[]` (default `['lesson']` until a screen
  opts in) controls which of the four are offered. This is what makes the staged
  rollout safe.
- The existing "reset on grade/subject change" guard is kept as is.

### 3. Grounding a wide scope

`resolveGeneratorGrounding` is lesson-only and stays that way. A sibling in
`kbContext.ts`:

```ts
resolveScopeGrounding(sel, lang, options): ScopeGrounding
// { grounded: true, kind, lessons: KBLesson[], context: string,
//   unitIds: string[] (NCCD ids only), ungroundedNote: '' }
```

- `kind: 'lesson'` delegates to `resolveGeneratorGrounding({ lessonId })` — no
  behaviour change.
- Wide kinds build `context` as a **bounded digest**, not N copies of
  `serializeLessonContext`: for each unit, its title; for each lesson its title,
  up to 3 official outcomes (النتاجات) and up to 3 key terms. A hard character
  budget (like the server's `PASSAGE_CHAR_BUDGET`) is enforced with the
  truncation said out loud («…ولم تُدرج بقية الدروس»), never silent.
- It never fuzzy-matches: an empty `lessonsInScope` is `grounded: false` with the
  existing ungrounded note. Fail closed or label honestly.

### 4. API request

`AIRequest` gains an optional `scope`:

```ts
scope?: { kind: ScopeKind; scopeKey: string; unitIds?: string[]; lessonIds?: string[] }
```

`unitId` / `lessonId` stay for `kind: 'lesson'` exactly as they are now.
`additionalContext` carries the digest, `contextSource: 'curriculum'` (it is
derived from the KB, not teacher-pasted).

On the server, `withGrounding` gains a wide branch: when `scope.unitIds` has
more than one NCCD unit it calls the existing `groundingForObjectives`-style
pooling (`passagesForUnit` per unit, merged by score, same
`PASSAGE_LIMIT`/`PASSAGE_CHAR_BUDGET`). It validates `scope.unitIds` with
`isNccdUnitId` and caps the list length (request-controlled input).

### 5. Artifact pool key

`generationKey.ts` hashes `lessonId`/topic today. Hash `scopeKey` into
**both** the strict and the coarse key and bump `PROMPT_VERSION`. A "semester 1" request
and a lesson request then can never share a slot. `lessonRefOf` (browse label
only) returns `scopeKey` for wide kinds.

### 6. Saved / reopened materials

Saved form state records `scopeKey`'s inputs (`kind` + the id), and
`reopenedGenerationScope` rebuilds a `ScopeSelection` from it rather than
grounding a title. A material saved before this change has no scope and keeps
the current behaviour (`kind: 'lesson'` from its topic).

### 7. Existing «الكتاب كاملًا» / «الوحدة كاملةً»

They become `kind: 'book'` and `kind: 'unit'` selections and go through the same
path, so the broken behaviour above is fixed as a side effect, not left as a
special case.

## Risks / things not yet verified

- **Digest size.** I have not measured lessons per semester per subject. If a
  full G10 maths semester exceeds the budget, the digest drops to
  *unit titles + lesson titles only* beyond the budget. To be measured when
  writing the plan.
- **NCCD id coverage.** Only the G10 maths S1/S2 units are in the NCCD id space
  (`nccdUnitId` returns undefined for legacy rows like `kbu-chem-1`). A semester
  of a subject with no NCCD ids is grounded by the app-side digest only, with no
  server book passages. The UI should say so (reuse `notGroundedHint` wording).
- **`DEMO_MODE`.** The offline path must handle a wide scope too (it is what the
  web build runs). Piece 1 gives it the lesson list and label; piece 2/3 decide
  what it generates.
- **iqra.tsx (chat)** uses `onSelectionDetail` and a single lesson id; it keeps
  `allowedKinds: ['lesson']` and is out of scope.

## Rollout

Piece 1 ships with `allowedKinds` still `['lesson']` on every screen except
those that have already been taught a wide scope. So piece 1 on its own changes
nothing a teacher sees, except that the single-lesson path now carries the id.
Piece 2 turns on `['lesson','unit','semester','book']` for quiz, worksheet,
homework and game; piece 3 for the rest.

## Tests (TDD, inside the existing globs)

`artifacts/mobile/services/__tests__/`:
- `scopeSelection.test.ts` — `lessonsInScope` for each kind (G10 maths S1 ≠ S2,
  book = S1 ∪ S2, unit = its lessons in order, unknown id = empty); `scopeKey`
  stable and distinct; `scopeLabel` Arabic/English.
- `scopeGrounding.test.ts` — wide scope is grounded without any title search;
  digest respects the budget and says when it truncated; empty scope is
  ungrounded; `kind: 'lesson'` equals today's `resolveGeneratorGrounding`.
- A request-builder test that a lesson request is byte-identical to today's
  (guards the "no visible change" claim).

`artifacts/api-server/src/**/__tests__/`:
- `generationKey` — different `scopeKey` ⇒ different strict key; same
  `scopeKey` ⇒ same key.
- `grounding` — wide branch pools across units, rejects non-NCCD ids, caps list
  length.

## Decisions (resolved in review, 2026-10-13)

1. «الفصل كاملًا» is **hidden** when a grade + subject has only one semester's
   book in the KB — it would equal «الكتاب كاملًا». `semestersAvailable` is
   derived from `KB_BOOKS`, never hard-coded.
2. Wide scopes stay **off under `DEMO_MODE`** until piece 2 teaches the offline
   generators. `TopicSelector` intersects `allowedKinds` with `['lesson']` when
   `DEMO_MODE` is true, so the offline path can never receive a scope it cannot
   honour.
