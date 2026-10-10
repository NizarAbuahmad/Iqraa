import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { boardFileOf } from '../boardFile.ts';
import { buildBoardHTML } from '../boardExportHtml.ts';
import type { BoardSolution } from '@workspace/math-verify';
import type { SolutionLabels } from '../solutionLayout.ts';
import {
  BOARD_STEP,
  CANVAS_H,
  CANVAS_W,
  blankPage,
  gridLines,
  withSolution,
  type BoardBackground,
  type BoardDoc,
  type Stroke,
} from '../whiteboardModel.ts';

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

describe('buildBoardHTML — a page with a solution', () => {
  const labels: SolutionLabels = { ai: 'AI-LABEL', verified: 'VERIFIED-LABEL', unchecked: 'UNCHECKED-LABEL', understoodAs: 'UNDERSTOOD' };
  const sol = (over: Partial<BoardSolution> = {}): BoardSolution => ({
    problem: 'P-2x+5=13', steps: ['STEP-ONE x^2', 'STEP-TWO', 'STEP-THREE'], answer: 'ANSWER-x=4', verified: false, source: 'unchecked', ...over,
  });
  const docWith = (s: BoardSolution): BoardDoc => ({
    current: 0,
    pages: [withSolution({ background: 'grid', board: { strokes: [stroke('0.5,0.5 0.5,0.5')], past: [] } }, s), blankPage()],
  });
  const html = (s: BoardSolution, isAr = true, l: SolutionLabels | undefined = labels) =>
    buildBoardHTML(boardFileOf(docWith(s)), 't', isAr, l);

  it('prints every step, the problem, the answer and BOTH labels, however few were revealed on screen', () => {
    const out = html(sol())!;
    for (const needle of ['AI-LABEL', 'P-2x+5=13', 'STEP-ONE', 'STEP-TWO', 'STEP-THREE', 'ANSWER-x=4', 'UNCHECKED-LABEL']) {
      assert.ok(out.includes(needle), needle);
    }
    assert.ok(!out.includes('VERIFIED-LABEL'));
  });

  it('a verified solution prints the verified label and what was checked, not the unchecked one', () => {
    const out = html(sol({ verified: true, source: 'sympy', understoodAs: '2x+5=13' }))!;
    assert.ok(out.includes('VERIFIED-LABEL'));
    assert.ok(out.includes('UNDERSTOOD 2x+5=13'));
    assert.ok(!out.includes('UNCHECKED-LABEL'));
  });

  it('writes exponents as real superscripts', () => {
    assert.ok(html(sol())!.includes('STEP-ONE x²'));
  });

  it('escapes the text, so a step cannot inject markup', () => {
    const out = html(sol({ steps: ['<script>alert(1)</script> x < 3'], answer: '"><img src=x onerror=1>' }))!;
    assert.ok(!out.includes('<script>'));
    assert.ok(!out.includes('<img'));
    assert.ok(out.includes('&lt;script&gt;'));
  });

  it('only the page that has a solution gets one, and the text direction follows the language', () => {
    const out = html(sol())!;
    assert.equal((out.match(/AI-LABEL/g) ?? []).length, 1);
    assert.ok(out.includes('direction="rtl"'));
    assert.ok(!html(sol(), false)!.includes('direction="rtl"'));
  });

  it('refuses a board with a solution when it has no labels to print', () => {
    // Not via `html(...)`: passing `undefined` to its defaulted parameter would apply the default labels.
    assert.equal(buildBoardHTML(boardFileOf(docWith(sol())), 't', true), null);
  });

  it('a board with no solution prints exactly as before', () => {
    const plain = buildBoardHTML(boardFileOf(docOf(['blank', [stroke('0.1,0.1 0.2,0.2')]])), 't', true)!;
    assert.ok(!plain.includes('<text'));
  });
});
