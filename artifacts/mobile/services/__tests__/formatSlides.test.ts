import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorksheetSlidesHTML } from '../exportHtml.ts';
import { buildDeckFromWorksheet } from '../classDeck.ts';
import { gridSvg } from '../formatPrintHtml.ts';
import { esc } from '../htmlEscape.ts';

const WIN = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };

const ws = {
  title: 't', instructions: '',
  sections: [
    { type: 'match', title: 'صِل', questions: [{ text: 'x', points: 2, format: { kind: 'match', stem: 'صِل', left: ['2^x = 8', '3^x = 9'], right: ['2', '3'], pairs: [1, 0] } }] },
    { type: 'graph', title: 'ارسم', questions: [{ text: 'y', points: 2, format: { kind: 'graph', stem: 'ارسم', exprs: ['x + 1'], window: WIN } }] },
    { type: 'order', title: 'رتّب', questions: [{ text: 'o', points: 2, format: { kind: 'order', stem: 'رتّب الخطوات', steps: ['ALPHASTEP', 'BETASTEP', 'GAMMASTEP'], order: [2, 0, 1] } }] },
    { type: 'spot_error', title: 'أين الخطأ؟', questions: [{ text: 's', points: 2, format: { kind: 'spot_error', stem: 'أين الخطأ؟', steps: ['S1TEXT', 'S2TEXT'], wrongStep: 1, fix: 'FIXTEXT', why: 'WHYTEXT' } }] },
  ],
  answerKey: [{ num: 1, answer: '١-ب، ٢-أ' }, { num: 2, answer: '(1 ، 2)' }, { num: 3, answer: 'ج، أ، ب' }, { num: 4, answer: 'الخطوة ٢' }],
} as any;

const meta = { subject: 's', grade: 'g' };

describe('formats on the projector', () => {
  it('slides export draws the same blocks as print', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.match(h, /fmt-match/);
    assert.match(h, /<svg/);
  });

  it('slides export carries the format CSS so the blocks are laid out', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.match(h, /\.fmt-match\s*\{/);
  });

  it('slides export prints the stem, not the plain-text question', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.match(h, /رتّب الخطوات/);
  });

  it('slides export with answers: the curve appears once, on the key slide', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.equal((h.match(/<polyline/g) ?? []).length, 1);
    assert.ok(h.indexOf('<polyline') > h.indexOf('مفتاح الإجابات'), 'the curve is after the key heading');
  });

  it('slides export without answers leaks nothing: no curve, no fix, no why', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    assert.ok(!/<polyline|<path/.test(h), 'no drawn curve');
    assert.ok(!h.includes('FIXTEXT') && !h.includes('WHYTEXT'));
    assert.match(h, /<svg/, 'the empty grid is still there');
  });

  it('slides export with answers still keeps fix and why off the question slides', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.ok(!h.includes('FIXTEXT') && !h.includes('WHYTEXT'));
  });

  it('live deck: one challenge slide per formatted question, in order', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(qs.length, 4);
    assert.deepEqual(qs.map(s => s.title), ['سؤال 1', 'سؤال 2', 'سؤال 3', 'سؤال 4']);
    assert.deepEqual(qs.map(s => s.answer), ['١-ب، ٢-أ', '(1 ، 2)', 'ج، أ، ب', 'الخطوة ٢']);
    assert.match(qs[0]!.content, /⟷/);
  });

  it('live deck: match is two blocks, left numbered and right lettered', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const c = deck.slides.filter(s => s.type === 'challenge')[0]!.content;
    assert.match(c, /^صِل/);
    assert.match(c, /١\) 2\^x = 8/);
    assert.match(c, /أ\) 2/);
    assert.match(c, /ب\) 3/);
  });

  it('live deck: order is lettered steps, spot_error numbered, graph the equations', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.match(qs[1]!.content, /ص = x \+ 1/);
    assert.match(qs[2]!.content, /أ\) ALPHASTEP/);
    assert.match(qs[2]!.content, /ج\) GAMMASTEP/);
    assert.match(qs[3]!.content, /١\) S1TEXT/);
    assert.match(qs[3]!.content, /٢\) S2TEXT/);
  });

  it('live deck content never carries the pairing, the order, the fix or the why', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.ok(!qs[0]!.content.includes('١-ب'), 'no pairing');
    // order: steps listed in the printed (shuffled) order, not the solution order.
    assert.ok(qs[2]!.content.indexOf('ALPHASTEP') < qs[2]!.content.indexOf('BETASTEP'));
    for (const s of qs) {
      assert.ok(!s.content.includes('FIXTEXT') && !s.content.includes('WHYTEXT'), 'no fix / why');
    }
  });

  it('live deck: the graph slide carries no plot before the reveal exists for it', () => {
    // presentation.tsx draws `visual` on every non-graph slide with no reveal
    // gate, so a plot on a challenge slide would show the answer on the class
    // screen. Until the presenter gates it, the slide must not carry one.
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(qs[1]!.visual, undefined);
  });

  it('live deck keeps outcomes[qNum-1] numbering: one slide per question', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const nums = deck.slides.filter(s => /^سؤال \d+$/.test(s.title)).length;
    assert.equal(nums, 4);
  });
});

describe('grid origin label', () => {
  it('draws the zero only when 0 is inside both ranges', () => {
    const zero = '>٠<';
    assert.ok(gridSvg(WIN, { isAr: true }).includes(zero));
    assert.ok(!gridSvg({ xMin: 1, xMax: 6, yMin: -3, yMax: 3 }, { isAr: true }).includes(zero), 'x range excludes 0');
    assert.ok(!gridSvg({ xMin: -3, xMax: 3, yMin: 2, yMax: 8 }, { isAr: true }).includes(zero), 'y range excludes 0');
    assert.ok(!gridSvg({ xMin: 1, xMax: 6, yMin: 2, yMax: 8 }, { isAr: false }).includes('>0<'));
  });
});

describe('htmlEscape', () => {
  it('is the same esc exportHtml re-exports', async () => {
    const mod = await import('../exportHtml.ts');
    assert.equal(mod.esc, esc);
  });
});
