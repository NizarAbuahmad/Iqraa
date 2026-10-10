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

  it('truncates a long title with an ellipsis instead of pushing the page number off', () => {
    const html = buildBoardHTML(boardFileOf(docOf(['blank', []])), 'x'.repeat(500), true)!;
    assert.ok(html.includes('text-overflow: ellipsis'));
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
