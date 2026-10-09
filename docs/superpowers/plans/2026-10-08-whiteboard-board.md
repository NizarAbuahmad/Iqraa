# Whiteboard (سبورة) A — Blank Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, teacher-only drawing board (grid/axes background, eraser, three stroke widths, undoable erase/clear) opened from the presentation's action row.

**Architecture:** All testable logic goes in one pure module, `services/whiteboardModel.ts`. `PenCanvas` (shared by the slide pen, the book-page pen and the new board) gains optional `width`/`erase` props and keeps the in-progress stroke in local state, committing on pen-up. A new screen `app/ai-tools/whiteboard.tsx` composes `PenCanvas`, a `BoardBackground` SVG and a `BoardToolbar`.

**Tech Stack:** Expo 54 / React Native 0.81 (also the web build), `react-native-svg` 15, `expo-router` 6, `node --test` with `--experimental-strip-types` for tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-whiteboard-board-design.md`

## Global Constraints

- **No new native module / dependency.** `app.json`'s `version` is the OTA runtime key; do not edit it (CLAUDE.md).
- **Pure modules import no `react-native` or `expo-*`.** The mobile runner is bare `node --test`; imports inside tested files use explicit `.ts` extensions.
- **Tests live in `artifacts/mobile/services/__tests__/`** — the only place the mobile runner looks. Do not narrow the glob.
- **Compute in Latin, convert to Arabic digits only at display time** (CLAUDE.md). Tick values are Latin strings in the model; the component calls `localizeDigits`.
- **No Tools-tab card.** Do not touch `services/toolCatalog.ts` or `toolCatalog.test.ts`.
- **Slide pen stays behaviourally the same** except that `onChange` fires once per stroke (on pen-up) instead of once per touch-move.
- **Arabic is the product language; the UI is RTL-first.** Every new string goes in both the `ar` and `en` blocks of `services/i18n.ts`.
- **Destructive actions use `confirm()` from `services/confirm.ts`** (`Alert.alert` buttons do nothing on react-native web).
- **Do not claim a phone or browser behaviour you did not observe.** Report unchecked items as unchecked.
- **Commit messages end with these two lines** (blank line before them):
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`
- Work on branch `ccr-cdf5bcd6-nzb5tw` (draft PR #928). Never push to another branch.

## File Structure

| File | Responsibility |
| --- | --- |
| Create `artifacts/mobile/services/whiteboardModel.ts` | Pure: `Stroke`, widths, `eraseAt`, board state + undo, background geometry, `localizeDigits` |
| Create `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` | Tests for all of the above |
| Modify `artifacts/mobile/components/classroom/PenLayer.tsx` | `PenCanvas` draft stroke + `width` + `erase`; re-export `Stroke` |
| Create `artifacts/mobile/components/classroom/BoardBackground.tsx` | SVG grid / axes + tick labels, never takes touches |
| Create `artifacts/mobile/components/classroom/BoardToolbar.tsx` | Close, background chips, colours, widths, pen/eraser, undo, clear |
| Create `artifacts/mobile/app/ai-tools/whiteboard.tsx` | The screen: state, confirm-on-clear/leave, Android back |
| Modify `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` | «السبورة» button in the action row |
| Modify `artifacts/mobile/services/i18n.ts` | New `whiteboardTool` / `board*` keys, both languages |
| Modify `artifacts/mobile/services/__tests__/routeGating.test.ts` | Pin: the board is teacher-only |
| Modify `STATUS.md` | Update the Smart Whiteboard entry; add what was verified |

---

### Task 0: Install and baseline

**Files:** none changed.

- [ ] **Step 1: Install dependencies** (`node_modules` is empty in a fresh session)

Run: `cd /home/user/Iqraa && pnpm install`
Expected: completes without error. If the proxy blocks it, stop and report; do not continue to later tasks without a working typecheck.

- [ ] **Step 2: Record the baseline**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -5; pnpm test 2>&1 | tail -12`
Expected: note whether typecheck and tests pass **before** any change. If anything already fails, write down which tests, so later failures are not blamed on this work.

---

### Task 1: Model — strokes, eraser, board state

**Files:**
- Create: `artifacts/mobile/services/whiteboardModel.ts`
- Create: `artifacts/mobile/services/__tests__/whiteboardModel.test.ts`

**Interfaces:**
- Produces (exact names used by Tasks 3–5):
  - `type Stroke = { color: string; points: string; width?: number }`
  - `DEFAULT_STROKE_WIDTH = 4`, `STROKE_WIDTHS = [3, 6, 12] as const`, `BOARD_DEFAULT_WIDTH = 6`, `ERASER_RADIUS = 16`, `HISTORY_LIMIT = 50`
  - `parsePoints(points: string): Point[]` where `Point = { x: number; y: number }`
  - `strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean`
  - `eraseAt(strokes: Stroke[], x: number, y: number, radius?: number): Stroke[]` (returns the **same array instance** when nothing was hit)
  - `type BoardState = { strokes: Stroke[]; past: Stroke[][] }`, `EMPTY_BOARD`
  - `commitStrokes(state, next)`, `undoBoard(state)`, `clearBoard(state)`, `hasInk(state)`, `canUndo(state)`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/whiteboardModel.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_BOARD,
  HISTORY_LIMIT,
  canUndo,
  clearBoard,
  commitStrokes,
  eraseAt,
  hasInk,
  parsePoints,
  strokeHit,
  undoBoard,
  type BoardState,
  type Stroke,
} from '../whiteboardModel.ts';

const line = (points: string, extra: Partial<Stroke> = {}): Stroke => ({ color: '#000', points, ...extra });

describe('parsePoints', () => {
  it('reads "x,y x,y" pairs', () => {
    assert.deepEqual(parsePoints('0,0 10,5.5 -3,4'), [
      { x: 0, y: 0 },
      { x: 10, y: 5.5 },
      { x: -3, y: 4 },
    ]);
  });

  it('skips malformed pairs instead of inventing zeros', () => {
    assert.deepEqual(parsePoints(''), []);
    assert.deepEqual(parsePoints('1,2 oops 3, 4,x'), [{ x: 1, y: 2 }]);
  });
});

describe('strokeHit / eraseAt', () => {
  it('hits a stroke within radius plus half its width', () => {
    const s = line('0,0 100,0'); // default width 4 -> reach = radius + 2
    assert.equal(strokeHit(s, 50, 10, 16), true);
    assert.equal(strokeHit(s, 50, 30, 16), false);
  });

  it('measures to the segment, not just the recorded points', () => {
    // Only two points, 100px apart: the middle is 50px from either vertex but 4px from the line.
    const s = line('0,0 100,0');
    assert.equal(strokeHit(s, 50, 4, 2), true);
    assert.equal(strokeHit(s, 50, 8, 2), false);
  });

  it('honours a stroke width', () => {
    const wide = line('0,0 100,0', { width: 12 }); // reach = 2 + 6
    assert.equal(strokeHit(wide, 50, 8, 2), true);
    assert.equal(strokeHit(wide, 50, 9, 2), false);
  });

  it('treats a dot (two identical points) and a single point as zero-length', () => {
    assert.equal(strokeHit(line('10,10 10,10'), 12, 10, 2), true);
    assert.equal(strokeHit(line('10,10 10,10'), 30, 10, 2), false);
    assert.equal(strokeHit(line('10,10'), 12, 10, 2), true);
  });

  it('never hits, and never throws on, a stroke with no readable points', () => {
    assert.equal(strokeHit(line(''), 0, 0, 1000), false);
  });

  it('removes only the strokes that were hit', () => {
    const a = line('0,0 100,0');
    const b = line('0,200 100,200');
    assert.deepEqual(eraseAt([a, b], 50, 4, 2), [b]);
  });

  it('returns the same array instance when nothing was hit', () => {
    const strokes = [line('0,0 100,0')];
    assert.equal(eraseAt(strokes, 50, 90, 4), strokes);
  });

  it('defaults to a finger-sized radius', () => {
    const strokes = [line('0,0 100,0')];
    assert.deepEqual(eraseAt(strokes, 50, 15), []); // 15 <= 16 + 2
  });
});

describe('board state', () => {
  const a = line('0,0 1,1');
  const b = line('2,2 3,3');

  it('starts empty with nothing to undo', () => {
    assert.equal(hasInk(EMPTY_BOARD), false);
    assert.equal(canUndo(EMPTY_BOARD), false);
  });

  it('undoes commits in reverse order, then stops', () => {
    let s: BoardState = commitStrokes(EMPTY_BOARD, [a]);
    s = commitStrokes(s, [a, b]);
    assert.equal(hasInk(s), true);
    s = undoBoard(s);
    assert.deepEqual(s.strokes, [a]);
    s = undoBoard(s);
    assert.deepEqual(s.strokes, []);
    assert.equal(canUndo(s), false);
    assert.equal(undoBoard(s), s);
  });

  it('ignores a commit that changes nothing', () => {
    const s = commitStrokes(EMPTY_BOARD, [a]);
    assert.equal(commitStrokes(s, s.strokes), s);
  });

  it('makes clear undoable, and does nothing on an empty board', () => {
    const s = commitStrokes(EMPTY_BOARD, [a, b]);
    const cleared = clearBoard(s);
    assert.deepEqual(cleared.strokes, []);
    assert.deepEqual(undoBoard(cleared).strokes, [a, b]);
    assert.equal(clearBoard(EMPTY_BOARD), EMPTY_BOARD);
  });

  it('keeps at most HISTORY_LIMIT undo steps, dropping the oldest', () => {
    let s: BoardState = EMPTY_BOARD;
    const total = HISTORY_LIMIT + 10;
    for (let i = 1; i <= total; i++) {
      s = commitStrokes(s, Array.from({ length: i }, () => a));
    }
    assert.equal(s.strokes.length, total);
    assert.equal(s.past.length, HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) s = undoBoard(s);
    assert.equal(s.strokes.length, total - HISTORY_LIMIT);
    assert.equal(undoBoard(s), s);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | tail -15`
Expected: FAIL — cannot find module `../whiteboardModel.ts`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/whiteboardModel.ts`:

```ts
/**
 * Pure logic for the whiteboard (سبورة): stroke geometry, the eraser, undo
 * history and the board's background geometry.
 *
 * No React Native and no `expo-*` imports, so `node --test` can load it — the
 * screen and `PenCanvas` render and gather touches, this decides.
 */

/** One stroke. `points` is `"x,y x,y …"` (an SVG polyline), in view pixels. */
export type Stroke = { color: string; points: string; /** Absent means DEFAULT_STROKE_WIDTH. */ width?: number };

/** The slide pen's fixed width — what a stroke without `width` is drawn at. */
export const DEFAULT_STROKE_WIDTH = 4;
/** Thin, medium, thick — offered on the board. */
export const STROKE_WIDTHS = [3, 6, 12] as const;
export const BOARD_DEFAULT_WIDTH = 6;
/** Eraser reach in view pixels, on top of half the stroke's own width. */
export const ERASER_RADIUS = 16;
export const HISTORY_LIMIT = 50;

export type Point = { x: number; y: number };

export function parsePoints(points: string): Point[] {
  const out: Point[] = [];
  for (const pair of points.trim().split(/\s+/)) {
    const [xs, ys] = pair.split(',');
    if (xs === undefined || ys === undefined || xs === '' || ys === '') continue;
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Does an eraser of `radius` centred on (x, y) touch this stroke? */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const pts = parsePoints(stroke.points);
  if (pts.length === 0) return false;
  const reach = radius + (stroke.width ?? DEFAULT_STROKE_WIDTH) / 2;
  if (pts.length === 1) return Math.hypot(x - pts[0]!.x, y - pts[0]!.y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    // Distance to the segment, not to its endpoints: a fast stroke records few
    // points, and an eraser dragged across the gap must still catch it.
    if (distanceToSegment(x, y, pts[i - 1]!, pts[i]!) <= reach) return true;
  }
  return false;
}

/**
 * Remove every stroke the eraser touches. Returns the SAME array when nothing
 * was hit, so a caller can tell "no change" by identity and skip a history step.
 */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number = ERASER_RADIUS): Stroke[] {
  const kept = strokes.filter(s => !strokeHit(s, x, y, radius));
  return kept.length === strokes.length ? strokes : kept;
}

/** The strokes on the board plus snapshots to undo back to. */
export type BoardState = { strokes: Stroke[]; past: Stroke[][] };

export const EMPTY_BOARD: BoardState = { strokes: [], past: [] };

/** Make `next` the board's strokes, remembering the old list. Same list in, same state out. */
export function commitStrokes(state: BoardState, next: Stroke[]): BoardState {
  if (next === state.strokes) return state;
  const past = [...state.past, state.strokes];
  return { strokes: next, past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past };
}

export function undoBoard(state: BoardState): BoardState {
  if (state.past.length === 0) return state;
  return { strokes: state.past[state.past.length - 1]!, past: state.past.slice(0, -1) };
}

/** Wipe the board — as a commit, so it can be undone. No-op when already empty. */
export function clearBoard(state: BoardState): BoardState {
  return state.strokes.length === 0 ? state : commitStrokes(state, []);
}

export const hasInk = (state: BoardState): boolean => state.strokes.length > 0;
export const canUndo = (state: BoardState): boolean => state.past.length > 0;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | tail -15`
Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/services/whiteboardModel.ts artifacts/mobile/services/__tests__/whiteboardModel.test.ts && git commit -F - <<'EOF'
Whiteboard model: stroke eraser and undoable board state

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 2: Model — backgrounds and digit display

**Files:**
- Modify: `artifacts/mobile/services/whiteboardModel.ts` (append)
- Modify: `artifacts/mobile/services/__tests__/whiteboardModel.test.ts` (append, and extend the import list)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces (used by Tasks 4–5):
  - `type BoardBackground = 'blank' | 'grid' | 'axes'`, `BOARD_BACKGROUNDS: readonly BoardBackground[]`, `BOARD_STEP = 40`
  - `type Segment = { x1: number; y1: number; x2: number; y2: number }`
  - `gridLines(width: number, height: number, step: number): Segment[]`
  - `type AxisTick = { x: number; y: number; value: string; axis: 'x' | 'y' }`
  - `axesGeometry(width, height, step): { xAxis: Segment; yAxis: Segment; ticks: AxisTick[] }`
  - `localizeDigits(text: string, lang: string): string`

- [ ] **Step 1: Write the failing tests**

In `whiteboardModel.test.ts`, extend the import list with `BOARD_BACKGROUNDS, axesGeometry, gridLines, localizeDigits,` (keep alphabetical-ish; order does not matter) and append:

```ts
describe('gridLines', () => {
  it('draws a vertical at every step inside the width and a horizontal inside the height', () => {
    const lines = gridLines(100, 60, 20);
    const verticals = lines.filter(l => l.x1 === l.x2);
    const horizontals = lines.filter(l => l.y1 === l.y2);
    assert.deepEqual(verticals.map(l => l.x1), [20, 40, 60, 80]);
    assert.deepEqual(horizontals.map(l => l.y1), [20, 40]);
    assert.equal(lines.length, 6);
    for (const v of verticals) assert.deepEqual([v.y1, v.y2], [0, 60]);
    for (const h of horizontals) assert.deepEqual([h.x1, h.x2], [0, 100]);
  });

  it('returns nothing for a degenerate size or step', () => {
    assert.deepEqual(gridLines(0, 60, 20), []);
    assert.deepEqual(gridLines(100, 60, 0), []);
    assert.deepEqual(gridLines(100, -1, 20), []);
  });
});

describe('axesGeometry', () => {
  it('puts the axes through the centre, on a grid line', () => {
    const g = axesGeometry(200, 120, 20);
    assert.deepEqual(g.xAxis, { x1: 0, y1: 60, x2: 200, y2: 60 });
    assert.deepEqual(g.yAxis, { x1: 100, y1: 0, x2: 100, y2: 120 });
  });

  it('snaps the origin to the grid so ticks sit on grid lines', () => {
    const g = axesGeometry(230, 130, 20);
    assert.equal(g.yAxis.x1 % 20, 0);
    assert.equal(g.xAxis.y1 % 20, 0);
  });

  it('ticks every step, skips the origin and the edges, y grows upward', () => {
    const g = axesGeometry(200, 120, 20);
    assert.equal(g.ticks.length, 12);
    const xs = g.ticks.filter(t => t.axis === 'x');
    const ys = g.ticks.filter(t => t.axis === 'y');
    assert.equal(xs.length, 8);
    assert.equal(ys.length, 4);
    assert.deepEqual(xs.find(t => t.x === 120), { axis: 'x', x: 120, y: 60, value: '1' });
    assert.deepEqual(xs.find(t => t.x === 80), { axis: 'x', x: 80, y: 60, value: '-1' });
    assert.deepEqual(ys.find(t => t.y === 40), { axis: 'y', x: 100, y: 40, value: '1' });
    assert.deepEqual(ys.find(t => t.y === 80), { axis: 'y', x: 100, y: 80, value: '-1' });
    assert.equal(g.ticks.some(t => t.value === '0'), false);
  });

  it('returns no ticks for a degenerate size or step', () => {
    assert.deepEqual(axesGeometry(0, 0, 20).ticks, []);
    assert.deepEqual(axesGeometry(200, 120, 0).ticks, []);
  });
});

describe('localizeDigits / BOARD_BACKGROUNDS', () => {
  it('shows Arabic-Indic digits only for Arabic', () => {
    assert.equal(localizeDigits('-12', 'ar'), '-١٢');
    assert.equal(localizeDigits('-12', 'en'), '-12');
  });

  it('offers blank, grid and axes in that order', () => {
    assert.deepEqual([...BOARD_BACKGROUNDS], ['blank', 'grid', 'axes']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | tail -15`
Expected: FAIL — `gridLines` (and the others) are not exported.

- [ ] **Step 3: Write the implementation**

Append to `whiteboardModel.ts`:

```ts
export type BoardBackground = 'blank' | 'grid' | 'axes';
export const BOARD_BACKGROUNDS: readonly BoardBackground[] = ['blank', 'grid', 'axes'];
/** Grid square size in view pixels; one axis unit is one square. */
export const BOARD_STEP = 40;

export type Segment = { x1: number; y1: number; x2: number; y2: number };

export function gridLines(width: number, height: number, step: number): Segment[] {
  if (!(width > 0) || !(height > 0) || !(step > 0)) return [];
  const lines: Segment[] = [];
  for (let x = step; x < width; x += step) lines.push({ x1: x, y1: 0, x2: x, y2: height });
  for (let y = step; y < height; y += step) lines.push({ x1: 0, y1: y, x2: width, y2: y });
  return lines;
}

export type AxisTick = { x: number; y: number; value: string; axis: 'x' | 'y' };

/**
 * Axes through the centre, with the origin snapped to a grid line so every tick
 * lands on one. Tick values are Latin strings ("-1", "2"); the component shows
 * them through `localizeDigits`. The origin and the edges get no tick.
 */
export function axesGeometry(
  width: number,
  height: number,
  step: number,
): { xAxis: Segment; yAxis: Segment; ticks: AxisTick[] } {
  const cx = step > 0 ? Math.round(width / 2 / step) * step : width / 2;
  const cy = step > 0 ? Math.round(height / 2 / step) * step : height / 2;
  const xAxis: Segment = { x1: 0, y1: cy, x2: width, y2: cy };
  const yAxis: Segment = { x1: cx, y1: 0, x2: cx, y2: height };
  const ticks: AxisTick[] = [];
  if (!(width > 0) || !(height > 0) || !(step > 0)) return { xAxis, yAxis, ticks };
  for (let k = 1; cx + k * step < width; k++) ticks.push({ axis: 'x', x: cx + k * step, y: cy, value: String(k) });
  for (let k = 1; cx - k * step > 0; k++) ticks.push({ axis: 'x', x: cx - k * step, y: cy, value: String(-k) });
  for (let k = 1; cy - k * step > 0; k++) ticks.push({ axis: 'y', x: cx, y: cy - k * step, value: String(k) });
  for (let k = 1; cy + k * step < height; k++) ticks.push({ axis: 'y', x: cx, y: cy + k * step, value: String(-k) });
  return { xAxis, yAxis, ticks };
}

/** Display-time digit conversion: Arabic-Indic for `ar`, untouched otherwise. */
export function localizeDigits(text: string, lang: string): string {
  return lang === 'ar' ? text.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!) : text;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whiteboardModel.test.ts 2>&1 | tail -15`
Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/services/whiteboardModel.ts artifacts/mobile/services/__tests__/whiteboardModel.test.ts && git commit -F - <<'EOF'
Whiteboard model: grid, axes geometry and display digits

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 3: `PenCanvas` — draft stroke, width, eraser (and check both existing consumers)

**Files:**
- Modify (replace whole file): `artifacts/mobile/components/classroom/PenLayer.tsx`

**Interfaces:**
- Consumes: `Stroke`, `DEFAULT_STROKE_WIDTH`, `ERASER_RADIUS`, `eraseAt` from `@/services/whiteboardModel`.
- Produces: `PenCanvas` props `{ strokes, color, active, onChange, width?: number, erase?: boolean }`; `Stroke` still exported from this file; `PEN_COLORS`, `PenPalette` unchanged.
- Existing consumers that must keep working: `app/ai-tools/classroom/presentation.tsx` and `app/ai-tools/classroom/book-page.tsx` (both pass only `strokes, color, active, onChange`).

- [ ] **Step 1: Replace `PenLayer.tsx`**

Write the whole file (the `PenPalette` component and `styles` are copied unchanged from the current file):

```tsx
import React, { memo, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT, TIMER_RED } from '@/services/deckTheme';
import { DEFAULT_STROKE_WIDTH, ERASER_RADIUS, eraseAt, type Stroke } from '@/services/whiteboardModel';

// Ink over a projected slide — the teacher circles a term, underlines a step,
// sketches a quick arrow. The slide pen stays deliberately simple: three
// colours, undo, clear, nothing saved. The full board (eraser, widths, grid)
// is `app/ai-tools/whiteboard.tsx`, which drives this same canvas.

export type { Stroke };

export const PEN_COLORS = [TIMER_RED, DECK_ACCENT, DECK_TEXT];

/** Committed strokes. Memoised so a touch-move that only changes the draft never re-renders them. */
const StrokeLines = memo(function StrokeLines({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((s, i) => (
        <Polyline
          key={i}
          points={s.points}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? DEFAULT_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});

/**
 * Transparent drawing surface. Sits inside the slide's ScrollView content so
 * ink scrolls with what it marks. When `active` is false it neither draws nor
 * takes touches, so reveal buttons under the ink still work.
 *
 * The stroke being drawn (or the list left after erasing) lives in this
 * component while the finger is down and is handed to `onChange` once, on
 * release — so a long board does not rebuild every polyline on every touch event.
 */
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
  // PanResponder is built once; read the latest props through a ref.
  const latest = useRef({ strokes, color, width, erase, onChange });
  latest.current = { strokes, color, width, erase, onChange };

  const [draft, setDraft] = useState<Stroke | null>(null);
  const [erased, setErased] = useState<Stroke[] | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasedRef = useRef<Stroke[] | null>(null);
  /** The committed strokes at the moment the finger went down. */
  const base = useRef<Stroke[]>([]);

  const responder = useMemo(() => {
    const finish = () => {
      const d = draftRef.current;
      const e = erasedRef.current;
      draftRef.current = null;
      erasedRef.current = null;
      setDraft(null);
      setErased(null);
      const { onChange: set } = latest.current;
      if (d) set([...base.current, d]);
      else if (e && e !== base.current) set(e); // identity: erasing nothing is not a change
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: ev => {
        const { locationX: x, locationY: y } = ev.nativeEvent;
        const cur = latest.current;
        base.current = cur.strokes;
        if (cur.erase) {
          const next = eraseAt(cur.strokes, x, y, ERASER_RADIUS);
          erasedRef.current = next;
          setErased(next);
        } else {
          // A single point would draw nothing; start with a zero-length
          // segment so a tap leaves a dot.
          const s: Stroke = { color: cur.color, width: cur.width, points: `${x},${y} ${x},${y}` };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderMove: ev => {
        const { locationX: x, locationY: y } = ev.nativeEvent;
        if (erasedRef.current) {
          const next = eraseAt(erasedRef.current, x, y, ERASER_RADIUS);
          if (next !== erasedRef.current) {
            erasedRef.current = next;
            setErased(next);
          }
        } else if (draftRef.current) {
          const s: Stroke = { ...draftRef.current, points: `${draftRef.current.points} ${x},${y}` };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

  return (
    <View
      {...(active ? responder.panHandlers : {})}
      // box-only: the Svg children never become the event target, so
      // locationX/Y are always relative to this view (on web a child target
      // would make them relative to the polyline instead).
      pointerEvents={active ? 'box-only' : 'none'}
      style={[StyleSheet.absoluteFill, active && Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'crosshair' } as any)]}
    >
      <Svg width="100%" height="100%">
        <StrokeLines strokes={erased ?? strokes} />
        {draft && <StrokeLines strokes={[draft]} />}
      </Svg>
    </View>
  );
}

/** Colour swatches + undo + clear, floated over the stage while the pen is on. */
export function PenPalette({ color, onColor, onUndo, onClear, canUndo, labels }: {
  color: string;
  onColor: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  labels: { undo: string; clear: string; colors: string[] };
}) {
  return (
    <View style={styles.palette}>
      {PEN_COLORS.map((c, i) => (
        <Pressable
          key={c}
          onPress={() => onColor(c)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={labels.colors[i]}
          accessibilityState={{ selected: c === color }}
          style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
        />
      ))}
      <View style={styles.divider} />
      <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.undo} style={{ opacity: canUndo ? 1 : 0.35 }}>
        <Ionicons name="arrow-undo-outline" size={20} color={DECK_MUTED} />
      </Pressable>
      <Pressable onPress={onClear} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: canUndo ? 1 : 0.35 }}>
        <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  palette: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  swatchOn: { borderWidth: 3, borderColor: DECK_BORDER, transform: [{ scale: 1.2 }] },
  divider: { width: 1, height: 20, backgroundColor: DECK_BORDER },
});
```

Before saving, diff against the original to confirm `PenPalette` and `styles` are byte-identical:
Run: `cd /home/user/Iqraa && git diff --stat artifacts/mobile/components/classroom/PenLayer.tsx && git diff artifacts/mobile/components/classroom/PenLayer.tsx | grep -E '^[-+]' | grep -E 'palette|swatch|divider|PenPalette' | head`
Expected: the only palette-related diff lines are none (unchanged).

- [ ] **Step 2: Typecheck and run the whole suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -10; pnpm test 2>&1 | tail -8`
Expected: typecheck clean (same as the Task 0 baseline); tests no worse than baseline, `whiteboardModel` tests passing.

- [ ] **Step 3: Check the two existing consumers in a browser (before building the board on top)**

This is the spec's first risk. Follow `LOCAL_SETUP.md` ("Run the backend", "Run the frontend") to get the web app on `http://localhost:8081` with the API on `:8080`, sign in as a teacher, then:

1. Open any lesson's slide deck in class mode (`/ai-tools/classroom/presentation`). Turn the pen on, draw a line and tap once for a dot. Expected: ink follows the pointer live, a tap leaves a dot, colour swatches switch colour, undo removes the last stroke, clear removes all, stepping to another slide and back shows that slide's ink.
2. Open a book page (`/ai-tools/classroom/book-page?lessonId=<a lesson with pages>`). Same checks.
3. With the pen on, confirm the slide does not scroll while drawing and scrolls again with the pen off.

If the app cannot be run or signed into in this environment, **say so** and mark steps 1–3 "not checked"; do not describe them as passing. Leave the dev servers running if they were started; Task 6 reuses them.

- [ ] **Step 4: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/components/classroom/PenLayer.tsx && git commit -F - <<'EOF'
PenCanvas: commit strokes on pen-up, add width and eraser props

The stroke in progress now lives in the canvas, so a long board does not
re-render every polyline on each touch event. Slides and the book page pass
neither new prop and draw as before.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 4: Strings, `BoardBackground` and `BoardToolbar`

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (two inserts)
- Create: `artifacts/mobile/components/classroom/BoardBackground.tsx`
- Create: `artifacts/mobile/components/classroom/BoardToolbar.tsx`

**Interfaces:**
- Consumes: `BOARD_BACKGROUNDS`, `BOARD_STEP`, `STROKE_WIDTHS`, `axesGeometry`, `gridLines`, `localizeDigits`, `type BoardBackground` (Tasks 1–2); `PEN_COLORS` (Task 3).
- Produces:
  - `BoardBackground({ kind: BoardBackground; width: number; height: number; lang: string })`
  - `BoardToolbar` with props listed in Step 3, and `type BoardToolbarLabels`
  - i18n keys: `whiteboardTool`, `boardEraser`, `boardWidthThin`, `boardWidthMedium`, `boardWidthThick`, `boardBgBlank`, `boardBgGrid`, `boardBgAxes`, `boardClearTitle`, `boardClearMessage`, `boardClearConfirm`, `boardLeaveTitle`, `boardLeaveMessage`, `boardLeaveConfirm`

- [ ] **Step 1: Add the Arabic strings**

In `artifacts/mobile/services/i18n.ts`, replace the unique line `    penBlack: 'أسود',` with:

```ts
    penBlack: 'أسود',
    whiteboardTool: 'السبورة',
    boardEraser: 'الممحاة',
    boardWidthThin: 'خط رفيع',
    boardWidthMedium: 'خط متوسط',
    boardWidthThick: 'خط عريض',
    boardBgBlank: 'فارغة',
    boardBgGrid: 'مربعات',
    boardBgAxes: 'محاور',
    boardClearTitle: 'مسح السبورة؟',
    boardClearMessage: 'سيُمسح كل ما على السبورة، ويمكنك التراجع بعد ذلك.',
    boardClearConfirm: 'امسح',
    boardLeaveTitle: 'مغادرة السبورة؟',
    boardLeaveMessage: 'ما كتبته على السبورة لن يُحفظ.',
    boardLeaveConfirm: 'غادر',
```

- [ ] **Step 2: Add the English strings**

Replace the unique line `    penBlack: 'Black',` with:

```ts
    penBlack: 'Black',
    whiteboardTool: 'Whiteboard',
    boardEraser: 'Eraser',
    boardWidthThin: 'Thin line',
    boardWidthMedium: 'Medium line',
    boardWidthThick: 'Thick line',
    boardBgBlank: 'Blank',
    boardBgGrid: 'Grid',
    boardBgAxes: 'Axes',
    boardClearTitle: 'Clear the board?',
    boardClearMessage: 'Everything on the board will be removed. You can undo it afterwards.',
    boardClearConfirm: 'Clear',
    boardLeaveTitle: 'Leave the board?',
    boardLeaveMessage: 'What you wrote on the board will not be saved.',
    boardLeaveConfirm: 'Leave',
```

If either `old_string` is not unique (the Edit tool will refuse), include the following line (`bookPageButton: …`) in the anchor.

- [ ] **Step 3: Create `BoardBackground.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { DECK_BORDER, DECK_MUTED } from '@/services/deckTheme';
import {
  BOARD_STEP,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground as BoardBackgroundKind,
} from '@/services/whiteboardModel';

/**
 * The paper behind the ink. Purely visual: it never takes a touch, so the
 * canvas above it gets every event. `axes` is a grid with the x and y axes and
 * one numbered tick per square (digits localised at display time only).
 */
export function BoardBackground({ kind, width, height, lang }: {
  kind: BoardBackgroundKind;
  width: number;
  height: number;
  lang: string;
}) {
  if (kind === 'blank' || !(width > 0) || !(height > 0)) return null;
  const grid = gridLines(width, height, BOARD_STEP);
  const axes = kind === 'axes' ? axesGeometry(width, height, BOARD_STEP) : null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        {grid.map((s, i) => (
          <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={DECK_BORDER} strokeWidth={1} />
        ))}
        {axes && (
          <>
            <Line {...axes.xAxis} stroke={DECK_MUTED} strokeWidth={2} />
            <Line {...axes.yAxis} stroke={DECK_MUTED} strokeWidth={2} />
            {axes.ticks.map((tick, i) => (
              <SvgText
                key={i}
                x={tick.axis === 'x' ? tick.x : tick.x - 6}
                y={tick.axis === 'x' ? tick.y + 16 : tick.y + 4}
                fontSize={12}
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

- [ ] **Step 4: Create `BoardToolbar.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED } from '@/services/deckTheme';
import { PEN_COLORS } from '@/components/classroom/PenLayer';
import { BOARD_BACKGROUNDS, STROKE_WIDTHS, type BoardBackground } from '@/services/whiteboardModel';

export type BoardToolbarLabels = {
  close: string;
  pen: string;
  eraser: string;
  undo: string;
  clear: string;
  /** One per `PEN_COLORS` entry. */
  colors: string[];
  /** One per `STROKE_WIDTHS` entry. */
  widths: string[];
  backgrounds: Record<BoardBackground, string>;
};

/**
 * Floating controls for the board: a top bar (close + paper) and a bottom pill
 * (colour, width, pen/eraser, undo, clear). The top container is `box-none` so
 * the empty gap between its two groups still lets the pen draw underneath.
 */
export function BoardToolbar({
  isRTL, topInset, bottomInset,
  color, onColor, width, onWidth, erase, onErase,
  canUndo, onUndo, hasInk, onClear,
  background, onBackground, onClose, labels,
}: {
  isRTL: boolean;
  topInset: number;
  bottomInset: number;
  color: string;
  onColor: (c: string) => void;
  width: number;
  onWidth: (w: number) => void;
  erase: boolean;
  onErase: (on: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  hasInk: boolean;
  onClear: () => void;
  background: BoardBackground;
  onBackground: (b: BoardBackground) => void;
  onClose: () => void;
  labels: BoardToolbarLabels;
}) {
  const rowDir = isRTL ? 'row-reverse' : 'row';
  return (
    <>
      <View pointerEvents="box-none" style={[styles.top, { top: topInset + 8, flexDirection: rowDir }]}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={labels.close}>
          <Ionicons name="close" size={22} color={DECK_MUTED} />
        </Pressable>
        <View style={[styles.chips, { flexDirection: rowDir }]}>
          {BOARD_BACKGROUNDS.map(b => (
            <Pressable
              key={b}
              onPress={() => onBackground(b)}
              accessibilityRole="button"
              accessibilityState={{ selected: b === background }}
              style={[styles.chip, b === background && styles.chipOn]}
            >
              <Text style={[styles.chipText, b === background && { color: DECK_ACCENT }, { fontFamily: 'Almarai_400Regular' }]}>
                {labels.backgrounds[b]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.palette, { bottom: bottomInset + 12 }]}>
        {PEN_COLORS.map((c, i) => (
          <Pressable
            key={c}
            onPress={() => { onColor(c); onErase(false); }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.colors[i]}
            accessibilityState={{ selected: !erase && c === color }}
            style={[styles.swatch, { backgroundColor: c }, !erase && c === color && styles.swatchOn]}
          />
        ))}
        <View style={styles.divider} />
        {STROKE_WIDTHS.map((w, i) => (
          <Pressable
            key={w}
            onPress={() => onWidth(w)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.widths[i]}
            accessibilityState={{ selected: w === width }}
            style={styles.widthSlot}
          >
            <View style={{ width: w + 6, height: w + 6, borderRadius: (w + 6) / 2, backgroundColor: w === width ? DECK_ACCENT : DECK_MUTED }} />
          </Pressable>
        ))}
        <View style={styles.divider} />
        <Pressable onPress={() => onErase(false)} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.pen} accessibilityState={{ selected: !erase }}>
          <Ionicons name={erase ? 'brush-outline' : 'brush'} size={20} color={erase ? DECK_MUTED : DECK_ACCENT} />
        </Pressable>
        <Pressable onPress={() => onErase(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.eraser} accessibilityState={{ selected: erase }}>
          <MaterialCommunityIcons name="eraser" size={22} color={erase ? DECK_ACCENT : DECK_MUTED} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.undo} style={{ opacity: canUndo ? 1 : 0.35 }}>
          <Ionicons name="arrow-undo-outline" size={20} color={DECK_MUTED} />
        </Pressable>
        <Pressable onPress={onClear} disabled={!hasInk} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: hasInk ? 1 : 0.35 }}>
          <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12, justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  chips: {
    gap: 6, padding: 4, borderRadius: 20,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: DECK_ACCENT + '50', backgroundColor: DECK_ACCENT + '12' },
  chipText: { fontSize: 13, color: DECK_MUTED },
  palette: {
    position: 'absolute', alignSelf: 'center', maxWidth: '96%',
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  swatchOn: { borderWidth: 3, borderColor: DECK_BORDER, transform: [{ scale: 1.2 }] },
  widthSlot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 20, backgroundColor: DECK_BORDER },
});
```

- [ ] **Step 5: Typecheck and run the suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -10; pnpm test 2>&1 | tail -8`
Expected: typecheck clean; no new test failures (the i18n tests must still pass with the new keys — if `i18n.test.ts` or `i18nTerminology.test.ts` rejects a string, fix the string, not the test).

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/services/i18n.ts artifacts/mobile/components/classroom/BoardBackground.tsx artifacts/mobile/components/classroom/BoardToolbar.tsx && git commit -F - <<'EOF'
Whiteboard: board strings, paper background and toolbar components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 5: The screen, the presentation button, and the teacher-only pin

**Files:**
- Create: `artifacts/mobile/app/ai-tools/whiteboard.tsx`
- Modify: `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` (action row, after the pen button)
- Modify: `artifacts/mobile/services/__tests__/routeGating.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–4; `confirm` (`@/services/confirm`), `goBack` (`@/services/navigation`), `useLanguage` (`@/context/LanguageContext`).
- Produces: route `/ai-tools/whiteboard` (no params).

- [ ] **Step 1: Create the screen**

`artifacts/mobile/app/ai-tools/whiteboard.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import {
  BOARD_DEFAULT_WIDTH,
  EMPTY_BOARD,
  canUndo,
  clearBoard,
  commitStrokes,
  hasInk,
  undoBoard,
  type BoardBackground as BoardBackgroundKind,
  type BoardState,
} from '@/services/whiteboardModel';

/**
 * The blank board (سبورة). Opened from the presentation; Back returns to the
 * same slide because the presentation stays mounted underneath.
 *
 * Nothing is saved yet, so clearing and leaving with ink both ask first. That
 * is the only protection against losing a board by accident: Android's
 * hardware back and the close button are intercepted, but the browser's own
 * back button and closing the tab are not.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [background, setBackground] = useState<BoardBackgroundKind>('blank');
  const [size, setSize] = useState({ w: 0, h: 0 });

  // The hardware-back listener is registered once; it reads the board through a ref.
  const boardRef = useRef(board);
  boardRef.current = board;

  const leave = useCallback(async () => {
    if (!hasInk(boardRef.current)) {
      goBack();
      return;
    }
    const ok = await confirm({
      title: t('boardLeaveTitle'),
      message: t('boardLeaveMessage'),
      confirmLabel: t('boardLeaveConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (ok) goBack();
  }, [t]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const onClear = useCallback(async () => {
    if (!hasInk(boardRef.current)) return;
    const ok = await confirm({
      title: t('boardClearTitle'),
      message: t('boardClearMessage'),
      confirmLabel: t('boardClearConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (ok) setBoard(b => clearBoard(b));
  }, [t]);

  return (
    <View style={styles.container}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <BoardBackground kind={background} width={size.w} height={size.h} lang={lang} />
        <PenCanvas
          strokes={board.strokes}
          color={color}
          width={width}
          erase={erase}
          active
          onChange={next => setBoard(b => commitStrokes(b, next))}
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
        canUndo={canUndo(board)}
        onUndo={() => setBoard(b => undoBoard(b))}
        hasInk={hasInk(board)}
        onClear={onClear}
        background={background}
        onBackground={setBackground}
        onClose={leave}
        labels={{
          close: t('close'),
          pen: t('penTool'),
          eraser: t('boardEraser'),
          undo: t('penUndo'),
          clear: t('penClear'),
          colors: [t('penRed'), t('penTeal'), t('penBlack')],
          widths: [t('boardWidthThin'), t('boardWidthMedium'), t('boardWidthThick')],
          backgrounds: { blank: t('boardBgBlank'), grid: t('boardBgGrid'), axes: t('boardBgAxes') },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
```

- [ ] **Step 2: Add the presentation button**

In `artifacts/mobile/app/ai-tools/classroom/presentation.tsx`, replace this exact block (the end of the pen button and the start of the timer button, around line 1398):

```tsx
          </Pressable>
          {hasTimer && (
            <Pressable
              onPress={restartTimer}
```

with:

```tsx
          </Pressable>
          <Pressable
            onPress={() => router.push('/ai-tools/whiteboard' as never)}
            style={styles.actionBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('whiteboardTool')}
          >
            <Ionicons name="easel-outline" size={18} color={TEXT_MUTED} />
            {compactBar ? null : (
              <Text numberOfLines={1} style={[styles.actionLabel, { fontFamily: 'Almarai_400Regular' }]}>
                {t('whiteboardTool')}
              </Text>
            )}
          </Pressable>
          {hasTimer && (
            <Pressable
              onPress={restartTimer}
```

`router` is already imported in this file (`import { router, useFocusEffect } from 'expo-router'`). If `easel-outline` is not a valid `Ionicons` glyph name the typecheck in Step 4 fails; use `'create-outline'` instead.

- [ ] **Step 3: Pin that the board is teacher-only**

Append to `artifacts/mobile/services/__tests__/routeGating.test.ts` (the three functions are already imported at the top of that file):

```ts
describe('the whiteboard route', () => {
  // The board is reached from the presentation, so it must follow the same
  // teacher-only default as every other /ai-tools screen. This pins existing
  // behaviour (it passes without any gating change); it fails if someone adds
  // the route to a non-teacher or public allowlist.
  it('is neither a public nor a non-teacher route', () => {
    assert.equal(isPublicRoute('/ai-tools/whiteboard'), false);
    assert.equal(isNonTeacherRoute('/ai-tools/whiteboard'), false);
  });
});
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -10; pnpm test 2>&1 | tail -8`
Expected: typecheck clean; the routeGating test passes.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa && git add artifacts/mobile/app/ai-tools/whiteboard.tsx artifacts/mobile/app/ai-tools/classroom/presentation.tsx artifacts/mobile/services/__tests__/routeGating.test.ts && git commit -F - <<'EOF'
Whiteboard: blank board screen opened from the presentation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
```

---

### Task 6: Verify in the browser, update STATUS.md, push

**Files:**
- Modify: `STATUS.md` (the Smart Whiteboard bullet near line 105, plus one new bullet)

- [ ] **Step 1: Drive the board in a browser** (servers from Task 3 Step 3, restarted if needed)

From a presentation, tap «السبورة». Expected, and record what you actually saw for each:

1. The board opens full-screen, blank, with the toolbar. Drawing follows the pointer live; a tap leaves a dot.
2. Each of the three widths draws visibly thicker; each colour draws in that colour; picking a colour while the eraser is on switches back to the pen.
3. Eraser: dragging across a stroke removes it, dragging across empty paper changes nothing, and Undo brings the erased stroke back.
4. Background chips: «مربعات» shows a squared grid, «محاور» shows axes with numbers (Arabic-Indic digits in Arabic, Latin in English), «فارغة» clears the paper. Drawn ink stays when the paper changes.
5. Clear (trash) asks first; Cancel keeps the ink; Clear removes it; Undo restores it.
6. Close with ink on the board asks first; Cancel stays; Leave returns to the presentation **on the same slide**, with that slide's pen ink untouched. Close on an empty board leaves with no prompt.
7. Re-check the Task 3 consumers once more now that the board exists: slide pen and book-page pen still draw, undo and clear.
8. Switch the app to English and confirm the toolbar reads left-to-right with English labels.

Anything you could not run (no sign-in, no backend, no phone) is reported as **not checked**. Touch input on a real phone and Android hardware back are expected to remain unchecked.

- [ ] **Step 2: Update `STATUS.md`**

Replace the existing bullet (currently near line 105):

```
  - **The Smart Whiteboard that shipped beside it is gone** — removed on
    2026-09-25 (#624): a text box shown full-screen, no AI, no drawing,
    nothing saved, and the classroom board already did the job. It is not in
    `toolCatalog.ts`, `toolCatalog.test.ts` or `app/ai-tools/` any more. This
    entry went on describing it as a live during-class tool for a week after
    the delete — checked against the tree on 2026-10-02.
```

with the following, filling in the date from `date +%F` and the "Verified" / "Not verified" sentences from what Step 1 actually showed:

```
  - **The first Smart Whiteboard is gone; a new board replaced it** — the old
    one was removed on 2026-09-25 (#624): a text box shown full-screen, no AI,
    no drawing, nothing saved. The new «السبورة» (sub-project A of three) is
    `app/ai-tools/whiteboard.tsx`: a blank board with grid/axes paper, an
    eraser, three widths, and undo that covers erase and clear. It is opened
    only from the presentation's action row (no Tools-tab card — the pilot
    tools list is pinned by `toolCatalog.test.ts`). Nothing is saved, so
    clearing and leaving with ink ask first; the browser's back button and
    closing the tab are not intercepted. Logic is in
    `services/whiteboardModel.ts` (tested). `PenCanvas` now commits a stroke on
    pen-up, which also affects the slide pen and `book-page.tsx`.
    Verified <DATE>: <what Step 1 observed, item by item>. Not verified:
    <everything Step 1 could not run, including touch on a real phone>.
    Still to build: B (saving, pages, export) and C (AI solve, which can mark
    only the 7 `VERIFIABLE_TOPICS` as verified). Spec and plan:
    `docs/superpowers/specs/2026-10-08-whiteboard-board-design.md`,
    `docs/superpowers/plans/2026-10-08-whiteboard-board.md`.
```

Do not leave `<DATE>` or the angle-bracket sentences in the file.

- [ ] **Step 3: Final checks**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -10; cd artifacts/mobile && pnpm test 2>&1 | tail -8; cd ../api-server && pnpm build 2>&1 | tail -3 && pnpm test 2>&1 | tail -5`
Expected: typecheck clean; mobile and api-server suites no worse than the Task 0 baseline. (api-server is untouched; this only confirms nothing broke monorepo-wide.)

Run: `cd /home/user/Iqraa && grep -n -E '<DATE>|TODO|TBD' artifacts/mobile/app/ai-tools/whiteboard.tsx artifacts/mobile/components/classroom/Board*.tsx artifacts/mobile/services/whiteboardModel.ts; grep -n '<DATE>' STATUS.md`
Expected: no output from either command.

- [ ] **Step 4: Commit and push**

```bash
cd /home/user/Iqraa && git add STATUS.md && git commit -F - <<'EOF'
STATUS: the whiteboard is back as a blank board (sub-project A)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d
EOF
git push -u origin ccr-cdf5bcd6-nzb5tw
```

If the push fails on a network error, retry up to four times with 2s, 4s, 8s, 16s waits.

- [ ] **Step 5: Update PR #928**

Retitle it to «Whiteboard (سبورة) A — blank board» and replace the body with: what changed (the files in the File Structure table), what was verified and what was not (copied from STATUS.md), `schema-push: n/a (no schema change)`, and, as the last lines of the body, `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, a blank line, then `https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`. Keep it as a draft.
