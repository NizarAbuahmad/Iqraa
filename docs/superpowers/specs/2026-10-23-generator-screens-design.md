# Generator screens — the band wears the tool, the form is a screen and not a stack of dropdowns

**Date:** 2026-10-23 · **Status:** approved by the owner from the review page
(«Generator Screens», option A: all five tools, desktop paper preview included) ·
**Scope:** `artifacts/mobile` only. Nothing here touches what is asked of the model,
the API, or what is stored.

## Why

The quiz, worksheet, lesson plan, activity and slides screens are where a teacher
spends the most time, and they are the plainest part of the app. Each is one long
form of equal full-width dropdowns under the same teal band. On a phone the quiz
shows seven dropdowns before the question types and the button is below the fold;
on desktop it is one 1,080-pixel column. They ask for the grade, the subject and
the lesson again even when Today already picked the lesson.

## What changes

1. **The band wears the tool.** `ToolHeader` takes the tool's colour from its
   concept (`CONCEPTS` in `constants/icons.ts`: quiz violet, worksheet teal, lesson
   plan indigo, slides blue, activity orange) as a gradient that only deepens, with
   the concept's drawing on the white tile it already draws. Every concept colour
   carries white at 4.5:1 (`iconSystem.test.ts`). A band under the status bar calls
   `useLightStatusBar()` (CLAUDE.md, `statusBar.test.ts`).
2. **The lesson is one card.** A card shows grade · subject, the lesson title, a
   «من المنهاج» badge when grounded (the app's spelling, 47 uses to 5), and a «تغيير الدرس» button. The existing grade
   and subject pickers and `TopicSelector` stay mounted and are the card's expanded
   state (see *Invariants*).
3. **Short lists become touch controls.** A list of at most four labels is a
   segmented control (level, distribution); a numeric list is a stepper over the
   screen's real option array (duration, marks, count); a multi-select is a chip
   group (question types). A dropdown stays where the list is long (grade, subject).
4. **The button says what you will get.** On a phone the generate button is docked
   at the bottom with a one-line summary above it («10 أسئلة · 20 دقيقة · 20 درجة ·
   4 أنواع»); the bar hides while the keyboard is open (`useKeyboardVisible`). On
   desktop (`DESKTOP_BREAKPOINT`) the form keeps a readable width and a paper
   preview sits beside it, updating as options change, with the button under it.

The mock is published at https://claude.ai/artifact/TfRsfLZxUVY4NxXwYjFs1K and its
source is in this design's history; the Arabic strings in it are the app's own.

## Invariants (do not change; tests and review check them)

- **State, route params and saved `formState` are untouched.** `gradeIdx`,
  `subjectIdx`, `durationIdx`, `marksIdx`, `numQIdx`, `diffIdx`, `selectedTypes`,
  `scope`, `distribution`, `lessonId` keep their names, types and meaning. These are
  persisted as bare positions into the picker lists (CLAUDE.md «Picker order is
  persisted state»), so a stepper moves an *index* through the same option array and
  never renumbers it.
- **The picked lesson is never re-derived from a title.** `usePickedLesson`,
  `resolveGeneratorGrounding({ lessonId, scope })`, `groundingRequestFields`,
  `groundedSubjectConflict` and the `lessonPickerParams` / `scopePickerParams`
  routes behave exactly as today (CLAUDE.md «A lesson title does not identify a
  lesson»). The card is presentation over the same state.
- **`TopicSelector` is never unmounted.** It holds scope selection (units, semester,
  whole book → `useWideScope`) and drives `onSelectionDetail`. Collapsed means
  `display: 'none'` plus hidden from the accessibility tree, not removed.
- **Teacher scope and stranded notes still apply.** `teacherScope.gradeHidden`,
  `subjectHiddenFor`, `StrandedSelectionNote`, `visibleCountOptions(wideScope.isWide)`
  and the wide-scope-only distribution control keep their conditions.
- **Validation and the disabled state are unchanged.** An empty topic still blocks
  the button and still shows the inline error beside the field (and the docked button's `genNeedLessonHint` where the button is disabled).
- **Generation, saving, regeneration, results and exports are not touched.**
  Everything below the form (`GenerationStatus`, results, `GeneratorResultActions`)
  is out of scope.
- **Keyboard:** no `KeyboardAvoidingView` inside a screen (CLAUDE.md); the docked bar
  hides on keyboard instead.

## The shared pieces (`artifacts/mobile/components/generator/`)

All colour comes from `useColors()` and the tool's concept colour (never the global
`palette`); a selected state's text is `readableOn(accent, colors.card)`, a solid
fill's text is `textOn(fill)`. Touch targets are at least 44 points. Accessibility
state uses `aria-checked` / `aria-pressed` / `aria-selected`, never
`accessibilityState` (`ariaState.test.ts`). Motion goes through `useReduceMotion()`.

| Piece | Props (sketch) | Notes |
|---|---|---|
| `SegmentedControl` | `label, options, index, onChange, accent` | radiogroup; 4 options max; equal widths |
| `Stepper` | `label, options (labels), index, onChange, accent` | disabled at either end; value is the label; one row layout (label one side, controls the other) at every width: the controls need about 176 points, so three never sit side by side |
| `ChipGroup` | `label, options, selected, onToggle, min, accent, single?` | multi-select; the last selected chip cannot be cleared when `min` is 1 (the screen's existing rule). `single`: a radiogroup for one choice out of more than four labels (the activity's five types); a selected chip is an opaque tint with a label judged against it |
| `LessonCard` | `gradeLabel, subjectLabel, subjectId, topic, grounded, expanded, onToggle, locked?` | subject drawing from `subjectTile` (`services/subjectTheme.ts`); the expanded body is passed as children; `locked` (no lesson yet) keeps it open and hides the button |
| `DockedAction` | `summary, label, onPress, loading, disabled, hint, accent, docked, hidden?` | phone: docked; desktop: inline under the preview; `hint` replaces the summary while disabled; `hidden` yields the spot to the result's save bar |
| `GeneratorLayout` | `form, side, isDesktop` | desktop two columns, phone single column |
| `PaperPreview` | `title, subtitle, rows, more, footer, note?, accent` | skeleton rows, never real questions; the sheet is always paper (white, ink): the only literal colours in the folder |

Pure helpers live in `services/generatorSummary.ts` (no react-native import, `.ts`
imports) so `node --test` can load them: `summaryLine(parts)` builds the one-line
summary with the Arabic count agreement `arCountPhrase` already implements, and
`previewRows(types, count, maxRows)` returns the rows and the remainder count, and `moreRowsLabel` words it («+ 4 أسئلة أخرى»). `ExamKindSwitch` takes an optional `accent` so the tab row matches the band.

## Per-tool mapping

- **Quiz** — level (4) → segmented; duration, marks, count → steppers over
  `DURATION_OPTIONS`, `MARKS_OPTIONS` and `visibleCountOptions(...)`; types → chips
  over `QUIZ_TYPE_ORDER`; distribution → segmented, only on a wide scope;
  `ExamKindSwitch` stays as the tab row.
- **Worksheet, lesson plan, activity, slides** — mapped when each is ported, by the
  same rules (a numeric list of at most four short labels, such as the lesson plan's
  four durations, is a segmented control, not a stepper; one choice out of five or more long labels, such as the
  activity's types, is a single-select `ChipGroup`); a field whose real options are not a short list stays a dropdown.
  Each port lists its mapping table in its PR.

## Verification

- Pure helpers: unit tests. Components: `node --test` source tests (the runner has no
  React Native transform) pinning the invariants above — every ported screen imports
  the shared pieces, keeps `TopicSelector`, uses no `PickerField` for a list of at
  most four labels, calls `useLightStatusBar` (through `ToolHeader`), and has no
  hand-written colour.
- A browser pass with the web build and `e2e/screens.mjs`: phone and desktop, light
  and dark, Arabic and English, with the lesson carried from Today and without; the
  wide-scope path (pick a unit, then a semester); a teacher with grade/subject
  hidden. Not device-verified, and the PR says so.
- No generation behaviour changes, so none is re-tested beyond the existing suites.

## Rollout

One pull request per tool, each reviewed on its own: (1) shared pieces and the quiz,
(2) worksheet, (3) lesson plan, (4) activity, (5) slides. `ToolHeader` takes its
colour from `concept` in PR 1, so the other generator screens (which already pass a
concept) change colour at once; their own accent constants are brought onto the
concept colour as each is ported, and the log says which are still on the old teal.

## Not in scope

The result screens, exports, the evaluations builder, the homework tool, the parent
message and the lesson-flow screens (they share `ToolHeader` and so pick up the band
colour, nothing else), and any change to prompts, the API or storage.
