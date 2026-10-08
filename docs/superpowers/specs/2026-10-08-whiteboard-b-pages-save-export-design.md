# Whiteboard (سبورة), sub-project B: pages, saving, PDF export

Status: **draft for review** — nothing here is built. Written 2026-10-08.
Builds on sub-project A (`2026-10-08-whiteboard-board-design.md`, PR #928).

## Context

A shipped a blank board that is drawn in raw screen pixels and saved nowhere.
B makes a board worth keeping: several pages, a canvas that looks the same on
every screen, saving to «موادي», reopening, and a PDF.

B is split in two, **one spec, two plans**, because the first half changes code
A just shipped and the second half is mostly new surface:

| | What | Touches |
| --- | --- | --- |
| **B1** | A fixed logical canvas fitted to the screen, and multiple pages (still unsaved) | `PenCanvas`, `BoardBackground`, `whiteboard.tsx`, the model |
| **B2** | Save, reopen from «موادي», PDF export | `workspace.ts` types, `materialKind.ts`, workspace list + viewer, a new export builder |

C (AI solve) is untouched and still depends on A (and on B if solutions are saved).

## Facts this design rests on (verified in the tree, 2026-10-08)

- **No schema change.** `saved_materials.type` is plain `text` and `content` is
  `jsonb` (`lib/db/src/schema/savedMaterials.ts`). `POST /workspace/items`
  validates only that `type` and `title` are present
  (`artifacts/api-server/src/routes/workspace.ts:127-190`); the JSON body limit
  is 12 MB (`app.ts:152`). So the `schema-push:` rule in CLAUDE.md does not apply.
- **The client types are the real work.** `MaterialType` in
  `services/workspace.ts:27` is a closed union, and `constants/materialKind.ts`
  holds `Record<MaterialType, …>` tables (`MATERIAL_COLOR`, `MATERIAL_ICON`,
  `MATERIAL_LABEL_KEY`, and an edit-route map). Widening the union makes the
  compiler list every consumer. A grep of files mentioning `MaterialType` or
  `'prompt-slides'` found: `app/workspace/index.tsx`, `app/workspace/view.tsx`,
  `components/ui/GeneratorResultActions.tsx`, `components/ui/FeedbackWidget.tsx`,
  `services/chatMaterialActions.ts`, `services/savedMaterialMatch.ts`,
  `services/lessonBoard.ts`, `services/ai/aiProvenance.ts`,
  `services/ai/RemoteAIService.ts`, `services/cqv/batch.ts`,
  `services/cqv/reports.ts`, `services/toolCatalog.ts`. Each is a decision in the
  plan (handle it, or confirm the exhaustive check already covers it).
- **`workspace/view.tsx` has no board branch.** Its `kind` switches fall through
  to the **quiz** builders (`getHTML`, `getPlainText`, `editRoute`). A saved
  board opened there would be rendered as a quiz. B2 must redirect boards away.
- **`saveItem` falls back to local storage** when signed out or when the API
  call fails (`workspace.ts:165-215`): `AsyncStorage` → `localStorage` on web
  (about 5 MB shared with everything else), and `writeLocal` is not wrapped, so
  an oversized board can throw out of `saveItem`.
- **`saveItem` stamps a `lessonId`** derived from `topic` by title when the
  caller set none (`withLessonId`, `workspace.ts:154-162`). That is the
  title-to-lesson derivation CLAUDE.md warns about. B does not add a new
  identity claim; boards get the same stamp as every other material (see
  *Known limitation*).
- **The PDF path takes HTML.** `exportAsPDF(html, filename)` (`share.ts:121`)
  writes the HTML into a sandboxed, script-less iframe on web and uses
  `expo-print` on native.
- **`lessonBoard.ts` counts five prep types** (lesson-plan, worksheet, quiz,
  slides, activity); a `'board'` material is outside that list, so the home prep
  board is unaffected.

## Goals

1. A page looks the same on a laptop, a projector and a phone.
2. A teacher can keep a board of several pages, reopen it from «موادي» on any
   device, edit it, and print or share it as a PDF.
3. Nothing a saved board contains can inject markup into the PDF.

## Non-goals

AI on the board (C); redo; thumbnails; copy/duplicate/reorder pages; text,
images or shapes on a page; sharing a board with students; real-time
collaboration; a lesson-identity link stronger than every other material has.

## Design

### B1 · 1. Fixed logical canvas

- Strokes are stored in **canvas units** on a **1280 × 720 (16:9)** canvas.
  1280 × 720 keeps A's look unchanged on a 1280-px-wide screen (stroke widths
  3 / 6 / 12 and the 40-unit grid mean the same thing there) while keeping the
  numbers small.
- Pure, tested helpers in `whiteboardModel.ts`:
  - `CANVAS_W = 1280`, `CANVAS_H = 720`.
  - `fitCanvas(areaW, areaH): { scale, width, height, offsetX, offsetY }` — the
    largest 16:9 rectangle that fits (`scale = min(areaW / 1280, areaH / 720)`),
    centred. Degenerate areas return scale 0.
  - `toCanvas(x, y, scale)` — screen offset to canvas units (`x / scale`);
    scale 0 returns the input unchanged so nothing divides by zero.
- `PenCanvas` gets an optional `scale` (default 1). Touches are divided by it,
  and the SVG draws in canvas units (`viewBox="0 0 1280 720"` on the board;
  without `scale` it behaves exactly as today). **The slide pen and the
  book-page pen do not pass `scale`, so they are unchanged.**
- The **eraser radius is a screen size**: the model keeps `ERASER_RADIUS = 16`
  px and `PenCanvas` passes `16 / scale` canvas units, so a finger-sized eraser
  stays finger-sized on a small screen. `eraseAlong` already works in whatever
  units it is given.
- `BoardBackground` draws in canvas units (grid step 40, axes through the
  snapped centre) inside the same viewBox, so tick positions and labels scale
  with the page.
- The stage is the fitted rectangle; the area around it is a neutral
  letterbox. The floating toolbars overlay the whole screen as in A; on a tall
  phone the letterbox bands are where they sit.
- A stored nothing, so there is **no migration**.
- **Cost, stated plainly:** on a portrait phone the page is a small landscape
  rectangle, and strokes are thin there (a width-6 stroke on a 390-px screen is
  about 1.8 px). That is the price of every screen showing the same page; the
  B1 plan verifies it at phone size before this is accepted.

### B1 · 2. Pages

- A board is a list of pages. A page is `{ background, strokes, past }`
  (`background` per page, so a maths page can have axes and the next one can be
  blank; undo history is per page and not saved).
- Pure model (tested): `addPage(doc)` inserts a blank page after the current one
  and selects it; `removePage(doc, i)` (never below one page); `goToPage(doc, i)`
  clamps; `MAX_PAGES = 20` (add is a no-op at the cap). The existing
  `commitStrokes` / `undoBoard` / `clearBoard` operate on the current page.
- UI: the top bar gains «‹ 2 / 5 ›» and «+», and a delete control with the same
  `confirm()` as clear when the page has ink. Page numbers use `localizeDigits`.
- `hasInk` becomes "any page has ink", which is what the leave confirmation asks.

### B2 · 3. Save and reopen

- A board saves as a `SavedMaterial` of the new type **`'board'`**:
  ```
  content = { version: 1, canvas: { w: 1280, h: 720 },
              pages: [{ background: 'blank'|'grid'|'axes',
                        strokes: [{ color, width, points }] }] }
  ```
  `formState` carries `{ boardVersion: 1 }`. No schema change.
- `saveItem` for the first save, `updateItem` for later ones; the board keeps the
  returned id. A **Save** control in the top bar opens a small title dialog
  (default: the deck's topic, else a dated «سبورة»); a title is required.
- **Context.** The presentation's button passes `topic`, `subject`, `grade` as
  route params; they fill the material's fields like any other material. The
  board stores no lesson identity of its own.
- **Dirty tracking.** The board remembers the last-saved document. Leaving with
  unsaved changes asks as in A; leaving right after a save does not.
- **Reopen.** Tapping a board in «موادي» opens
  `/ai-tools/whiteboard?materialId=<id>`; the screen loads it with `getItem`.
  `workspace/view.tsx` redirects `kind === 'board'` there so it never reaches the
  quiz fallback. `materialKind.ts` gains colour, icon and label for `'board'`,
  and the list gets a «سبورة» filter tab (the existing `TABS`).
- **Failure and size.** Serialisation rounds coordinates to one decimal. A hard
  cap of **2 MB of serialised content** and **20 pages** is enforced before any
  write; over the cap the teacher gets a message and nothing is written (2 MB
  stays under the 12 MB server limit and well under the shared browser storage
  quota that the local fallback uses). A thrown `writeLocal` is caught and
  reported as «تعذّر الحفظ», not swallowed and not a crash.

### B2 · 4. PDF export

- A pure `buildBoardHTML(doc, title, isAr)` (new file `services/boardExportHtml.ts`)
  returns one landscape page per board page: an inline `<svg viewBox="0 0 1280 720">`
  with the paper (grid lines, axes, tick labels through `localizeDigits`) and the
  strokes, plus the title and page number in the margin. It goes through the
  existing `exportAsPDF`.
- **Untrusted content.** Saved `content` is data from the server or local
  storage. `parseBoard(content)` (pure, tested) validates before anything is used
  or interpolated: `version` known, page count ≤ 20, `background` one of the
  three names, `color` matches `^#[0-9A-Fa-f]{3,8}$`, `width` a finite number in
  a sane range, `points` matches `^[-0-9.,\s]+$` and has a bounded length. A
  malformed board is refused with a message; it is never partially rendered. The
  HTML builder escapes everything it prints (title) and only ever interpolates
  validated numbers and colours.
- Word / plain-text export does not apply to a board.

### Testing and verification

- Pure tests (inside `services/__tests__/`): `fitCanvas` (wide, tall, exact,
  degenerate), `toCanvas`, page add / remove / go-to / cap, `hasInk` across
  pages, `serializeBoard` (rounding, cap refusal), `parseBoard` (accepts a good
  board; rejects bad colour, bad points, too many pages, unknown version, wrong
  types), and `buildBoardHTML` (one page per board page, a hostile title is
  escaped, no `<script>`, only validated colours/points appear).
- The compiler is the audit for the `MaterialType` widening: the plan lists each
  consumer from the typecheck output and records the decision.
- Browser pass (the A harness): draw on two pages, save, reload the app, reopen
  from «موادي» and find the same pages; resize the window between two widths and
  confirm strokes keep their place on the page; PDF export produces N pages;
  `view.tsx` on a board id redirects; over-cap save is refused with a message.
  Not checkable here: touch on a real phone, native print.
- `STATUS.md`, in the same PR: the whiteboard entry gains B1/B2, what was
  verified, and what was not.

## Known limitation

A board saved from a deck gets the same title-derived `lessonId` stamp as every
other material, so «this board belongs to this lesson» is as reliable as the
others (no better). The spec adds no new claim; fixing the title-to-lesson
problem is out of scope.

## Open decision for the owner (not a design question)

B builds on A's code. **PR #928 (A) is not merged.** This session may only push
to its own branch, so unless A is merged first, B's commits would land in the
same PR. Recommendation: merge #928 first (it is reviewed and browser-verified),
then B gets its own PR. Implementation does not start until this is decided.

## Risks

- **B1 changes code A just shipped.** The slide pen and book-page pen must stay
  byte-for-byte unchanged in behaviour (`scale` defaults to 1). The browser pass
  re-runs the A regressions.
- **A shared `PenCanvas` with a scale** is easy to get subtly wrong at the
  edges (letterbox hit areas, eraser size). The tests cover the pure maths; the
  browser pass covers two window sizes.
- **Thin strokes on phones** (see B1 · 1). If it is unacceptable in the browser
  pass at phone width, the plan's fix is a minimum on-screen stroke width, not a
  different canvas.
- **Widening `MaterialType`** silently affects code that is not obviously about
  boards (feedback widget, analytics, cqv reports); the plan makes each a
  recorded decision.
