import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatBodyHTML, gridSvg, formatKeyExtraHTML, FORMAT_CSS } from '../formatPrintHtml.ts';
import { buildWorksheetHTML } from '../exportHtml.ts';
import { normalizePlotExpr } from '../ai/worksheetFormats.ts';

const WIN = { xMin: -4, xMax: 4, yMin: -5, yMax: 5 };

describe('format print HTML', () => {
  it('normalises bank notation for the plotter', () => {
    assert.equal(normalizePlotExpr('x² − 4'), 'x^2 - 4');
    assert.equal(normalizePlotExpr('−x + 3'), '-x + 3');
  });
  it('match prints a two-column table with a box per row', () => {
    const h = formatBodyHTML({ kind: 'match', stem: 's', left: ['2^x = 8', '3^x = 9'], right: ['2', '3'], pairs: [1, 0] }, true);
    assert.match(h, /<table class="fmt-match"/);
    assert.equal((h.match(/fmt-box/g) ?? []).length, 2);
  });
  it('match letters the answer column and never prints the pairing', () => {
    const h = formatBodyHTML({ kind: 'match', stem: 's', left: ['p1', 'p2'], right: ['a1', 'a2'], pairs: [1, 0] }, true);
    assert.match(h, /أ/);
    assert.match(h, /ب/);
    assert.match(h, /١\./, 'problems are numbered');
  });
  it('order prints lettered cards with a position box', () => {
    const h = formatBodyHTML({ kind: 'order', stem: 's', steps: ['a', 'b', 'c'], order: [1, 0, 2] }, true);
    assert.equal((h.match(/class="fmt-card"/g) ?? []).length, 3);
    assert.match(h, /أ\)/);
  });
  it('order on an English paper letters A B C', () => {
    const h = formatBodyHTML({ kind: 'order', stem: 's', steps: ['a', 'b'], order: [1, 0] }, false);
    assert.match(h, /A\)/);
    assert.match(h, /B\)/);
  });
  it('spot_error prints numbered steps and a place for the step number', () => {
    const h = formatBodyHTML({ kind: 'spot_error', stem: 's', steps: ['a', 'b', 'c'], wrongStep: 1, fix: 'FIXTEXT', why: 'WHYTEXT' }, true);
    assert.match(h, /<ol class="fmt-steps"/);
    assert.match(h, /رقم الخطوة الخاطئة/);
    assert.match(h, /التصحيح/);
    assert.equal((h.match(/class="q-rule"/g) ?? []).length, 2);
    assert.ok(!h.includes('FIXTEXT') && !h.includes('WHYTEXT'), 'neither fix nor why prints on the student copy');
  });
  it('graph prints an empty grid on the paper and the drawn curve in the key', () => {
    const f = { kind: 'graph' as const, stem: 's', exprs: ['x² − 4'], window: WIN };
    const paper = formatBodyHTML(f, true);
    assert.match(paper, /<svg/);
    assert.ok(!/<path|<polyline/.test(paper), 'no curve on the student copy');
    assert.match(formatKeyExtraHTML(f, true), /<polyline|<path/);
    assert.match(gridSvg(WIN, { isAr: true }), /٤/);
  });
  it('grid uses latin digits and x/y on an English paper, Arabic digits and س/ص on Arabic', () => {
    const en = gridSvg(WIN, { isAr: false });
    assert.match(en, />4</);
    assert.ok(!/[٠-٩]/.test(en));
    assert.match(en, />x</);
    const ar = gridSvg(WIN, { isAr: true });
    assert.match(ar, />س</);
    assert.match(ar, />ص</);
  });
  it('a constant expression is drawn as a flat line', () => {
    const k = formatKeyExtraHTML({ kind: 'graph', stem: 's', exprs: ['0'], window: WIN }, true);
    assert.match(k, /<polyline/);
  });
  it('points outside the window are dropped, splitting the polyline', () => {
    const k = formatKeyExtraHTML({ kind: 'graph', stem: 's', exprs: ['x^2'], window: { xMin: -4, xMax: 4, yMin: -1, yMax: 5 } }, true);
    assert.equal((k.match(/<polyline/g) ?? []).length, 1);
    const k2 = formatKeyExtraHTML({ kind: 'graph', stem: 's', exprs: ['4 - x^2'], window: { xMin: -4, xMax: 4, yMin: -2, yMax: 5 } }, true);
    // y < -2 for |x| > ~2.45 on both sides, so only the middle arc survives.
    assert.equal((k2.match(/<polyline/g) ?? []).length, 1);
    const k3 = formatKeyExtraHTML({ kind: 'graph', stem: 's', exprs: ['x^2'], window: { xMin: -4, xMax: 4, yMin: 1, yMax: 5 } }, true);
    assert.equal((k3.match(/<polyline/g) ?? []).length, 2, 'x^2 below y=1 is a gap in the middle');
  });
  it('key extra is empty for non-graph kinds', () => {
    assert.equal(formatKeyExtraHTML({ kind: 'order', stem: 's', steps: ['a'], order: [0] }, true), '');
  });
  it('bank notation in format text goes through the maths escaper', () => {
    const h = formatBodyHTML({ kind: 'order', stem: 's', steps: ['<b>x</b> 2^3'], order: [0] }, true);
    assert.ok(!h.includes('<b>x</b>'));
    assert.match(h, /&lt;b&gt;/);
  });

  it('the grid carries no SVG <text>: its labels are HTML laid over it (web PDF cut the grid off)', () => {
    for (const isAr of [true, false]) {
      const g = gridSvg(WIN, { isAr });
      const svg = g.slice(g.indexOf('<svg'), g.indexOf('</svg>'));
      assert.ok(!svg.includes('<text'), 'no text node inside the SVG');
      assert.match(g, /^<div class="fmt-grid-wrap"/);
      assert.ok((g.match(/class="g-lbl /g) ?? []).length >= 8, 'tick labels are spans');
      assert.match(g, /style="left:[\d.]+%;top:[\d.-]+%"/, 'positioned in percent, so they scale with the grid');
    }
  });
  it('a grid, and a key row carrying a graph, are never split across pages', () => {
    assert.match(FORMAT_CSS, /\.fmt-grid-wrap \{[^}]*break-inside: avoid; page-break-inside: avoid;/);
    assert.match(FORMAT_CSS, /\.answer-row\.ak-graph \{ break-inside: avoid; page-break-inside: avoid; \}/);
    const ws = { instructions: '', sections: [{ title: 'ارسم', questions: [{ text: 't', points: 2, format: { kind: 'graph', stem: 's', exprs: ['x'], window: WIN } }, { text: 'q', points: 1 }] }], answerKey: [{ num: 1, answer: '(0، 0)' }, { num: 2, answer: '3' }] } as any;
    const html = buildWorksheetHTML(ws, 't', { subject: 's', grade: 'g' }, true, [], true);
    assert.equal((html.match(/class="answer-row ak-graph"/g) ?? []).length, 1);
  });
  it('a multi-line problem keeps its line break in every format cell', () => {
    const two = 'أوجد حل النظام:\n3^x = 9^y\nx − y = 1';
    const cells = [
      formatBodyHTML({ kind: 'match', stem: 's', left: [two, 'p'], right: ['a', 'b'], pairs: [0, 1] }, true),
      formatBodyHTML({ kind: 'order', stem: 's', steps: [two, 'b'], order: [0, 1] }, true),
      formatBodyHTML({ kind: 'spot_error', stem: 's', steps: [two, 'b'], wrongStep: 1, fix: 'f', why: 'w' }, true),
    ];
    for (const h of cells) {
      assert.ok(!h.includes('\n'), 'no raw newline left for the layout to collapse');
      assert.equal((h.match(/<br>/g) ?? []).length, 2, h);
      assert.match(h, /1⁩<br>|1<br>|<br>⁦x − y = 1/);
    }
  });
  it('the key legend writes latin y = … with a swatch per curve, never «ص =»', () => {
    const k = formatKeyExtraHTML({ kind: 'graph', stem: 's', exprs: ['x² − 2x', 'x'], window: WIN }, true);
    const legend = k.slice(k.indexOf('fmt-legend'));
    assert.ok(!legend.includes('ص'), 'no ص beside a latin x');
    assert.match(legend, /y = x/);
    assert.match(legend, /class="fmt-curve fmt-curve-0"/);
    assert.match(legend, /class="fmt-curve fmt-curve-1"/);
    assert.equal((legend.match(/class="fmt-swatch"/g) ?? []).length, 2);
  });
});
