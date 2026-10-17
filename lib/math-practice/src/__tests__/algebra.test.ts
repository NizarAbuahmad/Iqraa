/**
 * Algebra topic generators (`../algebra.ts`). Every answer is recomputed from
 * the printed stem by evaluating the printed strings as numbers — a route that
 * shares no code with the generators — and every wrong option is checked to be
 * genuinely wrong (a different function, a different solution set).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, type ConcreteItem, type DiffTier } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draws(id: string, n = 200): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) =>
    makeTopicItem(t, t.grades[0] + (i % (t.grades[1] - t.grades[0] + 1)), TIERS[i % 3]!, new Set(), seeded(i * 104729 + 7)));
}

// ── evaluating printed maths ────────────────────────────────────────────────

const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** Printed maths → a JS expression in x and y. */
function js(s: string): string {
  let t = s.replace(/−/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  t = t.replace(/⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => { const d = [...m.replace('⁻', '')].map(c => SUPD.indexOf(c)).join(''); return m.startsWith('⁻') ? `**(-${d})` : `**${d}`; });
  t = t.replace(/(\d*)√\(([^()]*)\)/g, (_, k, r) => `(${k || 1}*Math.sqrt(${r}))`).replace(/(\d*)√(\d+|[xy])/g, (_, k, r) => `(${k || 1}*Math.sqrt(${r}))`);
  // ratios first: (a)/(b) is one unit, or `p/q ÷ r/s` would associate wrongly
  t = t.replace(/\(([^()]*)\)\/\(([^()]*)\)/g, '(($1)/($2))');
  // wrap every power in brackets so a leading minus never sits directly before **
  const E = '(\\(-\\d+\\)|\\d+)';
  t = t.replace(new RegExp(`\\(([^()]*)\\)\\*\\*${E}`, 'g'), '(($1)**$2)').replace(new RegExp(`([xy])\\*\\*${E}`, 'g'), '($1**$2)').replace(new RegExp(`(\\d+)\\*\\*${E}`, 'g'), '($1**$2)');
  t = t.replace(/(\d)\s*([xy(])/g, '$1*$2').replace(/\)\s*([xy(\d])/g, ')*$1').replace(/([xy])\s*\(/g, '$1*(');
  return t;
}
const compiled = new Map<string, (x: number, y?: number) => number>();
const fn = (s: string) => {
  let f = compiled.get(s);
  if (!f) { f = new Function('x', 'y', `return ${js(s)}`) as (x: number, y?: number) => number; compiled.set(s, f); }
  return f;
};
const same = (a: number, b: number) => Math.abs(a - b) < 1e-7 || (Number.isNaN(a) && Number.isNaN(b));
const num = (s: string) => Number(s.replace('−', '-'));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
/** Signed integers in printed order: «−3 ، 4» → [−3, 4]. */
const snums = (s: string) => (s.match(/−?\d+/g) ?? []).map(num);
const has = (p: string, w: string) => p.includes(w);
/** The kinds added on 2026-10-16 are recomputed in their own block below; the checks here are the original kinds'. */
const stem = (item: ConcreteItem) => item.promptAr!;
const POINTS = [-4, -3, -2, -1, 0.5, 1, 2, 3, 5, 7];
/** Two printed expressions are the same function of x. */
const equivalent = (a: string, b: string) => POINTS.every(x => same(fn(a)(x), fn(b)(x)));

const GRID = Array.from({ length: 481 }, (_, i) => -120 + i * 0.5);
const cmp = (a: number, o: string, b: number) => (o === '<' ? a < b : o === '>' ? a > b : o === '≤' ? a <= b + 1e-9 : a >= b - 1e-9);
function chain(clause: string, x: number): boolean {
  const parts = clause.split(/ (<|>|≤|≥) /);
  const vals = parts.filter((_, i) => i % 2 === 0).map(e => fn(e)(x));
  const ops = parts.filter((_, i) => i % 2 === 1);
  return ops.every((o, i) => cmp(vals[i]!, o, vals[i + 1]!));
}
const inInterval = (s: string, x: number) => {
  const m = s.match(/^([([])(.+?) ، (.+?)([)\]])$/)!;
  const lo = m[2] === '−∞' ? -Infinity : num(m[2]!), hi = m[3] === '∞' ? Infinity : num(m[3]!);
  return (m[1] === '(' ? x > lo : x >= lo) && (m[4] === ')' ? x < hi : x <= hi);
};
const holds = (s: string, x: number) => s.split(' أو ').some(c => c.split(' و ').every(p => chain(p, x)));
const sameSet = (a: string, b: string) => GRID.every(x => holds(a, x) === holds(b, x));

/** Coefficients [c, b, a] of a printed quadratic. */
const quad = (s: string): [number, number, number] => {
  const f = fn(s);
  const c = f(0), p = f(1) - c, m = f(-1) - c;
  return [c, (p - m) / 2, (p + m) / 2];
};

// ── every item: shape ───────────────────────────────────────────────────────

const ALGEBRA_IDS = TOPICS.filter(t => /^(expr_|eq_|distribute|seq_basic|alg_terms|poly_|solve_eq|factor_|ineq_|intervals|sys_|line_|quad_|fn_eval|exp_simplify|radical_|rat_expr_|rat_eq|sqrt_|real_numbers)/.test(t.id)).map(t => t.id);

describe('algebra generators: shape', () => {
  it('there are many of them', () => assert.ok(ALGEBRA_IDS.length >= 40, String(ALGEBRA_IDS.length)));
  for (const id of ALGEBRA_IDS) {
    it(`${id}: three distinct wrong options, clean text, both languages`, () => {
      for (const item of draws(id, 240)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!, item.eq]) assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
        // a negative number is written with the real minus sign, never a hyphen
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.eq]) assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
      }
    });
  }
});

// ── answers recomputed ──────────────────────────────────────────────────────

describe('algebra generators: answers', () => {
  it('evaluating an expression', () => {
    for (const item of draws('expr_g4').filter(i => has(stem(i), 'عندما') && !has(stem(i), 'أيّ المقادير'))) {
      const [, v, val] = item.promptAr!.match(/عندما (\w) = (\d+)/)!;
      assert.equal(num(item.answer), new Function(v!, `return ${js(item.eq)}`)(Number(val)), item.promptAr);
    }
    for (const item of draws('expr_eval').filter(i => has(stem(i), 'عندما'))) {
      const xs = Number(item.promptAr!.match(/x = (\d+)/)![1]), ys = Number(item.promptAr!.match(/y = (\d+)/)?.[1] ?? 0);
      assert.equal(num(item.answer), fn(item.eq)(xs, ys), item.promptAr);
    }
    for (const item of draws('alg_terms')) {
      const m = item.promptAr!.match(/عندما x = (−?\d+)/);
      if (m) assert.equal(num(item.answer), fn(item.eq)(num(m[1]!)), item.promptAr);
      else if (item.promptAr!.startsWith('كم')) assert.equal(item.answer, String(item.eq.split(/ [+−] /).length));
      else {
        const [c, b, a] = quad(item.eq);
        assert.equal(num(item.answer), item.promptAr!.includes('الحد x²') ? a : b, item.promptAr);
      }
    }
  });

  it('equations: the answer satisfies it and no wrong option does', () => {
    for (const id of ['eq_add_sub', 'eq_mul_div', 'eq_mixed', 'solve_eq', 'rat_eq', 'radical_eq']) {
      for (const item of draws(id, 300).filter(i => !has(stem(i), 'اكتب معادلة'))) {
        const [l, r] = item.eq.split(' = ');
        // a listed pair of roots («7 ، 4») is not a number, so it satisfies nothing
        const ok = (v: number) => Number.isFinite(v) && same(fn(l!)(v), fn(r!)(v));
        assert.ok(ok(num(item.answer)), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!ok(num(w)), `${id}: wrong option ${w} satisfies ${item.eq}`);
      }
    }
  });

  it('sequences', () => {
    for (const item of draws('seq_basic', 300).filter(i => /^ما الحد (التالي|رقم)/.test(stem(i)))) {
      const t = item.eq.split(', ').map(num);
      const d = t[1]! - t[0]!;
      const arithmetic = t.every((v, i) => i === 0 || v - t[i - 1]! === d);
      const n = Number(item.promptAr!.match(/رقم (\d+)/)?.[1] ?? t.length + 1);
      const want = arithmetic ? t[0]! + (n - 1) * d : t[0]! * (t[1]! / t[0]!) ** (n - 1);
      assert.equal(num(item.answer), want, item.promptAr);
    }
  });

  it('polynomial results: the answer is the stem, expanded', () => {
    for (const id of ['distribute', 'poly_addsub', 'poly_mul', 'poly_special', 'exp_simplify']) {
      for (const item of draws(id, 300).filter(i => !/^ما (الخاصية|معامل|قيمة n)/.test(stem(i)))) {
        assert.ok(equivalent(item.eq, item.answer), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!equivalent(item.eq, w), `${id}: wrong option ${w} equals ${item.eq}`);
      }
    }
  });

  it('factoring: the answer multiplies back, the wrong options do not', () => {
    const factoring = (i: ConcreteItem) => /^(حلّل|استعمل)/.test(stem(i));
    for (const id of ['factor_gcf', 'factor_monic', 'factor_general', 'factor_special']) {
      for (const item of draws(id, 300).filter(factoring)) {
        assert.ok(equivalent(item.eq, item.answer), `${id}: ${item.eq} ≠ ${item.answer}`);
        // a half-done GCF is the same polynomial; it is wrong because it is not the GREATEST factor
        if (id !== 'factor_gcf') for (const w of item.wrongs) assert.ok(!equivalent(item.eq, w), `${id}: wrong factoring ${w} equals ${item.eq}`);
      }
    }
    // a «trinomial» lesson never serves a binomial, and no wrong factor is «x + 0»
    for (const item of draws('factor_monic').filter(factoring)) {
      assert.match(item.eq, /^x² [+−] \d*x [+−] \d+$/, item.eq);
      assert.ok(!item.wrongs.some(w => /[+−] 0\)/.test(w)), item.wrongs.join(' | '));
    }
    // the GCF really is the greatest
    for (const item of draws('factor_gcf').filter(factoring)) {
      const g = Number(item.answer.match(/^(\d+)/)![1]);
      const inner = item.answer.match(/\((.+)\)$/)![1]!;
      const fi = fn(inner);
      const co = [Math.abs(fi(0)), Math.abs(fi(1) - fi(0))];
      const gg = co.reduce((a, b) => { while (b) [a, b] = [b, a % b]; return a; }, 0);
      assert.equal(gg, 1, `${item.answer}: the bracket still has a common factor`);
      assert.ok(g >= 2);
    }
  });

  it('rational expressions simplify to the printed answer', () => {
    for (const id of ['rat_expr_muldiv', 'rat_expr_addsub']) {
      for (const item of draws(id, 300).filter(i => !/غير معرّف|المضاعف المشترك/.test(stem(i)))) {
        const pts = [-6.5, -2.5, 0.5, 1.5, 3.5, 8.5];
        assert.ok(pts.every(x => same(fn(item.eq)(x), fn(item.answer)(x))), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!pts.every(x => same(fn(item.eq)(x), fn(w)(x))), `${id}: wrong ${w} equals ${item.eq}`);
      }
    }
  });

  it('inequalities: same solution set as the stem; wrong options are different sets', () => {
    for (const id of ['ineq_add', 'ineq_mul', 'ineq_multi', 'ineq_compound']) {
      for (const item of draws(id, 300).filter(i => !/أيّ الأعداد|صِف تمثيل|الفترات/.test(stem(i)))) {
        const stem = id === 'ineq_compound' ? item.eq : item.eq;
        assert.ok(sameSet(stem, item.answer), `${id}: ${stem} vs ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameSet(stem, w), `${id}: wrong ${w} has the solution set of ${stem}`);
      }
    }
    const WORDS: Record<string, string> = { 'أكبر من': '>', 'أقل من': '<', 'لا يقل عن': '≥', 'لا يزيد على': '≤' };
    for (const item of draws('ineq_write').filter(i => has(stem(i), 'متباينة تعبّر عن'))) {
      const word = Object.keys(WORDS).find(w => item.promptAr!.includes(w))!;
      assert.equal(item.answer.split(' ')[1], WORDS[word], item.promptAr);
    }
  });

  it('intervals match the inequality', () => {
    for (const item of draws('intervals', 300).filter(i => has(stem(i), 'على صورة فترة'))) {
      assert.ok(GRID.every(x => inInterval(item.answer, x) === holds(item.eq, x)), `${item.eq} vs ${item.answer}`);
      for (const w of item.wrongs) assert.ok(!GRID.every(x => inInterval(w, x) === holds(item.eq, x)), `${w} is also ${item.eq}`);
    }
  });

  it('systems: the answer satisfies both equations, no wrong option does', () => {
    for (const id of ['sys_graph', 'sys_sub', 'sys_elim']) {
      for (const item of draws(id, 300).filter(i => /^(حلّ النظام|أيّ الأزواج)/.test(stem(i)))) {
        const eqs = item.eq.split(' ، ');
        assert.equal(eqs.length, 2);
        const sat = (p: string) => {
          const [px, py] = p.slice(1, -1).split(' ، ').map(num);
          return eqs.every(e => { const [l, r] = e.split(' = '); return same(fn(l!)(px!, py!), fn(r!)(px!, py!)); });
        };
        assert.ok(sat(item.answer), `${id}: ${item.eq} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sat(w), `${id}: wrong ${w} satisfies ${item.eq}`);
      }
    }
  });

  it('lines', () => {
    for (const item of draws('line_slope', 300).filter(i => has(stem(i), 'أوجد ميل'))) {
      const [[x1, y1], [x2, y2]] = [...item.eq.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [num(m[1]!), num(m[2]!)]) as [number, number][];
      const v = (s: string) => (s.includes('/') ? num(s.split('/')[0]!) / num(s.split('/')[1]!) : num(s));
      assert.ok(same(v(item.answer), (y2! - y1!) / (x2! - x1!)), item.eq);
      for (const w of item.wrongs) assert.ok(!same(v(w), (y2! - y1!) / (x2! - x1!)), `${w} is also the slope`);
    }
    const onLine = (eq: string, x: number, y: number) => { const [l, r] = eq.split(' = '); return same(fn(l!)(x, y), fn(r!)(x, y)); };
    for (const item of draws('line_slope_int', 300)) {
      const pts = [...item.promptAr!.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [num(m[1]!), num(m[2]!)]) as [number, number][];
      if (pts.length === 2) assert.ok(pts.every(([x, y]) => onLine(item.answer, x, y!)), `${item.answer} misses ${pts}`);
      else if (has(stem(item), 'ميله')) { const [, m, b] = item.promptAr!.match(/ميله (−?\d+) .* عند (−?\d+)/)!; assert.ok(onLine(item.answer, 0, num(b!)) && onLine(item.answer, 1, num(b!) + num(m!)), item.promptAr); }
    }
    for (const item of draws('line_point_slope', 300).filter(i => has(stem(i), 'ميله'))) {
      const m = num(item.promptAr!.match(/ميله (−?\d+)/)![1]!);
      const [x1, y1] = item.promptAr!.match(/\((−?\d+) ، (−?\d+)\)/)!.slice(1).map(num) as [number, number];
      assert.ok(onLine(item.answer, x1, y1) && onLine(item.answer, x1 + 1, y1 + m) && !onLine(item.answer, x1 + 1, y1), item.answer);
      for (const w of item.wrongs) assert.ok(!(onLine(w, x1, y1) && onLine(w, x1 + 1, y1 + m)), `${w} is also the line`);
    }
    for (const item of draws('line_par_perp', 300)) {
      const m = num(item.eq.match(/y = (−?\d*)x/)![1]! === '' ? '1' : item.eq.match(/y = (−?\d*)x/)![1]!.replace(/^−$/, '−1') || '1');
      if (item.promptAr!.includes('العمودي')) {
        const v = item.answer.includes('/') ? num(item.answer.split('/')[0]!) / num(item.answer.split('/')[1]!) : num(item.answer);
        assert.ok(same(v * m, -1), `${item.eq}: ${item.answer}`);
      } else if (item.promptAr!.includes('ما ميل')) assert.equal(num(item.answer), m);
      else {
        const [x1, y1] = item.promptAr!.match(/\((−?\d+) ، (−?\d+)\)/)!.slice(1).map(num) as [number, number];
        assert.ok(onLine(item.answer, x1, y1) && onLine(item.answer, x1 + 1, y1 + m), item.answer);
      }
    }
    for (const item of draws('line_standard', 300).filter(i => /المقطع|بالصورة القياسية/.test(stem(i)))) {
      if (item.eq.startsWith('y =')) {
        const f = fn(item.eq.slice(4));
        for (const x of [0, 1, 2, 3]) assert.ok(onLine(item.answer, x, f(x)), `${item.answer} misses (${x}, ${f(x)})`);
        assert.ok(!item.answer.startsWith('−'), 'A must be positive');
        for (const w of item.wrongs) assert.ok(![0, 1, 2].every(x => onLine(w, x, f(x))), `${w} is also the line`);
      } else {
        const [l, r] = item.eq.split(' = ');
        const A = fn(l!)(1, 0) - fn(l!)(0, 0), B = fn(l!)(0, 1) - fn(l!)(0, 0), C = fn(r!)(0);
        assert.equal(num(item.answer), item.promptAr!.includes('السيني') ? C / A : C / B, item.promptAr);
      }
    }
  });

  it('quadratic equations: both printed roots satisfy it, no wrong list does', () => {
    const root = (s: string) => (s.includes('/') ? num(s.split('/')[0]!) / num(s.split('/')[1]!) : num(s));
    for (const id of ['quad_factor', 'quad_graph']) {
      for (const item of draws(id, 300).filter(i => /^(حلّ المعادلة|ما حلول)/.test(stem(i)))) {
        const f = fn(item.eq.replace(' = 0', ''));
        const rs = item.answer.split(' ، ').map(root);
        assert.equal(rs.length, 2, item.eq);
        assert.ok(rs.every(r => same(f(r), 0)) && rs[0] !== rs[1], `${item.eq} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!(new Set(w.split(' ، ').map(root)).size === 2 && w.split(' ، ').map(root).every(r => same(f(r), 0))), `${w} also solves ${item.eq}`);
      }
    }
    for (const item of draws('quad_complete', 300)) {
      if (item.eq.endsWith('= 0')) {
        const f = fn(item.eq.replace(' = 0', ''));
        if (item.answer.includes('²')) {
          const [, h, k] = item.answer.match(/\(x \+ (\d+)\)² = (\d+)/)!;
          assert.ok(POINTS.every(x => same(f(x), (x + Number(h)) ** 2 - Number(k))), `${item.eq} ≠ ${item.answer}`);
          for (const w of item.wrongs) { const m = w.match(/\(x ([+−]) (\d+)\)² = (−?\d+)/)!; assert.ok(!POINTS.every(x => same(f(x), (x + (m[1] === '+' ? 1 : -1) * Number(m[2])) ** 2 - num(m[3]!)))); }
        } else {
          const rs = item.answer.split(' ، ').map(num);
          assert.ok(rs.every(r => same(f(r), 0)), `${item.eq} → ${item.answer}`);
          for (const w of item.wrongs) assert.ok(!(new Set(w.split(' ، ').map(num)).size === 2 && w.split(' ، ').map(num).every(r => same(f(r), 0))), `${w} also solves ${item.eq}`);
        }
      } else {
        const b = num(item.eq.match(/\+ (\d+)x/)![1]!);
        assert.equal(num(item.answer), (b / 2) ** 2, item.eq);
      }
    }
    for (const item of draws('quad_formula', 300).filter(i => !has(stem(i), 'عدد الحلول'))) {
      if (item.promptAr!.includes('المميز')) {
        const [c, b, a] = quad(item.eq.replace(' = 0', ''));
        assert.equal(num(item.answer), b * b - 4 * a * c, item.eq);
      } else {
        const f = fn(item.eq.replace(' = 0', ''));
        const root = (s: string) => (s.includes('/') ? num(s.split('/')[0]!) / num(s.split('/')[1]!) : num(s));
        assert.ok(item.answer.split(' ، ').map(root).every(r => same(f(r), 0)), `${item.eq} → ${item.answer}`);
      }
    }
  });

  it('quadratic functions', () => {
    for (const item of draws('quad_function', 300)) {
      const f = fn(item.eq.slice(4));
      const [c, b, a] = quad(item.eq.slice(4));
      const h = -b / (2 * a);
      const want = item.promptAr!.includes('السيني') ? h : item.promptAr!.includes('المقطع') ? c : f(h);
      assert.equal(num(item.answer), want + 0, `${item.eq}: ${item.promptAr}`);
    }
    for (const item of draws('quad_vertex', 300).filter(i => has(stem(i), 'ما رأس'))) {
      const f = fn(item.eq.slice(4));
      const [h, k] = item.answer.slice(1, -1).split(' ، ').map(num) as [number, number];
      assert.ok(same(f(h), k), `${item.eq} → ${item.answer}`);
      // a vertex is an extremum: the value one step either way is on the same side
      assert.ok((f(h + 1) - k) * (f(h - 1) - k) > 0 && same(f(h + 1), f(h - 1)), item.eq);
    }
    for (const item of draws('fn_eval', 300).filter(i => has(stem(i), 'فأوجد'))) {
      const [, body, at] = item.promptAr!.match(/f\(x\) = (.+?) فأوجد f\((−?\d+)\)/)!;
      assert.equal(num(item.answer), fn(body!)(num(at!)), item.promptAr);
    }
  });

  it('radicals and roots', () => {
    const val = (s: string) => fn(s)(0);
    for (const item of draws('radical_ops', 300)) {
      assert.ok(same(val(item.eq), val(item.answer)), `${item.eq} ≠ ${item.answer}`);
      for (const w of item.wrongs) assert.ok(!same(val(item.eq), val(w)), `${w} equals ${item.eq}`);
      if (item.eq.startsWith('√') && /√/.test(item.answer)) {
        const m = Number(item.answer.split('√')[1]);
        for (let p = 2; p * p <= m; p++) assert.notEqual(m % (p * p), 0, `${item.answer} is not fully simplified`);
      }
    }
    for (const item of draws('sqrt_basic', 300).filter(i => !has(stem(i), 'مربعة الشكل'))) {
      if (item.eq.startsWith('x² =')) assert.equal(Number(item.answer.slice(1)) ** 2, Number(item.eq.slice(5)));
      else if (item.eq.startsWith('−√')) assert.equal(-Math.sqrt(Number(item.eq.slice(2))), num(item.answer));
      else { const [a, b] = item.answer.split('/').map(Number); assert.ok(same(Math.sqrt(val(item.eq.slice(2, -1).replace('/', '/'))), a! / b!)); }
    }
    for (const item of draws('sqrt_between', 300).filter(i => has(stem(i), 'بين أي'))) {
      const n = Number(item.eq.slice(1)), [k, k1] = nums(item.answer);
      assert.ok(k! * k! < n && n < k1! * k1! && k1 === k! + 1, item.eq);
    }
    const SETS = ['الأعداد الطبيعية', 'الأعداد الصحيحة', 'الأعداد النسبية', 'الأعداد الحقيقية'];
    for (const item of draws('real_numbers', 300).filter(i => has(stem(i), 'أصغر مجموعة'))) {
      const s = item.eq;
      const root = s.match(/^√(\d+)$/);
      const want = s === 'π' || (root && !Number.isInteger(Math.sqrt(Number(root[1])))) ? 3
        : root || /^\d+$/.test(s) ? 0 : /^−\d+$/.test(s) ? 1 : 2;
      assert.equal(item.answer, SETS[want], s);
    }
  });
});

// ── kinds added 2026-10-16 ──────────────────────────────────────────────────
// Most of these lessons could ask one sentence with different numbers. Every
// kind added then is recomputed here from the printed Arabic stem alone, and
// every kind must actually be drawn.

function drawsAt(id: string, grade: number, n = 240): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + grade)));
}
/** The name of the first pattern a stem matches; an unknown stem fails. */
function kindOf(p: string, kinds: Record<string, RegExp>): string {
  const k = Object.keys(kinds).find(name => kinds[name]!.test(p));
  assert.ok(k, `unknown stem: ${p}`);
  return k!;
}
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const supNum = (s: string) => Number([...s].map(c => SUPS.indexOf(c)).join(''));
const sgn = (v: number) => (v < 0 ? `−${-v}` : String(v));
const setOf = (xs: number[]) => `{${[...new Set(xs)].sort((a, b) => a - b).map(sgn).join(' ، ')}}`;
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));
const rootVal = (s: string) => (s.includes('/') ? num(s.split('/')[0]!) / num(s.split('/')[1]!) : num(s));
const pairsIn = (s: string) => [...s.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [num(m[1]!), num(m[2]!)] as [number, number]);
const pairStrs = (s: string) => [...s.matchAll(/\(−?\d+ ، −?\d+\)/g)].map(m => m[0]);
const unitsOf = (s: string) => (s === 'وحدة واحدة' ? 1 : s === 'وحدتين' ? 2 : Number(s.split(' ')[0]));
const vertexOf = (f: string): [number, number] => { const [, b, a] = quad(f); const h = -b / (2 * a); return [h, fn(f)(h)]; };
const satisfies = (eq: string, x: number, y = 0) => { const [l, r] = eq.split(' = '); return same(fn(l!)(x, y), fn(r!)(x, y)); };
const sameFn = (f: (x: number) => number, g: (x: number) => number) => POINTS.every(x => same(f(x), g(x)));
const NSOL_T = ['حلّان حقيقيان مختلفان', 'حلّ حقيقي واحد', 'لا توجد حلول حقيقية'];
const nsolFor = (eq: string) => { const [c, b, a] = quad(eq); const d = b * b - 4 * a * c; return NSOL_T[d > 0 ? 0 : d === 0 ? 1 : 2]; };

/** Exactly one listed value passes `ok`; it is the answer, and every wrong option is one of the others listed. */
function onlyAnswer(item: ConcreteItem, listed: string[], ok: (s: string) => boolean) {
  assert.deepEqual(listed.filter(ok), [item.answer], `${stem(item)} → ${item.answer}`);
  for (const w of item.wrongs) assert.ok(listed.includes(w), `${w} is not listed in ${stem(item)}`);
}
/** The answer is `want` as a function of x; no wrong option is. */
function sameAs(item: ConcreteItem, want: (x: number) => number) {
  assert.ok(sameFn(fn(item.answer), want), `${stem(item)} → ${item.answer}`);
  for (const w of item.wrongs) assert.ok(!sameFn(fn(w), want), `${w} also answers ${stem(item)}`);
}

describe('algebra generators: kinds added 2026-10-16', () => {
  it('Grades 4–6: expressions, equations, properties', () => {
    const OPS: Record<string, (v: number, a: number) => number> = { 'جمع': (v, a) => v + a, 'طرح': (v, a) => v - a, 'ضرب': (v, a) => v * a, 'قسمة': (v, a) => v / a };
    const inX = (e: string) => fn(e.replace(/\b[a-z]\b/g, 'x'));
    for (const id of ['expr_g4', 'expr_eval']) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = stem(item);
        const k = kindOf(p, { which: /^أيّ المقادير/, box: /^في صندوق/, value: /عندما/, phrase: /^اكتب مقدارًا جبريًا/, numeric: /المقدار العددي/, shopper: /ما يدفعه/ });
        kinds.add(k);
        if (k === 'phrase') {
          const op = Object.keys(OPS).find(o => has(p, `ناتج ${o}`))!;
          const a = nums(p)[0]!;
          const want = (v: number) => OPS[op]!(v, a);
          assert.ok([3, 7.5, 13].every(v => same(inX(item.answer)(v), want(v))), `${p} → ${item.answer}`);
          for (const w of item.wrongs) assert.ok(![3, 7.5, 13].every(v => same(inX(w)(v), want(v))), `${w} also says ${p}`);
        } else if (k === 'numeric') assert.equal(Number(item.answer), fn(p.split('العددي ')[1]!.replace(/\.$/, ''))(0), p);
        else if (k === 'shopper') { const [a, b, n] = nums(p); assert.equal(Number(item.answer), a! * n! + b!, p); }
      }
      assert.equal(kinds.size, id === 'expr_g4' ? 5 : 3, `${id}: ${[...kinds]}`);
    }

    // one- and two-step equations: pick the solution, the «I thought of a number» story, write the equation
    const STORY: Array<[RegExp, (n: number[]) => number]> = [
      [/ضربه في .* وأضاف/, ([a, b, c]) => (c! - b!) / a!], [/أضافت إليه/, ([a, r]) => r! - a!], [/طرح منه/, ([a, r]) => r! + a!],
      [/ضربته في/, ([a, r]) => r! / a!], [/قسمه على/, ([a, r]) => r! * a!],
    ];
    const WRITE: Record<string, (a: number, r: number) => number> = { 'جمع': (a, r) => r - a, 'طرح': (a, r) => r + a, 'ضرب': (a, r) => r / a, 'قسمة': (a, r) => r * a };
    for (const [id, grade] of [['eq_add_sub', 5], ['eq_mul_div', 5], ['eq_mixed', 4], ['eq_mixed', 6]] as const) {
      const kinds = new Set<string>();
      for (const item of drawsAt(id, grade)) {
        const p = stem(item);
        const k = kindOf(p, { solve: /^حلّ المعادلة/, which: /^أيّ الأعداد/, story: /^فكّر/, write: /^اكتب معادلة/ });
        kinds.add(k);
        if (k === 'which') {
          const [, eq, list] = p.match(/للمعادلة (.+): (.+)؟$/)!;
          onlyAnswer(item, list!.split('، '), s => satisfies(eq!, num(s)));
        } else if (k === 'story') {
          const f = STORY.find(([re]) => re.test(p));
          assert.ok(f, p);
          assert.equal(num(item.answer), f[1](nums(p)), p);
        } else if (k === 'write') {
          const op = Object.keys(WRITE).find(o => has(p, `ناتج ${o}`))!;
          const [a, r] = nums(p);
          const x = WRITE[op]!(a!, r!);
          assert.ok(satisfies(item.answer, x), `${p} → ${item.answer}`);
          for (const w of item.wrongs) assert.ok(!satisfies(w, x), `${w} is also true of ${p}`);
        }
      }
      assert.equal(kinds.size, grade === 6 ? 3 : 4, `${id} G${grade}: ${[...kinds]}`);
    }

    const kinds = new Set<string>();
    for (const item of draws('distribute')) {
      const p = stem(item);
      const k = kindOf(p, { distribute: /^استعمل خاصية التوزيع/, name: /^ما الخاصية/, regroup: /^بسّط مستعملًا/ });
      kinds.add(k);
      if (k === 'name') {
        const eq = p.split(': ')[1]!.replace(/؟$/, '');
        assert.ok([1, 2, 5].every(x => satisfies(eq, x)), `not an identity: ${eq}`);
        const want = /^\d+\(x/.test(eq) ? 'الخاصية التوزيعية' : eq.includes('(') ? 'الخاصية التجميعية' : 'الخاصية التبديلية';
        assert.equal(item.answer, want, p);
        assert.ok(!item.wrongs.includes(want));
      } else if (k === 'regroup') sameAs(item, fn(p.split(': ')[1]!));
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('Grades 6–7: sequences', () => {
    for (const grade of [6, 7]) {
      const kinds = new Set<string>();
      for (const item of drawsAt('seq_basic', grade, 300)) {
        const p = stem(item);
        const k = kindOf(p, { next: /^ما الحد التالي/, nth: /^ما الحد رقم/, missing: /العدد المفقود/, rule: /^ما القاعدة/, general: /الحدّ العام/ });
        kinds.add(k);
        const terms = p.split(': ')[1]!.replace(/[؟…]/g, '').split('، ').map(s => s.trim()).filter(Boolean);
        if (k === 'missing') {
          const i = terms.indexOf('___');
          const known = terms.flatMap((s, j) => (s === '___' ? [] : [[j, num(s)] as [number, number]]));
          const [[j0, v0], [j1, v1]] = known as [[number, number], [number, number]];
          const d = (v1 - v0) / (j1 - j0);
          assert.ok(known.every(([j, v]) => v === v0 + (j - j0) * d), `not arithmetic: ${p}`);
          assert.equal(num(item.answer), v0 + (i - j0) * d, p);
        } else if (k === 'rule') {
          const d = num(terms[1]!) - num(terms[0]!);
          assert.equal(item.answer, d > 0 ? `أضف ${d}` : `اطرح ${-d}`, p);
          assert.ok(!item.wrongs.includes(item.answer));
        } else if (k === 'general') {
          const t = terms.map(num);
          const at = (s: string) => fn(s.replace(/n/g, 'x'));
          t.forEach((v, j) => assert.equal(at(item.answer)(j + 1), v, `${item.answer} at n = ${j + 1}: ${p}`));
          for (const w of item.wrongs) assert.ok(!t.every((v, j) => at(w)(j + 1) === v), `${w} also fits ${p}`);
        }
      }
      assert.equal(kinds.size, grade === 6 ? 3 : 5, `G${grade}: ${[...kinds]}`);
    }
  });

  it('Grade 7: expressions and equations', () => {
    let kinds = new Set<string>();
    for (const item of draws('poly_addsub')) {
      const p = stem(item);
      const k = kindOf(p, { simplify: /^بسّط: /, like: /بتجميع الحدود/, from: /^اطرح/, perimeter: /^مثلث/ });
      kinds.add(k);
      if (k === 'like') sameAs(item, fn(p.split(': ')[1]!));
      else if (k === 'from') { const [, A, B] = p.match(/^اطرح \((.+)\) من \((.+)\)\.$/)!; sameAs(item, x => fn(B!)(x) - fn(A!)(x)); }
      else if (k === 'perimeter') {
        const sides = [...p.matchAll(/\(([^()]+)\)/g)].map(m => fn(m[1]!));
        assert.equal(sides.length, 3, p);
        sameAs(item, x => sides.reduce((s, f) => s + f(x), 0));
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('poly_mul')) {
      const p = stem(item);
      const k = kindOf(p, { product: /^أوجد ناتج/, area: /^مستطيل/, expand: /^اضرب ثم بسّط/, coeff: /^ما معامل x/ });
      kinds.add(k);
      if (k === 'area') { const [, L, W] = p.match(/طوله (.+?) سم وعرضه (.+?) سم/)!; sameAs(item, x => fn(L!)(x) * fn(W!)(x)); }
      else if (k === 'expand') sameAs(item, fn(p.split(': ')[1]!));
      else if (k === 'coeff') assert.equal(num(item.answer), quad(p.match(/ناتج (.+)؟$/)![1]!)[1], p);
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('poly_special')) {
      const p = stem(item);
      const k = kindOf(p, { expand: /^أوجد ناتج/, square: /^استعمل مربع/, product: /^استعمل ناتج ضرب/ });
      kinds.add(k);
      if (k === 'square') { const [n] = nums(p); assert.equal(Number(item.answer), n! * n!, p); }
      else if (k === 'product') { const [a, b] = nums(p); assert.equal(Number(item.answer), a! * b!, p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('solve_eq', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /^حلّ المعادلة/, puzzle: /^عدد إذا/, consecutive: /أعداد صحيحة متتالية/, rectangle: /^مستطيل/ });
      kinds.add(k);
      const n = nums(p);
      if (k === 'puzzle') assert.equal(num(item.answer), (has(p, 'أُضيف') ? n[2]! - n[1]! : n[2]! + n[1]!) / n[0]!, p);
      else if (k === 'consecutive') assert.equal(num(item.answer), n[0]! / 3 + (has(p, 'أصغر') ? -1 : 1), p);
      else if (k === 'rectangle') assert.equal(num(item.answer), (n[0]! / 2 - n[1]!) / 2, p);
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('Grade 8: factoring', () => {
    let kinds = new Set<string>();
    for (const item of draws('factor_gcf', 300)) {
      const p = stem(item);
      const k = kindOf(p, { factor: /^حلّل/, gcf: /^ما العامل المشترك الأكبر/, bracket: /داخل القوسين/ });
      kinds.add(k);
      if (k === 'gcf') {
        const ms = [...p.matchAll(/(\d*)x([²³]?)/g)].map(m => [Number(m[1] || 1), m[2] ? supNum(m[2]) : 1] as const);
        assert.equal(ms.length, 2, p);
        const g = gcdN(ms[0]![0], ms[1]![0]), e = Math.min(ms[0]![1], ms[1]![1]);
        assert.equal(item.answer, `${g}x${e === 1 ? '' : SUPS[e]}`, p);
      } else if (k === 'bracket') {
        const [, e, out] = p.match(/القوسين: (.+) = (\d+x?)\( … \)؟$/)!;
        assert.ok(sameFn(x => fn(out!)(x) * fn(item.answer)(x), fn(e!)), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameFn(x => fn(out!)(x) * fn(w)(x), fn(e!)), `${w} also completes ${p}`);
        const [c, b] = quad(item.answer);
        assert.equal(gcdN(Math.abs(b), Math.abs(c)), 1, `${item.answer}: a common factor is left in the bracket`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    for (const id of ['factor_monic', 'factor_general']) {
      kinds = new Set();
      for (const item of draws(id, 300)) {
        const p = stem(item);
        const k = kindOf(p, { factor: /^حلّل/, pair: /العددان اللذان/, other: /أحد عاملي/ });
        kinds.add(k);
        if (k === 'pair') {
          const [, P, S] = p.match(/ضربهما (−?\d+) ومجموعهما (−?\d+)/)!;
          const fits = (s: string) => { const [u, v] = s.split(' ، ').map(num); return u! * v! === num(P!) && u! + v! === num(S!); };
          assert.ok(fits(item.answer), `${p} → ${item.answer}`);
          for (const w of item.wrongs) assert.ok(!fits(w), `${w} also fits ${p}`);
          // the two numbers split the middle term of the printed trinomial: product a·c, sum b
          const [c, b, a] = quad(p.match(/المقدار (.+?)(?: بتجزئة|،)/)![1]!);
          assert.ok(num(P!) === a * c && num(S!) === b, p);
        } else if (k === 'other') {
          const [, given, poly] = p.match(/إذا كان (\(.+?\)) أحد عاملي المقدار (.+)، فما/)!;
          assert.ok(sameFn(x => fn(given!)(x) * fn(item.answer)(x), fn(poly!)), `${p} → ${item.answer}`);
          for (const w of item.wrongs) assert.ok(!sameFn(x => fn(given!)(x) * fn(w)(x), fn(poly!)), `${w} is also a factor in ${p}`);
        }
      }
      assert.equal(kinds.size, 3, `${id}: ${[...kinds]}`);
    }

    kinds = new Set();
    for (const item of draws('factor_special', 300)) {
      const p = stem(item);
      const k = kindOf(p, { factor: /^حلّل/, c: /^ما قيمة c/, b: /^ما قيمة b/, numeric: /^استعمل تحليل/ });
      kinds.add(k);
      if (k === 'c') { const [, B, M] = quad(p.match(/المقدار (.+) \+ c/)![1]!); assert.equal(Number(item.answer), (B * B) / (4 * M), p); }
      else if (k === 'b') { const [, lead, C] = p.match(/المقدار (\d*)x² \+ bx \+ (\d+)/)!; assert.equal(Number(item.answer), 2 * Math.sqrt(Number(lead || 1) * Number(C)), p); }
      else if (k === 'numeric') { const [A, B] = nums(p); assert.equal(Number(item.answer), A! * A! - B! * B!, p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('Grades 8–9: inequalities and intervals', () => {
    /** «دائرة مغلقة عند 3، والتظليل نحو الأعداد الأكبر» → «x ≥ 3». */
    const drawn = (s: string) => {
      const m = s.match(/^دائرة (مغلقة|مفتوحة) عند (−?\d+)، والتظليل نحو الأعداد (الأكبر|الأصغر)$/)!;
      const closed = m[1] === 'مغلقة';
      return `x ${m[3] === 'الأكبر' ? (closed ? '≥' : '>') : (closed ? '≤' : '<')} ${m[2]}`;
    };
    for (const id of ['ineq_add', 'ineq_mul', 'ineq_multi']) {
      const kinds = new Set<string>();
      for (const item of draws(id, 300)) {
        const p = stem(item);
        const k = kindOf(p, { solve: /^حلّ المتباينة/, check: /^أيّ الأعداد/, line: /^صِف تمثيل/, story: /المتباينة التي تمثّل/ });
        kinds.add(k);
        if (k === 'check') {
          const [, eq, list] = p.match(/المتباينة (.+): (.+)؟$/)!;
          onlyAnswer(item, list!.split('، '), s => holds(eq!, num(s)));
        } else if (k === 'line') {
          const eq = p.match(/المتباينة (.+) على خط/)![1]!;
          assert.ok(sameSet(eq, drawn(item.answer)), `${eq}: ${item.answer}`);
          for (const w of item.wrongs) assert.ok(!sameSet(eq, drawn(w)), `${w} also draws ${eq}`);
        } else if (k === 'story') {
          const n = snums(p);
          let want: string;
          if (has(p, 'نقطة')) want = `x ≥ ${n[0]! - n[1]!}`;
          else if (has(p, 'حقيبة')) want = `x ≤ ${n[0]! - n[1]!}`;
          else if (has(p, 'ومع سامي')) want = `x ≤ ${n[1]! / n[0]!}`;
          else if (has(p, 'على الأقل من بيع')) want = `x ≥ ${n[0]! / n[1]!}`;
          else {
            const [a, b, c] = n;
            const s = has(p, 'أكبر من') ? '>' : has(p, 'أقل من') ? '<' : has(p, 'لا يقل عن') ? '≥' : '≤';
            want = `x ${s} ${(has(p, 'أُضيف') ? c! - b! : c! + b!) / a!}`;
          }
          assert.ok(sameSet(item.answer, want), `${p} → ${item.answer}, not ${want}`);
          for (const w of item.wrongs) assert.ok(!sameSet(w, want), `${w} also answers ${p}`);
        }
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }

    let kinds = new Set<string>();
    for (const item of draws('ineq_compound', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /^حلّ المتباينة المركبة/, words: /^اكتب متباينة مركبة/, interval: /باستعمال الفترات/ });
      kinds.add(k);
      if (k === 'words') {
        const [lo, hi] = snums(p);
        const either = /\d أو /.test(p);
        const [left, right] = either ? p.split(/(?<=\d) أو /) : p.split(' وأقل');
        const sl = has(left!, 'أو يساوي'), sr = has(right!, 'أو يساوي');
        const want = either ? `x ${sl ? '≤' : '<'} ${lo} أو x ${sr ? '≥' : '>'} ${hi}` : `${lo} ${sl ? '≤' : '<'} x ${sr ? '≤' : '<'} ${hi}`;
        assert.ok(sameSet(item.answer, want), `${p} → ${item.answer}, not ${want}`);
        for (const w of item.wrongs) assert.ok(!sameSet(w, want), `${w} also says ${p}`);
      } else if (k === 'interval') {
        const eq = p.match(/المركبة (.+) باستعمال/)![1]!;
        assert.ok(GRID.every(x => inInterval(item.answer, x) === holds(eq, x)), `${eq} vs ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!GRID.every(x => inInterval(w, x) === holds(eq, x)), `${w} is also ${eq}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('intervals', 300)) {
      const p = stem(item);
      const k = kindOf(p, { toInterval: /على صورة فترة/, toInequality: /^اكتب الفترة/, roster: /بطريقة سرد/, type: /^ما نوع الفترة/, builder: /الصفة المميزة/ });
      kinds.add(k);
      if (k === 'toInequality') {
        const iv = p.match(/الفترة (.+) على صورة/)![1]!;
        assert.ok(GRID.every(x => inInterval(iv, x) === holds(item.answer, x)), `${iv} vs ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!GRID.every(x => inInterval(iv, x) === holds(w, x)), `${w} is also ${iv}`);
      } else if (k === 'roster') {
        const cond = p.match(/تحقّق (.+)\.$/)![1]!;
        const xs: number[] = [];
        for (let x = -30; x <= 30; x++) if (holds(cond, x)) xs.push(x);
        assert.equal(item.answer, setOf(xs), p);
        assert.ok(!item.wrongs.includes(setOf(xs)));
      }
    }
    assert.equal(kinds.size, 5, [...kinds].join());
  });

  it('Grade 8: systems', () => {
    for (const id of ['sys_graph', 'sys_sub', 'sys_elim']) {
      const kinds = new Set<string>();
      for (const item of draws(id, 300)) {
        const p = stem(item);
        const k = kindOf(p, { solve: /^حلّ النظام/, which: /^أيّ الأزواج/, sumDiff: /^مجموع عددين/, tickets: /تذكرة/ });
        kinds.add(k);
        const n = nums(p);
        if (k === 'which') {
          const [first, ...eqs] = p.split('\n');
          onlyAnswer(item, pairStrs(first!), s => { const [[x, y]] = pairsIn(s) as [[number, number]]; return eqs.every(e => satisfies(e, x, y)); });
        } else if (k === 'sumDiff') assert.equal(Number(item.answer), (n[0]! + (has(p, 'الأكبر') ? n[1]! : -n[1]!)) / 2, p);
        else if (k === 'tickets') { const [total, A, C, T] = n; assert.equal(Number(item.answer), (T! - C! * total!) / (A! - C!), p); }
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
  });

  it('Grade 8: lines', () => {
    const onLine = (eq: string, x: number, y: number) => satisfies(eq, x, y);
    /** Points (x, y) on a printed line, y solved from it. */
    const pointsOf = (eq: string) => [0, 1, 2].map(x => { const [l, r] = eq.split(' = '); const g = (y: number) => fn(l!)(x, y) - fn(r!)(x, y); return [x, -g(0) / (g(1) - g(0))] as [number, number]; });
    let kinds = new Set<string>();
    for (const item of draws('line_slope', 300)) {
      const p = stem(item);
      const k = kindOf(p, { slope: /^أوجد ميل/, rate: /معدّل التغيّر/, missing: /^ما قيمة k/ });
      kinds.add(k);
      if (k === 'rate') { const [h1, t1, h2, t2] = nums(p); assert.equal(num(item.answer), (h2! - h1!) / (t2! - t1!), p); }
      else if (k === 'missing') {
        const [[x1, y1]] = pairsIn(p) as [[number, number]];
        const x2 = num(p.match(/\((−?\d+) ، k\)/)![1]!), m = num(p.match(/يساوي (−?\d+)/)![1]!);
        assert.equal(num(item.answer), y1 + m * (x2 - x1), p);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('line_slope_int', 300)) {
      const p = stem(item);
      const k = kindOf(p, { slopeAndIntercept: /ميله/, twoPoints: /بالنقطتين/, standard: /^اكتب المعادلة/ });
      kinds.add(k);
      if (k === 'standard') {
        const pts = pointsOf(p.match(/المعادلة (.+) بصيغة/)![1]!);
        assert.ok(item.answer.startsWith('y = ') && pts.every(([x, y]) => onLine(item.answer, x, y)), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!pts.every(([x, y]) => onLine(w, x, y)), `${w} is also the line in ${p}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('line_point_slope', 300)) {
      const p = stem(item);
      const k = kindOf(p, { slopeAndPoint: /ميله/, twoPoints: /بالنقطتين/, toSlopeIntercept: /^اكتب المعادلة/ });
      kinds.add(k);
      if (k === 'twoPoints') {
        const [[x1, y1], [x2, y2]] = pairsIn(p.split('، مستعملًا')[0]!) as [[number, number], [number, number]];
        assert.ok(onLine(item.answer, x1, y1) && onLine(item.answer, x2, y2), `${p} → ${item.answer}`);
        assert.ok(item.answer.startsWith(`y ${y1 < 0 ? '+' : '−'} ${Math.abs(y1)} = `), `not written at the first point: ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!(onLine(w, x1, y1) && onLine(w, x2, y2)), `${w} is also the line in ${p}`);
      } else if (k === 'toSlopeIntercept') {
        const pts = pointsOf(p.match(/المعادلة (.+) بصيغة/)![1]!);
        assert.ok(item.answer.startsWith('y = ') && pts.every(([x, y]) => onLine(item.answer, x, y)), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!pts.every(([x, y]) => onLine(w, x, y)), `${w} is also the line in ${p}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('Grade 9: quadratic equations', () => {
    let kinds = new Set<string>();
    for (const item of draws('quad_factor', 400)) {
      const p = stem(item);
      const k = kindOf(p, { factor: /بالتحليل\.$/, gcf: /العامل المشترك/, root: /الجذر التربيعي/, zero: /^ما حلول/, rectangle: /^مستطيل/ });
      kinds.add(k);
      if (k === 'rectangle') { const [d, A] = nums(p); assert.equal(Number(item.answer), (-d! + Math.sqrt(d! * d! + 4 * A!)) / 2, p); continue; }
      const eq = p.match(/المعادلة (.+?)(?: بإخراج| باستعمال| بالتحليل|؟)/)![1]!;
      const [l, r] = eq.split(' = ');
      const g = (x: number) => fn(l!)(x) - fn(r!)(x);
      const rs = item.answer.split(' ، ').map(rootVal);
      assert.ok(rs.length === 2 && rs[0] !== rs[1] && rs.every(x => same(g(x), 0)), `${eq} → ${item.answer}`);
      for (const w of item.wrongs) { const ws = w.split(' ، ').map(rootVal); assert.ok(!(ws.length === 2 && ws[0] !== ws[1] && ws.every(x => same(g(x), 0))), `${w} also solves ${eq}`); }
    }
    assert.equal(kinds.size, 5, [...kinds].join());

    kinds = new Set();
    for (const item of draws('quad_graph', 300)) {
      const p = stem(item);
      const k = kindOf(p, { graph: /بيانيًا/, count: /كم حلًّا/, standard: /بالصورة القياسية/ });
      kinds.add(k);
      if (k === 'count') {
        const eq = p.match(/بالمعادلة (.+) = 0 هو/)![1]!;
        assert.deepEqual(pairsIn(p)[0], vertexOf(eq).map(v => v + 0), `the printed vertex is not ${eq}'s`);
        assert.equal(item.answer, nsolFor(eq), p);
      } else if (k === 'standard') {
        const [l, r] = p.match(/المعادلة (.+) بالصورة/)![1]!.split(' = ');
        const want = (x: number) => fn(l!)(x) - fn(r!)(x);
        const lhs = (s: string) => fn(s.replace(/ = 0$/, ''));
        assert.ok(item.answer.endsWith(' = 0') && sameFn(lhs(item.answer), want), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameFn(lhs(w), want) && !sameFn(lhs(w), x => -want(x)), `${w} is also ${p}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('quad_formula', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /القانون العام/, discriminant: /^أوجد قيمة المميز/, count: /عدد الحلول الحقيقية/ });
      kinds.add(k);
      if (k === 'count') assert.equal(item.answer, nsolFor(p.match(/للمعادلة (.+) = 0\./)![1]!), p);
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('Grade 9: transformations and functions', () => {
    let kinds = new Set<string>();
    for (const item of draws('quad_vertex', 300)) {
      const p = stem(item);
      const k = kindOf(p, { vertex: /^ما رأس/, which: /^ما التحويل/, write: /^انسحب منحنى/, axis: /محور التماثل/ });
      kinds.add(k);
      if (k === 'which') {
        const [h, v] = vertexOf(p.match(/إلى منحنى الاقتران y = (.+)؟$/)![1]!);
        const want = h > 0 ? 'اليمين' : h < 0 ? 'اليسار' : v > 0 ? 'الأعلى' : 'الأسفل';
        const m = item.answer.match(/^انسحاب (.+) إلى (.+)$/)!;
        assert.ok(unitsOf(m[1]!) === Math.abs(h || v) && m[2] === want, `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!w.endsWith(`إلى ${want}`), `${w} also says ${p}`);
      } else if (k === 'write') {
        const want = pairsIn(p)[0]!;
        const f = item.answer.slice(4);
        assert.ok(quad(f)[2] === 1, `${item.answer} is not a translation of y = x²`);
        assert.deepEqual(vertexOf(f), want, `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.notDeepEqual(vertexOf(w.slice(4)), want, `${w} also says ${p}`);
      } else if (k === 'axis') {
        const [h] = vertexOf(p.match(/الاقتران y = (.+)؟$/)![1]!);
        assert.equal(item.answer, `x = ${sgn(h)}`, p);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('fn_eval', 300)) {
      const p = stem(item);
      const k = kindOf(p, { evaluate: /فأوجد/, domain: /^ما (مجال|مدى) العلاقة/, range: /ومجاله/, keep: /فتبقى اقترانًا/ });
      kinds.add(k);
      if (k === 'domain') {
        const ps = pairsIn(p);
        assert.equal(item.answer, setOf(ps.map(([x, y]) => (has(p, 'مجال') ? x : y))), p);
        assert.ok(!item.wrongs.includes(item.answer));
      } else if (k === 'range') {
        const [, f, D] = p.match(/f\(x\) = (.+) ومجاله \{(.+)\}، فما/)!;
        assert.equal(item.answer, setOf(D!.split(' ، ').map(num).map(x => fn(f!)(x))), p);
      } else if (k === 'keep') {
        const [rel, list] = p.split(' فتبقى اقترانًا: ');
        const xs = pairsIn(rel!).map(([x]) => x);
        assert.equal(new Set(xs).size, xs.length, `the relation is not a function: ${rel}`);
        onlyAnswer(item, pairStrs(list!), s => !xs.includes(pairsIn(s)[0]![0]));
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('Grade 9: exponents, radicals, rational expressions', () => {
    let kinds = new Set<string>();
    for (const item of draws('exp_simplify', 300)) {
      const p = stem(item);
      const k = kindOf(p, { simplify: /^بسّط/, positive: /بأسس موجبة/, value: /^أوجد قيمة/, missing: /^ما قيمة n/ });
      kinds.add(k);
      if (k === 'value') {
        assert.match(item.answer, /^1\/\d+$/);
        assert.ok(same(fn(item.answer)(0), fn(p.match(/قيمة (.+)\.$/)![1]!)(0)), p);
      } else if (k === 'missing') {
        const [m, t] = [...p.matchAll(/x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g)].map(x => supNum(x[1]!));
        assert.equal(Number(item.answer), has(p, '·') ? t! - m! : t! / m!, p);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('radical_ops', 300)) {
      const p = stem(item);
      const k = kindOf(p, { simplify: /^بسّط/, operate: /^أوجد ناتج/, rationalise: /أنطِق/, perimeter: /^مستطيل/ });
      kinds.add(k);
      const v = (s: string) => fn(s)(0);
      let want = NaN;
      if (k === 'rationalise') { const [, top, m] = p.match(/الكسر (\d+)\/√(\d+)/)!; want = Number(top) / Math.sqrt(Number(m)); assert.ok(!item.answer.includes('/'), item.answer); }
      else if (k === 'perimeter') { const [, L, W] = p.match(/طوله (.+?) سم وعرضه (.+?) سم/)!; want = 2 * (v(L!) + v(W!)); }
      else continue;
      assert.ok(same(v(item.answer), want), `${p} → ${item.answer}`);
      for (const w of item.wrongs) assert.ok(!same(v(w), want), `${w} also answers ${p}`);
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('radical_eq', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /^حلّ المعادلة: /, extraneous: /الحلول الدخيلة/, story: /^عدد إذا/ });
      kinds.add(k);
      if (k === 'extraneous') {
        const eq = p.match(/المعادلة (.+)، وتحقّق/)![1]!;
        const [l, r] = eq.split(' = ');
        const inner = fn(l!.match(/√\((.+)\)/)?.[1] ?? 'x');
        // squaring both sides: inner(x) = r(x)²; its two roots, of which only one solves the equation
        const S = (x: number) => inner(x) - fn(r!)(x) ** 2;
        const c = S(0), b = (S(1) - S(-1)) / 2, a = (S(1) + S(-1)) / 2 - c;
        const disc = Math.sqrt(b * b - 4 * a * c);
        const roots = [(-b - disc) / (2 * a), (-b + disc) / (2 * a)];
        const real = roots.filter(x => satisfies(eq, x));
        assert.deepEqual(real, [num(item.answer)], `${eq} → ${item.answer}`);
        assert.ok(item.wrongs.includes(sgn(roots.find(x => x !== real[0])!)), `the extraneous root is not offered: ${item.wrongs}`);
      } else if (k === 'story') {
        const [a, b] = nums(p);
        assert.equal(num(item.answer), b! * b! + (has(p, 'أُضيف') ? -a! : a!), p);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    const PTS = [-6.5, -2.5, 0.5, 1.5, 3.5, 8.5];
    const sameR = (a: string, b: string) => PTS.every(x => same(fn(a)(x), fn(b)(x)));
    kinds = new Set();
    for (const item of draws('rat_expr_muldiv', 300)) {
      const p = stem(item);
      const k = kindOf(p, { simplify: /^بسّط/, undefinedAt: /غير معرّف/, lowest: /في أبسط صورة/ });
      kinds.add(k);
      if (k === 'undefinedAt') {
        const den = fn(p.match(/\)\/\((.+)\) غير/)![1]!);
        const zeros: number[] = [];
        for (let x = -20; x <= 20; x++) if (den(x) === 0) zeros.push(x);
        assert.equal(item.answer, zeros.map(sgn).join(' ، '), p);
        assert.ok(!item.wrongs.includes(item.answer));
      } else if (k === 'lowest') {
        const e = p.match(/المقدار (.+) في أبسط/)![1]!;
        assert.match(item.answer, /^\(x [+−] \d+\)\/\(x [+−] \d+\)$/);
        assert.ok(sameR(e, item.answer), `${e} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameR(e, w), `${w} equals ${e}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('rat_expr_addsub', 300)) {
      const p = stem(item);
      const k = kindOf(p, { simplify: /^بسّط/, lcm: /المضاعف المشترك الأصغر/, unlike: /^أوجد ناتج/ });
      kinds.add(k);
      if (k === 'lcm') {
        const ms = [...p.matchAll(/(\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]*)/g)].map(m => [Number(m[1]), m[2] ? supNum(m[2]) : 1] as const);
        const L = (ms[0]![0] * ms[1]![0]) / gcdN(ms[0]![0], ms[1]![0]), e = Math.max(ms[0]![1], ms[1]![1]);
        assert.equal(item.answer, `${L}x${e === 1 ? '' : SUPS[e]}`, p);
      } else if (k === 'unlike') {
        const e = p.match(/ناتج (.+) في أبسط/)![1]!;
        assert.ok(sameR(e, item.answer), `${e} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameR(e, w), `${w} equals ${e}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    kinds = new Set();
    for (const item of draws('rat_eq', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /^حلّ المعادلة: /, cross: /الضرب التبادلي/, work: /يُنجز/ });
      kinds.add(k);
      if (k === 'cross') {
        const [, a, s1, p1, b, s2, q1] = p.match(/(\d+)\/\(x ([+−]) (\d+)\) = (\d+)\/\(x ([+−]) (\d+)\)/)!;
        const P = (s1 === '+' ? 1 : -1) * Number(p1), Q = (s2 === '+' ? 1 : -1) * Number(q1);
        // a(x + Q) = b(x + P)
        assert.equal(num(item.answer), (Number(b) * P - Number(a) * Q) / (Number(a) - Number(b)) + 0, p);
      } else if (k === 'work') { const [h1, h2] = nums(p); assert.equal(Number(item.answer), (h1! * h2!) / (h1! + h2!), p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('Grade 8: roots and real numbers', () => {
    let kinds = new Set<string>();
    for (const item of draws('sqrt_basic', 300)) {
      const p = stem(item);
      const k = kindOf(p, { solve: /^حلّ/, value: /^أوجد قيمة/, side: /طول ضلعها/, perimeter: /محيطها/ });
      kinds.add(k);
      const [A] = nums(p);
      if (k === 'side') assert.equal(Number(item.answer), Math.sqrt(A!), p);
      else if (k === 'perimeter') assert.equal(Number(item.answer), 4 * Math.sqrt(A!), p);
    }
    assert.equal(kinds.size, 4, [...kinds].join());

    kinds = new Set();
    for (const item of draws('sqrt_between', 300)) {
      const p = stem(item);
      const k = kindOf(p, { between: /بين أي/, nearest: /أقرب عدد صحيح/, tenth: /لأقرب جزء من عشرة/ });
      kinds.add(k);
      const [n] = nums(p);
      if (k === 'nearest') {
        let f = 0;
        while ((f + 1) * (f + 1) <= n!) f++;
        // nearer to f than to f + 1 exactly when n < (f + ½)²
        assert.equal(Number(item.answer), n! < (f + 0.5) ** 2 ? f : f + 1, p);
      } else if (k === 'tenth') {
        assert.match(item.answer, /^\d+\.\d$/);
        assert.ok(Math.abs(Number(item.answer) - Math.sqrt(n!)) <= 0.05, `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(Math.abs(Number(w) - Math.sqrt(n!)) > 0.05, `${w} also rounds √${n}`);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());

    const value = (s: string) => {
      if (s === 'π') return Math.PI;
      const neg = s.startsWith('−') ? -1 : 1, t = s.replace('−', '');
      if (t.startsWith('√')) return neg * Math.sqrt(Number(t.slice(1)));
      if (t.includes('/')) return (neg * Number(t.split('/')[0])) / Number(t.split('/')[1]);
      return neg * Number(t);
    };
    const rational = (s: string) => s !== 'π' && (!s.includes('√') || Number.isInteger(Math.sqrt(Number(s.replace(/[−√]/g, '')))));
    kinds = new Set();
    for (const item of draws('real_numbers', 300)) {
      const p = stem(item);
      const k = kindOf(p, { smallestSet: /أصغر مجموعة/, kind: /^أيّ الأعداد الآتية عدد/, extreme: /^ما (أكبر|أصغر) الأعداد/ });
      kinds.add(k);
      const list = p.split(': ')[1]?.replace(/؟$/, '').split('، ') ?? [];
      if (k === 'kind') onlyAnswer(item, list, s => rational(s) === !has(p, 'غير نسبي'));
      else if (k === 'extreme') {
        const vs = list.map(value);
        const want = list[vs.indexOf(has(p, 'ما أكبر') ? Math.max(...vs) : Math.min(...vs))];
        assert.equal(item.answer, want, p);
        assert.equal(list.length, 4);
      }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });
});

describe('algebra generators: kinds added for thin lessons', () => {
  it('Grade 4 expressions: which expression has a value, a situation as an expression', () => {
    const inX = (e: string) => fn(e.replace(/\b[a-z]\b/g, 'x'));
    const kinds = new Set<string>();
    for (const item of drawsAt('expr_g4', 4, 300)) {
      const p = stem(item);
      if (has(p, 'أيّ المقادير')) {
        // evaluate every listed expression at the given value; exactly the answer hits the target
        kinds.add('which');
        const [, target, v, val, list] = p.match(/قيمته (\d+) عندما ([a-z]) = (\d+): (.+)؟$/)!;
        const listed = list!.split(' ، ');
        assert.equal(listed.length, 4, p);
        const hits = listed.filter(e => new Function(v!, `return ${js(e)}`)(Number(val)) === Number(target));
        assert.deepEqual(hits, [item.answer], p);
        for (const w of item.wrongs) assert.ok(listed.includes(w), `${w} not listed in ${p}`);
      } else if (has(p, 'في صندوق')) {
        // n marbles, m put in or taken out
        kinds.add('box');
        const m = nums(p)[0]!;
        const want = (n: number) => (has(p, 'أخرج') ? n - m : n + m);
        assert.ok([3, 7.5, 13].every(n => same(inX(item.answer)(n), want(n))), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(![3, 7.5, 13].every(n => same(inX(w)(n), want(n))), `${w} also says ${p}`);
      }
    }
    assert.equal(kinds.size, 2, [...kinds].join());
  });

  it('Grade 8 writing inequalities: a solution from a list, the drawing, the inequality a drawing shows', () => {
    const kinds = new Set<string>();
    for (const item of draws('ineq_write', 300)) {
      const p = stem(item);
      const k = kindOf(p, { words: /^اكتب متباينة تعبّر/, check: /^أيّ الأعداد/, line: /^صِف تمثيل/, fromLine: /تمثيلها على خط الأعداد/ });
      kinds.add(k);
      if (k === 'check') {
        const [, eq, list] = p.match(/المتباينة (.+): (.+)؟$/)!;
        onlyAnswer(item, list!.split('، '), s => holds(eq!, num(s)));
      } else if (k === 'line') {
        const eq = p.match(/المتباينة (.+) على خط/)![1]!;
        const [, o, b] = eq.match(/^x (\S+) (−?\d+)$/)!;
        const closed = o === '≤' || o === '≥', up = o === '>' || o === '≥';
        assert.equal(item.answer, `دائرة ${closed ? 'مغلقة' : 'مفتوحة'} عند ${b}، والتظليل نحو الأعداد ${up ? 'الأكبر' : 'الأصغر'}`, p);
        assert.ok(!item.wrongs.includes(item.answer), p);
      } else if (k === 'fromLine') {
        const b = p.match(/عند (−?\d+) /)![1]!;
        const want = has(p, 'الأكبر') ? (has(p, 'مغلقة') ? `x ≥ ${b}` : `x > ${b}`) : (has(p, 'مغلقة') ? `x ≤ ${b}` : `x < ${b}`);
        assert.ok(sameSet(item.answer, want), `${p} → ${item.answer}, not ${want}`);
        for (const w of item.wrongs) assert.ok(!sameSet(w, want), `${w} also draws ${p}`);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('Grade 8 standard form: a table of values, an intercept in a situation', () => {
    const kinds = new Set<string>();
    for (const item of draws('line_standard', 300)) {
      const p = stem(item);
      if (has(p, 'جدول قيم')) {
        // solve the printed equation for y at the printed x
        kinds.add('table');
        const [, eq, x] = p.match(/المعادلة (.+)، ما قيمة y عندما x = (−?\d+)؟$/)!;
        const [l, r] = eq!.split(' = ');
        const g = (y: number) => fn(l!)(num(x!), y) - fn(r!)(0);
        const y = -g(0) / (g(1) - g(0));
        assert.ok(same(num(item.answer), y), `${p} → ${item.answer}, not ${y}`);
        assert.ok(item.wrongs.every(w => !same(num(w), y)), p);
      } else if (has(p, 'كرة')) {
        // all the money on one item: the total divided by that item's price
        kinds.add('situation');
        const [A, B, C] = nums(p.match(/المعادلة (.+?) شراء/)![1]!);
        const priceA = Number(p.match(/سعر الكرة (\d+)/)![1]), priceB = Number(p.match(/سعر المضرب (\d+)/)![1]);
        assert.ok(priceA === A && priceB === B && has(p, `بمبلغ ${C} `), p);
        const want = has(p, 'كم كرةً') ? C! / A! : C! / B!;
        assert.equal(Number(item.answer), want, p);
        assert.ok(item.wrongs.every(w => Number(w) !== want), p);
      }
    }
    assert.equal(kinds.size, 2, [...kinds].join());
  });

  it('Grade 9 sets and intervals: the type of an interval, a solution set in set-builder form', () => {
    const kinds = new Set<string>();
    for (const item of draws('intervals', 300)) {
      const p = stem(item);
      if (has(p, 'ما نوع الفترة')) {
        kinds.add('type');
        const [, l, r] = p.match(/([[(])−?\d+ ، −?\d+([\])])؟$/)!;
        assert.equal(item.answer, l === '[' && r === ']' ? 'فترة مغلقة' : l === '(' && r === ')' ? 'فترة مفتوحة' : 'فترة نصف مفتوحة', p);
      } else if (has(p, 'الصفة المميزة')) {
        // the set {x | x o b} must hold exactly where the printed inequality holds
        kinds.add('builder');
        const eq = p.match(/المتباينة (.+) بطريقة/)![1]!;
        const inner = (s: string) => s.match(/^\{x \| (.+)\}$/)![1]!;
        assert.ok(sameSet(inner(item.answer), eq), `${eq} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameSet(inner(w), eq), `${w} is also ${eq}`);
      }
    }
    assert.equal(kinds.size, 2, [...kinds].join());
  });
});

// ── routing ─────────────────────────────────────────────────────────────────

describe('algebra routing', () => {
  const cases: Array<[string, number, string | null]> = [
    ['المقادير والمتغيرات', 4, 'expr_g4'], ['معادلات الجمع والطرح', 5, 'eq_add_sub'], ['معادلات الضرب والقسمة', 5, 'eq_mul_div'],
    ['المعادلات', 6, 'eq_mixed'], ['الخصائص الجبرية', 6, 'distribute'], ['المتتاليات', 7, 'seq_basic'], ['المتتاليات', 10, null],
    ['جمع المقادير الجبرية وطرحها', 7, 'poly_addsub'], ['ضرب المقادير الجبرية', 7, 'poly_mul'], ['حالات خاصة من ضرب المقادير الجبرية', 7, 'poly_special'],
    ['حل المعادلات', 7, 'solve_eq'], ['حل المتباينات بالجمع والطرح', 8, 'ineq_add'], ['حل المتباينات متعددة الخطوات', 8, 'ineq_multi'],
    ['حل نظام من معادلتين خطيتين بالحذف', 8, 'sys_elim'], ['التحليل بإخراج العامل المشترك الأكبر', 8, 'factor_gcf'],
    ['تحليل ثلاثيات الحدود x²+bx+c', 8, 'factor_monic'], ['تحليل ثلاثيات الحدود ax²+bx+c', 8, 'factor_general'], ['حالات خاصة من التحليل', 8, 'factor_special'],
    ['ميل المستقيم', 8, 'line_slope'], ['المستقيمات المتوازية والمتعامدة', 8, 'line_par_perp'], ['المستقيمات المتوازية والقاطع', 7, 'parallel_transversal'],
    ['حل المعادلات التربيعية بإكمال المربع', 9, 'quad_complete'], ['حل المعادلات التربيعية باستعمال القانون العام', 9, 'quad_formula'],
    ['معمل برمجية جيوجبرا: استكشاف التحويلات الهندسية للاقتران التربيعي', 9, 'quad_vertex'],
    ['تبسيط المقادير الأسية', 9, 'exp_simplify'], ['حل المعادلات الجذرية', 9, 'radical_eq'], ['حل المعادلات النسبية', 9, 'rat_eq'],
    ['ضرب المقادير الجبرية النسبية وقسمتها', 9, 'rat_expr_muldiv'], ['الأعداد الحقيقية', 8, 'real_numbers'], ['الجذور الصماء', 8, 'sqrt_between'],
  ];
  for (const [title, grade, id] of cases) {
    it(`${title} (G${grade}) → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, grade)?.id ?? null, id);
      if (id) assert.ok(mathBankCovers(title, null, grade));
    });
  }
});
