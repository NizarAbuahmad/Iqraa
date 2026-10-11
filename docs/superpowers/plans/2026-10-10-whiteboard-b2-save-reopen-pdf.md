# Whiteboard B2 — Save, Reopen and PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can save a whiteboard (all its pages) to «موادي», reopen and edit it later from the workspace, and export it as a PDF with one landscape page per board page.

**Architecture:** A board is stored as a `SavedMaterial` of the new type `'board'`; its `content` is the JSON string of a versioned `BoardFile` (`{version, canvas, pages:[{background, strokes}]}`), so there is **no schema change**. Everything that decides what is safe lives in two pure, tested modules: `services/boardFile.ts` (serialise, parse/validate untrusted content, dirty check, size cap) and `services/boardExportHtml.ts` (the PDF markup, which re-validates its input and escapes what it prints). The screen gains a Save button and a title dialog, loads a saved board from a `savedId` route param, and `workspace/view.tsx` redirects boards to the board screen instead of letting them fall through to the quiz renderer.

**Tech Stack:** Expo 54 / React Native 0.81 (also the web build), `expo-router` 6, `react-native-svg` 15, `html2canvas` + `jspdf` (web PDF, already used by `exportAsPDF`), `node --test` with `--experimental-strip-types`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-whiteboard-b-pages-save-export-design.md` (sections *B2 · 3* and *B2 · 4*, *Testing and verification*, *Known limitation*). B1 (the fitted stage and pages) is already merged; this plan covers **B2 only**. C (AI solve) is separate.

## Global Constraints

- **No new native module / dependency; do not touch `app.json`.** `app.json`'s `version` is the OTA runtime key (CLAUDE.md).
- **No schema change, so no `lib/db` edit and no migration.** `saved_materials.type` is plain text and `content` is jsonb; the API stores any `type` (12 MB body limit, `artifacts/api-server/src/app.ts`). The PR body says `schema-push: n/a`.
- **Pure modules import no `react-native` or `expo-*`; tested files use explicit `.ts` extensions in imports** (`from './whiteboardModel.ts'`). The mobile runner is bare `node --test`.
- **Tests live in `artifacts/mobile/services/__tests__/`** — the only place the mobile runner looks.
- **Saved content is untrusted** (it comes from the server or local storage). Nothing from it is used, drawn or interpolated into HTML until `parseBoard` has accepted it. A malformed board is refused whole, never partly rendered.
- **State is declared with `aria-selected` (and other `aria-*` props), never `accessibilityState`** — `services/__tests__/ariaState.test.ts` fails the suite otherwise.
- **Rows flip themselves for RTL** (`isRTL ? 'row-reverse' : 'row'`); the app pins layout to LTR on every platform.
- **Compute in Latin, convert to Arabic digits only at display time** (`localizeDigits`).
- **Arabic is the product language; the UI is RTL-first.** Every new string goes in both the `ar` and `en` blocks of `services/i18n.ts` (`services/__tests__/i18n.test.ts` checks parity).
- **Do not add a `KeyboardAvoidingView` inside a screen.** A `<Modal>` that holds a text input wraps its own body in `KeyboardSafeView` (CLAUDE.md, «On Android nothing lifts content above the keyboard…»).
- **Destructive actions use `confirm()` from `services/confirm.ts`.** `DEMO_MODE` stays as it is.
- **Do not claim a phone or browser behaviour you did not observe.** Report unchecked items as unchecked.
- **Commit messages end with a blank line and these two lines, copied verbatim (do not substitute any other model name):**
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`
- Work on branch `ccr-cdf5bcd6-nzb5tw`. Before Task 1, check whether the pull request that branch last carried is merged (`mcp__github__list_pull_requests`, head `ccr-cdf5bcd6-nzb5tw`). If it **is merged**, restart the branch from the latest `main` (`git fetch origin main && git checkout -B ccr-cdf5bcd6-nzb5tw origin/main`) and the **first** push needs `--force-with-lease` after `git fetch --prune` (GitHub deletes the remote branch after a squash merge, in which case a plain push works). If it is **still open**, stop and ask: B2 must be its own pull request. Never push to another branch.
- Typecheck from the repo root: `cd /home/user/Iqraa && pnpm run typecheck`. If `artifacts/mobile` typecheck reports route-name errors, the git-ignored generated file `artifacts/mobile/.expo/types/router.d.ts` is stale: delete it and re-run (CI has no such file).

## Decisions recorded in this plan

- **The reopen route parameter is `savedId`, not `materialId`** (the spec's word). Every other tool reopens a saved material with `savedId`, and «موادي»' **Edit** menu item already navigates to `MATERIAL_EDIT_ROUTE[type]` with `{ savedId, ...formState }` — so registering `'/ai-tools/whiteboard'` as the board's edit route gives Edit for free.
- **The title dialog opens on the first save only.** Later saves update the same material under the same title and toast «تم تحديث السبورة». (The spec says "a Save control opens a small title dialog"; asking again on every save would be friction with no use, because nothing else in the dialog changes.)
- **Save and PDF live in the bottom palette as a sixth group**, not in the top bar. The palette already wraps *between* groups; the top bar (close + three paper chips) has no room at 320 px.
- **`parseBoard` is stricter than the spec's regex:** points must be space-separated `x,y` tokens of plain decimals (each token is matched), not just "characters from `[-0-9.,\s]`". Strictness here costs nothing (the app only ever writes that shape) and shuts out `1e999`, `--`, empty tokens and similar.
- **`buildBoardHTML` takes `unknown` and validates it itself** (`parseBoard`), returning `null` for anything invalid. One validation point: a caller cannot forget, and an in-memory board goes through the same gate as a stored one.
- **Over the size cap, every refusal shows one message** (`boardTooBig`). The page cap (20) is already enforced by the Add button, so "too many pages" is unreachable from the UI; the model still reports it distinctly for tests.
- **Boards carry the same title-derived `lessonId` stamp as every other material** (`withLessonId` in `services/workspace.ts` runs inside `saveItem`). This is the title-to-lesson weakness CLAUDE.md warns about, accepted by the spec's *Known limitation*; B2 adds no new identity claim and does not set a `lessonId` itself. The presentation passes the deck's `lesson`, `subject` and `grade` so a board saved from a deck is filed like its siblings.
- **`MaterialType` widening audit (done while writing this plan, 2026-10-10).** Adding `'board'` to the union makes the compiler fail in exactly one place: the four `Record<MaterialType, …>` tables in `constants/materialKind.ts`. The other files that mention `MaterialType` (`GeneratorResultActions`, `FeedbackWidget` — comments only; `chatMaterialActions`, `cqv/batch`, `cqv/reports` — they *produce* `MaterialType` values for generated artefacts and never read an arbitrary saved item; `lessonBoard.rowTypeOf` — `default: return null`, so a board never ticks a prep row; `savedMaterialMatch` — matches by exact type) are unaffected and stay untouched. `continueTeaching.buildContinueCardFromItem` has no caller in the app (tests only); a board would read as «خطة درس» there, and it is left alone. Every consumer that opens a saved item goes through `/workspace/view` (the list, the class shelf, the home recents), so the **one redirect in `view.tsx`** covers all of them.
- **Undo history is not saved** (spec). A reopened board starts every page with an empty undo history.
- **The board's PDF is built from the in-memory document**, so a board can be exported before it is ever saved.

## File Structure

| File | Responsibility |
| --- | --- |
| Create `artifacts/mobile/services/boardFile.ts` | Pure. `BoardFile` type, `boardFileOf`, `serializeBoard` (size/page cap), `parseBoard` (validation of untrusted content), `docOfFile`, `isBoardDirty` |
| Create `artifacts/mobile/services/__tests__/boardFile.test.ts` | Tests for all of the above |
| Create `artifacts/mobile/services/boardExportHtml.ts` | Pure. `buildBoardHTML(content, title, isAr): string \| null` — one landscape `.slide` per page |
| Create `artifacts/mobile/services/__tests__/boardExportHtml.test.ts` | Tests |
| Modify `artifacts/mobile/services/workspace.ts` | `MaterialType` gains `'board'` |
| Modify `artifacts/mobile/constants/materialKind.ts` | Colour, dark colour, icon, label key and edit route for `'board'` |
| Modify `artifacts/mobile/app/workspace/index.tsx` | A «سبوراتي» filter tab |
| Modify `artifacts/mobile/app/workspace/view.tsx` | Redirect `type === 'board'` to the board screen |
| Modify `artifacts/mobile/services/i18n.ts` | All new strings, both languages |
| Create `artifacts/mobile/components/classroom/BoardSaveDialog.tsx` | The title dialog (a `<Modal>` with a text input) |
| Modify `artifacts/mobile/components/classroom/BoardToolbar.tsx` | A sixth palette group: Save, then PDF |
| Modify `artifacts/mobile/app/ai-tools/whiteboard.tsx` | Load by `savedId`, Save, dirty-aware leave, PDF export, toast |
| Modify `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` | Pass the deck's lesson / subject / grade to the board |
| Modify `STATUS.md` | B2 entry in the whiteboard bullet |

---

### Task 0: Install and baseline

**Files:** none changed.

- [ ] **Step 1: Install**

Run: `cd /home/user/Iqraa && pnpm install`
Expected: completes without error.

- [ ] **Step 2: Record the baseline**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -6; cd artifacts/mobile && pnpm test > /tmp/b2-baseline.log 2>&1; grep -E "^# (tests|pass|fail|skipped)" /tmp/b2-baseline.log`
Expected: typecheck clean; the suite passes with 0 failures and 10 skipped. **Write down the pass count** — later tasks quote increases against it (`main` moves, so any number in this plan is only indicative). If anything fails, record which tests, so later failures are not blamed on this work.

---

### Task 1: The saved form of a board (pure)

**Files:**
- Create: `artifacts/mobile/services/boardFile.ts`
- Create: `artifacts/mobile/services/__tests__/boardFile.test.ts`

**Interfaces:**
- Consumes (from `services/whiteboardModel.ts`, already merged): `CANVAS_W = 1280`, `CANVAS_H = 720`, `DEFAULT_STROKE_WIDTH = 4`, `MAX_PAGES = 20`, `blankPage(bg?)`, `docHasInk(doc)`, types `BoardBackground` (`'blank' | 'grid' | 'axes'`), `BoardDoc` (`{ pages: Page[]; current: number }`), `Page` (`{ background; board: { strokes: Stroke[]; past: Stroke[][] } }`), `Stroke` (`{ color: string; points: string; width?: number }`).
- Produces (used by Tasks 3 and 4):
  - `BOARD_FILE_VERSION = 1`, `MAX_BOARD_BYTES = 2_000_000`
  - `type BoardFile = { version: 1; canvas: { w: number; h: number }; pages: BoardFilePage[] }`, `type BoardFilePage = { background: BoardBackground; strokes: BoardFileStroke[] }`, `type BoardFileStroke = { color: string; width: number; points: string }`
  - `boardFileOf(doc: BoardDoc): BoardFile`
  - `type SerializeResult = { ok: true; json: string } | { ok: false; reason: 'too-many-pages' | 'too-big' }`; `serializeBoard(doc: BoardDoc): SerializeResult`
  - `type ParseResult = { ok: true; file: BoardFile } | { ok: false; reason: string }`; `parseBoard(content: unknown): ParseResult` (accepts the JSON string or the parsed object)
  - `docOfFile(file: BoardFile): BoardDoc` (current page 0, every page's undo history empty)
  - `isBoardDirty(doc: BoardDoc, savedJson: string | null): boolean`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/boardFile.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_FILE_VERSION,
  MAX_BOARD_BYTES,
  boardFileOf,
  docOfFile,
  isBoardDirty,
  parseBoard,
  serializeBoard,
} from '../boardFile.ts';
import { blankPage, type BoardBackground, type BoardDoc, type Stroke } from '../whiteboardModel.ts';

const stroke = (points: string, extra: Partial<Stroke> = {}): Stroke => ({ color: '#DC2626', points, width: 6, ...extra });

const docOf = (...pages: Array<[BoardBackground, Stroke[]]>): BoardDoc => ({
  current: 0,
  pages: pages.map(([background, strokes]) => ({ background, board: { strokes, past: [] } })),
});

/** `n` plausible points, ~12 characters each. */
const manyPoints = (n: number): string =>
  Array.from({ length: n }, (_, i) => `0.${10000 + (i % 80000)},0.5`).join(' ');

describe('serializeBoard / parseBoard round trip', () => {
  it('keeps pages, paper, strokes, colours and widths, and starts every page with no undo history', () => {
    const d = docOf(['axes', [stroke('0.1,0.2 0.3,0.4'), stroke('0.5,0.5 0.5,0.5', { color: '#0F766E', width: 12 })]], ['blank', []]);
    const r = serializeBoard(d);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const p = parseBoard(r.json);
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const back = docOfFile(p.file);
    assert.equal(back.current, 0);
    assert.deepEqual(back.pages.map(x => x.background), ['axes', 'blank']);
    assert.deepEqual(back.pages[0]!.board.strokes, d.pages[0]!.board.strokes);
    assert.deepEqual(back.pages.map(x => x.board.past), [[], []]);
  });

  it('writes an explicit width for a stroke that has none (a slide-pen stroke means 4)', () => {
    const r = serializeBoard(docOf(['blank', [{ color: '#000', points: '0,0 0,0' }]]));
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const p = parseBoard(r.json);
    assert.equal(p.ok && p.file.pages[0]!.strokes[0]!.width, 4);
  });

  it('writes keys in a fixed order, so equal boards serialise to equal strings', () => {
    const r = serializeBoard(docOf(['grid', [stroke('0.1,0.2 0.3,0.4')]]));
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const v = JSON.parse(r.json);
    assert.equal(Object.keys(v).join(), 'version,canvas,pages');
    assert.deepEqual(v.canvas, { w: 1280, h: 720 });
    assert.equal(v.version, BOARD_FILE_VERSION);
    assert.equal(Object.keys(v.pages[0]).join(), 'background,strokes');
    assert.equal(Object.keys(v.pages[0].strokes[0]).join(), 'color,width,points');
  });

  it('boardFileOf never includes undo history', () => {
    const d: BoardDoc = { current: 0, pages: [{ background: 'blank', board: { strokes: [], past: [[stroke('0,0 1,1')]] } }] };
    assert.equal(JSON.stringify(boardFileOf(d)).includes('past'), false);
  });
});

describe('serializeBoard caps', () => {
  it('refuses more than 20 pages', () => {
    const d: BoardDoc = { current: 0, pages: Array.from({ length: 21 }, () => blankPage()) };
    const r = serializeBoard(d);
    assert.deepEqual(r, { ok: false, reason: 'too-many-pages' });
  });

  it('refuses content over 2 MB, and accepts a board just under it', () => {
    const big = docOf(['blank', Array.from({ length: 3000 }, () => stroke(manyPoints(80)))]);
    assert.deepEqual(serializeBoard(big), { ok: false, reason: 'too-big' });
    const small = docOf(['blank', Array.from({ length: 100 }, () => stroke(manyPoints(80)))]);
    const r = serializeBoard(small);
    assert.equal(r.ok, true);
    assert.ok(r.ok && r.json.length < MAX_BOARD_BYTES);
  });
});

const good = () => ({
  version: 1,
  canvas: { w: 1280, h: 720 },
  pages: [{ background: 'grid', strokes: [{ color: '#0F766E', width: 6, points: '0.1,0.2 0.3,0.4' }] }],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutate = (fn: (b: any) => void): unknown => { const b = good(); fn(b); return b; };

describe('parseBoard accepts', () => {
  it('a good board, as an object and as a JSON string', () => {
    assert.equal(parseBoard(good()).ok, true);
    assert.equal(parseBoard(JSON.stringify(good())).ok, true);
  });

  it('all three papers, an empty page, 3/4/6/8-digit hex colours, edge widths and negative coordinates', () => {
    const b = mutate(x => {
      x.pages = [
        { background: 'blank', strokes: [] },
        { background: 'grid', strokes: [] },
        { background: 'axes', strokes: [
          { color: '#abc', width: 0.5, points: '-0.5,1.25 0,0' },
          { color: '#ABCD', width: 64, points: '0.1,0.2' },
          { color: '#0F766E', width: 3, points: '0.1,0.2 0.3,0.4' },
          { color: '#0F766Eff', width: 12, points: '0.1,0.2 0.3,0.4' },
        ] },
      ];
    });
    assert.equal(parseBoard(b).ok, true);
  });
});

describe('parseBoard refuses', () => {
  const refused: Array<[string, unknown]> = [
    ['a number', 5],
    ['null', null],
    ['an array', []],
    ['text that is not JSON', '{nope'],
    ['a wrong version', mutate(b => { b.version = 2; })],
    ['a missing version', mutate(b => { delete b.version; })],
    ['a wrong canvas width', mutate(b => { b.canvas.w = 100; })],
    ['a wrong canvas height', mutate(b => { b.canvas.h = 100; })],
    ['no canvas', mutate(b => { delete b.canvas; })],
    ['no pages', mutate(b => { b.pages = []; })],
    ['pages that are not a list', mutate(b => { b.pages = {}; })],
    ['21 pages', mutate(b => { b.pages = Array.from({ length: 21 }, () => b.pages[0]); })],
    ['a page that is not an object', mutate(b => { b.pages = [7]; })],
    ['an unknown paper', mutate(b => { b.pages[0].background = 'dots'; })],
    ['a paper that is not text', mutate(b => { b.pages[0].background = 3; })],
    ['strokes that are not a list', mutate(b => { b.pages[0].strokes = 'x'; })],
    ['a stroke that is not an object', mutate(b => { b.pages[0].strokes = [3]; })],
    ['colour "red"', mutate(b => { b.pages[0].strokes[0].color = 'red'; })],
    ['colour "#12"', mutate(b => { b.pages[0].strokes[0].color = '#12'; })],
    ['colour "#12345"', mutate(b => { b.pages[0].strokes[0].color = '#12345'; })],
    ['colour "#GGGGGG"', mutate(b => { b.pages[0].strokes[0].color = '#GGGGGG'; })],
    ['a colour that closes an attribute', mutate(b => { b.pages[0].strokes[0].color = '#fff" onload="x'; })],
    ['colour that is not text', mutate(b => { b.pages[0].strokes[0].color = 12; })],
    ['width 0', mutate(b => { b.pages[0].strokes[0].width = 0; })],
    ['a negative width', mutate(b => { b.pages[0].strokes[0].width = -1; })],
    ['width 65', mutate(b => { b.pages[0].strokes[0].width = 65; })],
    ['NaN width', mutate(b => { b.pages[0].strokes[0].width = NaN; })],
    ['Infinity width', mutate(b => { b.pages[0].strokes[0].width = Infinity; })],
    ['a width that is text', mutate(b => { b.pages[0].strokes[0].width = '6'; })],
    ['empty points', mutate(b => { b.pages[0].strokes[0].points = ''; })],
    ['markup in points', mutate(b => { b.pages[0].strokes[0].points = '1,2 <script>'; })],
    ['a double space in points', mutate(b => { b.pages[0].strokes[0].points = '1,2  3,4'; })],
    ['a trailing space in points', mutate(b => { b.pages[0].strokes[0].points = '1,2 '; })],
    ['a semicolon in points', mutate(b => { b.pages[0].strokes[0].points = '1;2'; })],
    ['letters in points', mutate(b => { b.pages[0].strokes[0].points = 'a,b'; })],
    ['exponent notation in points', mutate(b => { b.pages[0].strokes[0].points = '1e5,2'; })],
    ['a single number in points', mutate(b => { b.pages[0].strokes[0].points = '12'; })],
    ['points that are not text', mutate(b => { b.pages[0].strokes[0].points = 1; })],
    ['points over 200 000 characters', mutate(b => { b.pages[0].strokes[0].points = '0.1,0.2 '.repeat(25001).trim(); })],
    ['5001 strokes on a page', mutate(b => { b.pages[0].strokes = Array.from({ length: 5001 }, () => b.pages[0].strokes[0]); })],
  ];
  for (const [name, value] of refused) {
    it(name, () => assert.equal(parseBoard(value).ok, false));
  }

  it('a JSON string longer than the cap, without parsing it', () => {
    assert.deepEqual(parseBoard('x'.repeat(MAX_BOARD_BYTES + 1)), { ok: false, reason: 'too-big' });
  });

  it('an object whose strokes add up to more than the cap, even though each stroke is allowed', () => {
    const points = '0.1,0.2 '.repeat(23750).trim(); // ~190 000 characters
    const b = mutate(x => { x.pages[0].strokes = Array.from({ length: 11 }, () => ({ color: '#000', width: 6, points })); });
    assert.deepEqual(parseBoard(b), { ok: false, reason: 'too-big' });
  });
});

describe('isBoardDirty', () => {
  const inked = docOf(['blank', [stroke('0.1,0.2 0.3,0.4')]]);
  const empty = docOf(['blank', []]);

  it('a never-saved board is dirty only when it has ink', () => {
    assert.equal(isBoardDirty(empty, null), false);
    assert.equal(isBoardDirty(inked, null), true);
  });

  it('a saved board is clean until it changes', () => {
    const r = serializeBoard(inked);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(isBoardDirty(inked, r.json), false);
    assert.equal(isBoardDirty(docOf(['blank', [stroke('0.1,0.2 0.3,0.4'), stroke('0.5,0.5 0.6,0.6')]]), r.json), true);
    assert.equal(isBoardDirty(docOf(['grid', [stroke('0.1,0.2 0.3,0.4')]]), r.json), true);
  });

  it('undo history and the current page do not make a board dirty', () => {
    const r = serializeBoard(inked);
    assert.ok(r.ok);
    if (!r.ok) return;
    const moved: BoardDoc = { current: 0, pages: [{ background: 'blank', board: { strokes: inked.pages[0]!.board.strokes, past: [[]] } }] };
    assert.equal(isBoardDirty(moved, r.json), false);
  });

  it('emptying a saved board is a change', () => {
    const r = serializeBoard(inked);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(isBoardDirty(empty, r.json), true);
  });

  it('a board too big to serialise counts as dirty (it can never match what was saved)', () => {
    const big = docOf(['blank', Array.from({ length: 3000 }, () => stroke(manyPoints(80)))]);
    assert.equal(isBoardDirty(big, '{}'), true);
  });
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "boardFile|Cannot find module|^# (pass|fail)"`
Expected: the new file fails to load («Cannot find module … boardFile.ts»); `# fail` ≥ 1.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/boardFile.ts`:

```ts
/**
 * The saved form of a whiteboard, and the checks that make it safe to use.
 *
 * A board is stored as the JSON string of a `BoardFile` in a `SavedMaterial`
 * of type `'board'`. That string comes back from the server or from device
 * storage, so it is **untrusted**: it is validated whole by `parseBoard`
 * before anything draws it or prints it, and a board that fails is refused,
 * never partly rendered.
 *
 * Ink is already stored as fractions of the page width (`services/penInk.ts`),
 * so a saved page looks the same on every screen. Undo history is not saved.
 *
 * Free of react-native so `node --test` can load it. Serialised content is
 * plain ASCII (digits, hex colours, JSON punctuation), so its length in
 * characters is its length in bytes.
 */
import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_STROKE_WIDTH,
  MAX_PAGES,
  docHasInk,
  type BoardBackground,
  type BoardDoc,
} from './whiteboardModel.ts';

export const BOARD_FILE_VERSION = 1;
/** Above this a board is refused on save and on open (the server accepts 12 MB; browser storage ~5 MB shared). */
export const MAX_BOARD_BYTES = 2_000_000;
export const MAX_STROKES_PER_PAGE = 5000;
export const MAX_POINTS_CHARS = 200_000;
export const MIN_STROKE_WIDTH = 0.5;
export const MAX_STROKE_WIDTH = 64;

export type BoardFileStroke = { color: string; width: number; points: string };
export type BoardFilePage = { background: BoardBackground; strokes: BoardFileStroke[] };
export type BoardFile = { version: 1; canvas: { w: number; h: number }; pages: BoardFilePage[] };

const BACKGROUNDS: readonly string[] = ['blank', 'grid', 'axes'];
/** #rgb, #rgba, #rrggbb or #rrggbbaa — nothing else gets into an attribute. */
const COLOR_RE = /^#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
/** One `x,y` token of plain decimals: no exponent, no `+`, no stray punctuation. */
const PAIR_RE = /^-?\d{1,6}(?:\.\d{1,6})?,-?\d{1,6}(?:\.\d{1,6})?$/;

function validPoints(points: unknown): points is string {
  if (typeof points !== 'string' || points.length === 0 || points.length > MAX_POINTS_CHARS) return false;
  return points.split(' ').every(token => PAIR_RE.test(token));
}

/** The board as a plain, fixed-shape object. Never includes undo history. */
export function boardFileOf(doc: BoardDoc): BoardFile {
  return {
    version: BOARD_FILE_VERSION,
    canvas: { w: CANVAS_W, h: CANVAS_H },
    pages: doc.pages.map(p => ({
      background: p.background,
      strokes: p.board.strokes.map(s => ({
        color: s.color,
        width: s.width ?? DEFAULT_STROKE_WIDTH,
        points: s.points,
      })),
    })),
  };
}

export type SerializeResult =
  | { ok: true; json: string }
  | { ok: false; reason: 'too-many-pages' | 'too-big' };

/**
 * The string to store, or why it cannot be stored. Key order is fixed, so two
 * equal boards give the same string — `isBoardDirty` relies on that.
 */
export function serializeBoard(doc: BoardDoc): SerializeResult {
  if (doc.pages.length > MAX_PAGES) return { ok: false, reason: 'too-many-pages' };
  const json = JSON.stringify(boardFileOf(doc));
  if (json.length > MAX_BOARD_BYTES) return { ok: false, reason: 'too-big' };
  return { ok: true, json };
}

export type ParseResult = { ok: true; file: BoardFile } | { ok: false; reason: string };
const bad = (reason: string): ParseResult => ({ ok: false, reason });

/**
 * Validate stored content (the JSON string, or the already-parsed object).
 * Accepts only the exact shape `boardFileOf` writes; everything is checked
 * before anything is returned, and the result is rebuilt field by field so no
 * unvalidated property can ride along.
 */
export function parseBoard(content: unknown): ParseResult {
  let value: unknown = content;
  if (typeof content === 'string') {
    if (content.length > MAX_BOARD_BYTES) return bad('too-big');
    try {
      value = JSON.parse(content);
    } catch {
      return bad('not-json');
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad('not-an-object');
  const v = value as Record<string, unknown>;
  if (v.version !== BOARD_FILE_VERSION) return bad('version');
  const canvas = v.canvas as Record<string, unknown> | null | undefined;
  if (!canvas || typeof canvas !== 'object' || canvas.w !== CANVAS_W || canvas.h !== CANVAS_H) return bad('canvas');
  if (!Array.isArray(v.pages) || v.pages.length < 1 || v.pages.length > MAX_PAGES) return bad('pages');

  const pages: BoardFilePage[] = [];
  let totalChars = 0;
  for (const rawPage of v.pages) {
    if (!rawPage || typeof rawPage !== 'object') return bad('page');
    const p = rawPage as Record<string, unknown>;
    if (typeof p.background !== 'string' || !BACKGROUNDS.includes(p.background)) return bad('background');
    if (!Array.isArray(p.strokes) || p.strokes.length > MAX_STROKES_PER_PAGE) return bad('strokes');
    const strokes: BoardFileStroke[] = [];
    for (const rawStroke of p.strokes) {
      if (!rawStroke || typeof rawStroke !== 'object') return bad('stroke');
      const s = rawStroke as Record<string, unknown>;
      if (typeof s.color !== 'string' || !COLOR_RE.test(s.color)) return bad('color');
      if (typeof s.width !== 'number' || !Number.isFinite(s.width) || s.width < MIN_STROKE_WIDTH || s.width > MAX_STROKE_WIDTH) {
        return bad('width');
      }
      if (!validPoints(s.points)) return bad('points');
      totalChars += s.points.length;
      if (totalChars > MAX_BOARD_BYTES) return bad('too-big');
      strokes.push({ color: s.color, width: s.width, points: s.points });
    }
    pages.push({ background: p.background as BoardBackground, strokes });
  }
  return { ok: true, file: { version: BOARD_FILE_VERSION, canvas: { w: CANVAS_W, h: CANVAS_H }, pages } };
}

/** A validated file as an editable document: first page current, no undo history. */
export function docOfFile(file: BoardFile): BoardDoc {
  return {
    current: 0,
    pages: file.pages.map(p => ({
      background: p.background,
      board: {
        strokes: p.strokes.map(s => ({ color: s.color, width: s.width, points: s.points })),
        past: [],
      },
    })),
  };
}

/**
 * Whether leaving now would lose something. A board that was never saved is
 * dirty when it has ink; a saved one when it no longer serialises to what was
 * saved (a board too big to serialise can never match, so it counts as dirty).
 * Undo history and the current page are not part of what is saved.
 */
export function isBoardDirty(doc: BoardDoc, savedJson: string | null): boolean {
  if (savedJson === null) return docHasInk(doc);
  const r = serializeBoard(doc);
  return !r.ok || r.json !== savedJson;
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "not ok|^# (pass|fail)"`
Expected: no `not ok` lines; `# fail 0`.

- [ ] **Step 5: Mutation-check two guards, then revert**

Temporarily change `COLOR_RE` to `/^#/` and re-run `pnpm test 2>&1 | grep -E "not ok"`: expected several `not ok` (the colour cases). Revert. Temporarily delete the `totalChars` check and re-run: expected the "strokes add up to more than the cap" test to fail. Revert. Run the suite once more: `# fail 0`.

- [ ] **Step 6: Typecheck and commit**

```bash
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -4
git add artifacts/mobile/services/boardFile.ts artifacts/mobile/services/__tests__/boardFile.test.ts
git commit -m "Whiteboard B2: the saved form of a board, validated, size-capped and dirty-checked

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d"
```

---

### Task 2: `'board'` is a material kind, and the viewer redirects boards

**Files:**
- Modify: `artifacts/mobile/services/workspace.ts:27` (the `MaterialType` union)
- Modify: `artifacts/mobile/constants/materialKind.ts` (four tables and the edit-route map)
- Modify: `artifacts/mobile/app/workspace/index.tsx:35-40` (`TABS`)
- Modify: `artifacts/mobile/app/workspace/view.tsx` (the `getItem(id).then` block, ~line 100)
- Modify: `artifacts/mobile/services/i18n.ts` (strings, both languages)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 3): `MaterialType` includes `'board'`; `MATERIAL_EDIT_ROUTE.board === '/ai-tools/whiteboard'`; i18n keys `boardType`, `myBoards`, `boardSave`, `boardSaveTitle`, `boardSaveNameLabel`, `boardSaveConfirm`, `boardSaved`, `boardUpdated`, `boardSaveFailed`, `boardTooBig`, `boardOpenFailed`, `boardExportPdf`, `boardExportFailed`; the viewer sends a board to `/ai-tools/whiteboard` with `{ savedId }`.

- [ ] **Step 1: Widen the union and let the compiler list what breaks**

In `artifacts/mobile/services/workspace.ts` change

```ts
export type MaterialType = 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides' | 'prompt-slides';
```
to
```ts
export type MaterialType = 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides' | 'prompt-slides' | 'board';
```

Run: `cd /home/user/Iqraa/artifacts/mobile && npx tsc --noEmit -p . 2>&1 | head -20`
Expected: **exactly four errors, all in `constants/materialKind.ts`** (`MATERIAL_FILL`, `ON_DARK`, `MATERIAL_ICON`, `MATERIAL_LABEL_KEY` missing `'board'`). If any other file errors, stop and report it — the audit in this plan's *Decisions* section is then incomplete.

- [ ] **Step 2: Choose a colour that carries white text, and prove it**

Run:
```bash
python3 - <<'EOF'
def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    r, g, b = (int(h[i:i+2], 16) for i in (1, 3, 5))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
fill, on_dark = '#9A3F12', '#F2A671'
print('white on fill      ', round(contrast('#FFFFFF', fill), 2), '(need >= 5.2)')
print('fill on white      ', round(contrast(fill, '#FFFFFF'), 2), '(need >= 4.8)')
print('on_dark on #111F36 ', round(contrast(on_dark, '#111F36'), 2), '(need >= 7.1)')
EOF
```
Expected: all three meet their minimum (the thresholds are the ones in `materialKind.ts`'s own comments). If one does not, darken `fill` / lighten `on_dark` until it does and use the new values below. No purple (the site's DESIGN.md rules it out): burnt orange is fine.

- [ ] **Step 3: Fill the four tables and the edit route**

In `artifacts/mobile/constants/materialKind.ts` add a line to each map (keep the existing entries):

```ts
// in MATERIAL_FILL
  board: '#9A3F12',
// in ON_DARK
  board: '#F2A671',
// in MATERIAL_ICON
  board: 'easel-outline',
// in MATERIAL_LABEL_KEY
  board: 'boardType',
// in MATERIAL_EDIT_ROUTE (the Partial map) — Edit reopens the board itself
  board: '/ai-tools/whiteboard',
```

Also extend the doc comment above `MATERIAL_EDIT_ROUTE` with one sentence: «A board reopens in the whiteboard: `savedId` makes the screen load the stored pages.»

- [ ] **Step 4: Add the strings**

In `artifacts/mobile/services/i18n.ts`, add after `boardDeletePageConfirm: 'احذف',` (Arabic block, ~line 1428):

```ts
    boardType: 'سبورة',
    myBoards: 'سبوراتي',
    boardSave: 'حفظ السبورة',
    boardSaveTitle: 'احفظ السبورة',
    boardSaveNameLabel: 'اسم السبورة',
    boardSaveConfirm: 'حفظ',
    boardSaved: 'حُفظت السبورة في «موادي»',
    boardUpdated: 'تم تحديث السبورة',
    boardSaveFailed: 'تعذّر الحفظ',
    boardTooBig: 'السبورة كبيرة جدًا للحفظ. احذف بعض الكتابة أو الصفحات.',
    boardOpenFailed: 'تعذّر فتح السبورة',
    boardExportPdf: 'تصدير PDF',
    boardExportFailed: 'تعذّر تصدير الملف',
```
and after `boardDeletePageConfirm: 'Delete',` (English block, ~line 3729):

```ts
    boardType: 'Whiteboard',
    myBoards: 'My boards',
    boardSave: 'Save board',
    boardSaveTitle: 'Save the board',
    boardSaveNameLabel: 'Board name',
    boardSaveConfirm: 'Save',
    boardSaved: 'Board saved to My materials',
    boardUpdated: 'Board updated',
    boardSaveFailed: 'Could not save',
    boardTooBig: 'This board is too large to save. Remove some writing or pages.',
    boardOpenFailed: 'Could not open the board',
    boardExportPdf: 'Export PDF',
    boardExportFailed: 'Could not export the PDF',
```
(Line numbers drift; anchor on the `boardDeletePageConfirm` lines.)

- [ ] **Step 5: Add the filter tab**

In `artifacts/mobile/app/workspace/index.tsx`, extend `TABS`:

```ts
const TABS: Array<{ key: MaterialType | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'allFilter' },
  { key: 'lesson', labelKey: 'myLessons' },
  { key: 'worksheet', labelKey: 'myWorksheets' },
  { key: 'quiz', labelKey: 'myQuizzes' },
  { key: 'board', labelKey: 'myBoards' },
];
```

- [ ] **Step 6: Redirect boards in the viewer**

In `artifacts/mobile/app/workspace/view.tsx`, in the `else if (id) { getItem(id).then(m => {` block, insert this **first** inside the callback (before the `const redo = …` line):

```ts
        // A board is not a quiz. Without this it falls through every `kind`
        // switch below to the quiz builders. It reopens in the whiteboard
        // itself; `replace` so Back goes to the list, not to this spinner.
        if (m?.type === 'board') {
          router.replace({ pathname: '/ai-tools/whiteboard' as any, params: { savedId: m.id } });
          return;
        }
```

- [ ] **Step 7: Verify**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -4`
Expected: clean.

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "not ok|^# (pass|fail)"`
Expected: `# fail 0` (the i18n parity test now covers the new keys).

Run: `cd /home/user/Iqraa && git diff --stat`
Expected: only the five files listed for this task.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services/workspace.ts artifacts/mobile/constants/materialKind.ts artifacts/mobile/app/workspace/index.tsx artifacts/mobile/app/workspace/view.tsx artifacts/mobile/services/i18n.ts
git commit -m "Whiteboard B2: 'board' is a saved-material kind; the viewer sends boards to the board

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d"
```

---

### Task 3: Save and reopen on the board screen

**Files:**
- Create: `artifacts/mobile/components/classroom/BoardSaveDialog.tsx`
- Modify: `artifacts/mobile/components/classroom/BoardToolbar.tsx` (a sixth palette group, the Save button)
- Modify: `artifacts/mobile/app/ai-tools/whiteboard.tsx` (rewrite — the full file is below)
- Modify: `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` (~line 1541, the board button)

**Interfaces:**
- Consumes (Task 1): `BOARD_FILE_VERSION`, `docOfFile`, `isBoardDirty`, `parseBoard`, `serializeBoard`. (Task 2): `MaterialType` includes `'board'`; i18n keys `boardSave`, `boardSaveTitle`, `boardSaveNameLabel`, `boardSaveConfirm`, `boardSaved`, `boardUpdated`, `boardSaveFailed`, `boardTooBig`, `boardOpenFailed`; `getItem`, `saveItem`, `updateItem` from `services/workspace`.
- Produces (used by Task 4): in `whiteboard.tsx`, `saved: { id: string; title: string; json: string } | null` state mirrored in `savedRef`, `defaultTitle()`, `showToast(msg)`, `docRef`; in `BoardToolbar`, the sixth group (Task 4 adds the PDF button to it) and the labels object (Task 4 adds `exportPdf`).
- Route params the screen now reads: `savedId?`, `topic?`, `subject?`, `grade?` (all strings).

- [ ] **Step 1: The title dialog**

Create `artifacts/mobile/components/classroom/BoardSaveDialog.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';

export type BoardSaveDialogLabels = { title: string; nameLabel: string; save: string; cancel: string };

/**
 * Asks for the board's name, once, on the first save. A `<Modal>` is its own
 * window, so it carries its own `KeyboardSafeView` (the root Stack's wrapper
 * does not reach it). A name is required: Save stays disabled while it is blank.
 */
export function BoardSaveDialog({ visible, initialTitle, isRTL, labels, onSubmit, onCancel }: {
  visible: boolean;
  initialTitle: string;
  isRTL: boolean;
  labels: BoardSaveDialogLabels;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  useEffect(() => {
    if (visible) setTitle(initialTitle);
  }, [visible, initialTitle]);
  const clean = title.trim();
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const submit = () => {
    if (clean) onSubmit(clean);
  };
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={[styles.heading, { fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {labels.title}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={submit}
              autoFocus
              selectTextOnFocus
              maxLength={80}
              returnKeyType="done"
              accessibilityLabel={labels.nameLabel}
              placeholder={labels.nameLabel}
              placeholderTextColor={DECK_MUTED}
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
            />
            <View style={[styles.buttons, { flexDirection: rowDir }]}>
              <Pressable onPress={onCancel} accessibilityRole="button" style={styles.btn}>
                <Text style={[styles.btnText, { color: DECK_MUTED, fontFamily: 'Almarai_400Regular' }]}>{labels.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!clean}
                accessibilityRole="button"
                style={[styles.btn, styles.btnPrimary, { opacity: clean ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'ReadexPro_500Medium' }]}>{labels.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    width: '100%', maxWidth: 420, padding: 20, gap: 14, borderRadius: 20,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  heading: { fontSize: 17, color: DECK_TEXT },
  input: {
    borderWidth: 1, borderColor: DECK_BORDER, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: DECK_TEXT,
  },
  buttons: { gap: 10, justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnText: { fontSize: 14 },
});
```

- [ ] **Step 2: The Save button in the toolbar**

In `artifacts/mobile/components/classroom/BoardToolbar.tsx`:

1. Add `save: string;` to `BoardToolbarLabels` (after `deletePage`).
2. Add the props (destructure and type them, after `onDeletePage`):
   - `onSave: () => void;`
   - `canSave: boolean;` — enabled only when there is something to save
   - `saveDirty: boolean;` — draws the icon filled and accented
   - `saveBusy: boolean;`
3. Add a sixth group as the **last child of the palette `<View>`**, right after the page-controls group:

```tsx
        <View style={styles.group}>
          <Pressable
            onPress={onSave}
            disabled={!canSave || saveBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.save}
            style={{ opacity: canSave && !saveBusy ? 1 : 0.35 }}
          >
            <Ionicons name={saveDirty ? 'save' : 'save-outline'} size={20} color={saveDirty ? DECK_ACCENT : DECK_MUTED} />
          </Pressable>
        </View>
```

- [ ] **Step 3: Rewrite the screen**

Replace the whole of `artifacts/mobile/app/ai-tools/whiteboard.tsx` with:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { DECK_ACCENT, DECK_BG, DECK_CARD_BG } from '@/services/deckTheme';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { BOARD_FILE_VERSION, docOfFile, isBoardDirty, parseBoard, serializeBoard } from '@/services/boardFile';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import { BoardSaveDialog } from '@/components/classroom/BoardSaveDialog';
import { Toast } from '@/components/ui/Toast';
import {
  BOARD_DEFAULT_WIDTH,
  EMPTY_DOC,
  MAX_PAGES,
  addPage,
  canUndo,
  clearBoard,
  commitStrokes,
  currentPage,
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

type Saved = { id: string; title: string; json: string };

/**
 * The board (سبورة). Opened from the presentation (Back returns to the same
 * slide, which stays mounted underneath) or from «موادي» with `savedId`.
 *
 * The page is a 16:9 stage fitted into the screen. `PenCanvas` measures the
 * stage, so ink is stored as fractions of the stage width and looks the same
 * on every screen; stroke widths scale with the stage (`strokeScale`).
 *
 * Save writes a `'board'` material (`services/boardFile.ts`): the first save
 * asks for a name, later ones update the same material. What counts as
 * unsaved work is "the board no longer serialises to what was saved" — so
 * clearing a page, deleting a page that has ink, and leaving with unsaved
 * changes on ANY page all ask first. Android's hardware back, the close
 * button and (on web) Escape are intercepted; the browser's own back button
 * and closing the tab are not.
 *
 * A saved board that fails validation is refused with a message and the
 * screen stays blank; Save then creates a NEW material and never overwrites
 * the unreadable one.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ savedId?: string; topic?: string; subject?: string; grade?: string }>();
  const [doc, setDoc] = useState<BoardDoc>(EMPTY_DOC);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(!!params.savedId);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [askTitle, setAskTitle] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const showToast = useCallback((msg: string) => setToast({ msg, visible: true }), []);

  // Listeners registered once read the document through refs.
  const docRef = useRef(doc);
  docRef.current = doc;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const askTitleRef = useRef(askTitle);
  askTitleRef.current = askTitle;

  // One confirm dialog at a time, shared by leave, clear and delete-page: a held
  // Escape key repeats, and each repeat would otherwise stack another dialog.
  const busy = useRef(false);
  const saving = useRef(false);

  const page = currentPage(doc);
  const stage = fitCanvas(area.w, area.h);
  const dirty = useMemo(() => isBoardDirty(doc, saved?.json ?? null), [doc, saved]);

  const leave = useCallback(async () => {
    if (busy.current || askTitleRef.current) return;
    if (!isBoardDirty(docRef.current, savedRef.current?.json ?? null)) {
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
  // presentation's handler and drop the board's ink unasked. While the name
  // dialog is open Escape belongs to the dialog (its Modal closes it).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || askTitleRef.current) return;
      e.preventDefault();
      void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  // Reopen a saved board. Nothing is drawn until it has loaded, so a stroke
  // can never be overwritten by the load finishing.
  useEffect(() => {
    const id = params.savedId;
    if (!id) return;
    let live = true;
    void getItem(id).then(item => {
      if (!live) return;
      const parsed = item && item.type === 'board' ? parseBoard(item.content) : null;
      if (item && parsed && parsed.ok) {
        const next = docOfFile(parsed.file);
        const r = serializeBoard(next);
        setDoc(next);
        setSaved(r.ok ? { id: item.id, title: item.title, json: r.json } : null);
      } else {
        showToast(t('boardOpenFailed'));
      }
      setLoading(false);
    });
    return () => { live = false; };
  }, [params.savedId, showToast, t]);

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

  /** «السبورة — <the lesson>», else «السبورة <today, Latin digits>». */
  const defaultTitle = useCallback(() => {
    const base = t('whiteboardTool');
    const topic = (params.topic ?? '').trim();
    return topic ? `${base} — ${topic}` : `${base} ${new Date().toISOString().slice(0, 10)}`;
  }, [params.topic, t]);

  const persist = useCallback(async (title: string) => {
    if (saving.current) return;
    const r = serializeBoard(docRef.current);
    if (!r.ok) {
      showToast(t('boardTooBig'));
      return;
    }
    saving.current = true;
    setSaveBusy(true);
    try {
      let id = savedRef.current?.id ?? null;
      // `updateItem` answers false when the material is gone (deleted from
      // «موادي» while the board was open): fall through to creating a new one,
      // which is what pressing Save meant. It is given only what changed, so a
      // lesson id stamped at the first save is kept.
      if (id && (await updateItem(id, { title, content: r.json }))) {
        showToast(t('boardUpdated'));
      } else {
        const created = await saveItem({
          type: 'board',
          title,
          subject: params.subject ?? '',
          grade: params.grade ?? '',
          topic: params.topic ?? '',
          language: lang === 'ar' ? 'ar' : 'en',
          content: r.json,
          formState: { boardVersion: BOARD_FILE_VERSION },
        });
        id = created.id;
        showToast(t('boardSaved'));
      }
      // `r.json` is the snapshot that was written: ink added while the request
      // was in flight leaves the board dirty, as it should.
      setSaved({ id, title, json: r.json });
    } catch {
      // `saveItem`'s device-storage fallback can throw (quota); nothing was kept.
      showToast(t('boardSaveFailed'));
    } finally {
      saving.current = false;
      setSaveBusy(false);
    }
  }, [lang, params.grade, params.subject, params.topic, showToast, t]);

  const onSave = useCallback(() => {
    if (saving.current || loading) return;
    const current = savedRef.current;
    if (current) void persist(current.title);
    else setAskTitle(true);
  }, [loading, persist]);

  const pageLabel = `${localizeDigits(String(doc.current + 1), lang)} / ${localizeDigits(String(doc.pages.length), lang)}`;

  return (
    <View style={styles.container} onLayout={e => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.stage, { left: stage.offsetX, top: stage.offsetY, width: stage.width, height: stage.height }]}>
        <BoardBackground kind={page.background} lang={lang} scale={stage.scale} />
        {/* Keyed by the current page index: prev / next / add, and deleting the
            LAST page (which moves `current` back), remount the canvas, so an
            in-flight draft and the measured canvas width reset. Deleting a
            middle page keeps `current` unchanged, so no remount — the canvas
            just receives the next page's strokes. */}
        <PenCanvas
          key={doc.current}
          strokes={page.board.strokes}
          color={color}
          width={width}
          strokeScale={stage.scale > 0 ? stage.scale : 1}
          erase={erase}
          active={!loading}
          onChange={next => setDoc(d => updateCurrent(d, p => ({ ...p, board: commitStrokes(p.board, next) })))}
        />
        {loading && (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator color={DECK_ACCENT} />
          </View>
        )}
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
        onSave={onSave}
        canSave={!loading && dirty}
        saveDirty={dirty}
        saveBusy={saveBusy}
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
          save: t('boardSave'),
        }}
      />
      <BoardSaveDialog
        visible={askTitle}
        initialTitle={defaultTitle()}
        isRTL={isRTL}
        labels={{ title: t('boardSaveTitle'), nameLabel: t('boardSaveNameLabel'), save: t('boardSaveConfirm'), cancel: t('cancel') }}
        onSubmit={title => { setAskTitle(false); void persist(title); }}
        onCancel={() => setAskTitle(false)}
      />
      <Toast visible={toast.visible} message={toast.msg} onHide={() => setToast(s => ({ ...s, visible: false }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The letterbox around the page is the deck's cream; the page itself is white.
  container: { flex: 1, backgroundColor: DECK_BG },
  stage: { position: 'absolute', backgroundColor: DECK_CARD_BG, overflow: 'hidden' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Give the board its context from the presentation**

In `artifacts/mobile/app/ai-tools/classroom/presentation.tsx`, find the whiteboard button (`grep -n "'/ai-tools/whiteboard'" artifacts/mobile/app/ai-tools/classroom/presentation.tsx`, ~line 1541). `activity` (the deck, `useState<ClassroomActivity | null>` ~line 932) is in scope: the button is in `PresentationScreen`, which spans the rest of the file. Replace

```tsx
            onPress={() => router.push('/ai-tools/whiteboard' as never)}
```
with
```tsx
            onPress={() => router.push({
              pathname: '/ai-tools/whiteboard',
              params: { topic: activity?.lesson ?? '', subject: activity?.subject ?? '', grade: activity?.grade ?? '' },
            } as never)}
```

- [ ] **Step 5: Verify the build**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -4`
Expected: clean. (If `Toast`'s props differ from `{ visible, message, onHide }`, read `components/ui/Toast.tsx` and fix the call, not the component.)

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "not ok|^# (pass|fail)"`
Expected: `# fail 0` (`ariaState.test` still passes: the new code uses no `accessibilityState`).

- [ ] **Step 6: Smoke-test in the browser, then commit**

The full browser pass is Task 5. Here only prove the screen still draws and Save is wired. Start the stack (Postgres, `pnpm run dev:api`, `pnpm run dev:mobile:web`; see *Task 5, Step 1*), sign in, open the board from a deck, draw one stroke, press the Save icon (bottom palette, last group), type a name, confirm: expected a toast «حُفظت السبورة في «موادي»» and the Save icon turning outline. Report exactly what you saw; if you cannot run it, say it is unchecked.

```bash
cd /home/user/Iqraa
git add artifacts/mobile/components/classroom/BoardSaveDialog.tsx artifacts/mobile/components/classroom/BoardToolbar.tsx artifacts/mobile/app/ai-tools/whiteboard.tsx artifacts/mobile/app/ai-tools/classroom/presentation.tsx
git commit -m "Whiteboard B2: save a board to موادي and reopen it

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d"
```

---

### Task 4: PDF export

**Files:**
- Create: `artifacts/mobile/services/boardExportHtml.ts`
- Create: `artifacts/mobile/services/__tests__/boardExportHtml.test.ts`
- Modify: `artifacts/mobile/components/classroom/BoardToolbar.tsx` (the PDF button)
- Modify: `artifacts/mobile/app/ai-tools/whiteboard.tsx` (export handler)

**Interfaces:**
- Consumes (Task 1): `parseBoard`, `boardFileOf`. (existing) `localizeDigits`, `axesGeometry`, `gridLines`, `BOARD_STEP`, `CANVAS_W`, `CANVAS_H` from `whiteboardModel.ts`; `scaleInkPoints(points, width)` from `penInk.ts`; `DECK_BORDER`, `DECK_MUTED` from `deckTheme.ts`; `exportAsPDF(html, filename)` from `services/share`; `exportFilename(title, suffix, fallback)` from `services/exportFilename`. (Task 3) `docRef`, `savedRef`, `defaultTitle`, `showToast`; i18n keys `boardExportPdf`, `boardExportFailed` (Task 2).
- Produces: `buildBoardHTML(content: unknown, title: string, isAr: boolean): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/boardExportHtml.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { boardFileOf } from '../boardFile.ts';
import { buildBoardHTML } from '../boardExportHtml.ts';
import { BOARD_STEP, CANVAS_H, CANVAS_W, gridLines, type BoardBackground, type BoardDoc, type Stroke } from '../whiteboardModel.ts';

const stroke = (points: string, extra: Partial<Stroke> = {}): Stroke => ({ color: '#DC2626', points, width: 6, ...extra });
const docOf = (...pages: Array<[BoardBackground, Stroke[]]>): BoardDoc => ({
  current: 0,
  pages: pages.map(([background, strokes]) => ({ background, board: { strokes, past: [] } })),
});
const count = (haystack: string, needle: RegExp): number => (haystack.match(needle) ?? []).length;

describe('buildBoardHTML', () => {
  it('makes one landscape slide per board page', () => {
    const d = docOf(['blank', []], ['grid', []], ['axes', []]);
    const html = buildBoardHTML(boardFileOf(d), 'سبورة', true)!;
    assert.equal(count(html, /class="slide"/g), 3);
    assert.ok(html.includes('size: A4 landscape'));
    assert.ok(html.includes('page-break-after'));
  });

  it('draws strokes in canvas units: stored fractions of the width times 1280', () => {
    const html = buildBoardHTML(boardFileOf(docOf(['blank', [stroke('0.5,0.25 0.5,0.25', { color: '#0F766E', width: 12 })]])), 't', false)!;
    assert.ok(html.includes('points="640,320 640,320"'), html);
    assert.ok(html.includes('stroke="#0F766E"'));
    assert.ok(html.includes('stroke-width="12"'));
    assert.ok(html.includes(`viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"`));
  });

  it('draws the paper for each page: nothing, a grid, or a grid with numbered axes', () => {
    const grid = gridLines(CANVAS_W, CANVAS_H, BOARD_STEP).length;
    const blank = buildBoardHTML(boardFileOf(docOf(['blank', []])), 't', false)!;
    const squared = buildBoardHTML(boardFileOf(docOf(['grid', []])), 't', false)!;
    const axes = buildBoardHTML(boardFileOf(docOf(['axes', []])), 't', false)!;
    assert.equal(count(blank, /<line /g), 0);
    assert.equal(count(squared, /<line /g), grid);
    assert.equal(count(axes, /<line /g), grid + 2);
    assert.equal(count(squared, /<text /g), 0);
    assert.ok(count(axes, /<text /g) > 20);
  });

  it('writes tick numbers and the page number in Arabic-Indic digits for Arabic, Latin for English', () => {
    const d = docOf(['axes', []], ['blank', []]);
    const ar = buildBoardHTML(boardFileOf(d), 't', true)!;
    const en = buildBoardHTML(boardFileOf(d), 't', false)!;
    assert.ok(ar.includes('١ / ٢') && ar.includes('٢ / ٢'));
    assert.ok(en.includes('1 / 2') && en.includes('2 / 2'));
    assert.ok(/>٣</.test(ar));
    assert.ok(/>3</.test(en));
  });

  it('keeps the paper left-to-right so a minus sign stays left of its digits', () => {
    const html = buildBoardHTML(boardFileOf(docOf(['axes', []])), 't', true)!;
    assert.ok(html.includes('direction="ltr"'));
  });

  it('escapes the title and never emits a script or a raw tag from it', () => {
    const hostile = '</div><script>alert(1)</script><img src=x onerror=alert(2)> "quoted" & \'single\'';
    const html = buildBoardHTML(boardFileOf(docOf(['blank', []])), hostile, true)!;
    assert.equal(html.includes('<script'), false);
    assert.equal(html.includes('<img'), false);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&quot;quoted&quot;'));
    assert.ok(html.includes('&amp;'));
  });

  it('refuses content that is not a valid board, instead of printing any of it', () => {
    const evil = { version: 1, canvas: { w: 1280, h: 720 }, pages: [{ background: 'grid', strokes: [{ color: '#fff" onload="alert(1)', width: 6, points: '0.1,0.2 0.3,0.4' }] }] };
    assert.equal(buildBoardHTML(evil, 't', true), null);
    assert.equal(buildBoardHTML({ nope: 1 }, 't', true), null);
    assert.equal(buildBoardHTML(null, 't', true), null);
    assert.equal(buildBoardHTML(JSON.stringify(evil), 't', true), null);
  });

  it('accepts the stored JSON string as well as the object', () => {
    const d = docOf(['blank', [stroke('0.1,0.2 0.3,0.4')]]);
    const html = buildBoardHTML(JSON.stringify(boardFileOf(d)), 't', true);
    assert.ok(html && html.includes('<polyline'));
  });

  it('has no script anywhere, whatever the board holds', () => {
    const html = buildBoardHTML(boardFileOf(docOf(['axes', [stroke('0.1,0.2 0.3,0.4')]], ['grid', []])), 'x', true)!;
    assert.equal(/<script/i.test(html), false);
    assert.equal(/\son[a-z]+=/i.test(html), false);
  });
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "boardExportHtml|Cannot find module|^# (pass|fail)"`
Expected: «Cannot find module … boardExportHtml.ts»; `# fail` ≥ 1.

- [ ] **Step 3: Write the builder**

Create `artifacts/mobile/services/boardExportHtml.ts`:

```ts
/**
 * A whiteboard as printable HTML: one A4-landscape `.slide` per board page,
 * which is the shape `exportAsPDF` / `capturePdf` already turns into one PDF
 * page each (`SLIDE_SELECTOR` in `pdfCapture.web.ts`).
 *
 * Each page is an inline `<svg viewBox="0 0 1280 720">` holding the paper and
 * the strokes (stored fractions of the width, times 1280, are canvas units).
 * The page is 16:9 and A4 is not, so it is centred under a thin title bar.
 *
 * The input is saved content, so it is UNTRUSTED. `buildBoardHTML` validates it
 * itself with `parseBoard` and returns null for anything invalid; after that
 * the only values interpolated are validated hex colours, numbers computed
 * here, digit-only points, and the title, which is escaped.
 *
 * Free of react-native so `node --test` can load it.
 */
import { parseBoard } from './boardFile.ts';
import { DECK_BORDER, DECK_MUTED, DECK_TEXT } from './deckTheme.ts';
import { scaleInkPoints } from './penInk.ts';
import {
  BOARD_STEP,
  CANVAS_H,
  CANVAS_W,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground,
  type Segment,
} from './whiteboardModel.ts';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A number for an attribute: at most two decimals, never exponent notation for our ranges. */
const num = (n: number): string => String(Number(n.toFixed(2)));

const line = (s: Segment, stroke: string, strokeWidth: number): string =>
  `<line x1="${num(s.x1)}" y1="${num(s.y1)}" x2="${num(s.x2)}" y2="${num(s.y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

/** The same paper as the screen (`BoardBackground`) at the reference scale. */
function paperSVG(background: BoardBackground, lang: string): string {
  if (background === 'blank') return '';
  const grid = gridLines(CANVAS_W, CANVAS_H, BOARD_STEP).map(s => line(s, DECK_BORDER, 1.5)).join('');
  if (background === 'grid') return grid;
  const axes = axesGeometry(CANVAS_W, CANVAS_H, BOARD_STEP);
  const ticks = axes.ticks
    .map(tick => {
      const x = tick.axis === 'x' ? tick.x : tick.x - 8;
      const y = tick.axis === 'x' ? tick.y + 22 : tick.y + 5;
      const anchor = tick.axis === 'x' ? 'middle' : 'end';
      return `<text x="${num(x)}" y="${num(y)}" font-size="16" fill="${DECK_MUTED}" text-anchor="${anchor}">${escapeHtml(localizeDigits(tick.value, lang))}</text>`;
    })
    .join('');
  return grid + line(axes.xAxis, DECK_MUTED, 3) + line(axes.yAxis, DECK_MUTED, 3) + ticks;
}

/** The whole document, or null when `content` is not a valid board. */
export function buildBoardHTML(content: unknown, title: string, isAr: boolean): string | null {
  const parsed = parseBoard(content);
  if (!parsed.ok) return null;
  const lang = isAr ? 'ar' : 'en';
  const total = parsed.file.pages.length;
  const safeTitle = escapeHtml(title);

  const slides = parsed.file.pages
    .map((page, i) => {
      const strokes = page.strokes
        .map(
          s =>
            `<polyline points="${scaleInkPoints(s.points, CANVAS_W)}" fill="none" stroke="${s.color}" stroke-width="${num(s.width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join('');
      const label = `${localizeDigits(String(i + 1), lang)} / ${localizeDigits(String(total), lang)}`;
      return `<div class="slide">
  <div class="bar"><span class="title">${safeTitle}</span><span class="num">${label}</span></div>
  <div class="page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" direction="ltr" style="direction:ltr">${paperSVG(page.background, lang)}${strokes}</svg></div>
</div>`;
    })
    .join('\n');

  const font = isAr ? "'Almarai', 'Noto Naskh Arabic', Arial" : "'Inter', 'Helvetica Neue', Arial";
  return `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${font}, sans-serif; background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width: 297mm; height: 210mm; background: #fff; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.bar { height: 14mm; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 10mm; border-bottom: 1px solid ${DECK_BORDER}; color: ${DECK_TEXT}; font-size: 14px; }
.title { font-weight: 700; }
.num { color: ${DECK_MUTED}; direction: ltr; unicode-bidi: isolate; }
.page { flex: 1; display: flex; align-items: center; justify-content: center; }
.page svg { width: 297mm; height: 167.06mm; display: block; }
</style>
</head>
<body>
${slides}
</body>
</html>`;
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "not ok|^# (pass|fail)"`
Expected: no `not ok`; `# fail 0`.

- [ ] **Step 5: Mutation-check the escaping, then revert**

Temporarily change `safeTitle` to `title`; expected the «escapes the title» test fails. Revert. Temporarily replace `const parsed = parseBoard(content); if (!parsed.ok) return null;` by a version that accepts anything with `pages`; expected the «refuses content that is not a valid board» test fails. Revert, and re-run: `# fail 0`.

- [ ] **Step 6: The PDF button**

In `artifacts/mobile/components/classroom/BoardToolbar.tsx`:
1. Add `exportPdf: string;` to `BoardToolbarLabels`.
2. Add props `onExport: () => void;`, `canExport: boolean;`, `exportBusy: boolean;`.
3. In the sixth group (the one holding Save), add after the Save `Pressable`:

```tsx
          <Pressable
            onPress={onExport}
            disabled={!canExport || exportBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.exportPdf}
            style={{ opacity: canExport && !exportBusy ? 1 : 0.35 }}
          >
            <Ionicons name="document-outline" size={20} color={DECK_MUTED} />
          </Pressable>
```

- [ ] **Step 7: The export handler**

In `artifacts/mobile/app/ai-tools/whiteboard.tsx`:

1. Add imports:
```tsx
import { exportAsPDF } from '@/services/share';
import { exportFilename } from '@/services/exportFilename';
import { buildBoardHTML } from '@/services/boardExportHtml';
```
and extend the `boardFile` import with `boardFileOf`, and the `whiteboardModel` import with `docHasInk`.

2. Next to `const saving = useRef(false);` add `const exporting = useRef(false);` and, next to `saveBusy`, `const [exportBusy, setExportBusy] = useState(false);`.

3. After `onSave`, add:

```tsx
  // From the in-memory document, so a board can be exported before it is saved.
  // `buildBoardHTML` validates what it is given, so a bug in `boardFileOf`
  // cannot put anything unchecked into the markup.
  const onExport = useCallback(async () => {
    if (exporting.current || loading) return;
    const title = savedRef.current?.title ?? defaultTitle();
    const html = buildBoardHTML(boardFileOf(docRef.current), title, lang === 'ar');
    if (!html) {
      showToast(t('boardExportFailed'));
      return;
    }
    exporting.current = true;
    setExportBusy(true);
    try {
      await exportAsPDF(html, exportFilename(title, '', 'whiteboard'));
    } catch {
      showToast(t('boardExportFailed'));
    } finally {
      exporting.current = false;
      setExportBusy(false);
    }
  }, [defaultTitle, lang, loading, showToast, t]);
```

4. Pass to `<BoardToolbar … />`: `onExport={onExport}`, `canExport={!loading && docHasInk(doc)}`, `exportBusy={exportBusy}`, and in `labels` add `exportPdf: t('boardExportPdf'),`.

- [ ] **Step 8: Verify**

Run: `cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -4`
Expected: clean.

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | grep -E "not ok|^# (pass|fail)"`
Expected: `# fail 0`.

Browser (see Task 5, Step 5 for the exact PDF check): draw on two pages, press the PDF icon; a `.pdf` downloads. Report what you observed, or that it is unchecked.

- [ ] **Step 9: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/boardExportHtml.ts artifacts/mobile/services/__tests__/boardExportHtml.test.ts artifacts/mobile/components/classroom/BoardToolbar.tsx artifacts/mobile/app/ai-tools/whiteboard.tsx
git commit -m "Whiteboard B2: export a board as a PDF, one landscape page per board page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d"
```

---

### Task 5: Verify in the browser, update STATUS.md, push (controller-run)

**Files:**
- Modify: `STATUS.md` (the whiteboard bullet)

This task needs a signed-in teacher and the local stack, so the controller runs it; implementers report "not checked" for browser behaviour.

- [ ] **Step 1: Start the stack**

Postgres data lives in `/var/tmp/pgdata` if it still exists from an earlier session:
```bash
su postgres -s /bin/bash -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgdata -o '-p 5432 -k /tmp' -l /var/tmp/pg.log start"
cd /home/user/Iqraa && (nohup pnpm run dev:api > /var/tmp/api.log 2>&1 &); (nohup pnpm run dev:mobile:web > /var/tmp/web.log 2>&1 &)
sleep 60; curl -s -o /dev/null -w "api %{http_code}\n" localhost:8080/api/healthz; curl -s -o /dev/null -w "web %{http_code}\n" localhost:8081
```
Expected: `api 200`, `web 200`. If the database is gone, follow `LOCAL_SETUP.md` and `docs/deploying.md` («Schema») to create it, then create a teacher (grade-10, mathematics, email verified). Playwright is global: run scripts with `NODE_PATH=/opt/node22/lib/node_modules node script.cjs`, in the scratchpad directory, with the `open`/`signIn` helpers the earlier board scripts use. The home screen's start button reads «ابدأ الحصة الآن».

- [ ] **Step 2: The B2 browser pass** — assert each of these, record PASS/FAIL with the observed value:

1. **Save first time.** Open the board from a deck. Draw a stroke on page 1 with axes paper, add a page, draw on page 2. The Save icon is filled. Press it: the name dialog opens, **pre-filled** with «السبورة — <the deck's lesson>». Clear the field: **Save is disabled**. Type a name, confirm: toast «حُفظت السبورة في «موادي»», Save icon turns outline and disabled.
2. **It is in «موادي».** `/workspace`: the board appears under «الكل» with the easel icon and the label «سبورة»; the «سبوراتي» tab shows only boards; the three other tabs do not show it.
3. **Reopen after a hard reload.** Reload the page (a new document load), open «موادي», tap the board: URL is `/ai-tools/whiteboard?savedId=…`, the indicator reads «١ / ٢», page 1 has **the same polyline `points`** as before the reload and axes paper, page 2 has its stroke. Resize the window 1280 → 800: strokes keep their place on the page.
4. **Edit menu** (the card's menu → تعديل) opens the same board.
5. **Viewer redirect.** Navigate directly to `/workspace/view?id=<board id>`: it lands on the board, **not** a quiz.
6. **Dirty tracking.** Reopen, change nothing, press the close button: **no prompt**. Draw a stroke: the Save icon fills; close: prompt. Cancel; Save: **no dialog**, toast «تم تحديث السبورة»; close: **no prompt**. Draw, then undo to the saved state: still saved (no prompt).
7. **Update, not duplicate.** `/workspace` still lists **one** board after the second save.
8. **Unsaved board still protects.** A new board with ink and no save: close asks, as in B1. A new board with **no** ink: closes without asking.
9. **Unreadable saved board.** Get a token: `curl -s -X POST localhost:8080/api/auth/login -H 'content-type: application/json' -d '{"email":"<teacher>","password":"<password>"}'` (confirm the token field name in the response). POST a board with bad content: `curl -s -X POST localhost:8080/api/workspace/items -H "authorization: Bearer <token>" -H 'content-type: application/json' -d '{"type":"board","title":"bad","content":"{\"version\":1,\"canvas\":{\"w\":1280,\"h\":720},\"pages\":[{\"background\":\"grid\",\"strokes\":[{\"color\":\"red\",\"width\":6,\"points\":\"0.1,0.2 0.3,0.4\"}]}]}"}'`. Open it from «موادي»: toast «تعذّر فتح السبورة», a blank board, **no crash**. Draw and Save: a **new** item is created (two items titled «bad» and the new name), and the bad one is **unchanged** (`GET /api/workspace/items/<id>` still returns the bad content).
10. **Over the cap is refused client-side.** Unit-tested in Task 1; in the browser, confirm only that the Save path for an ordinary board never shows «كبيرة جدًا».
11. **Signed-out / device storage.** Sign out, open the board from a deck, save: it lands in device storage and reopens from «موادي» (record whether this works; if signed-out users cannot reach the board at all, say so).
12. **Regressions.** Re-run the existing browser scripts for the board (B1 pass), Escape / keys / countdown, slide pen, per-slide ink and the book-page pen: all still pass. (Scripts live in the scratchpad from earlier sessions: `b1.cjs`, `board.cjs`, `postfix.cjs`, `slidepen.cjs`, `slideink.cjs`, `bookpen.cjs`; the start button name changed to «ابدأ الحصة الآن».)
13. **Toolbar at phone width.** At 390, 360 and 320 px the sixth palette group wraps *between* groups and nothing overflows the screen.

- [ ] **Step 3: Arabic layout of the new controls and the dialog**

At 390 px in Arabic: the dialog's buttons are mirrored (Save on the left in RTL), the text field is right-aligned, and the keyboard-lifting wrapper does not double-lift (web cannot show the keyboard; report **unchecked** for Android keyboard behaviour). In English: all labels present, LTR.

- [ ] **Step 4: Check the new workspace tab on a phone**

At 360 px the five tabs (الكل / دروسي / أوراقي / اختباراتي / سبوراتي) fit without clipping or horizontal scroll. If the labels clip, say so in the report: the fix is the shorter «سبورة» as the tab label, not a layout rewrite.

- [ ] **Step 5: The PDF**

In Playwright, listen for the download: `const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير PDF' }).click()]); await dl.saveAs('/tmp/b2-board.pdf');`. Then:

```bash
pdfinfo /tmp/b2-board.pdf | grep -E "Pages|Page size"
pdftoppm -r 60 -png /tmp/b2-board.pdf /tmp/b2-board
ls /tmp/b2-board*
```
Expected: `Pages: 2` for the two-page board, page size about 842 × 595 pt (A4 landscape). Open the PNGs (Read tool): the title bar, the page number, the axes and the stroke are visible, the tick minus signs sit to the left of their digits, and an Arabic title is not boxes. **If the strokes or the axes text are missing from the PDF** (html2canvas can drop inline-SVG content), say so plainly — do not call the export done; the fallback is to draw each page as an `<img src="data:image/svg+xml;…">` built from the same SVG string, which is a change to `buildBoardHTML` and its tests, not to anything else. Also: with **no ink** the PDF button is disabled; a board saved and reopened exports identically to before saving.

- [ ] **Step 6: Update `STATUS.md`**

In the whiteboard bullet (`grep -n "Still to build: B2" STATUS.md`): replace the sentence that lists B2 as still to build with an entry dated 2026-10-10 saying what B2 added **and only what steps 2–5 actually observed**: boards save as material type `'board'` (no schema change; `services/boardFile.ts`, validated and capped at 2 MB / 20 pages), the first save asks for a name and later ones update, reopening is `savedId` (the «موادي» card, Edit, and `workspace/view.tsx`, which now redirects boards instead of dropping them into the quiz renderer), the leave prompt now means "unsaved changes", and the PDF is one landscape page per board page via `services/boardExportHtml.ts`. List separately what was **not** verified: touch on a real phone, Android hardware back and keyboard behaviour, native print, native SVG text. State the tests count from `pnpm test`. Keep «Still to build» to C only (AI solve — only the 7 `VERIFIABLE_TOPICS` may ever be marked verified). Add this plan and the spec to the file list at the end of the bullet.

- [ ] **Step 7: Final checks**

```bash
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -4
cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (tests|pass|fail|skipped)"
cd /home/user/Iqraa && git status -s
```
Expected: typecheck clean; `# fail 0`; only `STATUS.md` modified.

- [ ] **Step 8: Commit, push, open a DRAFT pull request**

```bash
git add STATUS.md
git commit -m "STATUS: record whiteboard B2 (save, reopen, PDF) as observed

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d"
git fetch --prune origin
git push -u origin ccr-cdf5bcd6-nzb5tw
```
(Use `--force-with-lease` only if the remote branch still exists with already-merged history, per *Global Constraints*.) Open a **draft** PR with `mcp__github__create_pull_request` (base `main`, head `ccr-cdf5bcd6-nzb5tw`). Body: what B2 does, the verification you actually did (Task 5 results with numbers), **Not verified** (phone touch, Android back/keyboard, native print), `schema-push: n/a (no schema change)`, and end with the lines `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `https://claude.ai/code/session_01ESUy8bkeK9ZwcELgKZuu5d`. Then `mcp__claude-code-remote__subscribe_pr_activity` for the new PR.

---

## Self-review (run while writing)

**Spec coverage.** *B2 · 3*: type `'board'` and content shape → Task 1 + Task 2; `saveItem` first / `updateItem` after, id kept, Save control with title dialog (default title: the deck's topic, else dated) → Task 3 (first-save-only dialog is a recorded decision); context params from the presentation → Task 3 Step 4; dirty tracking and leave → Task 1 `isBoardDirty` + Task 3 `leave`; reopen from «موادي» with the `view.tsx` redirect, colour / icon / label and the filter tab → Task 2 (route param `savedId`, recorded); size cap and 20 pages enforced before any write, `writeLocal` throw caught → Task 1 `serializeBoard` + Task 3 `persist`'s `catch`. *B2 · 4*: pure `buildBoardHTML` in `services/boardExportHtml.ts`, landscape page per board page, paper + strokes through `scaleInkPoints(points, 1280)`, title and page number, via `exportAsPDF` → Task 4; untrusted content: `parseBoard` validation (version, page count, background, colour, width, points), escaping of everything printed → Task 1 + Task 4; Word / text export not applicable → nothing added. *Testing*: pure tests for `serializeBoard` / `parseBoard` / `buildBoardHTML` → Tasks 1 and 4; the compiler as the `MaterialType` audit, each consumer recorded → Task 2 Step 1 + *Decisions*; browser pass (two pages, save, reload, reopen, resize, PDF pages, redirect, over-cap, malformed) → Task 5; STATUS.md → Task 5. *Known limitation* (lessonId stamp) → *Decisions*. No gap found.

**Placeholder scan.** No "TBD", "similar to", "add validation" or code-less steps; every code step carries the code. The only conditional instructions are the ones with a stated criterion (e.g. «if `Toast`'s props differ, read the file and fix the call»; «if the PDF drops the SVG, do not call it done; the fallback is…»).

**Type consistency.** `BoardFile`, `serializeBoard` → `{ ok, json }`, `parseBoard` → `{ ok, file }`, `docOfFile`, `isBoardDirty(doc, savedJson | null)`, `boardFileOf` are defined in Task 1 and used with those exact names and shapes in Tasks 3 and 4. `Saved = { id, title, json }` is defined in Task 3 and used in Task 4 as `savedRef.current?.title`. `buildBoardHTML(content: unknown, title, isAr): string | null` is the same in its tests, its implementation and the screen call. Toolbar props added in Task 3 (`onSave`, `canSave`, `saveDirty`, `saveBusy`, label `save`) and Task 4 (`onExport`, `canExport`, `exportBusy`, label `exportPdf`) match the screen's props. i18n keys defined in Task 2 are exactly those used in Tasks 3–4 (`boardSave`, `boardSaveTitle`, `boardSaveNameLabel`, `boardSaveConfirm`, `boardSaved`, `boardUpdated`, `boardSaveFailed`, `boardTooBig`, `boardOpenFailed`, `boardExportPdf`, `boardExportFailed`, `boardType`, `myBoards`).
