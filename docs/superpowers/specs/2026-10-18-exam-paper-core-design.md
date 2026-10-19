# Exam-paper core: one question-type order, one repeat rule — design

**Status:** proposed. **Scope:** `lib/exam-paper` (new), and the call sites in
`artifacts/api-server` and `artifacts/mobile` named below. **No behaviour
change** for a teacher or a student: same papers, same prompts, same stored rows.

## Why

The quiz (`/ai-tools/quiz`, a paper that stores nothing) and evaluations (rows,
a share link, marks) are two systems and stay two (STATUS.md, «One card for
quizzes and evaluations», 2026-10-18). Merging their *screens* was a navigation
change. Merging their *generators* was left open, and the code shows how little
of it is genuinely the same:

| | Quiz | Evaluation |
|---|---|---|
| Offline | `quizOnce` (`mobile/services/ai/generators.ts`) | `mockGenerator.ts` (API) |
| Live | `/generate/quiz` → `quizPromptAr/En` → JSON → `normalizeQuiz`, top-up, `quizRepeats` | `llmGenerator.ts` → `validateGenerated` |
| Output | in-memory JSON, shared through `ai_artifacts` | typed rows: competency, marks, verified keys |

What *is* duplicated, and was found by reading both sides:

1. **The question-type order lives in four hand-synced lists.**
   `QUIZ_TYPE_ORDER` in `api-server/src/lib/generationShape.ts:140` and in
   `mobile/services/quizPaper.ts:26`; `EXAM_TYPE_ORDER` in
   `api-server/src/modules/assessment/paperOrder.ts:17` and in
   `mobile/services/examBlocks.ts:20`. Each says "keep in step with" the other.
   Only the exam pair is pinned, by a test that reads the mobile file's source
   text with a regex (`paperOrder.test.ts:64`). The quiz order is the exam order
   restricted to four types, so it is derivable.
2. **The repeat rule's inputs are written twice.** `MAX_WORDS_CHANGED = 3`
   (`generationShape.ts:284`, `validator.ts:191`) and the "frame has a letter"
   test `/\p{L}/u` (`generationShape.ts` in `kindOf`, `validator.ts` in
   `dominantKind`) each appear on both sides, with the same `sameKind(…, 3)` call.

## Decisions taken (and why)

1. **Shared core, both pipelines kept** (chosen in conversation, 2026-10-18).
   Over "make the quiz an unsaved evaluation", which would give quizzes
   objective scoping, book items and verified keys, and cost them the offline
   path and the artifact pool. That is a product change, not a refactor.
2. **A new workspace package, `lib/exam-paper`** (chosen over `lib/math-practice`
   and over a drift test). The app cannot import from `api-server`, so a single
   list needs a `lib/` package. `math-practice` would work but its name would
   lie, and a drift test makes drift fail CI rather than become impossible.
3. **The two grouping algorithms are NOT unified.** An earlier reading said both
   sides run one loop. They do not. `kindOf`/`quizRepeats` group greedily by the
   first matching group and *replace* past a third; `dominantKind` measures from
   each stem separately, never chaining, and only *warns* past a quarter. The
   repo documents measuring that difference on 2026-10-17. Unifying them would
   change which papers are flagged or rewritten, so only their shared inputs move.
4. **Count, top-up and replace logic stays where it is.** It runs on different
   shapes (`questions[].text/points` JSON against typed rows with competency
   quotas), and the shortfall arithmetic is one line. Sharing it buys nothing.
5. **Prompt text is out of scope.** Sharing the type contracts of `quizPromptAr/En`
   and `TYPE_CONTRACTS` would change what the model is told: a behaviour change
   and a prompt-version bump (`exam-gen-7`).

## The package

`lib/exam-paper`, pure TypeScript, laid out like `lib/math-practice`
(`package.json` with `exports: ./src/index.ts`, `tsconfig.json` with
`composite`/`allowImportingTsExtensions`, `src/`, `src/__tests__/`).
Its one dependency is `@workspace/math-practice`, for `sameKind`/`stemFrame`.

```ts
// src/index.ts
export const EXAM_TYPE_ORDER: readonly string[];        // the ten types, once
export const QUIZ_TYPES: readonly ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'];
export type QuizType = (typeof QUIZ_TYPES)[number];
export const QUIZ_TYPE_ORDER: readonly QuizType[];      // EXAM_TYPE_ORDER filtered to QUIZ_TYPES
export function inPaperOrder<T>(items: readonly T[], typeOf: (item: T) => string): T[];

export const MAX_WORDS_CHANGED = 3;
export function hasSentence(frame: string): boolean;    // /\p{L}/u — symbol-only stems have no sentence to share
export function sameAsk(frameA: string, frameB: string): boolean; // sameKind(a, b, MAX_WORDS_CHANGED)
```

`inPaperOrder` moves as written (stable sort, unknown types last). `sameAsk`
takes frames, as both call sites already hand `sameKind` a `stemFrame`.

## Call sites

| File | Change |
|---|---|
| `api-server/src/modules/assessment/paperOrder.ts` | re-export `EXAM_TYPE_ORDER`, `inPaperOrder` from the package; delete the local copies |
| `api-server/src/lib/generationShape.ts` | `QUIZ_TYPE_ORDER`, `QuizType` re-exported from the package; `kindOf` uses `hasSentence`/`sameAsk`; drop the local `MAX_WORDS_CHANGED` |
| `api-server/src/modules/assessment/validator.ts` | `dominantKind` uses `hasSentence`/`sameAsk`; drop the local constant; grouping and quota untouched |
| `mobile/services/examBlocks.ts` | re-export `EXAM_TYPE_ORDER` from the package; the block/heading code stays |
| `mobile/services/quizPaper.ts` | re-export `QUIZ_TYPE_ORDER` from the package |

Every re-export keeps the existing export name, so `prompts.ts`, `generators.ts`,
`evaluations.ts` and the existing tests need no edit. The "keep in step with"
comments are deleted: there is nothing left to keep in step.

## Tests

- **New, in the package:** `QUIZ_TYPES` equals today's literal
  `['multiple_choice','true_false','fill_blank','short_answer']`;
  `QUIZ_TYPE_ORDER` equals `EXAM_TYPE_ORDER.filter(in QUIZ_TYPES)`; every quiz type
  is an exam type; `EXAM_TYPE_ORDER` has no duplicates; `inPaperOrder` tests move
  with the function; `sameAsk`/`hasSentence` pinned on the two documented examples
  («الكتلة المولية» for O₂ and Na₂CO₃ is one ask; the cap keeps whole-objective
  stems apart).
- **Replaced:** `paperOrder.test.ts:64` ("matches `examBlocks.ts`") reads the
  mobile file's source with a regex and would fail once that file re-exports.
  It becomes an identity check: the API's and the app's `EXAM_TYPE_ORDER` are the
  package's. Its other cases stay.
- **Unchanged and must still pass, as the behaviour guard:** `paperOrder`,
  `quizMinistryOrder`, `examBlocks`, `quizPrompts`, `quizCount`, the evaluation
  validator suite and the book-item suites.
- **Before/after, not just green:** run `quizRepeats` and `dominantKind` over the
  offline generator's papers for every lesson on the old and the new code and
  compare, as the 2026-10-17 measurement did. The result must be identical.

## Wiring and deploy

- Root `tsconfig.json` gains a reference; `api-server` and `mobile` each add
  `"@workspace/exam-paper": "workspace:*"`; `pnpm-lock.yaml` updates.
- `ci.yml` gets a test step beside «Test practice banks». A package with tests CI
  does not run is unguarded — that has already happened here.
- **Deploy:** `deploy.yml` redeploys the API for any change under `lib/**` ("the
  API bundles those packages"), so this merge ships the API and web together. The
  behaviour is identical, but it is a real deploy.
- API bundles through esbuild and the app through Metro; `math-practice` is
  consumed the same way by both. Verified at build time: API bundle, mobile web
  export, and a signed-in browser pass over the quiz and evaluation screens.
- Mobile imports follow the repo rule: a file loaded by bare `node --test` needs
  explicit `.ts` extensions inside the package.

## Docs

`STATUS.md` gets a dated section. `CLAUDE.md` «A quiz's question types and their
order live in three places» and the evaluations note under it say the order is in
several lists to keep equal; they change to say it is one list in `lib/exam-paper`,
with the prompts and the offline `quizOnce` still separate.

## Out of scope

Prompt text; count/top-up/replace; the two grouping algorithms and their quotas;
the offline banks; `ai_artifacts`; any change to what a teacher receives.
A future "quiz as an unsaved evaluation" is a different project with its own spec.

## Risks

- **A type missing from the quiz list silently drops questions.** `normalizeQuiz`
  drops unrequested types, so a wrong `QUIZ_TYPES` would lose questions without
  an error. Guarded by pinning the literal list in a test.
- **The new package is a new thing to keep working in three build systems**
  (tsc, esbuild, Metro). Guarded by building all three before opening the PR.
- **Doing too much.** The temptation is to also unify `kindOf` and `dominantKind`
  because they look alike. Decision 3 says why not; a reviewer should hold that line.
