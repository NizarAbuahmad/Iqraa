# Wide-scope assessment tools — quiz, worksheet, homework, game (piece 2 of 3)

Status: draft for review · 2026-10-14 · builds on
`2026-10-13-wide-scope-selection-design.md` (piece 1, merged as #1045)

## Problem

Piece 1 gave the picker a structured scope (`lesson | unit | semester | book`),
a bounded grounding digest, `AIRequest.scope`, and a scope-aware cache key. **No
screen uses any of it yet.** A teacher still cannot make a paper for a semester,
and «الكتاب كاملًا» / «الوحدة كاملةً» still only write a topic string that grounds
to one lesson or none.

This piece makes **quiz, worksheet, homework and game** honour a unit / semester / book
scope, in both the offline path (the web build, `DEMO_MODE`) and the live path.
The game screen needs its own adoption: `game.tsx` builds its own `generateQuiz`
request and its own `TopicSelector` (its 5/8/10/12 count picker is unchanged).

## Goals

1. On quiz, worksheet, homework and game the teacher can pick a unit, a semester or the
   whole book, and the paper's questions come from the lessons in that scope.
2. The teacher chooses **how questions are spread** over those lessons («توزيع
   الأسئلة»): *balanced by unit* (default) or *random*.
3. The count picker offers bigger papers on a wide scope (25 and 30).
4. The offline generators and the live prompts implement the **same** plan
   (CLAUDE.md's "two places" rule), and a test pins them together.
5. The screen says which lessons the paper covers, and says honestly when that is
   model-reported rather than known.
6. A saved paper reopens on its own scope and distribution (piece 1 deferred this).
7. A wide scope that cannot be grounded is refused, not generated mislabeled.

## Non-goals

- Lesson plan, slides, activity, lesson-flow, infographic, classroom builder —
  piece 3.
- Evaluations (`/evaluations/:id/generate`): a separate pipeline driven by
  objectives, not by the topic picker. Untouched.
- Papers above 30 questions (see *Decisions*, 3).
- Weighting questions by lesson length (`KBLesson.periods`): missing for some
  books, and a short unit could get nothing.
- Letting the teacher tick individual units or lessons.

## Decisions (resolved with the product owner, 2026-10-14)

1. **Distribution is the teacher's choice.** Two modes, shown only for a unit,
   semester or book scope: «متوازن حسب الوحدة» (default) and «عشوائي».
2. **Bigger papers on a wide scope.** The count picker gains larger numbers.
3. **The larger numbers are 25 and 30, not 30/40/50.** Found while designing:
   `quizWanted` (api-server `lib/generationShape.ts`) ignores any count above 30,
   which silently turns the top-up/trim enforcement off, and the output ceiling in
   `quizTokens` / `worksheetTokens` (`routes/generate.ts`) is already clamped at
   24 000 tokens — roughly 28 quiz or 25 worksheet questions at the current
   per-question estimates. A 40 or 50-question paper in one call would arrive
   truncated. Larger papers need generation split across calls: a separate, larger
   change, deliberately not in this piece.

## Design

### 1. Coverage plan — `artifacts/mobile/services/coveragePlan.ts` (pure)

```ts
export type Distribution = 'balanced' | 'random';
export type PoolLesson = { id: string; unitId: string };

planCoverage(
  pool: readonly PoolLesson[],    // the request's lesson table, in book order
  count: number,
  mode: Distribution,
  opts?: { offset?: number; random?: () => number },
): number[]                       // length === count, indices into pool, one lesson per question slot

buildCoverage(scope: ScopeSelection, lang, count, mode, opts?)
  // builds the pool from piece 1's lessonsInScope and returns
  // { lessons: [{ code, id, unitId, title }], slots? }  (slots: balanced only)
```

The plan takes a pool rather than a `ScopeSelection` because the offline
generators only hold the request's lesson table; `buildCoverage` is the one place
that turns a scope into that pool.

- **balanced:** units in book order; every unit gets one slot before any unit
  gets a second; inside a unit, lessons rotate in book order. If `count` is less
  than the number of units, the first `count` units (rotated by `offset`) get one
  each. Deterministic for a given `(scope, count)`.
- **random:** the same slot count, lessons drawn without replacement; a lesson
  repeats only after every lesson was used. It does **not** promise every unit is
  covered. `opts.random` is injectable for tests.
- `offset` rotates where the rotation starts, so an offline *Regenerate* does not
  return the same plan. The offset itself is never sent, but a rotated plan's
  per-lesson counts do reach the live prompt on Regenerate; every rotated plan is
  still unit-balanced for the same scope and count.
- A one-lesson pool returns `count` slots of that one lesson, so the callers need
  no special case, and a single-lesson request behaves as it does today.
- `buildCoverage` uses `lessonsInScope` from piece 1 and nothing else: it never
  searches by title.

### 2. Offline path (`artifacts/mobile/services/ai/generators.ts`)

`quizOnce`, `generateWorksheet` and `homeworkOnce` already build each question
with a maker that takes one lesson's `(topic, kb)` — `makeQuizMCQ_ar(topic, kb, …)`,
`makeWorksheetQ(type, lang, topic, kb, …)` and their siblings.

- When the request carries a wide scope they call `planCoverage` and, **per
  question slot**, resolve that slot's lesson (by id, `getLessonById`) and pass its
  title and `KBLesson` to the existing maker. No bank content changes; the
  per-lesson banks and the maths families are reused as they are.
- Lessons with no offline bank (`NoQuestionBankError`, e.g. a geometry lesson)
  are dropped from the offline plan and reported, not hidden, so one such lesson
  cannot make a whole-book paper throw. The offline path re-plans from
  `coverage.lessons` (it never reads `slots`).
- The offline count caps: `worksheetOnce` and `homeworkOnce` used to clamp the
  count to 20; both clamp at 30 so the 25 and 30 options are honoured.
- A bank that runs out hands its share to other lessons in the plan (the existing
  rule, `quizCount.test.ts`) instead of ending the paper early. The result still
  sets `shortfall` when the whole scope's banks are spent.
- The worked example and the half-solved first question (worksheet) belong to
  slot 1's lesson and still count inside the picked number.
- Each question records which lesson it came from, so the screen can list
  coverage (see §4).
- **`DEMO_MODE`:** piece 1 hides `semester` under `DEMO_MODE` because the offline
  generators could not honour it. Once these three can, `TopicSelector` gets a
  prop `offlineWideScope` (default `false`); quiz, worksheet, homework and game pass
  `true`, which skips the demo gating for them. Every other screen keeps today's
  behaviour until piece 3.

### 3. Live path

- **Request:** `distribution` (`'balanced' | 'random'`) joins the strict key
  fields in `generationKey.ts`. `scopeKey` is already keyed (piece 1). Neither the
  code table nor the slots are hashed: the table is a pure function of the scope
  and, for `balanced`, the slots are a pure function of `(scopeKey,
  numQuestions)`. The wire `coverage` is `{ lessons: [{ code, id, unitId, title }],
  slots? }`. For `random` no per-request assignment is sent, so the pool
  still serves variants instead of every request being unique.
- **Prompt:** `quizPromptAr/En` and `worksheetPromptAr/En` (api-server
  `lib/prompts.ts`) gain a coverage clause, used only when `body.scope` is a wide
  scope. In **both** modes the client sends a lesson-code table for the scope —
  `lessons: [{ code: 'L1', id, unitId, title }, …]`, one entry per lesson in range, derived
  from `lessonsInScope`, so it is a pure function of the scope and never
  differs between two requests for the same scope. For `balanced` it also sends
  the per-slot assignment (`slots: ['L3', 'L7', …]`, from `planCoverage`), but the
  prompt renders it as **per-lesson counts** («L7: 2 questions»), not a slot
  order: a quiz is re-sorted into ministry type blocks and a worksheet is grouped
  by difficulty, so "question 3 is about L7" cannot hold. For `random` it sends no
  `slots`; the clause says to choose lessons at random and repeat none before all
  are used. Homework shares the worksheet prompt builders.
- **Tagging:** each question is asked to carry a `lesson` field holding its `Ln`
  code. The client maps the codes back to lesson ids from the table it sent. The
  server **passes the tag through**; it does not count, trim or reject on it,
  because model tagging is unreliable and a reply must never be thrown away over a
  missing tag.
- **Count:** unchanged — `quizShortfall`, `worksheetShortfall`, the top-up and the
  trim keep working on `numQuestions`. Their tests are extended to 25 and 30. The
  token ceiling is not raised in this piece; at 30 questions it is already
  clamped (see Decision 3), so a 30-question paper is expected to lean on the
  top-up call more often. That cost is to be measured, not assumed (*Risks*).
- **Two places:** the offline plan and the live table come from the same
  `planCoverage` call, and a test asserts that the live prompt's per-lesson counts
  match the multiset of per-lesson counts of the plan the offline generator uses.

### 4. What the teacher sees

- Distribution picker «توزيع الأسئلة» under the topic, only for unit / semester /
  book.
- The count picker appends **25** and **30** to `NUM_Q_OPTIONS` (append, never
  insert — persisted indices, see CLAUDE.md on picker order) and shows them only
  on a wide scope; the saved index of an existing paper still means the same
  number.
- A result line «الدروس المغطاة: …». Offline it is exact. Live it is read from
  the model's tags and labelled «حسب ما أعلنه النموذج»; a question with no tag is
  simply not counted.
- A wide scope that does not ground (`resolveScopeGrounding` → ungrounded, or the
  server finds no usable unit) is **refused before generation** with a message,
  the way `groundedSubjectConflict` refuses a mislabeled topic. «الكتاب كاملًا» no
  longer means "an empty topic".

### 5. Screens — `quiz.tsx`, `worksheet.tsx`, homework (worksheet screen, `isHomework`), `game.tsx`

- `TopicSelector` gets `allowedKinds={['lesson','unit','semester','book']}`,
  `onScopeChange`, and `offlineWideScope`.
- The request is built with piece 1's `resolveScopeGrounding` and
  `scopeRequestFields`. **`scopeRequestFields` is merged over the screen's own
  fields last** (piece 1's final review: spreading the screen's lesson-derived
  `additionalContext` over it would clobber the digest).
- Each screen freezes the wide scope and distribution in its own state at
  generation time (`wideFrozen`), and save, export and present read that, not the
  live pickers — the same rule the screens already follow for grade and subject.
  `GenerationScope` is not extended, which gives the same guarantee without
  widening a shared type.
- `formState` saved with a material gains `scope` and `distribution`. On reopen
  `parseScope` rebuilds the scope; a material saved before this has neither and
  keeps today's behaviour. Piece 1's review: run `parseScope` before
  `scopeLabel` on saved state.
- `TopicSelector` does not emit a scope on mount when a topic arrives as a prop
  (piece 1, by design). Screens opened with a saved scope seed it themselves.
- Game: `game.tsx` gets the same adoption as the quiz screen (its own request and
  `TopicSelector`); its question-count picker (5/8/10/12) is unchanged.

### 6. Files

| File | Change |
| --- | --- |
| `mobile/services/coveragePlan.ts` | new, pure |
| `mobile/services/ai/generators.ts` | quiz / worksheet / homework offline: per-slot lesson |
| `mobile/services/ai/AIService.ts` | `AIRequest.distribution`, `coverage`; `lesson` tag on `QuizQuestion` / `WorksheetQuestion` |
| `mobile/services/generatorRequests.ts` | send `distribution` + `coverage` |
| `mobile/components/ui/TopicSelector.tsx` | `offlineWideScope` |
| `mobile/app/ai-tools/{quiz,worksheet,game}.tsx` | picker, count options, request, saved state, coverage line |
| `mobile/services/i18n.ts` | «توزيع الأسئلة», the two modes, «الدروس المغطاة», the refusal |
| `api-server/src/lib/prompts.ts` | coverage clause in quiz / worksheet prompts |
| `api-server/src/lib/generationKey.ts` | `distribution` in the strict key |
| `api-server/src/lib/generationShape.ts` | pass the `lesson` tag through `normalizeQuiz` / worksheet normalisation |
| `STATUS.md` | what landed, and what was and was not run |

## Risks and things not yet verified

- **Live adherence is not testable.** Tests can pin the table in the prompt and
  that the server preserves tags; they cannot prove the model follows the plan.
  Hence the «حسب ما أعلنه النموذج» label and no server-side rejection.
- ~~**`normalizeQuiz` and the worksheet normaliser may drop unknown question
  fields.**~~ **Resolved:** `normalizeQuiz` mutates the model's question objects in
  place and keeps unknown fields, so a `lesson` tag survives. A test still proves
  it, for the quiz and the worksheet.
- **30-question papers lean on the top-up.** The ceiling is clamped at 24 000
  tokens; extra calls cost budget (`AI_BUDGET_USD`). Measure on the live route
  before enabling 30 on the web build, and drop it if the top-up fires too often.
- **No browser in the build container.** Piece 1's picker entry was never clicked
  through. This piece must say what was run; the screens need a manual check
  (picker, distribution, count options, coverage line, reopen) before the offline
  gate is lifted.
- **Maths verification.** Questions drawn per lesson are still verified one by
  one by the existing paths; a mixed-lesson paper must not change which questions
  may claim «verified». A test per screen's offline output should assert the
  verification flags are unchanged for a single-lesson paper.
- **Pool sharing.** A pooled `balanced` paper is served to every teacher with the
  same `(scopeKey, count, distribution, difficulty, types, …)`. A wrong answer in
  it is everybody's wrong answer, as for lessons today; the existing retire flow
  («بلّغ عن مشكلة») applies unchanged.

## Rollout

Behind nothing — quiz, worksheet, homework and game screens get the new options as
soon as it merges. Mitigations: lesson scope behaves exactly as today (a test pins
that a lesson request is byte-identical, as piece 1 did); 25 / 30 are hidden on a
lesson scope.

**Offline gate — decision, amended after the final review.** This spec first said
the offline gate (`offlineWideScope`) would be lifted only after the manual browser
check above. It was lifted **without** that check: no browser was available, and
production web runs `DEMO_MODE`, so with the gate off the feature would be invisible
to everyone. The gate stays on. The consequence is a duty, not a mitigation: the
first person to open the quiz, worksheet and game screens on the web build must
click through the picker, the distribution control, the 25 / 30 counts, the
coverage line, Save and reopen **before merging**.

## Tests (TDD, inside the existing globs)

`artifacts/mobile/services/__tests__/`:
- `coveragePlan.test.ts` — balanced gives every unit a slot before any second,
  rotates inside a unit, is deterministic, never leaves a unit out when
  `count >= units`, `count < units` covers distinct units, `offset` changes it, a
  one-lesson pool gives `count` slots of that lesson; random is reproducible with
  an injected generator and repeats no lesson until all were used.
- `quizWideScope.test.ts`, `worksheetWideScope.test.ts`, `homeworkWideScope.test.ts`
  — offline output for a real G10 maths semester: every question's lesson is in
  scope; every unit covered at count ≥ units; the count equals the picked number
  (worked example inside it for worksheets); `shortfall` honest when banks run out;
  a lesson-scope request is unchanged.
- `coverageLivePrompt.test.ts` — the client's code table lists the scope's lessons
  and, for `balanced`, the prompt's per-lesson counts match the offline plan's.

`artifacts/api-server/src/**/__tests__/`:
- prompt tests — the coverage clause appears for a wide scope and not for a lesson;
  `distribution` splits the strict key; a lesson request's key is unchanged.
- generation-shape tests — a `lesson` tag survives normalisation; the 25 and 30
  counts are enforced (`quizShortfall`, `worksheetShortfall`, trim).

## Open questions for review

1. Should «توزيع الأسئلة» also appear for a **lesson** scope? Proposed: no — one
   lesson has nothing to distribute over.
2. For the live `random` mode, should the device choose the lessons per slot and
   send `slots` after all (the model told exactly which lessons)? Proposed: no — a
   per-request random assignment would put a unique value in the request and end
   pooling; the code table plus the mode is enough.
