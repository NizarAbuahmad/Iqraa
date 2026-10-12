# Real book items on the live model path — design addendum

Status: approved 2026-10-12 ("do it") with the three open questions resolved as proposed (see "Resolved questions"). Nothing is built. Extends
`2026-10-12-book-items-design.md` (the "live-AI path: unchanged" line there is
what this changes).

## Problem

PR #1021 serves real NCCD maths items to the evaluation generator, but only to
`generateMockEvaluation`, which `POST /evaluations/:id/generate` calls only when
live AI is off (`routes/evaluations.ts`, the `else` of `if (live)`). Production
runs `AI_LIVE_MODE=true` (STATUS.md, "Live AI is on, 2026-08-20"), so no
production evaluation draws a book item. This addendum puts them on the model
path.

## What the live path does today (read from the code, 2026-10-12)

1. `generateWithModel({ objectives, assessmentTypes, count, difficulty, … })`
   asks the model for `count` questions (`evaluation.targetQuestionCount`).
2. `validateGenerated(result.questions, …)` drops malformed questions and
   near-duplicates (the later of two similar stems loses).
3. `verifyAnswerKeys` marks SymPy-confirmed keys `verified`; a question with no
   `check` is kept as `verified:false, code:"no_key"`. It removes nothing.
4. **If the model returned more than `count`, the surplus is cut from the END**
   (`keyCheck.kept.splice(targetQuestionCount)`).
5. `partitionForRegeneration` soft-deletes every previous `source:"ai"` question,
   the new ones are inserted with `source:"ai"`, and the evaluation records
   `generator: "llm"`, `modelId`, `generationParams`.
6. On regeneration the stems the teacher was already shown go into the prompt as
   `avoid`, with one retry if the new paper repeats most of them.
7. **The model chooses each question's `competencyKey` and `marks` itself**
   (`parseGeneratedQuestions`); no code allocates them, unlike the mock path,
   where `allocateQuestions` fixes the competency of each slot and
   `MARKS_BY_COMPETENCY` (1/2/3/4) fixes its marks.

Two of these decide the design. (4) means a book question appended after the
model's would be the first thing cut. (7) means a book question needs a
competency and marks assigned by rule.

## Decisions

| Question | Decision |
| --- | --- |
| Approach | The model writes the paper as today; the system adds real book questions after, deterministically. The model is never shown book items as examples and never asked to reproduce them. |
| How many | At most `floor(count / 2)`, further capped by what the lesson has and by the requested types, as in the mock path. Zero when the subject is not mathematics, no objective has a `lessonId` with items, or no matching type was requested. |
| Paper length | Decide the number `k` of book questions first; ask the model for `count − k`; add `k` book questions. The paper stays `count` long. |
| Competency and marks | By kind: an exercise is `application` (3 marks), a unit-test multiple-choice question is `understanding` (2 marks). Stated as nominal, as it already is on the mock path. |
| Rollout | Behind a server flag, **off by default**. Turned on after a person has compared the 24 items with the printed books. |
| Shared code | The existing `bookQuestion` in `mockGenerator.ts` is **exported** (not moved) and takes a `slot(kind)` function for competency and marks; the mock path passes a fixed slot, unchanged in behaviour. The new live-path code (`planBookDraw`, `drawBookQuestions`, `assembleLivePaper`) lives in `modules/assessment/bookQuestions.ts`. Moving it would have dragged `buildRubric`/`BANK_TIER` along or created an import cycle, for no gain. |

## Design

### 1. Plan, then ask the model for less

Before the model call, in the route:

- `planBookDraw({ objectives, assessmentTypes, count, subjectId, enabled })`
  returns `k` and does not draw. It counts eligible items per objective
  (`bookItemsForLesson(objective.lessonId)`, filtered by kind against the
  requested types) and returns `min(floor(count / 2), what a seeded dry run of
  the real draw delivers)`, not the raw eligible count: two near-duplicate book
  items are never both drawn, so counting raw items would ask the model for too
  few questions and the paper would come back short. It returns 0 when `enabled`
  is false or the subject is not mathematics.
- `runLlm` is called with `count: evaluation.targetQuestionCount − k`.
- If the model is later short or fails, nothing changes: its existing error and
  shortfall handling stands.

### 2. Draw after the model, against its questions

After `generateWithModel` returns and before `validateGenerated`:

1. Trim the model's own questions to `count − k` (the model is free to send
   more), with the existing "returned N more than requested" note. This is what
   stops the final trim cutting a book question. The final trim stays as a
   backstop.
2. `drawBookQuestions({ objectives, assessmentTypes, difficulty, k, accepted:
   <the model's questions>, session, rng })` draws up to `k` book questions
   with the clash check from the mock path (`stemSimilarity` /
   `DUPLICATE_THRESHOLD` / `promptOf` from `validator.ts`), so a book question
   that would be rejected as a near-duplicate of a model question is redrawn,
   not drawn and then lost. Objectives are visited round-robin in a shuffled
   order, as the mock does.
3. The book questions are added to the model's, then the combined list is stably
   sorted into the paper's type blocks (order of `assessmentTypes`), because the
   model was told to lay the paper out in consecutive type blocks; the final trim
   cannot fire when a book share exists. The whole list then goes through
   `validateGenerated` and `verifyAnswerKeys` exactly as today.

If the clash check exhausts the pool, fewer than `k` are drawn and the paper is
short by the difference. That is reported through the existing `produced` /
`requested` fields and a note; it is rare (the pool is large relative to `k`)
and strictly better than a silently shorter paper with a false reason.

### 3. Regeneration varies the book questions too

`previousQuestions` is already loaded. The ids in their
`aiMetadata.bookItemId` seed the per-request `session` set so a regeneration
prefers items the teacher has not seen. When that leaves fewer than `k`
available, the seed is dropped and repeats are allowed: a repeated real
question is acceptable, a short paper is not.

### 4. What is recorded and shown

- `evaluation.generator` stays `"llm"`; the model wrote most of the paper.
- Each book question carries `aiMetadata.generator: "book"` and the keys Task 4
  of the first plan already reads (`bookItemId`, `bookStatus`,
  `bookCitationAr/En`, `bookLabelAr/En`), so the evaluation screen shows the
  citation and key label with no mobile change.
- `generationParams.bookItems = { enabled, planned, drawn, ids }` is written on
  live-path maths papers only (not the mock path), including when the flag is
  off, so "why did this paper have no book items" is answerable from the row.
- One `generationNotes` line when any were drawn, in English like the route's
  other notes: "N question(s) are real items from the NCCD books, with answers
  computed by SymPy from the question text; they are labelled on each question."
- No change to `GENERATION_PROMPT_VERSION`: the prompt text is unchanged; only
  its `count` differs.

### 5. The flag

`BOOK_ITEMS_LIVE` (api-server env), true only when exactly `"true"`, like
`AI_LIVE_MODE`. Off by default so the merge changes nothing in production. Read
at request time, not import time. Declared in `LOCAL_SETUP.md` and
`docs/deploying.md`. Because an unset flag is a silent no-op (the trap
CLAUDE.md records for `EXPO_PUBLIC_*`), the `generationParams.bookItems.enabled`
field above is the way to see which state a paper was made in.

### 6. Testing and rollout

- `bookQuestions.test.ts`: `isBookItemsLiveOn`, `planBookDraw` (zero for non-maths, flag off, no
  `lessonId`, no matching type; the half-paper cap; the eligible cap), and
  `drawBookQuestions` (never a near-duplicate of a supplied model question;
  never a type that was not requested; `check` always null; unit-test choices
  self-mark; regeneration seed prefers unseen items and falls back to repeats).
- The route's assembly is a short pure function, `assembleLivePaper`
  (`modelQuestions`, `k`, trim, draw, append), tested with a fake model
  response: the paper is exactly `count` long; the model's surplus is trimmed
  before the book questions are added; a model that returns fewer than asked
  leaves the book questions intact.
- Existing mock-path tests must pass unchanged: the extraction is a move, not a
  rewrite.
- Flag off: a byte-for-byte test that the request to the model and the stored
  rows are identical to today's for a maths evaluation.
- One commit moves the builder (mock tests green), one adds the live path.
- Merge changes nothing in production while the flag is off. Turning it on is an
  env change on iqraa-api, taken after the 24 items are compared with the books.
  No schema change, no mobile change, no `app.json` `version` bump.

## Resolved questions

1. **Flag default: off.** Merging changes nothing in production; turning it on is
   an env change after the 24 items have been compared with the printed books.
2. **Competency and marks: by kind** (exercise = application, 3 marks; unit-test
   choice = understanding, 2 marks), nominal.
3. **Position: appended** after the model's questions (amended: ordered into type blocks, see §2).

## Not decided here

- Giving the model the book items as examples. Rejected for this slice: the
  model could reword them, which would lose the citation and the computed key.
- The mobile offline quiz/exam path and `routes/generate.ts` (quizzes,
  worksheets): separate slices.
- Extracting unit-test items 6–11 so some items can be `verified`.
