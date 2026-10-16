/**
 * Seven Grade 10 lessons could only ask one or two kinds of question, so an
 * offline quiz on them was the same sentence with new numbers (measured
 * 2026-10-15; see `stemFrame`). Each now asks what its NCCD objectives list:
 * how many solutions a system has, a value that makes a line a tangent, a
 * real-life model, radical ↔ exponent form, a compass direction as a bearing,
 * Heron's formula, an estimate from the line of best fit, quartiles…
 *
 * The banked systems are checked here by substitution, independently of the
 * bank: every listed point satisfies both equations, and the list is complete.
 * The topic generators' answers are recomputed in geometry/stats.test.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MATH_BANK, itemStem, stemFrame, topicFor } from '../index.ts';
import { makeTopicItem } from '../topics.ts';

/** «y = −x² + 2x + 1» → (x, y) => value of left − right. */
function equation(src: string): (x: number, y: number) => number {
  const js = (side: string) => side
    .replace(/−/g, '-').replace(/²/g, '^2')
    .replace(/(\d)([xy(])/g, '$1*$2').replace(/([xy])\^(\d)/g, 'Math.pow($1, $2)');
  const [l, r] = src.split('=');
  return new Function('x', 'y', `return (${js(l!)}) - (${js(r!)});`) as (x: number, y: number) => number;
}
const isYOfX = (src: string) => /^y = [^y]*$/.test(src);
/** Real solutions of y = f(x), y = g(x), both of degree ≤ 2: the roots of f − g, counted. */
function solutionCount(e1: string, e2: string): number {
  const f = equation(e1), g = equation(e2);
  // y = f(x) gives f(x, 0) = −f(x); the difference of the two is −(f − g).
  const h = (x: number) => g(x, 0) - f(x, 0);
  const c = h(0), b = (h(1) - h(-1)) / 2, a = (h(1) + h(-1)) / 2 - c;
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? (Math.abs(c) < 1e-12 ? Infinity : 0) : 1;
  const d = b * b - 4 * a * c;
  return Math.abs(d) < 1e-12 ? 1 : d > 0 ? 2 : 0;
}
const points = (s: string) => [...s.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [Number(m[1]!.replace('−', '-')), Number(m[2]!.replace('−', '-'))] as const);
const COUNT: Record<string, number> = { 'لا يوجد حل': 0, 'حل واحد': 1, 'حلّان': 2 };
const systems = MATH_BANK.filter(i => (i.family === 'linear_quad' || i.family === 'quad_system') && i.eq2 && isYOfX(i.eq.replace(/k/, '0')) && /=/.test(i.eq2));

describe('banked systems, checked by substitution', () => {
  it('every system to solve lists exactly its solutions', () => {
    let checked = 0;
    for (const item of systems.filter(i => i.kind === 'system')) {
      const where = `${item.id}: ${item.eq} ; ${item.eq2} → ${item.answer}`;
      const pts = points(item.answer);
      for (const [x, y] of pts) {
        assert.ok(Math.abs(equation(item.eq)(x, y)) < 1e-9 && Math.abs(equation(item.eq2!)(x, y)) < 1e-9, `not a solution: ${where}`);
      }
      if (isYOfX(item.eq) && isYOfX(item.eq2!)) {
        assert.equal(pts.length, solutionCount(item.eq, item.eq2!), `incomplete or extra: ${where}`);
        checked += 1;
      }
      // a wrong option listing exactly the solution set would be a second right answer
      const key = (s: string) => points(s).map(p => p.join(',')).sort().join('|');
      for (const w of item.wrongs) if (points(w).length) assert.notEqual(key(w), key(item.answer), `wrong option is right: ${where}`);
    }
    assert.ok(checked >= 8, `only ${checked} systems were fully checked`);
  });

  it('«how many solutions» answers what the equations give', () => {
    const items = systems.filter(i => i.answer in COUNT);
    assert.ok(items.length >= 6, String(items.length));
    for (const item of items) assert.equal(solutionCount(item.eq, item.eq2!), COUNT[item.answer], `${item.id}: ${item.eq} ; ${item.eq2}`);
  });

  it('the tangent value of k leaves exactly one solution, and no wrong k does', () => {
    const items = MATH_BANK.filter(i => i.family === 'linear_quad' && /\+ k$/.test(i.eq));
    assert.ok(items.length >= 2);
    for (const item of items) {
      const at = (k: string) => solutionCount(item.eq.replace('k', `(${k.replace('−', '-')})`), item.eq2!);
      assert.equal(at(item.answer), 1, item.id);
      for (const w of item.wrongs) assert.notEqual(at(w), 1, `${item.id}: ${w} is also a tangent`);
    }
  });

  it('rational exponents evaluate to the key', () => {
    const items = MATH_BANK.filter(i => i.family === 'simplify_exp' && i.promptAr?.startsWith('احسب قيمة'));
    assert.ok(items.length >= 3);
    for (const item of items) {
      const m = item.promptAr!.match(/(\d+)\^\((−?)(\d+)\/(\d+)\)/)!;
      const value = Number(m[1]) ** ((m[2] ? -1 : 1) * Number(m[3]) / Number(m[4]));
      const [n, d] = item.answer.split('/').map(Number);
      assert.ok(Math.abs(value - n! / (d ?? 1)) < 1e-9, `${item.id}: ${value} ≠ ${item.answer}`);
    }
  });
});

/** Distinct sentences a lesson can be asked in (`stemFrame`). */
function bankKinds(family: string): number {
  return new Set(MATH_BANK.filter(i => i.family === family).map(i => stemFrame(itemStem(i, true)))).size;
}
function topicKinds(title: string): number {
  const topic = topicFor(title, 10);
  assert.ok(topic, `no generator for ${title}`);
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const frames = new Set<string>();
  for (let i = 0; i < 200; i++) frames.add(stemFrame(makeTopicItem(topic, 10, (['easy', 'medium', 'hard'] as const)[i % 3], new Set(), rng).promptAr!));
  return frames.size;
}

describe('every Grade 10 lesson that had one or two kinds of question now has three or more', () => {
  for (const [title, family] of [
    ['حل نظام مكوَّن من معادلة خطية ومعادلة تربيعية', 'linear_quad'],
    ['حل نظام مكوَّن من معادلتين تربيعيتين', 'quad_system'],
    ['تبسيط المقادير الأسية', 'simplify_exp'],
  ] as const) {
    it(title, () => assert.ok(bankKinds(family) >= 3, `${family}: ${bankKinds(family)} kinds`));
  }
  for (const title of [
    'الاتجاه من الشمال (Bearing)',
    'استعمال جيب الزاوية لإيجاد مساحة المثلث',
    'أشكال الانتشار',
    'المنحنى التكراري التراكمي',
  ]) {
    it(title, () => assert.ok(topicKinds(title) >= 3, `${title}: ${topicKinds(title)} kinds`));
  }
});

