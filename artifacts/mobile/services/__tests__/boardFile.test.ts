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
