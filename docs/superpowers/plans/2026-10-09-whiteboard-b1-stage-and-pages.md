# Whiteboard B1 — Fitted Stage and Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The board's page becomes a 16:9 stage fitted into the screen (so a page looks the same everywhere, and stroke widths scale with it), and a board becomes a list of up to 20 pages — still unsaved.

**Architecture:** `main` already stores ink as fractions of the canvas width (`services/penInk.ts`), so hosting `PenCanvas` inside a fitted 16:9 stage makes every stroke resolution-independent with no new coordinate system. A new optional `strokeScale` prop scales stroke widths with the stage; the paper is drawn in canvas units inside a `viewBox`. A pure model gains the stage maths (`fitCanvas`) and a page list (`BoardDoc`) whose pages each own paper, strokes and undo history.

**Tech Stack:** Expo 54 / React Native 0.81 (also the web build), `react-native-svg` 15, `expo-router` 6, `node --test` with `--experimental-strip-types`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-whiteboard-b-pages-save-export-design.md` (sections *B1 · 1* and *B1 · 2*). This plan covers **B1 only**; B2 (save, reopen, PDF) is a separate plan.

## Global Constraints

- **No new native module / dependency; do not touch `app.json`.** `app.json`'s `version` is the OTA runtime key (CLAUDE.md).
- **Pure modules import no `react-native` or `expo-*`; tested files use explicit `.ts` extensions in imports.** The mobile runner is bare `node --test`.
- **Tests live in `artifacts/mobile/services/__tests__/`** — the only place the mobile runner looks.
- **The slide pen and book-page pen must behave exactly as before.** Every new `PenCanvas` prop is optional and defaults to today's behaviour.
- **State is declared with `aria-selected` (and other `aria-*` props), never `accessibilityState`** — `services/__tests__/ariaState.test.ts` fails the suite otherwise (react-native-web never reads `accessibilityState`).
- **Compute in Latin, convert to Arabic digits only at display time** (`localizeDigits`).
- **Arabic is the product language; the UI is RTL-first.** Every new string goes in both the `ar` and `en` blocks of `services/i18n.ts`.
- **Destructive actions use `confirm()` from `services/confirm.ts`.**
- **Do not claim a phone or browser behaviour you did not observe.** Report unchecked items as unchecked.
- **Commit messages end with a blank line and these two lines, copied verbatim (do not substitute any other model name):**
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`
- Work on branch `ccr-cdf5bcd6-nzb5tw`. **This branch still carries PR #928 (sub-project A, unmerged) — B1 stacks on it.** Never push to another branch.
- Typecheck from the repo root: `cd /home/user/Iqraa && pnpm run typecheck`. If `artifacts/mobile` typecheck reports route-name errors (`"/suggest-feature"` and similar), the git-ignored generated file `artifacts/mobile/.expo/types/router.d.ts` is stale: delete it and re-run (CI has no such file).

## Decisions recorded in this plan

- **A new page inherits the current page's paper** (grid / axes / blank) but has no ink. The spec says "blank page"; the intent is "no ink", and a maths teacher adding the next problem wants the same paper.
- **Page indicator** is `n / total` with digits through `localizeDigits`; the page controls live in the bottom palette as a fifth group (the palette already wraps between groups; the top bar has no room at phone width).
- **Undo history is per page and is not saved** (B2 saves strokes and paper only).

## File Structure

| File | Responsibility |
| --- | --- |
| Modify `artifacts/mobile/services/whiteboardModel.ts` | `CANVAS_W/H`, `fitCanvas`; the page model (`Page`, `BoardDoc`, `addPage`, `removePage`, `goToPage`, `updateCurrent`, `docHasInk`, …) |
| Modify `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` | Tests for both |
| Modify `artifacts/mobile/components/classroom/PenLayer.tsx` | `PenCanvas` `strokeScale` prop (draw width and erase reach) — Task 3 |
| Modify `artifacts/mobile/components/classroom/BoardBackground.tsx` | Paper drawn in canvas units inside a `viewBox` |
| Modify `artifacts/mobile/components/classroom/BoardToolbar.tsx` | A fifth palette group: previous / indicator / next / add / delete page |
| Modify `artifacts/mobile/services/i18n.ts` | Page-control strings, both languages |
| Modify `artifacts/mobile/app/ai-tools/whiteboard.tsx` | Fitted stage, `BoardDoc` state, page handlers |
| Modify `STATUS.md` | B1 entry in the whiteboard bullet |

---

### Task 0: Install and baseline

**Files:** none changed.

- [ ] **Step 1: Install**

Run: `cd /home/user/Iqraa && pnpm install`
Expected: completes without error.

- [ ] **Step 2: Record the baseline**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -6; cd artifacts/mobile && pnpm test > /tmp/b1-baseline.log 2>&1; grep -E "^# (tests|pass|fail|skipped)" /tmp/b1-baseline.log`
Expected: typecheck clean; the mobile suite is **3351 pass / 0 fail / 10 skipped** (3361 tests). If anything differs, write down which tests, so later failures are not blamed on this work.

---

### Task 1: Model — the stage maths

**Files:**
- Modify: `artifacts/mobile/services/whiteboardModel.ts` (append)
- Modify: `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` (extend the import list, append)

**Interfaces:**
- Produces (used by Tasks 3–4): `CANVAS_W = 1280`, `CANVAS_H = 720`, `type Stage = { scale: number; width: number; height: number; offsetX: number; offsetY: number }`, `fitCanvas(areaW: number, areaH: number): Stage`.

- [ ] **Step 1: Write the failing tests**

In `whiteboardModel.test.ts`, add `CANVAS_H, CANVAS_W, fitCanvas,` to the existing import list from `../whiteboardModel.ts`, then append:

```ts
describe('fitCanvas', () => {
  it('is the identity on an area that is exactly the reference size', () => {
    assert.deepEqual(fitCanvas(1280, 720), { scale: 1, width: 1280, height: 720, offsetX: 0, offsetY: 0 });
  });

  it('letterboxes a wide area at the sides, keeping the scale limited by the height', () => {
    assert.deepEqual(fitCanvas(2560, 720), { scale: 1, width: 1280, height: 720, offsetX: 640, offsetY: 0 });
  });

  it('letterboxes a tall area above and below, keeping the scale limited by the width', () => {
    assert.deepEqual(fitCanvas(640, 1000), { scale: 0.5, width: 640, height: 360, offsetX: 0, offsetY: 320 });
  });

  it('always yields a 16:9 stage that fits inside the area', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1920, 1080], [1000, 1000], [300, 50]] as const) {
      const s = fitCanvas(w, h);
      assert.ok(Math.abs(s.width / s.height - CANVAS_W / CANVAS_H) < 1e-9, `${w}x${h}`);
      assert.ok(s.width <= w + 1e-9 && s.height <= h + 1e-9, `${w}x${h}`);
      assert.ok(Math.abs(s.offsetX * 2 + s.width - w) < 1e-9, `${w}x${h} centred horizontally`);
      assert.ok(Math.abs(s.offsetY * 2 + s.height - h) < 1e-9, `${w}x${h} centred vertically`);
    }
  });

  it('returns an empty stage for an area with no size yet', () => {
    const empty = { scale: 0, width: 0, height: 0, offsetX: 0, offsetY: 0 };
    assert.deepEqual(fitCanvas(0, 720), empty);
    assert.deepEqual(fitCanvas(1280, 0), empty);
    assert.deepEqual(fitCanvas(-5, 100), empty);
    assert.deepEqual(fitCanvas(Number.NaN, 100), empty);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok|SyntaxError|does not provide" | head`
Expected: FAIL — `fitCanvas` / `CANVAS_W` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `whiteboardModel.ts`:

```ts
/** The page's reference size. Paper and stroke widths are drawn in these units. */
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

/** Where the 16:9 page sits inside the screen area, and how big it is. */
export type Stage = { scale: number; width: number; height: number; offsetX: number; offsetY: number };

/**
 * The largest 16:9 rectangle that fits the area, centred. `scale` is its width
 * over `CANVAS_W` (canvas units to pixels). An area with no size yet — before
 * layout — gives an all-zero stage rather than dividing by it.
 */
export function fitCanvas(areaW: number, areaH: number): Stage {
  if (!(areaW > 0) || !(areaH > 0)) return { scale: 0, width: 0, height: 0, offsetX: 0, offsetY: 0 };
  const scale = Math.min(areaW / CANVAS_W, areaH / CANVAS_H);
  const width = CANVAS_W * scale;
  const height = CANVAS_H * scale;
  return { scale, width, height, offsetX: (areaW - width) / 2, offsetY: (areaH - height) / 2 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: the Step 2 command.
Expected: all pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/services/whiteboardModel.ts artifacts/mobile/services/__tests__/whiteboardModel.test.ts && git commit -F - <<'EOF'
Whiteboard model: the 16:9 stage fitted into the screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 2: Model — pages

**Files:**
- Modify: `artifacts/mobile/services/whiteboardModel.ts` (append)
- Modify: `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` (extend the import list, append)

**Interfaces:**
- Consumes (already in the file): `BoardState`, `EMPTY_BOARD`, `commitStrokes`, `undoBoard`, `hasInk`, `canUndo`, `type BoardBackground`.
- Produces (used by Task 4): `MAX_PAGES = 20`; `type Page = { background: BoardBackground; board: BoardState }`; `type BoardDoc = { pages: Page[]; current: number }`; `blankPage(background?: BoardBackground): Page`; `EMPTY_DOC: BoardDoc`; `currentPage(doc): Page`; `updateCurrent(doc, fn: (page: Page) => Page): BoardDoc`; `addPage(doc): BoardDoc`; `removePage(doc, index?: number): BoardDoc`; `goToPage(doc, index: number): BoardDoc`; `docHasInk(doc): boolean`.

- [ ] **Step 1: Write the failing tests**

In `whiteboardModel.test.ts`, add `EMPTY_DOC, MAX_PAGES, addPage, currentPage, docHasInk, goToPage, removePage, updateCurrent, type BoardDoc,` to the existing import list, then append:

```ts
describe('pages', () => {
  const stroke = line('0,0 10,10');
  const draw = (doc: BoardDoc): BoardDoc =>
    updateCurrent(doc, p => ({ ...p, board: commitStrokes(p.board, [...p.board.strokes, stroke]) }));
  const paper = (doc: BoardDoc, background: 'blank' | 'grid' | 'axes'): BoardDoc =>
    updateCurrent(doc, p => ({ ...p, background }));
  /** n pages, page i holding i strokes' worth of identity via its paper, current = `current`. */
  const threePages = (current: number): BoardDoc => {
    let d = paper(EMPTY_DOC, 'blank');
    d = paper(addPage(d), 'grid');
    d = paper(addPage(d), 'axes');
    return goToPage(d, current);
  };

  it('starts as one blank page', () => {
    assert.equal(EMPTY_DOC.pages.length, 1);
    assert.equal(EMPTY_DOC.current, 0);
    assert.equal(currentPage(EMPTY_DOC).background, 'blank');
    assert.equal(docHasInk(EMPTY_DOC), false);
  });

  it('adds a page right after the current one, selects it, and inherits the paper but not the ink', () => {
    let d = draw(paper(EMPTY_DOC, 'axes'));
    d = addPage(goToPage(addPage(d), 0)); // pages: [axes+ink, new, new]  → current is index 1
    assert.equal(d.pages.length, 3);
    assert.equal(d.current, 1);
    assert.equal(currentPage(d).background, 'axes');
    assert.equal(hasInk(currentPage(d).board), false);
    assert.equal(hasInk(d.pages[0]!.board), true);
  });

  it('refuses to grow past MAX_PAGES, returning the same document', () => {
    let d = EMPTY_DOC;
    for (let i = 1; i < MAX_PAGES; i++) d = addPage(d);
    assert.equal(d.pages.length, MAX_PAGES);
    assert.equal(addPage(d), d);
  });

  it('removes the current page and keeps pointing at a real page', () => {
    // [blank, grid, axes], current 2 → remove the last page: current moves back to 1.
    let d = removePage(threePages(2));
    assert.deepEqual(d.pages.map(p => p.background), ['blank', 'grid']);
    assert.equal(d.current, 1);
    // current 1 → remove it: the next page slides in and stays selected.
    d = removePage(threePages(1));
    assert.deepEqual(d.pages.map(p => p.background), ['blank', 'axes']);
    assert.equal(currentPage(d).background, 'axes');
  });

  it('keeps the same page selected when an earlier page is removed', () => {
    const d = removePage(threePages(2), 0);
    assert.deepEqual(d.pages.map(p => p.background), ['grid', 'axes']);
    assert.equal(currentPage(d).background, 'axes');
  });

  it('never removes the last page, and ignores a bad index', () => {
    assert.equal(removePage(EMPTY_DOC), EMPTY_DOC);
    const d = threePages(0);
    assert.equal(removePage(d, 9), d);
    assert.equal(removePage(d, -1), d);
    assert.equal(removePage(d, 1.5), d);
  });

  it('goToPage clamps, and returns the same document when nothing changes', () => {
    const d = threePages(0);
    assert.equal(goToPage(d, 99).current, 2);
    assert.equal(goToPage(d, -5).current, 0);
    assert.equal(goToPage(d, 0), d);
    assert.equal(goToPage(d, Number.NaN), d);
  });

  it('updateCurrent edits only the current page, and is a no-op when the page is unchanged', () => {
    const d = threePages(1);
    assert.equal(updateCurrent(d, p => p), d);
    const e = draw(d);
    assert.equal(hasInk(e.pages[1]!.board), true);
    assert.equal(hasInk(e.pages[0]!.board), false);
    assert.equal(hasInk(e.pages[2]!.board), false);
  });

  it('sees ink on any page, not just the current one', () => {
    const d = goToPage(draw(addPage(EMPTY_DOC)), 0); // ink on page 1, viewing page 0
    assert.equal(hasInk(currentPage(d).board), false);
    assert.equal(docHasInk(d), true);
  });

  it('keeps undo history per page', () => {
    let d = draw(EMPTY_DOC);                    // page 0: one stroke, one undo step
    d = addPage(d);                              // page 1, current
    assert.equal(canUndo(currentPage(d).board), false);
    d = goToPage(d, 0);
    assert.equal(canUndo(currentPage(d).board), true);
    d = updateCurrent(d, p => ({ ...p, board: undoBoard(p.board) }));
    assert.equal(hasInk(currentPage(d).board), false);
  });
});
```

(The test file already imports `commitStrokes`, `undoBoard`, `hasInk`, `canUndo` and defines `line`; if an import is missing, add it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok|SyntaxError|does not provide" | head`
Expected: FAIL — `addPage` etc. are not exported.

- [ ] **Step 3: Write the implementation**

Append to `whiteboardModel.ts`:

```ts
/** A board is a list of pages; each page owns its paper, its strokes and its undo history. */
export const MAX_PAGES = 20;

export type Page = { background: BoardBackground; board: BoardState };
export type BoardDoc = { pages: Page[]; current: number };

export const blankPage = (background: BoardBackground = 'blank'): Page => ({ background, board: EMPTY_BOARD });

export const EMPTY_DOC: BoardDoc = { pages: [blankPage()], current: 0 };

export const currentPage = (doc: BoardDoc): Page => doc.pages[doc.current]!;

/** Apply `fn` to the current page. Same page back means the same document back. */
export function updateCurrent(doc: BoardDoc, fn: (page: Page) => Page): BoardDoc {
  const page = currentPage(doc);
  const next = fn(page);
  if (next === page) return doc;
  return { ...doc, pages: doc.pages.map((p, i) => (i === doc.current ? next : p)) };
}

/**
 * Insert a page right after the current one and select it. It has no ink but
 * inherits the current page's paper — someone adding the next problem wants the
 * same grid or axes. At `MAX_PAGES` the same document comes back.
 */
export function addPage(doc: BoardDoc): BoardDoc {
  if (doc.pages.length >= MAX_PAGES) return doc;
  const at = doc.current + 1;
  const page = blankPage(currentPage(doc).background);
  return { pages: [...doc.pages.slice(0, at), page, ...doc.pages.slice(at)], current: at };
}

/** Remove a page (default: the current one). Never the last page; a bad index is ignored. */
export function removePage(doc: BoardDoc, index: number = doc.current): BoardDoc {
  if (doc.pages.length <= 1 || !Number.isInteger(index) || index < 0 || index >= doc.pages.length) return doc;
  const pages = doc.pages.filter((_, i) => i !== index);
  const current = index < doc.current ? doc.current - 1 : doc.current;
  return { pages, current: Math.min(current, pages.length - 1) };
}

/** Select a page, clamped into range. Same page selected means the same document back. */
export function goToPage(doc: BoardDoc, index: number): BoardDoc {
  if (!Number.isInteger(index)) return doc;
  const next = Math.max(0, Math.min(doc.pages.length - 1, index));
  return next === doc.current ? doc : { ...doc, current: next };
}

/** Is there ink on ANY page? (What leaving the board asks about.) */
export const docHasInk = (doc: BoardDoc): boolean => doc.pages.some(p => hasInk(p.board));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: the Step 2 command.
Expected: all pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/services/whiteboardModel.ts artifacts/mobile/services/__tests__/whiteboardModel.test.ts && git commit -F - <<'EOF'
Whiteboard model: pages, each with its own paper, strokes and undo history

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 3: `strokeScale` on `PenCanvas`

**Files:**
- Modify: `artifacts/mobile/components/classroom/PenLayer.tsx`
- Modify: `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` (append one test)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `PenCanvas` new optional prop `strokeScale?: number` (default `1`): a stroke is drawn `(stroke.width ?? 4) * strokeScale` pixels wide, and the eraser's width unit is `strokeScale / canvasWidth`. Slide pen and book-page pen pass nothing.

- [ ] **Step 1: Write a failing test that pins the hit-test unit for a scaled stroke width**

Append to `whiteboardModel.test.ts`:

```ts
describe('hit test with canvas-unit stroke widths (strokeScale)', () => {
  // A 640px-wide stage showing the 1280-unit page: strokeScale = 0.5, so a
  // width-12 stroke is drawn 6px wide and one WIDTH unit is 0.5/640 of the
  // stored width-fraction. The eraser stays 16 screen pixels.
  const canvasW = 640;
  const strokeScale = 0.5;
  const unit = strokeScale / canvasW;
  const radius = 16 / canvasW;
  const s = line('0.1,0.25 0.9,0.25', { width: 12 });

  it('reach = 16px eraser + 3px (half of the 6px drawn width) = 0.0296875 of the width', () => {
    assert.equal(strokeHit(s, 0.5, 0.25 + 0.0295, radius, unit), true);
    assert.equal(strokeHit(s, 0.5, 0.25 + 0.03, radius, unit), false);
  });
});
```

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok"`
Expected: this test **passes already** — it pins the existing `unit` semantics that `PenCanvas` is about to rely on, so it is a guard, not a red phase. Say so in your report rather than faking a failure.

- [ ] **Step 2: Add `strokeScale` to `PenLayer.tsx`**

Make exactly these edits.

(a) `StrokeLines` — scale the drawn width. Replace:

```tsx
const StrokeLines = memo(function StrokeLines({ strokes, canvasW }: { strokes: Stroke[]; canvasW: number }) {
```
with:
```tsx
const StrokeLines = memo(function StrokeLines({ strokes, canvasW, strokeScale }: { strokes: Stroke[]; canvasW: number; strokeScale: number }) {
```
and replace `          strokeWidth={s.width ?? DEFAULT_STROKE_WIDTH}` with:
```tsx
          strokeWidth={(s.width ?? DEFAULT_STROKE_WIDTH) * strokeScale}
```

(b) The component signature and its doc. Replace:

```tsx
export function PenCanvas({ strokes, color, active, onChange, width = DEFAULT_STROKE_WIDTH, erase = false }: {
  strokes: Stroke[];
  color: string;
  active: boolean;
  onChange: (next: Stroke[]) => void;
  /** Stroke width in pixels. Slides leave this alone. */
  width?: number;
  /** Touches remove strokes instead of drawing. */
  erase?: boolean;
}) {
```
with:
```tsx
export function PenCanvas({ strokes, color, active, onChange, width = DEFAULT_STROKE_WIDTH, erase = false, strokeScale = 1 }: {
  strokes: Stroke[];
  color: string;
  active: boolean;
  onChange: (next: Stroke[]) => void;
  /** Stroke width in width units (pixels when `strokeScale` is 1). Slides leave this alone. */
  width?: number;
  /** Touches remove strokes instead of drawing. */
  erase?: boolean;
  /**
   * Pixels per width unit. The board passes its stage's scale so a stroke keeps
   * its thickness relative to the PAGE on every screen; slides leave it at 1.
   */
  strokeScale?: number;
}) {
```

(c) The `latest` ref. Replace:

```tsx
  const latest = useRef({ strokes, color, width, erase, onChange, canvasW });
  latest.current = { strokes, color, width, erase, onChange, canvasW };
```
with:
```tsx
  const latest = useRef({ strokes, color, width, erase, onChange, canvasW, strokeScale });
  latest.current = { strokes, color, width, erase, onChange, canvasW, strokeScale };
```

(d) Erase on pen-down. Also change the comment just above them so it says `unit` is one WIDTH unit in stored units (a stroke's `width` times `strokeScale` pixels), and the eraser's reach is a fixed number of screen pixels. Replace the lines that compute `unit`/`fx`/`fy` and call `eraseAt` in `onPanResponderGrant`:

```tsx
          const unit = 1 / cur.canvasW;
          const fx = x * unit;
          const fy = y * unit;
          const next = eraseAt(cur.strokes, fx, fy, ERASER_RADIUS * unit, unit);
```
with:
```tsx
          const px = 1 / cur.canvasW;                  // one pixel, in stored units
          const unit = cur.strokeScale / cur.canvasW;  // one WIDTH unit, in stored units
          const fx = x * px;
          const fy = y * px;
          const next = eraseAt(cur.strokes, fx, fy, ERASER_RADIUS * px, unit);
```

(e) Erase on move. In `onPanResponderMove` replace:

```tsx
        const cw = latest.current.canvasW;
        if (erasedRef.current) {
          if (!(cw > 0)) return;
          const unit = 1 / cw;
          const fx = x * unit;
          const fy = y * unit;
          const from = lastErase.current ?? { x: fx, y: fy };
          const next = eraseAlong(erasedRef.current, from.x, from.y, fx, fy, ERASER_RADIUS * unit, unit);
```
with:
```tsx
        const cw = latest.current.canvasW;
        if (erasedRef.current) {
          if (!(cw > 0)) return;
          const px = 1 / cw;
          const unit = latest.current.strokeScale / cw;
          const fx = x * px;
          const fy = y * px;
          const from = lastErase.current ?? { x: fx, y: fy };
          const next = eraseAlong(erasedRef.current, from.x, from.y, fx, fy, ERASER_RADIUS * px, unit);
```
(the lines after it — `lastErase.current = …`, the `if (next !== erasedRef.current)` block — stay as they are).

(f) Pass the scale to both renders. Replace:

```tsx
        <StrokeLines strokes={erased ?? strokes} canvasW={canvasW} />
        {draft && <StrokeLines strokes={[draft]} canvasW={canvasW} />}
```
with:
```tsx
        <StrokeLines strokes={erased ?? strokes} canvasW={canvasW} strokeScale={strokeScale} />
        {draft && <StrokeLines strokes={[draft]} canvasW={canvasW} strokeScale={strokeScale} />}
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -15`
Expected: clean. (`strokeScale` is optional, so the screen and the other two consumers still compile unchanged.)

- [ ] **Step 4: Run the model tests and the full suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | grep -E "^# (pass|fail)"; pnpm test > /tmp/b1-t3.log 2>&1; grep -E "^# (tests|pass|fail|skipped)" /tmp/b1-t3.log`
Expected: 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/components/classroom/PenLayer.tsx artifacts/mobile/services/__tests__/whiteboardModel.test.ts && git commit -F - <<'EOF'
PenCanvas: a strokeScale prop so stroke widths can scale with the page

The slide pen and book-page pen pass no strokeScale and are unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```


---

### Task 4: The fitted stage, the paper in canvas units, the page list, and the page controls

**Files:**
- Modify (replace the whole file): `artifacts/mobile/components/classroom/BoardBackground.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (two inserts)
- Modify: `artifacts/mobile/components/classroom/BoardToolbar.tsx`
- Modify (replace the whole file): `artifacts/mobile/app/ai-tools/whiteboard.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–3, and `BOARD_STEP`, `axesGeometry`, `gridLines`, `localizeDigits` (existing).
- Produces: `BoardBackground({ kind, lang })` — **no `width` / `height` props any more**: it fills its parent and draws in canvas units (`viewBox="0 0 1280 720"`), so the parent must be the 16:9 stage; i18n keys `boardPrevPage`, `boardNextPage`, `boardAddPage`, `boardDeletePage`, `boardDeletePageTitle`, `boardDeletePageMessage`, `boardDeletePageConfirm`; `BoardToolbar` new props `pageLabel: string`, `canPrevPage`, `canNextPage`, `canAddPage`, `canDeletePage: boolean`, `onPrevPage`, `onNextPage`, `onAddPage`, `onDeletePage: () => void`, and four new `labels` fields `prevPage`, `nextPage`, `addPage`, `deletePage`.

- [ ] **Step 1: Replace `BoardBackground.tsx`** (do this together with Step 5, which rewrites its only caller; the typecheck is expected to be red between the two)

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { DECK_BORDER, DECK_MUTED } from '@/services/deckTheme';
import {
  BOARD_STEP,
  CANVAS_H,
  CANVAS_W,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground as BoardBackgroundKind,
} from '@/services/whiteboardModel';

/**
 * The paper behind the ink, drawn in canvas units (1280 × 720) inside a
 * viewBox, so it scales with the page. The parent must be the 16:9 stage.
 * Purely visual: it never takes a touch, so the canvas above it gets every
 * event. `axes` is a grid with the x and y axes and one numbered tick per
 * square (digits localised at display time only).
 */
export function BoardBackground({ kind, lang }: { kind: BoardBackgroundKind; lang: string }) {
  if (kind === 'blank') return null;
  const grid = gridLines(CANVAS_W, CANVAS_H, BOARD_STEP);
  const axes = kind === 'axes' ? axesGeometry(CANVAS_W, CANVAS_H, BOARD_STEP) : null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none">
        {grid.map((s, i) => (
          <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={DECK_BORDER} strokeWidth={1.5} />
        ))}
        {axes && (
          <>
            <Line {...axes.xAxis} stroke={DECK_MUTED} strokeWidth={3} />
            <Line {...axes.yAxis} stroke={DECK_MUTED} strokeWidth={3} />
            {axes.ticks.map((tick, i) => (
              <SvgText
                key={i}
                x={tick.axis === 'x' ? tick.x : tick.x - 8}
                y={tick.axis === 'x' ? tick.y + 22 : tick.y + 5}
                fontSize={16}
                fill={DECK_MUTED}
                textAnchor={tick.axis === 'x' ? 'middle' : 'end'}
              >
                {localizeDigits(tick.value, lang)}
              </SvgText>
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Arabic strings**

In `artifacts/mobile/services/i18n.ts`, replace the unique line `    boardLeaveConfirm: 'غادر',` with:

```ts
    boardLeaveConfirm: 'غادر',
    boardPrevPage: 'الصفحة السابقة',
    boardNextPage: 'الصفحة التالية',
    boardAddPage: 'صفحة جديدة',
    boardDeletePage: 'احذف الصفحة',
    boardDeletePageTitle: 'حذف الصفحة؟',
    boardDeletePageMessage: 'ستُحذف هذه الصفحة وكل ما عليها.',
    boardDeletePageConfirm: 'احذف',
```

- [ ] **Step 3: English strings**

Replace the unique line `    boardLeaveConfirm: 'Leave',` with:

```ts
    boardLeaveConfirm: 'Leave',
    boardPrevPage: 'Previous page',
    boardNextPage: 'Next page',
    boardAddPage: 'New page',
    boardDeletePage: 'Delete page',
    boardDeletePageTitle: 'Delete this page?',
    boardDeletePageMessage: 'This page and everything on it will be removed.',
    boardDeletePageConfirm: 'Delete',
```

If an Edit anchor is not unique, include the following line in the anchor. If `i18n.test.ts` / `i18nTerminology.test.ts` rejects a string, fix the **string**, not the test, and say which.

- [ ] **Step 4: Page controls in `BoardToolbar.tsx`**

(a) Extend `BoardToolbarLabels` — replace:

```tsx
  backgrounds: Record<BoardBackground, string>;
};
```
with:
```tsx
  backgrounds: Record<BoardBackground, string>;
  prevPage: string;
  nextPage: string;
  addPage: string;
  deletePage: string;
};
```

(b) Extend the destructured parameters and the prop types. Replace:

```tsx
  background, onBackground, onClose, labels,
}: {
```
with:
```tsx
  background, onBackground, onClose, labels,
  pageLabel, canPrevPage, canNextPage, canAddPage, canDeletePage,
  onPrevPage, onNextPage, onAddPage, onDeletePage,
}: {
```
and replace:
```tsx
  onClose: () => void;
  labels: BoardToolbarLabels;
}) {
```
with:
```tsx
  onClose: () => void;
  labels: BoardToolbarLabels;
  /** "2 / 5", digits already localised. */
  pageLabel: string;
  canPrevPage: boolean;
  canNextPage: boolean;
  canAddPage: boolean;
  canDeletePage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
}) {
```

(c) Add a fifth group at the end of the palette. Replace the last group and the closing tags:

```tsx
          <Pressable onPress={onClear} disabled={!hasInk} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: hasInk ? 1 : 0.35 }}>
            <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
          </Pressable>
        </View>
      </View>
    </>
```
with:
```tsx
          <Pressable onPress={onClear} disabled={!hasInk} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: hasInk ? 1 : 0.35 }}>
            <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
          </Pressable>
        </View>
        <View style={styles.group}>
          <Pressable onPress={onPrevPage} disabled={!canPrevPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.prevPage} style={{ opacity: canPrevPage ? 1 : 0.35 }}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={DECK_MUTED} />
          </Pressable>
          <Text style={[styles.pageLabel, { fontFamily: 'Almarai_400Regular' }]}>{pageLabel}</Text>
          <Pressable onPress={onNextPage} disabled={!canNextPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.nextPage} style={{ opacity: canNextPage ? 1 : 0.35 }}>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={DECK_MUTED} />
          </Pressable>
          <Pressable onPress={onAddPage} disabled={!canAddPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.addPage} style={{ opacity: canAddPage ? 1 : 0.35 }}>
            <Ionicons name="add-circle-outline" size={22} color={DECK_MUTED} />
          </Pressable>
          <Pressable onPress={onDeletePage} disabled={!canDeletePage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.deletePage} style={{ opacity: canDeletePage ? 1 : 0.35 }}>
            <Ionicons name="remove-circle-outline" size={22} color={DECK_MUTED} />
          </Pressable>
        </View>
      </View>
    </>
```

(d) Add the style. In the `StyleSheet.create({ … })` object, after the `group:` line add:
```tsx
  pageLabel: { fontSize: 13, color: DECK_MUTED, minWidth: 40, textAlign: 'center' },
```

- [ ] **Step 5: Replace `whiteboard.tsx`**

Write the whole file:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { DECK_BG, DECK_CARD_BG } from '@/services/deckTheme';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import {
  BOARD_DEFAULT_WIDTH,
  EMPTY_DOC,
  MAX_PAGES,
  addPage,
  canUndo,
  clearBoard,
  commitStrokes,
  currentPage,
  docHasInk,
  fitCanvas,
  goToPage,
  hasInk,
  localizeDigits,
  removePage,
  undoBoard,
  updateCurrent,
  type BoardBackground as BoardBackgroundKind,
  type BoardDoc,
} from '@/services/whiteboardModel';

/**
 * The board (سبورة). Opened from the presentation; Back returns to the same
 * slide because the presentation stays mounted underneath.
 *
 * The page is a 16:9 stage fitted into the screen. `PenCanvas` measures the
 * stage, so ink is stored as fractions of the stage width and looks the same
 * on every screen; stroke widths scale with the stage (`strokeScale`).
 *
 * Nothing is saved yet, so clearing a page, deleting a page that has ink, and
 * leaving with ink on ANY page all ask first. Android's hardware back, the
 * close button and (on web) Escape are intercepted; the browser's own back
 * button and closing the tab are not.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<BoardDoc>(EMPTY_DOC);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Listeners registered once read the document through a ref.
  const docRef = useRef(doc);
  docRef.current = doc;

  // One confirm dialog at a time, shared by leave, clear and delete-page: a held
  // Escape key repeats, and each repeat would otherwise stack another dialog.
  const busy = useRef(false);

  const page = currentPage(doc);
  const stage = fitCanvas(area.w, area.h);

  const leave = useCallback(async () => {
    if (busy.current) return;
    if (!docHasInk(docRef.current)) {
      goBack();
      return;
    }
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardLeaveTitle'),
        message: t('boardLeaveMessage'),
        confirmLabel: t('boardLeaveConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) goBack();
    } finally {
      busy.current = false;
    }
  }, [t]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  // Esc is a reflex key on web; without this it would fall through to the
  // presentation's handler and drop the board's ink unasked.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  const onClear = useCallback(async () => {
    if (busy.current) return;
    if (!hasInk(currentPage(docRef.current).board)) return;
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardClearTitle'),
        message: t('boardClearMessage'),
        confirmLabel: t('boardClearConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setDoc(d => updateCurrent(d, p => ({ ...p, board: clearBoard(p.board) })));
    } finally {
      busy.current = false;
    }
  }, [t]);

  const onDeletePage = useCallback(async () => {
    if (busy.current) return;
    const d = docRef.current;
    if (d.pages.length <= 1) return;
    if (!hasInk(currentPage(d).board)) {
      setDoc(x => removePage(x));
      return;
    }
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardDeletePageTitle'),
        message: t('boardDeletePageMessage'),
        confirmLabel: t('boardDeletePageConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setDoc(x => removePage(x));
    } finally {
      busy.current = false;
    }
  }, [t]);

  const pageLabel = `${localizeDigits(String(doc.current + 1), lang)} / ${localizeDigits(String(doc.pages.length), lang)}`;

  return (
    <View style={styles.container} onLayout={e => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.stage, { left: stage.offsetX, top: stage.offsetY, width: stage.width, height: stage.height }]}>
        <BoardBackground kind={page.background} lang={lang} />
        {/* Keyed by page so a gesture in flight cannot carry onto the next page. */}
        <PenCanvas
          key={doc.current}
          strokes={page.board.strokes}
          color={color}
          width={width}
          strokeScale={stage.scale > 0 ? stage.scale : 1}
          erase={erase}
          active
          onChange={next => setDoc(d => updateCurrent(d, p => ({ ...p, board: commitStrokes(p.board, next) })))}
        />
      </View>
      <BoardToolbar
        isRTL={isRTL}
        topInset={insets.top}
        bottomInset={insets.bottom}
        color={color}
        onColor={setColor}
        width={width}
        onWidth={setWidth}
        erase={erase}
        onErase={setErase}
        canUndo={canUndo(page.board)}
        onUndo={() => setDoc(d => updateCurrent(d, p => ({ ...p, board: undoBoard(p.board) })))}
        hasInk={hasInk(page.board)}
        onClear={onClear}
        background={page.background}
        onBackground={(b: BoardBackgroundKind) => setDoc(d => updateCurrent(d, p => (p.background === b ? p : { ...p, background: b })))}
        onClose={leave}
        pageLabel={pageLabel}
        canPrevPage={doc.current > 0}
        canNextPage={doc.current < doc.pages.length - 1}
        canAddPage={doc.pages.length < MAX_PAGES}
        canDeletePage={doc.pages.length > 1}
        onPrevPage={() => setDoc(d => goToPage(d, d.current - 1))}
        onNextPage={() => setDoc(d => goToPage(d, d.current + 1))}
        onAddPage={() => setDoc(d => addPage(d))}
        onDeletePage={onDeletePage}
        labels={{
          close: t('close'),
          pen: t('penTool'),
          eraser: t('boardEraser'),
          undo: t('penUndo'),
          clear: t('penClear'),
          colors: [t('penRed'), t('penTeal'), t('penBlack')],
          widths: [t('boardWidthThin'), t('boardWidthMedium'), t('boardWidthThick')],
          backgrounds: { blank: t('boardBgBlank'), grid: t('boardBgGrid'), axes: t('boardBgAxes') },
          prevPage: t('boardPrevPage'),
          nextPage: t('boardNextPage'),
          addPage: t('boardAddPage'),
          deletePage: t('boardDeletePage'),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The letterbox around the page is the deck's cream; the page itself is white.
  container: { flex: 1, backgroundColor: DECK_BG },
  stage: { position: 'absolute', backgroundColor: DECK_CARD_BG, overflow: 'hidden' },
});
```

- [ ] **Step 6: Typecheck and the full suite**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -10; cd artifacts/mobile && pnpm test > /tmp/b1-t4.log 2>&1; grep -E "^# (tests|pass|fail|skipped)" /tmp/b1-t4.log`
Expected: typecheck clean; 0 failing tests (the i18n tests must accept the 7 new keys; `ariaState` must still pass).

- [ ] **Step 7: Read your own diff adversarially**

Check and say in the report: the page-switch handlers use functional `setDoc` updates (no stale `doc`); `PenCanvas` is keyed by `doc.current`; `leave` asks when ANY page has ink and `onClear` only looks at the current page; `busy` is reset in a `finally` in all three dialog handlers; `onDeletePage` deletes an empty page without asking; the last page cannot be deleted; no import is unused; no `accessibilityState` crept in; `BoardBackground` has no leftover `width`/`height` use anywhere.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/components/classroom/BoardBackground.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/components/classroom/BoardToolbar.tsx artifacts/mobile/app/ai-tools/whiteboard.tsx && git commit -F - <<'EOF'
Whiteboard: a fitted 16:9 stage and multiple pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 5: Verify in the browser, update STATUS.md, push

**Files:**
- Modify: `STATUS.md` (the whiteboard bullet)

- [ ] **Step 1: Drive it in a browser** (follow `LOCAL_SETUP.md` for Postgres, the API on :8080 and Expo web on :8081; sign in as a teacher; start a class and open the board from the presentation)

Record what you actually saw for each:

1. **Stage:** the page is a 16:9 rectangle (`stage` width / height ≈ 1.778) centred in a cream letterbox; at 1280×800 the letterbox is above and below, at 800×800 too, at 1900×700 at the sides.
2. **Resolution independence:** draw a stroke at 1280×800, then resize the window to 800×800. The stroke is in the same place **on the page** (its first polyline coordinate scales by 800/1280 ≈ 0.625, and it covers the same squares of the grid).
3. **Widths scale with the page:** at 1280 wide a width-6 stroke is 6px (`stroke-width` ≈ 6); at 640 wide it is ≈ 3px.
4. **Pages:** «+» adds a page after the current one and selects it (indicator `2 / 2`); the new page has no ink and the same paper; Previous/Next move between pages and each keeps its own ink; per-page paper (axes on one page, blank on the next) is kept; undo on a page does not touch another page's ink; delete removes the current page (asks first when it has ink, not when it is empty); the last page cannot be deleted; at 20 pages «+» is disabled.
5. **Leaving** asks when **any** page has ink (including one you are not looking at), and not when all pages are empty.
6. **Eraser** still removes only the crossed stroke, at both window sizes.
7. **Regressions:** the slide pen, per-slide ink and the book-page pen still draw, undo and clear (their strokes are unaffected by `strokeScale`); Escape, the keyboard guards and the countdown still behave as in A.
8. **Arabic and English:** the indicator shows Arabic-Indic digits in Arabic and Latin in English; the page buttons carry their labels; the toolbar still wraps between groups at 390 px (now five groups).

Anything you could not run is reported as **not checked**. Touch on a real phone is expected to remain unchecked.

- [ ] **Step 2: Update `STATUS.md`**

In the whiteboard bullet (search `The first Smart Whiteboard is gone; a new board replaced it`; the file is ~870 KB — never read it whole, use `grep -n` and a small `offset`/`limit` window), add one paragraph before the `Not verified:` sentence describing B1: the fitted 16:9 stage (ink stays in place on resize because ink is stored as fractions of the stage width), stroke widths scaling with the page (`strokeScale`), pages (up to 20, each with its own paper, ink and undo history; a new page inherits the paper), and what Step 1 actually showed. Replace the sentence "Nothing is saved yet" context only if it becomes untrue (it does not: B1 saves nothing). Update the `Still to build:` sentence to say B2 (save, reopen, PDF) and C remain. Do not claim anything Step 1 did not observe; add anything it could not check to the `Not verified:` list.

- [ ] **Step 3: Final checks**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -6; cd artifacts/mobile && pnpm test > /tmp/b1-final.log 2>&1; grep -E "^# (tests|pass|fail|skipped)" /tmp/b1-final.log; grep -n "<DATE>" /home/user/Iqraa/STATUS.md`
Expected: typecheck clean; 0 failing; no `<DATE>` placeholder.

- [ ] **Step 4: Commit and push**

```bash
cd /home/user/Iqraa && git add STATUS.md && git commit -F - <<'EOF'
STATUS: whiteboard B1 — a fitted stage and pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
git push -u origin ccr-cdf5bcd6-nzb5tw
```

If the push fails on a network error, retry up to four times with 2s, 4s, 8s, 16s waits.

- [ ] **Step 5: Update PR #928**

The PR now carries A **and** B1. Retitle it to «Whiteboard (سبورة): A — blank board, B1 — fitted stage and pages», add a B1 section to the body (what changed, what was verified, what was not), keep `schema-push: n/a (no schema change)` and the two footer lines `🤖 Generated with [Claude Code](https://claude.com/claude-code)` / `https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`, and keep it a draft.
