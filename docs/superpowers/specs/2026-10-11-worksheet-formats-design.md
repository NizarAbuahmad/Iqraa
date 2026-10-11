# New worksheet formats: صِل، رتّب، أين الخطأ؟، ارسم

Step 5 of the worksheet review. Agreed in chat on 2026-10-10/11:

- **Formats.** All four: matching, ordering steps, error-spotting and graphing on a grid.
- **Source.** The bank only, with no AI. The content is correct by construction and identical whether or not live AI is on.
- **Choosing.** The formats are new ticks in the worksheet screen's «أنواع الأسئلة».
- **Approach A.** A structured `format` on the question, with plain text kept for everything that only reads text.
- **أين الخطأ؟ uses hand-written missteps**, not an automatic answer swap.

## What a teacher gets

Four new ticks under «أنواع الأسئلة»: «صِل», «رتّب الخطوات», «أين الخطأ؟», «ارسم».

- **One question per tick.** Each ticked format adds one question to the sheet, in its own section titled after the format.
- **The total stays the teacher's.** That question counts inside the number the teacher picked, the same as the worked example does today.
- **Ticks the lesson can't support** are greyed out with a one-line reason under the list, e.g. «لا توجد خطوات حل محلولة لهذا الدرس بعد». A greyed tick can't be selected.
- **A format that still can't be built** (for example, the bank ran out after other questions took its items) is left out. The existing shortfall note names it. Nothing is invented.

| Format | What the student sees | Built from |
|---|---|---|
| **صِل** | Two columns: 4–5 problems (right) and their answers shuffled (left). Write the letter, or draw a line. | 4–5 solved bank items of the lesson's family whose answers are distinct and short (≤ 24 chars) |
| **رتّب الخطوات** | One problem, its 3–6 working steps shuffled into lettered cards. Number them in order. | One solved item with 3–6 steps. The last step (the answer line) is kept last and not shuffled, so the order has exactly one reading |
| **أين الخطأ؟** | One problem and a student's working, with one step wrong. Circle the wrong step and write it correctly. | A hand-written misstep: `{itemId, stepIndex, wrongLine, whyAr, whyEn}` replacing that step of the item's working |
| **ارسم** | The equation(s) and a blank coordinate grid. Draw, then answer the bank's question (e.g. the intersection). | Bank items with `kind: 'graph'`; the window is derived from the answer points with a margin |

## Data model

`WorksheetQuestion` (`artifacts/mobile/services/ai/AIService.ts`) gains one optional field:

```ts
format?:
  | { kind: 'match'; left: string[]; right: string[]; pairs: number[] }   // pairs[i] = index in right for left[i]
  | { kind: 'order'; steps: string[]; order: number[] }                  // steps as shown; order = correct sequence of indices
  | { kind: 'spot_error'; steps: string[]; wrongStep: number; fix: string; why: string }
  | { kind: 'graph'; exprs: string[]; window: { xMin: number; xMax: number; yMin: number; yMax: number } }
```

- **`text` stays a complete plain-text rendering of the question** (the format's lines inlined). Everything that only reads text keeps working unchanged: shared text, Word, ملفاتي, the pool and the converter's fallback.
- **The answer key entry is still `{num, answer, solution?}`**, with an answer readable on its own:
  - صِل: «١-ب، ٢-د، …»
  - رتّب: «ج، أ، د، ب»
  - أين الخطأ؟: «الخطوة ٣: …» + the corrected line + `why`
  - ارسم: the bank answer
- **`WorksheetSection.type`** gains `'match' | 'order' | 'spot_error' | 'graph'` for the section a format sits in.

Maths stays in latin `x` in storage and converts to «س» / Arabic digits only at display, as everywhere else.

## Where the code goes

- **`lib/math-practice/src/missteps.ts` (new).** The hand-written list.
  - Every entry's `itemId` must name a solved item, and `stepIndex` must be a step that isn't the last.
  - `wrongLine` must differ from the real line.
  - `steps.test.ts`-style tests enforce all three.
  - Initial coverage: about 2 per Grade-10 maths family that has working (≈30 entries).
- **`artifacts/mobile/services/ai/worksheetFormats.ts` (new, pure, loaded by `node --test`).**
  - `formatAvailability(lesson ctx) → Record<FormatKind, {ok, reasonAr, reasonEn}>`
  - `buildFormatQuestion(kind, ctx, used) → {question, keyEntry} | null`
  - Deduped through the existing math-practice session (`beginMathPracticeSession`), so a format never reuses an item another question on the sheet already used.
- **`generateWorksheet` (`services/ai/generators.ts`)** calls it for each ticked format after the regular sections, and reserves the count up front.
- **Live path.**
  - `RemoteAIService` sends the request with the format types removed and the count reduced by the number of formats. It then appends the same `buildFormatQuestion` results and renumbers the key.
  - `worksheetPromptAr/En` (`artifacts/api-server/src/lib/prompts.ts`) ignores unknown types. A test asserts the format kinds never appear in the prompt text, so the model is never asked for them.
  - The pooled artifact is the model's part only; the formats are re-added on every serve by the same builder, so a pooled sheet gets fresh bank items each time. It's cheap.
- **Worksheet screen (`app/ai-tools/worksheet.tsx`).** Extends `QType` / `ALL_Q_TYPES` by **appending** the four: the selected types are persisted in formState, so the order is persisted state. It also handles the greyed ticks and labels in `i18n.ts` (ar + en, «ًا» not «اً»).
- **Edits (`worksheetEdits.ts`).**
  - A question with a `format` can be deleted or have its points changed.
  - Editing its text drops the `format` (and its working), as a hand edit to a solved question already drops working today. The question then degrades to the plain question.

## Print (PDF) — `buildWorksheetHTML`

Per-kind rendering inside the question card, before any answer lines (which a formatted question doesn't get):

- **صِل.** A two-column table. The right column is numbered (١، ٢…) and the left is lettered (أ، ب…), with a blank box beside each number for the letter.
- **رتّب.** Lettered step cards in shuffled order, each with a small box for its position number.
- **أين الخطأ؟.** The numbered working, each step on its own line. Below it: «رقم الخطوة الخاطئة: ___» and two writing lines for the correction.
- **ارسم.** An SVG grid sized to the window: light grid lines, axes, tick labels at integer steps (Arabic digits on an Arabic paper), and a box below for the answer. The grid is empty on the student copy.
- **Answer key.**
  - Each entry prints as listed under *Data model*.
  - ارسم's key entry also draws the graph on its grid, reusing `samplePlot` / `plotGeometry` from `deckVisuals.ts`, with grid lines added.
- **Print styles.** Ink-saver (grey grid, no fills) and large print (bigger cards and grid) apply as for other content.

## Projector — `buildWorksheetSlidesHTML` and `buildDeckFromWorksheet`

One slide per formatted question, in the same layout as print, at projector size:

- صِل: the two columns.
- رتّب: the step cards.
- أين الخطأ؟: the numbered working.
- ارسم: the empty grid.

The answer slides show the solution: the pairs, the ordered steps, the wrong step highlighted next to its correction, and the drawn graph.

## Sent to a class — `fromWorksheet.ts` + take screen

The worksheet send payload (`worksheetSendPayload`) and the request parser carry `format`. The converter checks `format` first:

| Format | Evaluation type | Body | Key | Marking |
|---|---|---|---|---|
| صِل | `matching` | `left` = problems, `right` = answers | `pairs` | auto, partial credit |
| رتّب | `matching` | `left` = the step cards, `right` = positions «الأولى، الثانية…» | step → position | auto, partial credit |
| أين الخطأ؟ | `multiple_choice` | stem = problem + numbered working; options = «الخطوة ١ … ن» | the wrong step | auto (finding the step); the correction is not marked |
| ارسم | `short_answer` | the prompt with the equations; the graph's question | model answer = the bank answer | teacher |

- **Validation.** Every converted question still passes the type registry. A `format` that fails its own validation (e.g. pairs out of range) falls back to the existing text rules, so the converter fails closed.
- **ارسم on screen.** The take screen shows the equations; a grid image is not drawn on the student's phone in this round.
- **No new evaluation type and no schema change**, so no migration. The exam-side `matching` UI and grader are used unchanged.

## Testing

- **`missteps.test.ts`.** Every entry is valid (item exists, step in range and not last, wrong ≠ right). Every Grade-10 maths family with working has at least one entry, or is listed as deliberately uncovered.
- **`worksheetFormats.test.ts`.**
  - Each kind builds from a known lesson, with an answer key consistent with its `format`.
  - The unshuffled order recovers the item's working.
  - صِل answers are distinct.
  - Availability is false with a reason when the bank can't support a kind.
  - No item is reused across the sheet.
- **Generator.** Counts include the formats inside the total. The two-paths test: offline and live both get their format questions from `buildFormatQuestion`, so the same kinds come out with the same structure. The prompt never names a format kind.
- **Print / slides.** Each kind renders its structure (table, cards, numbered steps, `<svg>` grid) and the key renders its answer. Ink-saver and large print apply.
- **Converter.** One test per row of the table above, each passing the real type registry, plus fallback on a malformed `format`.
- **Driven in the web build.** Tick all four on «النسب المثلثية» or a lesson with graph items; print to PDF; project; send to a class and take it as a student, checking that صِل/رتّب/أين الخطأ؟ are auto-marked.

## Not in this change

- Formats for quizzes or homework.
- Drawing on the phone for ارسم.
- Chemistry missteps; أين الخطأ؟ is maths-only until some are written.
- AI-written formats.
- Fill-in tables.
- A drag-to-order answer UI.

## As built (2026-10-11) — where the build differs from the above

Recorded after the web-build drive. STATUS.md («Four new worksheet formats»)
has the verification and the defects that drive found.

- **Every format carries a `stem`.** The union in *Data model* gained
  `stem: string` on all four kinds: the instruction plus the problem, e.g.
  «رتّب خطوات حل المسألة الآتية:\nأوجد حل المعادلة: …». Print, slides, the
  deck and the converter read the problem from it rather than re-deriving it
  from `text`.
- **The matching student projection carries `stem`.** `questionTypes.ts`'s
  `matching.sanitizeForStudent` now passes a non-empty `stem` through.
  Without it, رتّب reached the take screen with the steps but not the problem
  they solve. The stem holds no answer data, and `take/[code].tsx` shows it.
  Any matching question with a stem now shows it, as every other type
  already did.
- **The order cap.** رتّب converts to `matching` against
  «الأولى…السادسة», so 2–6 steps are auto-marked. A longer order (the
  parser accepts up to 10) has no position label, falls back to the text
  rules, and lands as a short answer for the teacher. That fails closed. The
  generator only builds 3–6 steps, so it does not arise from the bank today.
- **`visualOnReveal` on deck slides.** The live deck shows ارسم's graph only
  after «أظهر الإجابة». `deckVisuals.ts`'s slide type gained an optional
  `visualOnReveal`. `buildDeckFromWorksheet` sets it with the plot, and
  `presentation.tsx` renders the visual when `!visualOnReveal || answerVisible`.
  Challenge slides elsewhere keep their figures visible, because they need
  them to be answered.
- **The reveal shows the working.** For رتّب and أين الخطأ؟ the revealed
  answer is the key answer plus its solution lines. The presenter splits a
  maths-bearing multi-line answer one line per row (`answerLines` in
  `services/deckText.ts`). On the projector صِل is two blocks (numbered
  problems, then lettered answers), never paired rows: the answers are
  shuffled, so a shared row would teach wrong pairs.
- **Count and points are one rule for both paths.**
  - `formatRoom(total, wantsWordProblem) = max(0, total − 3 − (wp ? 1 : 0))`:
    the room left after the worked example, the half-solved question, one
    ordinary question and the word problem. Ticked formats beyond the room
    are reported, not added.
  - `formatPoints`: 4 / 6 / 10 by difficulty.
  - The live path asks the model for `total − taken`, with no floor of 5.
- **Formats are picked first, scarcest first.** The bank is drawn for the
  formats before the worked example and the practice sections, so a ticked
  format is not starved by ordinary questions. On a small bank the practice
  sections come up short instead, and say so through the existing shortfall
  note.
- **Greying needs a grounded lesson.** A tick is judged only when the topic
  grounds to a KB lesson. A greyed tick draws unchecked and disabled, but it
  stays in the stored selection and is stripped only from the request, so
  typing a title no longer wipes ticks. On homework the ticks are hidden, and
  a carried-in selection is stripped.
- **The missing-formats note covers two causes.** No room in the count, or
  not enough bank items: «لم تُضف هذه الأنواع: {names} — لا يتّسع لها عدد
  الأسئلة المطلوب، أو لا تكفي أسئلة البنك لهذا الدرس.»
- **The graph window holds the curves, not only the answer points.**
  `fitGraphWindow` widens y to cover a sample of each expression (clamped to
  ±10, with a margin), using `normalizePlotExpr`. Both live in
  `worksheetFormats.ts`, not `deckVisuals.ts`.
- **أين الخطأ؟'s key solution** is the reason (`why`) followed by the
  corrected working. Print, slides and the deck show it that way. The drive
  found that the reason's position numbers the working one off from the
  paper; see STATUS.
- **Missteps.** 28 entries, two per maths family with working (14 families),
  with no deliberately uncovered family.
- **`esc` moved to `services/htmlEscape.ts`.** It is re-exported from
  `exportHtml.ts`, which ends the `formatPrintHtml` ↔ `exportHtml` import
  cycle.
- **Driven on a different lesson than planned.** The drive used «حل المعادلة
  الأسية» and the unit-1 GeoGebra lab (`u1_lab`), not «النسب المثلثية».
