# Whiteboard (سبورة), sub-project A: the blank board

Status: **draft for review** — nothing here is built. Written 2026-10-08.

## Context

The first Smart Whiteboard was removed on 2026-09-25 (#624): a text box shown
full-screen, no AI, no drawing, nothing saved. The slide **pen**
(`artifacts/mobile/components/classroom/PenLayer.tsx`, used in
`app/ai-tools/classroom/presentation.tsx`) already lets a teacher draw over a
projected slide, but its own comment says it is "deliberately not a
whiteboard: no shapes, no eraser, no saving".

The whiteboard comes back as three sub-projects, built in this order, each with
its own spec, plan and review:

| | What | Depends on |
|---|---|---|
| **A** | A blank, standalone board: grid or axes background, eraser, stroke widths | nothing |
| **B** | Several pages, saved to the lesson, reopened and exported | A |
| **C** | A typed problem goes in, a step-by-step solution comes out | A (and B to save it) |

**This spec covers A only.** B and C are listed under *Out of scope* with the
constraints A must not violate.

## Goal

A teacher in front of a class can open a blank board from the presentation,
work a problem by hand on a graph-paper or axes background, correct a mistake
with an eraser or undo, and return to the same slide.

## Non-goals (for A)

- Saving, multiple pages, export, or reopening a board (B).
- Any AI, typed input, or solution content (C).
- Shapes, text boxes, a ruler, or handwriting recognition.
- A Tools-tab card. STATUS.md says the pilot is limited to five tools and
  `services/__tests__/toolCatalog.test.ts` pins the offered list. Adding the
  card later is one catalog entry plus a deliberate test update.
- A new drawing engine (Skia or similar). It would add a native module, which
  requires bumping `app.json`'s `version` (the OTA runtime key — see CLAUDE.md);
  not worth it for this.

## Design

### 1. Pure model — `artifacts/mobile/services/whiteboardModel.ts`

No `react-native` or `expo-*` imports, so `node --test` can load it. Imports use
explicit `.ts` extensions.

- `Stroke` is the existing `{ color: string; points: string }` (points are
  `"x,y x,y …"`), gaining **optional** `width?: number`. A missing width means
  4, today's value, so slide ink is unchanged. `Stroke` stays exported from
  `PenLayer.tsx` (re-exported from the model if it moves) so the presentation's
  import does not change.
- `STROKE_WIDTHS = [3, 6, 12]`; the default is 6 on the board. Slides keep 4.
- `eraseAt(strokes, x, y, radius): Stroke[]` removes every stroke with any
  segment within `radius` of `(x, y)` (distance from point to line segment, so a
  fast drag that skips points still erases). A single-point stroke (a dot) is
  treated as a zero-length segment. Returns the same array instance when nothing
  was hit, so callers can skip pushing a useless history entry.
- History: `pushHistory(history, strokes)`, `undo(history)` over snapshots of
  the whole stroke list, capped at `HISTORY_LIMIT = 50` (oldest dropped). Erase
  and clear are therefore undoable, which the slide pen's "remove last stroke"
  cannot do.
- Backgrounds: `type BoardBackground = 'blank' | 'grid' | 'axes'` and pure
  geometry helpers returning line segments for a given width/height:
  - `gridLines(w, h, step)` — squared paper.
  - `axesGeometry(w, h, step)` — x and y axes through the centre plus tick
    positions and tick values. Tick labels are produced as **Latin** numerals;
    conversion to Arabic digits happens at display time only (CLAUDE.md rule).

### 2. `PenCanvas` changes — `components/classroom/PenLayer.tsx`

Additive; the slide call site passes none of the new props and behaves as before.

- New optional props: `width?: number` (default 4) and `erase?: boolean`.
- In erase mode, touch down and move call `eraseAt` with the touch point and
  report the result through `onChange` at pen-up, as one history step per drag.
- **Draft stroke held locally.** Today every move rebuilds the whole stroke list
  through `onChange`, so every polyline re-renders per touch event. That is fine
  for a few circles on a slide and would lag on a full board. The stroke being
  drawn lives in the canvas's own state and is committed with `onChange` on
  pen-up; committed strokes render in a memoised layer. Consequence: for the
  slide pen, `onChange` now fires once per stroke instead of once per move.
  `presentation.tsx` only stores the array, so it is unaffected, but this is the
  one behaviour change to slides and must be checked in the browser.
  **There are two existing consumers, not one:** `presentation.tsx` and
  `app/ai-tools/classroom/book-page.tsx` (found while writing the plan). Both
  must be checked.
- Coordinates remain view-relative pixels (`locationX/Y`), as today. See
  *Open points for B*.

### 3. Screen and entry

- New route `app/ai-tools/whiteboard.tsx`. Full-screen, RTL-first, using the
  deck theme tokens from `services/deckTheme`.
- Toolbar floats over the board: colour swatches (reuse `PEN_COLORS`), three
  widths, pen/eraser toggle, undo, clear, and a background switcher
  (blank / grid / axes). Icons and labels follow `PenPalette`'s pattern; new
  strings go in both the `ar` and `en` blocks of `services/i18n.ts` next to the
  existing `pen*` keys.
- **Clear** asks first, via `confirm()` from `services/confirm.ts` (the helper
  exists because `Alert.alert` buttons do nothing on react-native web).
- **Leaving with ink on the board** asks first, via the same helper. A has no
  saving, so this is the only protection against losing a board by accident.
  Android hardware back is intercepted with `BackHandler`; the toolbar's own
  back button does the same. **Known limit:** the browser's native back button
  and tab close on web are not intercepted.
- Entry: a «سبورة» button in the presentation's action row (beside the pen
  button, `presentation.tsx` ~line 1387) calls `router.push('/ai-tools/whiteboard')`.
  The presentation stays mounted in the stack, so Back returns to the same slide
  and its per-slide ink is untouched.
- Route gating: `routeGating.ts` is an allowlist of non-teacher routes;
  `/ai-tools/*` is not on it, so the board is teacher-only with no change.
  Confirm this holds with a `routeGating.test.ts` case rather than assuming it.

### 4. Verification

- New `services/__tests__/whiteboardModel.test.ts` (inside the existing mobile
  test glob) covers: `eraseAt` hits, misses, dots, a fast drag across a gap, and
  the same-instance return; history cap and undo order; `gridLines` and
  `axesGeometry` counts and tick values.
- The screen and `PenCanvas` cannot be loaded by the bare `node --test` runner.
  They are verified by running the web build and driving both the board and the
  slide pen in a browser (the `run` skill). Touch behaviour on a real phone is
  **not** verified by that and will be reported as unchecked.
- `pnpm run typecheck` for the whole monorepo, and `cd artifacts/mobile && pnpm test`.
- STATUS.md, in the same PR: update the Smart Whiteboard entry (~line 105) to say
  a new board exists and where, and add a dated entry for A.

## Out of scope — constraints A must leave room for

**B (saving).** A keeps view-relative pixel coordinates. A saved board reopened
on a different screen size or orientation would be mis-scaled, so B must decide
on normalised coordinates (or a fixed logical canvas) before it persists
anything. A deliberately does not choose, because choosing without a storage
design would be guessing. B also owns where saved boards live
(`SavedMaterial` in `services/workspace.ts`, or its own table — and if a table,
the `schema-push:` rule in CLAUDE.md applies).

**C (AI solve).** The verifier (`artifacts/math-verifier`) proves **final
answers** for seven topics only (`VERIFIABLE_TOPICS` in
`lib/math-verify/src/answerKey.ts`): polynomial derivative, derivative at a
point, circle centre, circle radius, and linear, quadratic and exponential
equations. It checks no individual step. C must therefore label any solution
outside those topics as AI-written and unchecked, and never show a verified mark
it did not earn. Input is typed first; reading handwriting needs a vision model
and is a separate decision. Live AI is gated by `AI_LIVE_MODE`, `AI_BUDGET_USD`
and `DEMO_MODE`; C does not change `DEMO_MODE`.

## Risks

- **Slide pen regression** from the draft-stroke change. Mitigation: it is the
  first thing exercised in the browser, before the board screen is built on it.
- **Touch input on web vs native** differs (`locationX/Y` relative to the event
  target; `PenCanvas` already works around this with `pointerEvents="box-only"`).
  The board reuses that workaround and must not wrap the canvas in extra
  touchable views.
- **Accidental loss of a board** before B exists. Mitigated by the leave and
  clear confirmations, with the browser-back limit stated above.
