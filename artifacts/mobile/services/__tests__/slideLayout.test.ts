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
    };
    for (const name of SLIDE_LAYOUTS) {
      assert.equal(resolveSlideLayout(samples[name])?.kind, name, `${name} should resolve`);
    }
  });
});
