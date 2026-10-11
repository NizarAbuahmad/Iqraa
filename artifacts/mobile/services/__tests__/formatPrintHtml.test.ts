import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatBodyHTML, gridSvg, formatKeyExtraHTML } from '../formatPrintHtml.ts';
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
});
