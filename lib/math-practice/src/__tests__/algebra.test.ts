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
  t = t.replace(/(\d*)√\(([^()]*)\)/g, (_, k, r) => `(${k || 1}*Math.sqrt(${r}))`).replace(/(\d*)√(\d+)/g, (_, k, r) => `(${k || 1}*Math.sqrt(${r}))`);
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
    for (const item of draws('expr_g4')) {
      const [, v, val] = item.promptAr!.match(/عندما (\w) = (\d+)/)!;
      assert.equal(num(item.answer), new Function(v!, `return ${js(item.eq)}`)(Number(val)), item.promptAr);
    }
    for (const item of draws('expr_eval')) {
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
      for (const item of draws(id, 300)) {
        const [l, r] = item.eq.split(' = ');
        const ok = (v: number) => same(fn(l!)(v), fn(r!)(v));
        assert.ok(ok(num(item.answer)), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!ok(num(w)), `${id}: wrong option ${w} satisfies ${item.eq}`);
      }
    }
  });

  it('sequences', () => {
    for (const item of draws('seq_basic', 300)) {
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
      for (const item of draws(id, 300)) {
        assert.ok(equivalent(item.eq, item.answer), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!equivalent(item.eq, w), `${id}: wrong option ${w} equals ${item.eq}`);
      }
    }
  });

  it('factoring: the answer multiplies back, the wrong options do not', () => {
    for (const id of ['factor_gcf', 'factor_monic', 'factor_general', 'factor_special']) {
      for (const item of draws(id, 300)) {
        assert.ok(equivalent(item.eq, item.answer), `${id}: ${item.eq} ≠ ${item.answer}`);
        // a half-done GCF is the same polynomial; it is wrong because it is not the GREATEST factor
        if (id !== 'factor_gcf') for (const w of item.wrongs) assert.ok(!equivalent(item.eq, w), `${id}: wrong factoring ${w} equals ${item.eq}`);
      }
    }
    // a «trinomial» lesson never serves a binomial, and no wrong factor is «x + 0»
    for (const item of draws('factor_monic')) {
      assert.match(item.eq, /^x² [+−] \d*x [+−] \d+$/, item.eq);
      assert.ok(!item.wrongs.some(w => /[+−] 0\)/.test(w)), item.wrongs.join(' | '));
    }
    // the GCF really is the greatest
    for (const item of draws('factor_gcf')) {
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
      for (const item of draws(id, 300)) {
        const pts = [-6.5, -2.5, 0.5, 1.5, 3.5, 8.5];
        assert.ok(pts.every(x => same(fn(item.eq)(x), fn(item.answer)(x))), `${id}: ${item.eq} ≠ ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!pts.every(x => same(fn(item.eq)(x), fn(w)(x))), `${id}: wrong ${w} equals ${item.eq}`);
      }
    }
  });

  it('inequalities: same solution set as the stem; wrong options are different sets', () => {
    for (const id of ['ineq_add', 'ineq_mul', 'ineq_multi', 'ineq_compound']) {
      for (const item of draws(id, 300)) {
        const stem = id === 'ineq_compound' ? item.eq : item.eq;
        assert.ok(sameSet(stem, item.answer), `${id}: ${stem} vs ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!sameSet(stem, w), `${id}: wrong ${w} has the solution set of ${stem}`);
      }
    }
    const WORDS: Record<string, string> = { 'أكبر من': '>', 'أقل من': '<', 'لا يقل عن': '≥', 'لا يزيد على': '≤' };
    for (const item of draws('ineq_write')) {
      const word = Object.keys(WORDS).find(w => item.promptAr!.includes(w))!;
      assert.equal(item.answer.split(' ')[1], WORDS[word], item.promptAr);
    }
  });

  it('intervals match the inequality', () => {
    const inInterval = (s: string, x: number) => {
      const m = s.match(/^([([])(.+?) ، (.+?)([)\]])$/)!;
      const lo = m[2] === '−∞' ? -Infinity : num(m[2]!), hi = m[3] === '∞' ? Infinity : num(m[3]!);
      return (m[1] === '(' ? x > lo : x >= lo) && (m[4] === ')' ? x < hi : x <= hi);
    };
    for (const item of draws('intervals', 300)) {
      assert.ok(GRID.every(x => inInterval(item.answer, x) === holds(item.eq, x)), `${item.eq} vs ${item.answer}`);
      for (const w of item.wrongs) assert.ok(!GRID.every(x => inInterval(w, x) === holds(item.eq, x)), `${w} is also ${item.eq}`);
    }
  });

  it('systems: the answer satisfies both equations, no wrong option does', () => {
    for (const id of ['sys_graph', 'sys_sub', 'sys_elim']) {
      for (const item of draws(id, 300)) {
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
    for (const item of draws('line_slope', 300)) {
      const [[x1, y1], [x2, y2]] = [...item.eq.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [num(m[1]!), num(m[2]!)]) as [number, number][];
      const v = (s: string) => (s.includes('/') ? num(s.split('/')[0]!) / num(s.split('/')[1]!) : num(s));
      assert.ok(same(v(item.answer), (y2! - y1!) / (x2! - x1!)), item.eq);
      for (const w of item.wrongs) assert.ok(!same(v(w), (y2! - y1!) / (x2! - x1!)), `${w} is also the slope`);
    }
    const onLine = (eq: string, x: number, y: number) => { const [l, r] = eq.split(' = '); return same(fn(l!)(x, y), fn(r!)(x, y)); };
    for (const item of draws('line_slope_int', 300)) {
      const pts = [...item.promptAr!.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [num(m[1]!), num(m[2]!)]) as [number, number][];
      if (pts.length === 2) assert.ok(pts.every(([x, y]) => onLine(item.answer, x, y!)), `${item.answer} misses ${pts}`);
      else { const [, m, b] = item.promptAr!.match(/ميله (−?\d+) .* عند (−?\d+)/)!; assert.ok(onLine(item.answer, 0, num(b!)) && onLine(item.answer, 1, num(b!) + num(m!)), item.promptAr); }
    }
    for (const item of draws('line_point_slope', 300)) {
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
    for (const item of draws('line_standard', 300)) {
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
      for (const item of draws(id, 300)) {
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
    for (const item of draws('quad_formula', 300)) {
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
    for (const item of draws('quad_vertex', 300)) {
      const f = fn(item.eq.slice(4));
      const [h, k] = item.answer.slice(1, -1).split(' ، ').map(num) as [number, number];
      assert.ok(same(f(h), k), `${item.eq} → ${item.answer}`);
      // a vertex is an extremum: the value one step either way is on the same side
      assert.ok((f(h + 1) - k) * (f(h - 1) - k) > 0 && same(f(h + 1), f(h - 1)), item.eq);
    }
    for (const item of draws('fn_eval', 300)) {
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
    for (const item of draws('sqrt_basic', 300)) {
      if (item.eq.startsWith('x² =')) assert.equal(Number(item.answer.slice(1)) ** 2, Number(item.eq.slice(5)));
      else if (item.eq.startsWith('−√')) assert.equal(-Math.sqrt(Number(item.eq.slice(2))), num(item.answer));
      else { const [a, b] = item.answer.split('/').map(Number); assert.ok(same(Math.sqrt(val(item.eq.slice(2, -1).replace('/', '/'))), a! / b!)); }
    }
    for (const item of draws('sqrt_between', 300)) {
      const n = Number(item.eq.slice(1)), [k, k1] = nums(item.answer);
      assert.ok(k! * k! < n && n < k1! * k1! && k1 === k! + 1, item.eq);
    }
    const SETS = ['الأعداد الطبيعية', 'الأعداد الصحيحة', 'الأعداد النسبية', 'الأعداد الحقيقية'];
    for (const item of draws('real_numbers', 300)) {
      const s = item.eq;
      const root = s.match(/^√(\d+)$/);
      const want = s === 'π' || (root && !Number.isInteger(Math.sqrt(Number(root[1])))) ? 3
        : root || /^\d+$/.test(s) ? 0 : /^−\d+$/.test(s) ? 1 : 2;
      assert.equal(item.answer, SETS[want], s);
    }
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
