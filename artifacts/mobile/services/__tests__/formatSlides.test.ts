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
  answerKey: [
    { num: 1, answer: '١-ب، ٢-أ' },
    { num: 2, answer: '(1 ، 2)' },
    { num: 3, answer: 'ج، أ، ب', solution: ['SOLSTEP-A', 'SOLSTEP-B', 'SOLSTEP-C'] },
    { num: 4, answer: 'الخطوة ٢: FIXTEXT\nWHYTEXT', solution: ['S1TEXT', 'FIXTEXT'] },
  ],
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

  it('slides export without answers leaks nothing: no curve, no fix, no why, no working', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    assert.ok(!/<polyline|<path/.test(h), 'no drawn curve');
    for (const secret of ['FIXTEXT', 'WHYTEXT', 'SOLSTEP-A', 'SOLSTEP-B']) {
      assert.ok(!h.includes(secret), `${secret} must not appear`);
    }
    assert.match(h, /<svg/, 'the empty grid is still there');
  });

  it('slides export with answers: the key slide carries each solution, nothing earlier does', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    const keyAt = h.indexOf('مفتاح الإجابات');
    assert.ok(keyAt > 0);
    for (const shown of ['SOLSTEP-A', 'SOLSTEP-C', 'WHYTEXT', 'FIXTEXT']) {
      assert.ok(h.includes(shown), `${shown} is on the key slide`);
      assert.ok(h.indexOf(shown) > keyAt, `${shown} is not before the key slide`);
    }
    assert.match(h, /<ol class="solution">/);
  });

  it('key rows map by num, not by position in answerKey', () => {
    const shuffled = { ...ws, answerKey: [...ws.answerKey].reverse() };
    const h = buildWorksheetSlidesHTML(shuffled, 't', meta, true);
    const rows = h.split('<div class="ak-row').slice(1);
    const row = (n: number) => rows.find(r => r.includes(`<span class="ak-num">${n}.</span>`))!;
    assert.match(row(2), /<polyline/, 'the curve sits on the graph row');
    for (const n of [1, 3, 4]) assert.ok(!/<polyline/.test(row(n)), `row ${n} has no curve`);
    assert.match(row(3), /SOLSTEP-A/);
    assert.ok(!row(4).includes('SOLSTEP-A'));
    assert.match(row(4), /WHYTEXT/);
  });

  it('live deck: one challenge slide per formatted question, in order', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(qs.length, 4);
    assert.deepEqual(qs.map(s => s.title), ['سؤال 1', 'سؤال 2', 'سؤال 3', 'سؤال 4']);
    assert.deepEqual(qs.map(s => s.answer?.split('\n')[0]), ['١-ب، ٢-أ', '(1 ، 2)', 'ج، أ، ب', 'الخطوة ٢: FIXTEXT']);
  });

  it('live deck: match is two blocks, no row pairs a problem with an answer', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const c = deck.slides.filter(s => s.type === 'challenge')[0]!.content;
    assert.match(c, /^صِل/);
    assert.ok(!c.includes('⟷'), 'no arrow joining left to right');
    const lines = c.split('\n');
    assert.ok(lines.includes('١) 2^x = 8') && lines.includes('٢) 3^x = 9'), 'numbered problems');
    assert.ok(lines.includes('أ) 2') && lines.includes('ب) 3'), 'lettered answers');
    const blank = lines.lastIndexOf('');
    assert.ok(blank > lines.indexOf('٢) 3^x = 9') && blank < lines.indexOf('أ) 2'), 'a blank line separates the blocks');
    assert.ok(lines.every(l => !(/^[١٢]\)/.test(l) && /[أب]\)/.test(l))), 'never both on one line');
  });

  it('live deck: order is lettered steps, spot_error numbered, graph the equations', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.match(qs[1]!.content, /^y = x \+ 1$/m, 'an equation the stem lacks is added, in the paper\'s latin');
    assert.ok(!qs[1]!.content.includes('ص'), 'never «ص = x»');
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

  it('live deck: the graph slide carries its plot, held back until the reveal', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    const v = qs[1]!.visual;
    assert.equal(v?.kind, 'plot');
    assert.ok(v?.kind === 'plot' && v.series.length === 1 && v.series[0]!.points.length > 0, 'non-empty series');
    assert.equal(qs[1]!.visualOnReveal, true, 'the presenter must not draw it before the reveal');
    for (const i of [0, 2, 3]) {
      assert.equal(qs[i]!.visual, undefined);
      assert.equal(qs[i]!.visualOnReveal, undefined);
    }
  });

  it('live deck: order and spot_error reveal the key answer then its working, line by line', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(qs[2]!.answer, 'ج، أ، ب\nSOLSTEP-A\nSOLSTEP-B\nSOLSTEP-C');
    assert.equal(qs[3]!.answer, 'الخطوة ٢: FIXTEXT\nWHYTEXT\nS1TEXT\nFIXTEXT');
    assert.ok(!qs[2]!.answer!.includes('→'), 'plain lines, not a working chain');
    // Match and graph keep the bare key answer; the teacher tip keeps it too.
    assert.equal(qs[0]!.answer, '١-ب، ٢-أ');
    assert.equal(qs[2]!.teacher?.expectedAnswer, 'ج، أ، ب');
    // The deck-level key list stays one short line per question.
    assert.equal(deck.answerKey[2], 'سؤال 3: ج، أ، ب');
  });

  it('live deck: a constant graph expression still gives a series with points', () => {
    const zero = { ...ws, sections: [{ type: 'graph', title: 'g', questions: [{ text: 'k', points: 1, format: { kind: 'graph', stem: 's', exprs: ['0'], window: WIN } }] }], answerKey: [{ num: 1, answer: 'y=0' }] };
    const slide = buildDeckFromWorksheet(zero, 't', true).slides.find(s => s.type === 'challenge')!;
    assert.equal(slide.visual?.kind, 'plot');
    assert.ok(slide.visual?.kind === 'plot' && slide.visual.series[0]!.points.length > 0);
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

describe('fix round 1 (2026-10-11 drive)', () => {
  const graphWs = (stem: string, exprs: string[]) => ({
    title: 't', instructions: '',
    sections: [{ type: 'graph', title: 'ارسم', questions: [{ text: stem, points: 2, format: { kind: 'graph', stem, exprs, window: WIN } }] }],
    answerKey: [{ num: 1, answer: '(0 ، 0) و (3 ، 3)' }],
  }) as any;

  it('live deck: equations already in the stem are not repeated', () => {
    const stem = 'ارسم في المستوى الإحداثي ثم أجب:\nأوجد حلول النظام:\ny = x² − 2x\ny = x';
    const c = buildDeckFromWorksheet(graphWs(stem, ['x² − 2x', 'x']), 't', true).slides.find(s => s.type === 'challenge')!.content;
    assert.equal((c.match(/y = x² − 2x/g) ?? []).length, 1);
    assert.equal(c.split('\n').filter(l => l.trim() === 'y = x').length, 1);
    assert.ok(!c.includes('ص'));
    // Spacing and notation do not count as a different equation.
    const c2 = buildDeckFromWorksheet(graphWs('ارسم:\ny=x^2-2x', ['x² − 2x']), 't', true).slides.find(s => s.type === 'challenge')!.content;
    assert.equal(c2.split('\n').filter(l => /y/.test(l)).length, 1);
  });

  it('slides export: a long key flows onto as many key slides as it needs, every row on one', () => {
    const sol = ['first working line', 'second working line', 'third working line', 'fourth working line', 'fifth working line'];
    const n = 14;
    const long = {
      title: 't', instructions: '',
      sections: [{ type: 'short_answer', title: 'س', questions: [
        ...Array.from({ length: n - 1 }, (_, i) => ({ text: `q${i}`, points: 1 })),
        { text: 'g', points: 2, format: { kind: 'graph', stem: 'ارسم', exprs: ['x'], window: WIN } },
      ] }],
      answerKey: Array.from({ length: n }, (_, i) => ({ num: i + 1, answer: `ANS${i + 1}`, ...(i < n - 1 ? { solution: sol } : {}) })),
    } as any;
    const h = buildWorksheetSlidesHTML(long, 't', meta, true);
    const keySlides = h.split('<div class="slide">').filter(sl => sl.includes('<div class="ak-grid">'));
    assert.ok(keySlides.length > 1, `${keySlides.length} key slides`);
    for (let i = 1; i <= n; i++) {
      assert.equal(keySlides.filter(sl => sl.includes(`>ANS${i}<`) || sl.includes(`ANS${i}⁩`)).length, 1, `row ${i} on exactly one key slide`);
    }
    // The footer total counts every key slide.
    const total = Number(/\d+ \/ (\d+)/.exec(h)![1]);
    assert.equal((h.match(/<div class="slide[ "]/g) ?? []).length, total);
  });

  it('slides export: a short key stays on one slide', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.equal(h.split('<div class="slide">').filter(sl => sl.includes('<div class="ak-grid">')).length, 1);
  });

  it('slides export: the empty grid is its own full-width row, at projector size', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    assert.match(h, /<div class="fmt-grid-row"><div class="fmt-grid-wrap"/);
    assert.match(h, /\.q-card \.fmt-grid-row \{ width:100%; \}/);
    assert.match(h, /\.q-card \.fmt-grid-wrap \{ width:400px !important; \}/);
    assert.ok(!/\.q-card \.fmt-grid \{ max-height/.test(h), 'no 200px cap');
  });

  it('key answers keep their line breaks on the slide', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', meta, true);
    assert.match(h, /FIXTEXT⁩?<br>⁦?WHYTEXT/);
  });
});

describe('the live deck\'s answer summary', () => {
  it('keeps a multi-line answer on its question\'s line', () => {
    // أين الخطأ؟'s answer is «الخطوة N: fix» with the reason on the next line;
    // read line by line, the reason used to stand alone under no question.
    const deck = buildDeckFromWorksheet(ws, 't', true);
    assert.equal(deck.answerKey.length, 4);
    for (const line of deck.answerKey) {
      assert.ok(!line.includes('\n'), line);
      assert.match(line, /^سؤال \d+: /);
    }
    assert.match(deck.answerKey[3]!, /FIXTEXT.*WHYTEXT/);
  });
});
