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
  groupRtlSegments,
  groupLtrSegments,
  bindOperators,
  isArabicLed,
  isLatinProseLine,
  normalizeExponents,
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

  // The chemistry export bug. «N₂ + H₂ → NH₃» used to become TWO isolates with
  // the arrow stranded between them in the RTL flow, so the three pieces laid
  // out right to left and the page printed «NH₃ → N₂ + H₂» — the reverse
  // reaction. Verified in a browser: the stored string was right, the display
  // was mirrored. One isolate keeps the whole equation in reading order.
  it('keeps a reaction equation in ONE isolate, arrow inside it', () => {
    assert.equal(
      isolateForeignRuns('وازن المعادلة الآتية: N₂ + H₂ → NH₃'),
      'وازن المعادلة الآتية: ⁦N₂ + H₂ → NH₃⁩',
    );
  });

  it('never leaves an arrow stranded between two isolates', () => {
    const out = isolateForeignRuns('CH₄ + 2O₂ → CO₂ + 2H₂O');
    assert.ok(!/⁩\s*[→←↔⇒⇌]\s*⁦/.test(out), `arrow stranded: ${out}`);
    assert.equal(out, '⁦CH₄ + 2O₂ → CO₂ + 2H₂O⁩');
  });

  it('handles every arrow style a reaction can use, including two-way', () => {
    for (const arrow of ['→', '⇌', '↔', '⇒', '⟶']) {
      const out = isolateForeignRuns(`تفاعل: N₂ + 3H₂ ${arrow} 2NH₃`);
      assert.equal(out, `تفاعل: ⁦N₂ + 3H₂ ${arrow} 2NH₃⁩`, `arrow ${arrow}`);
    }
  });

  it('keeps a multi-step chain whole', () => {
    assert.equal(isolateForeignRuns('S → SO₂ → SO₃'), '⁦S → SO₂ → SO₃⁩');
  });

  it('stripping the isolates still recovers the original for a reaction', () => {
    const original = 'ما نوع التفاعل الآتي: CaO + CO₂ → CaCO₃؟';
    assert.equal(isolateForeignRuns(original).replace(/[⁦⁩]/g, ''), original);
  });

  // The arrow is interior-only on purpose. At the edge of a Latin word and
  // Arabic prose it was already laid out correctly, so absorbing it would
  // change output that had nothing wrong with it.
  // The chemistry worksheet bug, found by printing one. An isolate is laid out
  // on its own, so a bracket inside it cannot pair with its partner outside:
  // «(الكتلة المولية 44 g/mol)» printed its closing bracket inside the Latin
  // run, and «CO₂. (C = 12، O = 16)» — the Arabic comma ends a run — printed
  // as «O = 16) ،CO₂. (C = 12». An unpaired bracket stays in the Arabic flow.
  it('leaves a closing bracket opened in the Arabic outside the isolate', () => {
    assert.equal(
      isolateForeignRuns('(الكتلة المولية 44 g/mol)'),
      '(الكتلة المولية ⁦44 g/mol⁩)',
    );
  });

  it('keeps a bracket split by an Arabic comma in the Arabic flow', () => {
    assert.equal(
      isolateForeignRuns('أوجد الكتلة المولية لـ CO₂. (C = 12، O = 16)'),
      'أوجد الكتلة المولية لـ ⁦CO₂.⁩ (⁦C = 12⁩، ⁦O = 16⁩)',
    );
  });

  it('still keeps a balanced bracket inside its run', () => {
    assert.equal(isolateForeignRuns('صيغة Ca(OH)₂ هنا'), 'صيغة ⁦Ca(OH)₂⁩ هنا');
  });

  it('stripping the isolates recovers a line with unpaired brackets', () => {
    const original = 'لـ Ca(OH)₂. (Ca = 40، O = 16، H = 1)؟ (الكتلة 74 g/mol)';
    assert.equal(isolateForeignRuns(original).replace(/[⁦⁩]/g, ''), original);
  });

  it('does not pull an edge arrow into the isolate', () => {
    assert.equal(isolateForeignRuns('Wi-Fi → الإعدادات'), '⁦Wi-Fi⁩ → الإعدادات');
  });

  it('leaves an arrow in pure Arabic prose alone', () => {
    const line = 'الخطوة الأولى → الخطوة الثانية';
    assert.equal(isolateForeignRuns(line), line);
  });

  it('leaves a bare-number arrow alone — no Latin, no operator', () => {
    assert.equal(isolateForeignRuns('من 2 → 3'), 'من 2 → 3');
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

// The bank stores maths canonically (`5^{10}`, `3^6 = 729`) and its promptAr
// carries the display form (`5⁷ ÷ 5³`). A printed worksheet mixed the two:
// stems in real superscripts, options and the whole answer key in raw caret
// notation, with LaTeX braces leaking into a distractor.
describe('normalizeExponents', () => {
  it('turns a braced exponent into real superscripts — no braces printed', () => {
    assert.equal(normalizeExponents('2^{12}'), '2¹²');
    assert.equal(normalizeExponents('5^{10}'), '5¹⁰');
  });

  it('turns a bare exponent into superscripts', () => {
    assert.equal(normalizeExponents('5^4 = 625'), '5⁴ = 625');
    assert.equal(normalizeExponents('a^2'), 'a²');
    assert.equal(normalizeExponents('3^6 = 729'), '3⁶ = 729');
  });

  it('handles negative, signed and symbolic exponents', () => {
    assert.equal(normalizeExponents('a^{-2}'), 'a⁻²');
    assert.equal(normalizeExponents('10^-3'), '10⁻³');
    assert.equal(normalizeExponents('2^n'), '2ⁿ');
    assert.equal(normalizeExponents('a^{n+1}'), 'aⁿ⁺¹');
  });

  it('keeps a fractional exponent as ^(p/q) — no Unicode superscript has a slash', () => {
    // Same convention the stems already use («27^(2/3)»), so stem and option
    // agree on the one shape that cannot be a superscript.
    assert.equal(normalizeExponents('8^{2/3}'), '8^(2/3)');
    assert.equal(normalizeExponents('16^{-3/4}'), '16^(-3/4)');
    assert.equal(normalizeExponents('27^(2/3)'), '27^(2/3)');
  });

  it('does not touch fractions — «1/2» must not become «(1)/(2)»', () => {
    // This is why it is not mathLineToUnicode, which does rewrite fractions.
    assert.equal(normalizeExponents('1/2'), '1/2');
    assert.equal(normalizeExponents('√3/2'), '√3/2');
    assert.equal(normalizeExponents('cos 60° = 1/2'), 'cos 60° = 1/2');
  });

  it('is idempotent, and a no-op on text with no caret', () => {
    for (const s of ['2^{12}', '8^{2/3}', 'a^{-2}', '2³ · 2⁴', 'اشرح الفكرة', '']) {
      const once = normalizeExponents(s);
      assert.equal(normalizeExponents(once), once, s);
    }
    assert.equal(normalizeExponents('2³ · 2⁴'), '2³ · 2⁴');
    assert.equal(normalizeExponents('اشرح الفكرة'), 'اشرح الفكرة');
  });

  it('is null-safe, like the escape helper that calls it', () => {
    assert.equal(normalizeExponents(undefined as never), '');
    assert.equal(normalizeExponents(null as never), '');
  });

  it('agrees with the display-form stems the bank already ships', () => {
    // promptAr for se-e1 is «2³ · 2⁴»; its canonical eq is «2^3 · 2^4».
    assert.equal(normalizeExponents('2^3 · 2^4'), '2³ · 2⁴');
    assert.equal(normalizeExponents('(2^3 · 2^{-1}) / 2'), '(2³ · 2⁻¹) / 2');
  });
});

// The curriculum data writes every minus as U+2212, not the ASCII hyphen. With
// only `-` in the run class, «y = 2x−5» was cut at the sign and bidi reordered
// the pieces, so a worked example reached the projector as «7x+12=0−x²».
describe('isolateForeignRuns — the U+2212 minus sign', () => {
  const strip = (s: string) => s.replace(/[⁦⁩]/g, '');

  it('keeps a worked example whole, one isolate per side of the Arabic «و»', () => {
    const line = 'y = 2x−5 و y = x²−5x+7: 2x−5 = x²−5x+7 → x²−7x+12=0';
    const out = isolateForeignRuns(line);
    assert.equal(
      out,
      '⁦y = 2x−5⁩ و ⁦y = x²−5x+7⁩: ⁦2x−5 = x²−5x+7 → x²−7x+12=0⁩',
    );
    assert.equal(strip(out), line);
  });

  it('keeps a negative energy expression whole', () => {
    const out = isolateForeignRuns('طاقة المستوى: E = −13.6 / n² إلكترون فولت');
    assert.equal(out, 'طاقة المستوى: ⁦E = −13.6 / n²⁩ إلكترون فولت');
  });

  it('treats a number and a U+2212 minus as notation, like the ASCII hyphen', () => {
    assert.equal(isolateForeignRuns('الناتج 7−3 هنا'), 'الناتج ⁦7−3⁩ هنا');
  });
});

// The bank writes powers as `3^{2x}` and `2^{x+3}`. The parser only knew
// `^2` and `^(2x)`, so a braced exponent fell through to plain text and
// printed with its braces on the worksheet screen. (Found by running the app
// 2026-10-05: «4^x = 2^{x+3}» rendered as «2^{x+3}4^x».)
describe('parseMathLine — braced exponents', () => {
  it('reads ^{x+3} as one exponent, braces dropped', () => {
    const n = parseMathLine('2^{x+3}');
    assert.deepEqual(n, [{ kind: 'sup', base: '2', exp: 'x+3' }]);
  });

  it('reads ^{2x} and keeps the text after it', () => {
    assert.deepEqual(parseMathLine('3^{2x} = 81'), [
      { kind: 'sup', base: '3', exp: '2x' },
      { kind: 'text', text: ' = 81' },
    ]);
  });

  it('handles a braced and a bare exponent on one line', () => {
    assert.deepEqual(parseMathLine('4^x = 2^{x+3}'), [
      { kind: 'sup', base: '4', exp: 'x' },
      { kind: 'text', text: ' = ' },
      { kind: 'sup', base: '2', exp: 'x+3' },
    ]);
  });

  it('reads a braced exponent after a parenthesised group', () => {
    assert.deepEqual(parseMathLine('(2^2)^{x}'), [
      { kind: 'sup', base: '(2^2)', exp: 'x' },
    ]);
  });

  it('leaves an unclosed brace as plain text', () => {
    const n = parseMathLine('2^{x+3');
    assert.ok(!n.some(x => x.kind === 'sup'));
    assert.equal(n.map(x => (x.kind === 'text' ? x.text : '')).join(''), '2^{x+3');
  });

  it('renders HTML and unicode without braces', () => {
    assert.equal(mathLineToHtml('2^{x+3}'), '2<sup>x+3</sup>');
    assert.equal(mathLineToUnicode('3^{2}'), '3²');
  });
});

describe('isolateForeignRuns — braces stay inside the run', () => {
  it('wraps «3^{2x} = 81» in one isolate, not three', () => {
    const out = isolateForeignRuns('أوجد حل المعادلة: 3^{2x} = 81');
    assert.equal(out, 'أوجد حل المعادلة: ⁦3^{2x} = 81⁩');
  });
});

// MathText lays an Arabic-led line out with flex-direction row-reverse so the
// prose reads right to left. That reversed EVERY node, including the pieces of
// one equation: «أوجد حل المعادلة: 3^x = 27» drew as «= 27 | 3ˣ | prose», the
// equation back to front. The fix keeps each equation as one left-to-right
// group and reverses only between Arabic phrases and equations.
describe('groupRtlSegments — one equation is one left-to-right group', () => {
  const prose = (text: string) => ({ kind: 'prose', text });
  const kinds = (segs: ReturnType<typeof groupRtlSegments>) => segs.map(g => g.kind);

  it('keeps «3^x = 27» together after the Arabic lead', () => {
    const segs = groupRtlSegments(parseMathLine('أوجد حل المعادلة: 3^x = 27'));
    assert.deepEqual(kinds(segs), ['prose', 'math']);
    assert.deepEqual(segs[0], prose('أوجد حل المعادلة:'));
    const m = segs[1];
    assert.ok(m.kind === 'math');
    assert.deepEqual(m.nodes.map(n => n.kind), ['sup', 'text']);
    assert.equal(flat(m.nodes).trim(), '3^x = 27');
  });

  it('puts the colon with the Arabic, not at the front of the equation', () => {
    const segs = groupRtlSegments(parseMathLine('أوجد حل المعادلة: 3^x = 27'));
    assert.ok(segs[0].kind === 'prose' && segs[0].text.endsWith(':'));
  });

  it('splits an equation sitting between two Arabic phrases', () => {
    const segs = groupRtlSegments(parseMathLine('إذا كان x^2 = 4 فإن س موجبة'));
    assert.deepEqual(kinds(segs), ['prose', 'math', 'prose']);
    assert.equal(segs[0].kind === 'prose' && segs[0].text, 'إذا كان');
    assert.equal(segs[2].kind === 'prose' && segs[2].text, 'فإن س موجبة');
  });

  it('keeps «27 = 3^3» whole in the half-solved step line', () => {
    const segs = groupRtlSegments(parseMathLine('1) نكتب 27 بالأساس 3: 27 = 3^3'));
    const maths = segs.filter(g => g.kind === 'math');
    const last = maths[maths.length - 1];
    assert.ok(last.kind === 'math');
    assert.ok(flat(last.nodes).replace(/\s/g, '').endsWith('27=3^3'));
  });

  it('returns a single math group for a line with no Arabic', () => {
    const segs = groupRtlSegments(parseMathLine('3^x = 27'));
    assert.deepEqual(kinds(segs), ['math']);
  });

  it('drops nothing: segments reassemble to the original text', () => {
    const line = 'بسّط: x^2 + 1 ثم عوّض x = 2';
    const segs = groupRtlSegments(parseMathLine(line));
    const back = segs.map(g => (g.kind === 'prose' ? g.text : flat(g.nodes))).join('');
    assert.equal(back.replace(/\s/g, ''), line.replace(/\s/g, ''));
  });
});

// A numbered step line — «1) نكتب 27 بالأساس 3: 27 = 3^3» — opens with its
// marker, not Arabic, so the old /^\s*Arabic/ test called it a left-to-right
// line and the browser's bidi scrambled it («= 27 :3 ...»; seen in the app).
describe('isArabicLed — a list marker does not make a line Latin', () => {
  it('true for plain Arabic and for Arabic after a marker', () => {
    for (const s of ['أوجد حل المعادلة: 3^x = 27', '1) نكتب 27', '2. نعوّض', '(3) اجمع', '١) نكتب', '  - اكتب']) {
      assert.equal(isArabicLed(s), true, s);
    }
  });
  it('false for an equation or Latin-led line', () => {
    for (const s of ['3^x = 27', 'x = 3 ثم', '12 + 4 = 16', '(x+1)/2', 'f(x) = 2x', '']) {
      assert.equal(isArabicLed(s), false, s);
    }
  });
});

// On a phone-width projector «Solve the equation: 2^x = 32» broke between the
// raised exponent and « = 32» (2ˣ on one line, = 32 on the next), and
// «Write 32 with base 2: 32 = 2^5» left «2^5» alone on its own line. MathText's
// left-to-right row wrapped at every node boundary. The fix glues an equation's
// neighbouring numbers and operators to it, so the row can only break between
// prose and an equation, never inside one.
describe('groupLtrSegments — a wrap never lands inside an equation', () => {
  const shape = (line: string) =>
    groupLtrSegments(parseMathLine(line)).map(g =>
      g.kind === 'prose' ? `P:${g.text}` : `M:${flat(g.nodes).replace(/\s+/g, ' ').trim()}`);

  it('keeps « = 32» with the exponent that precedes it', () => {
    assert.deepEqual(shape('Solve the equation: 2^x = 32'), [
      'P:Solve the equation:',
      'M:2^x = 32',
    ]);
  });

  it('pulls the numbers before the exponent into the equation', () => {
    assert.deepEqual(shape('Write 32 with base 2: 32 = 2^5'), [
      'P:Write 32 with base',
      'M:2: 32 = 2^5',
    ]);
  });

  it('stops at the first prose word after the equation', () => {
    assert.deepEqual(shape('2^x = 32 is the solution'), ['M:2^x = 32', 'P:is the solution']);
  });

  it('keeps two exponents on one line as a single equation', () => {
    assert.deepEqual(shape('Substitute: 4^x = 2^{x+3}'), ['P:Substitute:', 'M:4^x = 2^(x+3)']);
  });

  it('returns one math group for a pure equation', () => {
    const segs = groupLtrSegments(parseMathLine('3^x = 27'));
    assert.deepEqual(segs.map(g => g.kind), ['math']);
  });

  it('returns plain prose untouched', () => {
    assert.deepEqual(shape('Read the passage carefully'), ['P:Read the passage carefully']);
  });

  it('does not treat the article «a» as a variable', () => {
    assert.deepEqual(shape('Write a 2^x'), ['P:Write a', 'M:2^x']);
  });

  it('drops nothing: segments reassemble to the original text', () => {
    const line = 'Then 3^2 + 4^2 = 25 so the triangle is right-angled';
    const back = groupLtrSegments(parseMathLine(line))
      .map(g => (g.kind === 'prose' ? g.text : flat(g.nodes))).join('');
    assert.equal(back.replace(/\s/g, ''), line.replace(/\s/g, '').replace(/\^/g, '^'));
  });
});

// «…so the exponents are equal: x = 3» wrapped as «x» / «= 3» on a phone-width
// slide. A plain-text line has no nodes to group, so the spaces around an
// operator become non-breaking: the browser may still break the sentence, but
// not the equation.
describe('bindOperators — a plain line never breaks around an operator', () => {
  const NB = '\u00A0';
  it('binds the spaces around = to their operands', () => {
    assert.equal(bindOperators('are equal: x = 3'), `are equal: x${NB}=${NB}3`);
  });
  it('binds each operator in a chain', () => {
    assert.equal(bindOperators('2x + 3 = 11'), `2x${NB}+${NB}3${NB}=${NB}11`);
  });
  it('covers the comparison and times signs', () => {
    assert.equal(bindOperators('a ≤ b × c'), `a${NB}≤${NB}b${NB}×${NB}c`);
  });
  it('leaves a spaced hyphen or dash alone: that is punctuation', () => {
    assert.equal(bindOperators('Step one - read the text'), 'Step one - read the text');
  });
  it('leaves ordinary spaces between words alone', () => {
    assert.equal(bindOperators('the bases are equal'), 'the bases are equal');
  });
  it('is idempotent and a no-op on empty text', () => {
    const once = bindOperators('x = 3');
    assert.equal(bindOperators(once), once);
    assert.equal(bindOperators(''), '');
  });
});

/**
 * A chat bubble laid a URL or an English credit out right-to-left, so the
 * lab sheet's link read «//phet.colorado.edu/…:https» and the credit's words
 * came out in reverse order. A line with no Arabic in it that is not maths is
 * shown left-to-right; maths keeps its own layout.
 */
describe('isLatinProseLine', () => {
  it('takes a URL and an English credit', () => {
    assert.equal(isLatinProseLine('https://phet.colorado.edu/sims/html/vector-addition/latest/vector-addition_ar.html'), true);
    assert.equal(isLatinProseLine('PhET Interactive Simulations, University of Colorado Boulder — phet.colorado.edu (CC BY-NC 4.0)'), true);
  });
  it('leaves Arabic, mixed and maths lines alone', () => {
    assert.equal(isLatinProseLine('هذه ورقة المختبر الافتراضي'), false);
    assert.equal(isLatinProseLine('افتح الرابط https://phet.colorado.edu'), false);
    assert.equal(isLatinProseLine('x^2 + 3 = 7'), false);
    assert.equal(isLatinProseLine('٢٠ ÷ ٤ = ٥'), false);
    assert.equal(isLatinProseLine('   '), false);
  });
});
