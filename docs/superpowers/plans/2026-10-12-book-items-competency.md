# Tell the model what the book supplies — implementation plan

> For agentic workers: use subagent-driven-development. TDD: failing test, then code. Spec:
> `docs/superpowers/specs/2026-10-12-book-items-competency-design.md`.

**Goal:** with `BOOK_ITEMS_LIVE=true`, the model's prompt says what the book supplies and how
many questions of each competency to write so the whole paper meets the difficulty's targets.
Flag off: prompt and behaviour byte-identical.

**Files:** `modules/assessment/competency.ts` (+ `__tests__/competency.test.ts`),
`modules/assessment/bookQuestions.ts` (+ test), `modules/assessment/llmGenerator.ts`
(+ `__tests__/llmGenerator.test.ts`), `routes/evaluations.ts`, then STATUS.md / CLAUDE.md /
`docs/deploying.md` wording. All under `artifacts/api-server/src/` unless stated.

**Global constraints:** no schema, native, mobile or `app.json` change. `allocateQuestions`
with no third argument must return exactly what it returns today (existing tests untouched).
`buildGenerationPrompt` without `supplied` must return exactly today's text. Flag read per
request as before. Implementers commit locally with the two attribution trailers and do not
push; the controller pushes after review.

## Task 1 — `allocateQuestions` can start from questions already on the paper

`allocateQuestions(total, difficulty, supplied?: Partial<Record<CompetencyKey, number>>)`.

Semantics: `total` is the whole paper; `supplied` are questions already on it (counted towards
`total` and towards the shares); the return value is how many NEW questions to add per
competency, summing to `max(0, total − Σsupplied)`. Floor seeding: if the budget allows
`Σ max(0, 2 − supplied[k])` seeds, seed each competency up to two (supplied counting), else
seed none (same all-or-nothing rule as today). Then the existing marks-greedy loop, with shares
computed over supplied + new. With `supplied` absent or all zero the result equals today's for
every (total, difficulty) — pin that for totals 0..40 against a copy of the old behaviour
captured in the test as literal expected objects for a handful of cases (5, 8, 10, 20, 40 ×
3 difficulties generated once from the current code and pasted in).

Tests (red first): (a) the equality pin above; (b) `supplied = {application: 5, understanding: 1}`,
total 10, basic → new counts sum 4, and the whole-paper (supplied + new) shares are closer to the
basic targets than "allocate 4 ignoring supplied + supplied"; (c) supplied larger than total →
all zeros; (d) never negative; (e) the two-per-competency floor counts supplied ones (supplied
understanding=2 gets no seed).

## Task 2 — `planBook`, the supplied summary, and the prompt block

In `bookQuestions.ts`: factor the dry run out of `planBookDraw` into
`planBook(req: BookPlanRequest): { k: number; supplied: BookSupplied }` and make
`planBookDraw(req) = planBook(req).k` (API and every existing test unchanged).
`BookSupplied = { byType: Partial<Record<"short_answer" | "multiple_choice", number>>;
byCompetency: Partial<Record<CompetencyKey, number>>; marks: number }`, summarised from the dry
run's questions (type from the question, competency and marks from the question). k=0 → empty
summary. Export `summariseBook(questions): BookSupplied` (pure, tested).

In `llmGenerator.ts`: `LlmGenerationRequest.supplied?: { count: number; byType; byCompetency;
marks; newByCompetency: Record<CompetencyKey, number>; paperTotal: number }`. When present (and
count > 0), `buildGenerationPrompt` inserts, in the USER message after "Write N questions." and
before Objectives, an English block (the prompt's working language) stating: the paper has
`paperTotal` questions; about `count` of them are already written from the official textbook and
will be added after yours — list them by type and by competency with marks; do not write those;
count them when spreading across types (this restates rule 2 for the whole paper); and "to bring
the whole paper to its target mix, write about: knowledge a, understanding b, application c,
critical_thinking d" using `newByCompetency` (sum = req.count). Absent → no change to the text.
Export `generationPromptVersion(req)` → `GENERATION_PROMPT_VERSION` or
`${GENERATION_PROMPT_VERSION}+book` when `supplied` present; `parseGeneratedQuestions` stamps
`aiMetadata.promptVersion` with it.

Tests (red first): bookQuestions — `planBook(...).k === planBookDraw(...)` for the existing
fixtures; supplied counts match what a `drawBookQuestions` of the same k contains (types,
competencies, marks); k=0 → empty. llmGenerator — a request without `supplied` yields a prompt
equal to one captured from the current code (pin the whole `user` and `system` strings for a
fixture request as literals); with `supplied` the block appears exactly once with the numbers
and `newByCompetency`; version helper; `parseGeneratedQuestions` stamps it.

## Task 3 — route wiring, docs

In the live branch of `routes/evaluations.ts`: call `planBook(...)` once (replacing the
`planBookDraw` call; keep `bookPlanned = plan.k`). When `bookPlanned > 0` compute
`newByCompetency = allocateQuestions(target, difficulty, plan.supplied.byCompetency)` and pass
`supplied` to `generateWithModel` via `runLlm` (the top-up call too: for the top-up pass the same
`supplied` but with `count` = missing and `newByCompetency` re-derived or omitted — simplest
correct choice: omit `supplied` from the top-up, since the first call already carried it; state
the choice in a comment). Record `generationParams["promptVersion"] = generationPromptVersion(...)`
and add `supplied` summary under `generationParams.bookItems.supplied` (so a paper's competency
brief is auditable from the row). No route test (no harness); typecheck + helper tests carry it.

Docs (same commit): STATUS.md — replace the "competency/type mix can skew" known-limit with what
now happens and what is still not covered (the real draw can differ from the dry run by a
question or two; the allocation is a request, the model may still miss it; warnings still don't
block); CLAUDE.md book-items note: one clause (the prompt is told what the book supplies);
spec/plan "Differences" table. The PR body paragraph is updated by the controller.

Verification: `pnpm run typecheck`, `pnpm run build && pnpm test` in `artifacts/api-server`
(previous total 1606; report the new one), and `cd lib/curriculum && pnpm test` unchanged.
