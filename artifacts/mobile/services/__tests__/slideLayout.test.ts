/**
 * Which shape a slide gets drawn in, and — more importantly — when it quietly
 * gives up and gets drawn the ordinary way.
 *
 * The falling-back half is the point. A slide that half-renders a comparison
 * or shows a statistic with no number does it on a wall in front of a class,
 * where nobody can fix it. Every case below that expects `null` is a case
 * where the ordinary layout is the better outcome.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/slideLayout.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSlideLayout, SLIDE_LAYOUTS } from '../slideLayout.ts';
import type { ActivitySlide } from '../ai/AIService.ts';
import { payloadLines, MAX_FLOW_NODES, MAX_STATS, MAX_TABLE_ROWS, MAX_TIMELINE_EVENTS } from '../slideLayout.ts';

const slide = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 1, type: 'intro', title: 'عنوان', content: '', durationSeconds: 0, ...over,
});

describe('resolveSlideLayout — no layout asked for', () => {
  it('returns null for an ordinary slide', () => {
    assert.equal(resolveSlideLayout(slide({ content: '• سطر\n• سطر' })), null);
  });

  it('returns null for a layout name it does not know', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'carousel' as never })), null);
  });
});

describe('statement', () => {
  it('takes a single short line', () => {
    const out = resolveSlideLayout(slide({ layout: 'statement', content: 'الكسر جزء من كلّ' }));
    assert.deepEqual(out, { kind: 'statement', text: 'الكسر جزء من كلّ' });
  });

  it('strips a bullet the model left on', () => {
    const out = resolveSlideLayout(slide({ layout: 'statement', content: '• الكسر جزء من كلّ' }));
    assert.equal(out?.kind === 'statement' && out.text, 'الكسر جزء من كلّ');
  });

  it('falls back when it is really a list', () => {
    // A statement slide set in display type, holding three bullets, is worse
    // than the ordinary slide it replaced.
    assert.equal(resolveSlideLayout(slide({ layout: 'statement', content: '• أ\n• ب\n• ج' })), null);
  });

  it('falls back on a paragraph', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'statement', content: 'ن'.repeat(200) })), null);
  });

  it('falls back on empty content', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'statement', content: '   ' })), null);
  });
});

describe('stat', () => {
  it('takes a figure and its label', () => {
    const out = resolveSlideLayout(slide({
      layout: 'stat', stat: { value: '٩٫٨', label: 'متر/ثانية² تسارع الجاذبية' },
    }));
    assert.deepEqual(out, { kind: 'stat', value: '٩٫٨', label: 'متر/ثانية² تسارع الجاذبية' });
  });

  it('keeps a source when one is given', () => {
    const out = resolveSlideLayout(slide({
      layout: 'stat', stat: { value: '3', label: 'قوانين نيوتن', source: 'الكتاب المدرسي' },
    }));
    assert.equal(out?.kind === 'stat' && out.source, 'الكتاب المدرسي');
  });

  it('falls back with no figure — that is just a big heading', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'stat', stat: { value: '', label: 'شيء' } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'stat' })), null);
  });

  it('falls back with no label — a number nobody can read', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'stat', stat: { value: '70%', label: '' } })), null);
  });

  it('falls back when the figure is too long to set large', () => {
    const out = resolveSlideLayout(slide({
      layout: 'stat', stat: { value: '١٢٣٤٥٦٧٨٩٠١٢٣٤٥', label: 'رقم طويل' },
    }));
    assert.equal(out, null);
  });
});

describe('compare', () => {
  const good = {
    leftTitle: 'قبل', left: ['كان بطيئًا'],
    rightTitle: 'بعد', right: ['صار أسرع', 'وأوضح'],
  };

  it('takes two titled columns', () => {
    const out = resolveSlideLayout(slide({ layout: 'compare', compare: good }));
    assert.equal(out?.kind, 'compare');
    assert.equal(out?.kind === 'compare' && out.right.length, 2);
  });

  it('strips bullets the model left on either side', () => {
    const out = resolveSlideLayout(slide({
      layout: 'compare', compare: { ...good, left: ['• كان بطيئًا'] },
    }));
    assert.equal(out?.kind === 'compare' && out.left[0], 'كان بطيئًا');
  });

  it('falls back when one side is empty — that is not a comparison', () => {
    assert.equal(resolveSlideLayout(slide({
      layout: 'compare', compare: { ...good, right: [] },
    })), null);
  });

  it('falls back when a column has no heading', () => {
    assert.equal(resolveSlideLayout(slide({
      layout: 'compare', compare: { ...good, rightTitle: '' },
    })), null);
  });

  it('falls back when the payload is missing entirely', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'compare' })), null);
  });
});

describe('steps', () => {
  it('numbers the bulleted lines', () => {
    const out = resolveSlideLayout(slide({
      layout: 'steps', content: '• اقرأ السؤال\n• استخرج المعطيات\n• احسب',
    }));
    assert.deepEqual(out, { kind: 'steps', steps: ['اقرأ السؤال', 'استخرج المعطيات', 'احسب'] });
  });

  it('falls back on a single step — numbering one line is noise', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'steps', content: '• خطوة واحدة' })), null);
  });

  it('falls back on prose that was never a sequence', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'steps', content: 'فقرة بلا خطوات' })), null);
  });
});

describe('SLIDE_LAYOUTS', () => {
  it('every advertised layout can actually resolve', () => {
    // A layout the prompt may ask for but nothing can draw would render as an
    // ordinary slide forever, invisibly.
    const samples: Record<(typeof SLIDE_LAYOUTS)[number], ActivitySlide> = {
      statement: slide({ layout: 'statement', content: 'جملة' }),
      stat: slide({ layout: 'stat', stat: { value: '3', label: 'قوانين' } }),
      compare: slide({
        layout: 'compare',
        compare: { leftTitle: 'أ', left: ['١'], rightTitle: 'ب', right: ['٢'] },
      }),
      steps: slide({ layout: 'steps', content: '• أ\n• ب' }),
      timeline: slide({
        layout: 'timeline',
        timeline: [{ label: '١', text: 'أ' }, { label: '٢', text: 'ب' }, { label: '٣', text: 'ج' }],
      }),
      stats: slide({ layout: 'stats', stats: [{ value: '٣', label: 'أ' }, { value: '٤', label: 'ب' }] }),
      table: slide({ layout: 'table', table: { headers: ['أ', 'ب'], rows: [['١', '٢'], ['٣', '٤']] } }),
      flow: slide({ layout: 'flow', flow: { steps: ['أ', 'ب', 'ج'] } }),
    };
    for (const name of SLIDE_LAYOUTS) {
      assert.equal(resolveSlideLayout(samples[name])?.kind, name, `${name} should resolve`);
    }
  });
});

import { inlineSteps } from '../slideLayout.ts';

describe('inlineSteps', () => {
  it('reads the book’s one-line procedure as its steps, dropping the lead-in', () => {
    assert.deepEqual(
      inlineSteps('الخطوات: 1) عزل y من المعادلة الخطية 2) تعويضه في التربيعية 3) حل المعادلة الناتجة 4) إيجاد y لكل x'),
      ['عزل y من المعادلة الخطية', 'تعويضه في التربيعية', 'حل المعادلة الناتجة', 'إيجاد y لكل x'],
    );
  });

  it('accepts a bullet, a full stop as the marker, and Arabic-Indic digits', () => {
    assert.deepEqual(inlineSteps('• ١) اقرأ ٢) احسب ٣) تحقّق'), ['اقرأ', 'احسب', 'تحقّق']);
    assert.deepEqual(inlineSteps('1. read 2. solve 3. check'), ['read', 'solve', 'check']);
  });

  it('strips the separators left between steps', () => {
    assert.deepEqual(inlineSteps('1) اقرأ؛ 2) احسب، 3) تحقّق.'), ['اقرأ', 'احسب', 'تحقّق.']);
  });

  it('is not fooled by numbers that are not markers', () => {
    assert.equal(inlineSteps('طاقة المستوى E = −13.6 / n² حيث f(2) = 5 و n = 3'), null);
  });

  it('refuses two numbered clauses — a pair is not a process', () => {
    assert.equal(inlineSteps('1) اقرأ 2) احسب'), null);
  });

  it('refuses markers that do not count 1, 2, 3 in order', () => {
    assert.equal(inlineSteps('1) اقرأ 3) احسب 4) تحقّق'), null);
    assert.equal(inlineSteps('2) اقرأ 3) احسب 4) تحقّق'), null);
  });

  it('refuses a long lead-in, which is prose and not a label', () => {
    assert.equal(inlineSteps('لحل أي نظام من هذا النوع نتبع ما يلي بالترتيب: 1) أ 2) ب 3) ج'), null);
  });

  it('refuses a step with nothing in it', () => {
    assert.equal(inlineSteps('1) اقرأ 2)  3) تحقّق'), null);
  });
});

describe('timeline', () => {
  const ev = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `١٩٠${i}`, text: `حدث ${i + 1}` }));

  it('takes three to six events with a label and a description each', () => {
    const out = resolveSlideLayout(slide({ layout: 'timeline', timeline: ev(4) }));
    assert.equal(out?.kind, 'timeline');
    assert.equal(out && out.kind === 'timeline' ? out.events.length : 0, 4);
  });

  it('trims, strips a bullet, and reads a numeric label as text', () => {
    const out = resolveSlideLayout(slide({
      layout: 'timeline',
      timeline: [{ label: 1948 as never, text: '  • بدأ  ' }, ...ev(2)],
    }));
    assert.deepEqual(out && out.kind === 'timeline' ? out.events[0] : null, { label: '1948', text: 'بدأ' });
  });

  it('refuses a pair, and a list too long to read as a line', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: ev(2) })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: ev(MAX_TIMELINE_EVENTS + 1) })), null);
  });

  it('refuses the whole timeline when one event is missing its date or its words', () => {
    // Dropping the bad one would quietly turn a sequence into a different sequence.
    const bad = [...ev(3), { label: '', text: 'بلا تاريخ' }];
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: bad })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: [...ev(3), { label: 'س', text: '' }] })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: [...ev(3), null as never] })), null);
  });

  it('refuses an over-long label or description, and a payload that is not a list', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: [...ev(3), { label: 'x'.repeat(25), text: 'ن' }] })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: [...ev(3), { label: 'س', text: 'x'.repeat(121) }] })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline', timeline: 'many' as never })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'timeline' })), null);
  });
});

describe('stats', () => {
  const st = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `${10 * (i + 1)}%`, label: `بند ${i + 1}` }));

  it('takes two to four figures', () => {
    for (const n of [2, 3, MAX_STATS]) {
      const out = resolveSlideLayout(slide({ layout: 'stats', stats: st(n) }));
      assert.equal(out && out.kind === 'stats' ? out.items.length : 0, n);
    }
  });

  it('reads a bare number as the figure it is', () => {
    const out = resolveSlideLayout(slide({ layout: 'stats', stats: [{ value: 1969 as never, label: 'سنة' }, ...st(1)] }));
    assert.equal(out && out.kind === 'stats' ? out.items[0]!.value : null, '1969');
  });

  it('refuses one figure (that is `stat`), five, and any item without a short value and a label', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'stats', stats: st(1) })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'stats', stats: st(MAX_STATS + 1) })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'stats', stats: [...st(2), { value: '', label: 'x' }] })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'stats', stats: [...st(2), { value: '5', label: '' }] })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'stats', stats: [...st(2), { value: '1,234,567,890,123', label: 'x' }] })), null);
  });
});

describe('table', () => {
  const table = { headers: ['الدولة', 'العاصمة'], rows: [['الأردن', 'عمّان'], ['مصر', 'القاهرة'], ['لبنان', 'بيروت']] };

  it('takes a grid with a cell under every header', () => {
    const out = resolveSlideLayout(slide({ layout: 'table', table }));
    assert.deepEqual(out, { kind: 'table', headers: table.headers, rows: table.rows });
  });

  it('reads numbers in cells as their text', () => {
    const out = resolveSlideLayout(slide({
      layout: 'table', table: { headers: ['السنة', 'العدد'], rows: [[2020 as never, 15 as never], ['2021', '18']] },
    }));
    assert.deepEqual(out && out.kind === 'table' ? out.rows[0] : null, ['2020', '15']);
  });

  it('refuses a row that is short or long — padding it would shift values under the wrong heading', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: [...table.rows, ['فقط']] } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: [...table.rows, ['أ', 'ب', 'ج']] } })), null);
  });

  it('refuses a blank cell or header, too few or too many columns and rows, or a non-grid', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: [['أ', ''], ['ب', 'ج']] } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, headers: ['وحيد'] , rows: [['أ'], ['ب']] } })), null);
    const wide = { headers: ['1', '2', '3', '4', '5'], rows: [['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e']] };
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: wide })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: [table.rows[0]!] } })), null);
    const tall = Array.from({ length: MAX_TABLE_ROWS + 1 }, () => ['أ', 'ب']);
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: tall } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'table', table: { ...table, rows: 'x' as never } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'table' })), null);
  });
});

describe('flow', () => {
  const nodes = ['تبخّر', 'تكاثف', 'هطول', 'جريان'];

  it('takes three to six nodes, and remembers whether it loops', () => {
    assert.deepEqual(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: nodes } })), { kind: 'flow', nodes, cycle: false });
    assert.equal(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: nodes, cycle: true } }))?.kind, 'flow');
    const out = resolveSlideLayout(slide({ layout: 'flow', flow: { steps: nodes, cycle: true } }));
    assert.equal(out && out.kind === 'flow' ? out.cycle : null, true);
  });

  it('only a literal true loops it — a string "false" must not', () => {
    const out = resolveSlideLayout(slide({ layout: 'flow', flow: { steps: nodes, cycle: 'false' as never } }));
    assert.equal(out && out.kind === 'flow' ? out.cycle : null, false);
  });

  it('refuses two nodes, seven, a blank node, or an over-long one', () => {
    assert.equal(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: ['أ', 'ب'] } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: Array.from({ length: MAX_FLOW_NODES + 1 }, (_, i) => `ن${i}`) } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: [...nodes, ' '] } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'flow', flow: { steps: [...nodes, 'x'.repeat(61)] } })), null);
    assert.equal(resolveSlideLayout(slide({ layout: 'flow' })), null);
  });
});

describe('payloadLines — a refused layout still leaves the teacher the words', () => {
  it('turns each payload into bullet-ready lines', () => {
    assert.deepEqual(payloadLines(slide({ timeline: [{ label: '١٩٤٨', text: 'حدث' }] })), ['١٩٤٨ — حدث']);
    assert.deepEqual(payloadLines(slide({ stats: [{ value: '40%', label: 'سكن' }] })), ['40% — سكن']);
    assert.deepEqual(payloadLines(slide({ flow: { steps: ['أ', 'ب'] } })), ['أ', 'ب']);
    assert.deepEqual(
      payloadLines(slide({ table: { headers: ['س', 'ص'], rows: [['١', '٢']] } })),
      ['س: ١ — ص: ٢'],
    );
  });

  it('survives junk instead of throwing', () => {
    assert.deepEqual(payloadLines(slide({ timeline: [null, { label: 5 }] as never, stats: 'x' as never })), []);
    assert.deepEqual(payloadLines(slide()), []);
  });
});
