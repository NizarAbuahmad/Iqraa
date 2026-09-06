/**
 * What these guard: the projector's math parser must never mangle a line it
 * does not fully understand. Every unrecognized construct must round-trip as
 * plain text — the failure mode is "looks like today", never "looks wrong".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hasRenderableMath,
  isolateForeignRuns,
  mathLineToHtml,
  mathLineToUnicode,
  parseMathLine,
  prettifySymPy,
  type MathNode,
} from '../mathRender.ts';

/** Reassemble text nodes to check nothing was dropped. */
function flat(nodes: MathNode[]): string {
  return nodes.map(n => {
    if (n.kind === 'text') return n.text;
    // A parenthesized exponent is stored without its parens; restore them so
    // the round-trip check compares like with like.
    if (n.kind === 'sup') {
      const exp = /^[+-]?[0-9٠-٩a-zA-Zسصعن]+$/u.test(n.exp) ? n.exp : `(${n.exp})`;
      return `${n.base}^${exp}`;
    }
    if (n.kind === 'frac') return `${flat(n.num)}/${flat(n.den)}`;
    return `√(${flat(n.body)})`;
  }).join('');
}

describe('parseMathLine — superscripts', () => {
  it('parses x^2 into a sup node', () => {
    const nodes = parseMathLine('3x^4 - 2x + 7');
    const sup = nodes.find(n => n.kind === 'sup');
    assert.deepEqual(sup, { kind: 'sup', base: 'x', exp: '4' });
  });

  it('keeps the coefficient out of the base', () => {
    const nodes = parseMathLine('12x^3');
    assert.deepEqual(nodes, [
      { kind: 'text', text: '12' },
      { kind: 'sup', base: 'x', exp: '3' },
    ]);
  });

  it('handles negative and parenthesized exponents', () => {
    assert.deepEqual(parseMathLine('x^-2'), [{ kind: 'sup', base: 'x', exp: '-2' }]);
    assert.deepEqual(parseMathLine('x^(n+1)'), [{ kind: 'sup', base: 'x', exp: 'n+1' }]);
  });

  it('supports Arabic variable letters', () => {
    const nodes = parseMathLine('٣س^٢');
    assert.deepEqual(nodes, [
      { kind: 'text', text: '٣' },
      { kind: 'sup', base: 'س', exp: '٢' },
    ]);
  });

  it('parses a parenthesized base', () => {
    assert.deepEqual(parseMathLine('(x+1)^2'), [{ kind: 'sup', base: '(x+1)', exp: '2' }]);
  });
});

describe('parseMathLine — fractions', () => {
  it('parses simple token fractions', () => {
    assert.deepEqual(parseMathLine('3/4'), [{
      kind: 'frac',
      num: [{ kind: 'text', text: '3' }],
      den: [{ kind: 'text', text: '4' }],
    }]);
  });

  it('parses parenthesized fractions recursively', () => {
    const nodes = parseMathLine('(x^2+1)/(x-1)');
    assert.equal(nodes.length, 1);
    const frac = nodes[0]!;
    assert.equal(frac.kind, 'frac');
    if (frac.kind === 'frac') {
      assert.ok(frac.num.some(n => n.kind === 'sup'), 'numerator keeps its superscript');
      assert.deepEqual(frac.den, [{ kind: 'text', text: 'x-1' }]);
    }
  });

  it('leaves date-like or wordy slashes alone', () => {
    // "ص/م" style abbreviations: single letters DO match, but a slash next to
    // a space or multi-word text must not become a fraction.
    const line = 'القسمة / الضرب';
    assert.deepEqual(parseMathLine(line), [{ kind: 'text', text: line }]);
  });
});

describe('parseMathLine — roots', () => {
  it('parses √(...) with nested content', () => {
    const nodes = parseMathLine('√(x^2 + 1)');
    assert.equal(nodes[0]!.kind, 'root');
    if (nodes[0]!.kind === 'root') {
      assert.ok(nodes[0]!.body.some(n => n.kind === 'sup'));
    }
  });

  it('parses sqrt(...) and bare √25', () => {
    assert.equal(parseMathLine('sqrt(16)')[0]!.kind, 'root');
    assert.deepEqual(parseMathLine('√25'), [
      { kind: 'root', body: [{ kind: 'text', text: '25' }] },
    ]);
  });
});

describe('parseMathLine — safety', () => {
  it('returns pure prose untouched as a single text node', () => {
    const line = 'اقرأ النص التالي ثم أجب عن الأسئلة';
    assert.deepEqual(parseMathLine(line), [{ kind: 'text', text: line }]);
  });

  it('never loses characters, whatever the input', () => {
    const lines = [
      '3x^4 - 2x + 7 → 12x^3 - 2',
      'حل المعادلة: س^2 + ٣س = ١٠',
      '(a+b)^2 = a^2 + 2ab + b^2',
      '√(3/4) + x^(n+1)',
      'نصف الصف (15/30 طالبًا)',
      'مثال: 1/2 + 1/3 = 5/6',
    ];
    for (const line of lines) {
      assert.equal(flat(parseMathLine(line)), line, `lost characters in: ${line}`);
    }
  });

  it('handles unbalanced parens without hanging or dropping text', () => {
    const line = 'أوجد (س عندما';
    assert.deepEqual(parseMathLine(line), [{ kind: 'text', text: line }]);
  });
});

describe('hasRenderableMath', () => {
  it('is true for equations, false for prose', () => {
    assert.equal(hasRenderableMath('12x^3 - 2'), true);
    assert.equal(hasRenderableMath('√(x+1)'), true);
    assert.equal(hasRenderableMath('اليوم سنتعلم درسًا جديدًا'), false);
  });
});

describe('prettifySymPy', () => {
  it('turns the verifier syntax into renderable notation', () => {
    // The exact string SymPy sends back for d/dx(x^3).
    assert.equal(prettifySymPy('3*x**2'), '3x^2');
    assert.equal(prettifySymPy('12*x**3 - 2'), '12x^3 - 2');
  });

  it('keeps real numeric multiplication visible', () => {
    assert.equal(prettifySymPy('2*3'), '2×3');
  });

  it('drops the star before a parenthesized factor', () => {
    assert.equal(prettifySymPy('2*(x + 1)'), '2(x + 1)');
  });
});

describe('mathLineToHtml', () => {
  it('renders a superscript with a <sup> tag', () => {
    assert.equal(mathLineToHtml('x^2'), 'x<sup>2</sup>');
  });

  it('renders a fraction as nested spans, recursively', () => {
    const html = mathLineToHtml('(x^2+1)/(x-1)');
    assert.match(html, /class="mfrac"/);
    assert.match(html, /<sup>2<\/sup>/, 'numerator keeps its own superscript');
  });

  it('escapes HTML-significant characters in plain text', () => {
    assert.equal(mathLineToHtml('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
  });

  it('leaves prose as escaped plain text, no markup', () => {
    assert.equal(mathLineToHtml('اشرح الفكرة'), 'اشرح الفكرة');
  });
});

describe('mathLineToUnicode', () => {
  it('turns a numeric exponent into a real Unicode superscript', () => {
    assert.equal(mathLineToUnicode('12x^3 - 2'), '12x³ - 2');
  });

  it('falls back to ^exp notation for exponents with no superscript coverage', () => {
    // 'k' has no Unicode superscript in this map — must not silently drop it.
    assert.equal(mathLineToUnicode('x^k'), 'x^k');
  });

  it('prints fractions and roots in parenthesized plain-text form', () => {
    assert.equal(mathLineToUnicode('3/4'), '(3)/(4)');
    assert.equal(mathLineToUnicode('√25'), '√(25)');
  });

  it('round-trips prose untouched', () => {
    const line = 'اليوم سنتعلم درسًا جديدًا';
    assert.equal(mathLineToUnicode(line), line);
  });
});

describe('isolateForeignRuns', () => {
  it('wraps each Latin/math run embedded in Arabic prose in bidi isolates', () => {
    const out = isolateForeignRuns('إذا كان f(x) = 2x + 3 و g(x) = x²');
    assert.equal(out, 'إذا كان ⁦f(x) = 2x + 3⁩ و ⁦g(x) = x²⁩');
  });

  it('leaves pure Arabic prose untouched — no isolates inserted', () => {
    const line = 'اشرح الفكرة بأسلوب بسيط';
    assert.equal(isolateForeignRuns(line), line);
  });

  it('never drops or reorders characters — stripping the isolates recovers the original', () => {
    const original = 'قيمة x عند f(x) = 2x + 3 هي 11، فإن (f∘g)(x) يساوي: (1 نقطة)';
    const wrapped = isolateForeignRuns(original);
    const stripped = wrapped.replace(/[⁦⁩]/g, '');
    assert.equal(stripped, original);
  });

  it('handles an empty line', () => {
    assert.equal(isolateForeignRuns(''), '');
  });

  // The two lines from the slide that shipped scrambled to a projector:
  // «f(x) = 2x⁴ - x² + 3» rendered as «x⁴f(x) = 2 - x² + 3», and the «t²»
  // of «5t²» was carried off to the next line on its own.
  it('keeps a polynomial with unicode superscripts whole', () => {
    const out = isolateForeignRuns(
      'إيجاد مشتقة الاقترانات الآتية: f(x) = 2x⁴ - x² + 3، و g(x) = 5x³',
    );
    assert.equal(
      out,
      'إيجاد مشتقة الاقترانات الآتية: ⁦f(x) = 2x⁴ - x² + 3⁩، و ⁦g(x) = 5x³⁩',
    );
  });

  it('keeps a displacement formula whole, trailing squared term included', () => {
    const out = isolateForeignRuns('السرعة اللحظية باستخدام s(t) = 80t - 5t²');
    assert.equal(out, 'السرعة اللحظية باستخدام ⁦s(t) = 80t - 5t²⁩');
  });

  it('isolates subscripts and comparisons as one run, not three', () => {
    assert.equal(isolateForeignRuns('حيث x₁ ≤ 5'), 'حيث ⁦x₁ ≤ 5⁩');
  });

  // A run only earns an isolate when it could actually be reordered. These
  // three were caught by the export suite: isolating them split «أ.» into
  // «أ⁦.⁩» and cut the page out of a «ص 45» citation.
  it('leaves a bare number alone — bidi already places it correctly', () => {
    assert.equal(isolateForeignRuns('انظر صفحة 45'), 'انظر صفحة 45');
  });

  it('leaves standalone punctuation alone', () => {
    assert.equal(isolateForeignRuns('أ. الوقت'), 'أ. الوقت');
  });

  it('still isolates a number once an operator joins it', () => {
    assert.equal(isolateForeignRuns('احسب 2 + 3'), 'احسب ⁦2 + 3⁩');
  });
});
