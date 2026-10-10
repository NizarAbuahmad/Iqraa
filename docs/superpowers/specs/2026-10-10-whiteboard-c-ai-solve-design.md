# Whiteboard (سبورة), sub-project C: AI-solved problems on the board

Status: **draft for review** — nothing here is built. Written 2026-10-10.
Builds on A (`2026-10-08-whiteboard-board-design.md`), B1 and B2
(`2026-10-08-whiteboard-b-pages-save-export-design.md`; all merged).

## Context

A gave the teacher a board, B made it keepable. C is the part that needs
judgment about *claims*: a teacher types a maths problem and a worked solution
appears on the page, to be revealed one step at a time in front of the class.

The risk is not the drawing. It is that a model-written solution looks exactly
like a checked one. CLAUDE.md records this failure twice (`verified` set from a
code-computed fallback; «من بنك الأسئلة المُراجَع» printed over model-written
answers), and `STATUS.md` records a false SymPy badge on `P = 1/6`. Every
decision below is shaped by one rule from the A spec, restated here:

> Only the 7 `VERIFIABLE_TOPICS` of the maths verifier may ever be marked
> verified, and only for the **final answer** — the verifier checks no
> individual step. Anything else is labelled AI-written and unchecked. `DEMO_MODE`
> is not touched.

## Decisions made with the owner (2026-10-10)

1. **Steps revealed one at a time, on the page** — the solution is a block on the
   page, saved and exported with the board (not a side panel, not a checker only).
2. **A SymPy disagreement shows nothing.** Retry once with SymPy's answer as the
   target; if the model still disagrees, no solution is shown. Fail closed.
3. **Input is a text box with a symbol row** (`x²  ^  √  ÷  ×  ( )  =`). There is no
   equation keypad in the app today, so this is one small new component.
4. **With live AI off, say so and show nothing.** No canned or mock solution
   (CLAUDE.md: mock content is indistinguishable from real).
5. **Layout: the left ~45 % of the page**, auto-fitted for up to 8 steps; the
   right half stays free for the teacher's own pen work. One block per page.

## Non-goals

Handwriting recognition (needs a vision model; a separate decision); per-step
verification; graphs of solutions; several blocks on one page; editing the AI's
steps; pooling or sharing a solution between teachers; any change to
`DEMO_MODE`, `AI_LIVE_MODE` or the budget caps.

## Design

### 1. The server decides every claim

A new teacher-only endpoint **`POST /generate/solve`**, in `generateRouter`
(`artifacts/api-server/src/routes/generate.ts`), behind the same
`authMiddleware` / `requireRole(TEACHER_ROLES)` / per-user limiter as the other
`/generate` kinds. The client never decides what may be called verified.

Request: `{ problem: string (≤ 400 chars), lang: 'ar' | 'en' }`. Response, on
success:

```
{ problem, steps: string[] (1–8), answer, verification: SolveVerification }
SolveVerification = { verified: boolean; source: 'sympy' | 'unchecked';
                      code: 'verified' | 'no_check' | 'unsupported' | 'undecided'
                          | 'verifier_unreachable' | 'unlinked' | 'restated';
                      understoodAs?: string; computedAnswer?: string | null }
```

Flow, in order:

1. `assertLiveModeEnabled()` — with live AI off the route answers with the
   existing «live mode off» error code; the client shows the AI-off message and
   nothing else (decision 4).
2. **No pooling.** The request is forced to `contextSource: 'teacher'` (as
   `/generate/prompt-slides` does) so `ai_artifacts` never stores or shares it.
3. Quota and budget run first, through the existing `refusalFromCaps`
   (`assertUserQuotaAvailable` + `assertBudgetAvailable`); `completeOnce` runs
   under `withUserAiSlot`; `recordUsage` after. New kind `"solve"` is added to
   `GenerationKind` and `REQUIRED_FIELDS` in `lib/generationShape.ts`
   (`["problem", "steps", "answer"]`).
4. **The model's output** (JSON): `problem` (its restatement), `steps` (strings,
   latin variables and ×, no LaTeX, last step states the result), `answer`, and an
   optional latin `check: { topic, question, answer }` — the same block the exam
   generator already asks for and `parseAnswerKeyCheck`
   (`lib/math-verify/src/answerKey.ts`) already parses. Any `verified`,
   `verifiedBy`, `computedAnswer` or `verification` the model emits is **deleted**
   (the pattern of `stripUnearnedVerification`, `classroomPrompts.ts:733`; that
   function is applied only to classroom decks, so solve needs its own call).
5. **Verification** (§2), then sanitise (§3), then respond.

The prompt lives in `artifacts/api-server/src/lib/` beside the other prompts and
repeats the existing worked-example rules (latin `x`/`y`, `×`, no LaTeX, no
`verified` fields, ≤ 8 steps, one line each, the working must reach the stated
answer). It states that the model must write `check` only for the seven topics
and only when the problem is exactly that.

### 2. Verification: final answer only, fail closed, no false link

Reuse, do not rewrite: `relateAnswerKey(topic, question, answer)`
(`lib/mathVerifierClient.ts`) returns a three-way `KeyRelation`
(`equivalent | distinct | indeterminate | error | unsupported_topic`) and never
throws; `keyVerification.ts` already states the three rules this follows (only a
contradiction removes content; an unreachable verifier changes nothing;
`verified` is only ever the verifier's own word).

| Verifier relation | Result |
| --- | --- |
| `equivalent` **and** the answer is linked (below) | `verified: true`, `source: 'sympy'`, `code: 'verified'` |
| `distinct` | **retry once** with SymPy's `computed_answer` named as the target answer; second `distinct` → respond with no solution (§4 «لم أستطع…»); a retry that is `equivalent` is verified like any other |
| `indeterminate` / `error` / `unsupported_topic` / no or malformed `check` | the solution is kept, `verified: false`, `source: 'unchecked'`, with the matching `code` |
| verifier unreachable | kept, unchecked, `code: 'verifier_unreachable'` (it is a free-tier service that sleeps; never lose a solution because it was asleep) |

Two **link rules** stop a verdict attaching to something it did not judge — the
same class as `keyLinking.ts`'s `key_unlinked`:

- **Answer link.** The displayed `answer` must equal `check.answer` after
  trim/whitespace normalisation; if they differ the solution is kept but
  `verified:false`, `code:'unlinked'`. (Otherwise SymPy could bless
  `check.answer` while the board prints a different final line.)
- **Problem link.** The model could verify the right answer to a *different*
  problem than the one typed. So (a) when the teacher's text is itself a latin
  maths expression that `classifyVerifiableTopic`
  (`lib/math-verify/src/guards.ts:211`, shared by app and API) can classify, the
  topic and normalised payload it extracts must agree with `check`; on a
  disagreement the solution is kept unchecked (`code:'restated'`); and (b) a
  verified solution always carries `understoodAs` — the latin `check.question`
  — and the block shows it (§5), so the teacher sees exactly what the ✓ refers to.
  Arabic prose problems cannot be classified by the existing regexes; for them
  (b) is the only guard, and that limit is stated in the UI copy.

Out of scope and stated: the steps are never checked. A wrong step that reaches
the right answer will sit under a ✓ on the final answer; the always-on label in
§5 is the mitigation.

### 3. Sanitising what the model returned

A pure `parseSolution(raw)` (new, `lib/math-verify` or the api-server lib —
decided in the plan by where the app also needs it) returns a `Solution` or
`null`: strings only; `problem` ≤ 400 and `answer` ≤ 200 chars; 1–8 steps, each
≤ 300 chars; no control characters or markup (`<`, `>`, backtick); trimmed;
duplicates of the answer kept as is. `null` means «لم أستطع حل هذه المسألة
بثقة» — the same message as a double `distinct`. The same function validates a
solution read back from a saved board (§6): saved content is untrusted.

### 4. What the teacher sees

- **Entry.** A «حلّ مسألة» button (icon `calculator-outline`) in the bottom palette's
  action group beside Save and PDF. It opens a `<Modal>` with its own
  `KeyboardSafeView` (CLAUDE.md: a Modal with an input must carry its own): a
  multiline text field (Arabic or English, ≤ 400 chars), the symbol row, and
  «حلّ» (disabled while empty or in flight). The dialog follows `BoardSaveDialog`'s
  pattern (`components/classroom/BoardSaveDialog.tsx`), and rows flip for RTL.
- **While solving:** a spinner in the dialog; one request at a time; cancel closes
  the dialog and ignores the late result.
- **States:** success → the block appears (§5) and the dialog closes;
  `live mode off` → «الحل بالذكاء الاصطناعي غير مُفعَّل»; no solution
  (`null` / double `distinct`) → «لم أستطع حل هذه المسألة بثقة. جرّب صياغة
  أوضح»; quota/budget refused → the existing cap message; network/timeout →
  «تعذّر الحل، حاول مرة أخرى». The dialog stays open on every failure so the
  text is not lost.
- **Replace.** Pressing «حلّ» when the page already has a solution asks first
  (`confirm()`), because it replaces that block.

### 5. The block on the page

A **solution block** is drawn in the left ~45 % of the 1280×720 page (x 24–568,
y 24–696, in canvas units), *under* the pen layer: `pointerEvents="none"`, the
pen draws over it. It is React Native views, not SVG: it renders each line with
the existing `MathText` (`components/ui/MathText.tsx`, pure Views, accepts latin
input) at a font size derived from the stage scale and the step count by a pure
`fitSolution(stepCount, longestStep, stageScale)` (tested), so up to 8 steps fit.

Content, top to bottom: a small header chip «حل بالذكاء الاصطناعي»; the problem
(and, when verified, «المسألة كما فُهمت: `understoodAs`»); the steps revealed so
far, numbered; and, once the last step is shown, the final answer.

**Labels — always both lines, never one without the other:**

1. «خطوات مكتوبة بالذكاء الاصطناعي ولم تُراجَع» — on every solution, verified or not.
2. Either «✓ الإجابة النهائية: تحقق منها SymPy» (`verification.verified`), or
   «الإجابة النهائية لم يُتحقق منها». No third state, no «تم التحقق» wording
   for the steps, and no reuse of «من بنك الأسئلة المُراجَع» (a bank claim).

**Reveal.** The block takes no touches (it sits under the pen), so revealing is
done from a small control row beside it, `aria-label`ed and mirrored for RTL:
«إظهار الخطوة التالية» (the primary control, disabled when every step is shown),
«إخفاء الكل» and «حذف». `revealed` is transient UI state, not saved. **Reopening
a saved board shows the solution fully revealed** (the board is a record), with
«إخفاء الكل» one tap away for reuse in class. «حذف» asks via `confirm()` only
when steps are revealed. The board's undo covers ink only, so removing a block is
not undoable — it is explicit and confirmed (recorded so the plan does not invent
undo for blocks).

### 6. In the board file

`BoardFile` (`services/boardFile.ts`) goes to **version 2**: each page may carry
an optional `solution: { problem, steps, answer, verified: boolean, source:
'sympy'|'unchecked', understoodAs? }`. `parseBoard` accepts v1 (no solution) and
v2, rebuilds the solution field by field through `parseSolution`, and refuses the
whole board on a malformed one — the existing rule. `serializeBoard` /
`isBoardDirty` need no new logic beyond including the field (the dirty check
compares serialised JSON). The 2 MB cap is unaffected in practice (a solution is
< 3 KB). **A saved `verified: true` is only trusted as a label of what the server
said at save time**; nothing re-verifies on open, and the block says so by
carrying the same two labels. No schema change: `saved_materials.content` is
jsonb.

`Page` in `whiteboardModel.ts` gains an optional `solution`; `addPage` gives a
new page none (a solution does not inherit like the paper does);
`removePage`/`goToPage` need no change; `docHasInk` is unchanged (a solution is
not ink), so «clear page» clears ink only and the leave prompt counts a solution
as unsaved work through `isBoardDirty`, not through `docHasInk`.

### 7. In the PDF

`boardExportHtml.ts` draws the block as SVG text in the same left region, **all
steps revealed**, with both labels, using `mathLineToUnicode`
(`services/mathRender.ts`) for the lines, and escapes every string (it already
validates through `parseBoard`, which now includes `parseSolution`). The B2 PDF
check (a real download inspected as page images) is repeated for a page with a
solution, since html2canvas rendering of SVG text is the known uncertainty.

### 8. Client plumbing

`RemoteAIService` gets `solveProblem()` following `generatePromptSlides`: through
`generateWithProvenance` with `demoMode: false, strict: true` and no mock (a
per-call override; `DEMO_MODE` itself stays true). `AiGenerationKind`
(`services/ai/aiProvenance.ts`) gains `'solve'`. The error `code`s the server
already returns are mapped to the §4 messages by a pure function (tested).

## Testing and verification

- **Server, with injected stubs** (a stub `completeOnce` and a stub
  `relateAnswerKey`, as `keyVerification` is tested): every row of the §2 table,
  including the retry with SymPy's answer, a second `distinct`, an unreachable
  verifier, the answer link, the problem link, and a model that emits
  `verified:true` (must be stripped). The prompt contract test (as the other
  prompts have). `REQUIRED_FIELDS` has the new kind.
- **Pure client tests** (`services/__tests__/`): `parseSolution`, the
  `BoardFile` v1/v2 round trip and hostile-solution refusals, `fitSolution`,
  the error-code→message map, `boardExportHtml` with a solution (escaping, both
  labels present, all steps present).
- **Browser** (the A/B harness): with AI off, «حلّ» shows the AI-off message and
  draws nothing; the dialog (symbol row inserts at the cursor, blank disables
  «حلّ»); a block injected through the saved-board path (a v2 board POSTed to the
  API, since the live model cannot be called here) renders under the pen, reveals
  one step per tap, hides, removes, saves, reloads, reopens fully revealed, and
  exports a PDF page with both labels.
- **Not verifiable here, and reported as not verified:** the live model's
  actual solutions, the verifier on real model output, token cost, and touch on a
  real phone. If an `AI_LIVE_MODE` key becomes available this is the one place
  to run a handful of real problems per topic and record the verified / unchecked
  split.

## Risks

- **A ✓ above bad working.** Steps are unchecked; mitigated by the always-on
  first label, never by wording alone. If teachers still read the ✓ as covering
  the steps, the fix is to drop the ✓ from the block and keep the answer check
  in the dialog only.
- **Right answer to the wrong problem.** Covered by the problem link and the
  `understoodAs` line; Arabic prose problems rely on the teacher reading that line.
- **Verifier asleep or slow** (2 s job timeout, 8 s client): solutions then arrive
  unchecked, never lost.
- **The first non-ink item in the board file.** Version 2 must keep v1 boards
  opening; the v1/v2 test is the guard. A bad `solution` refuses the whole board,
  which loses a teacher's ink for one corrupt field — accepted, as for ink.
- **Cost.** Each solve is a model call against `AI_BUDGET_USD` and the per-user
  quota; the limiter is the existing 15/min. No change to caps.

## Open points for the plan (not for the owner)

Where `parseSolution` lives (shared lib vs api-server, decided by where the app
also needs it); the exact symbol-row insertion behaviour on native vs web text
inputs (cursor selection); where the control row sits so it neither covers the
steps nor collides with the toolbar at phone width.
