/**
 * The five Grade 10 lessons that used to refuse with NoQuestionBankError
 * (`g10.ts`). Every key is recomputed here from the printed stem by a route
 * that shares no code with the generator: polynomials are parsed back out of
 * the Arabic stem and solved numerically, trig values come from Math.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, matchMathFamily, type ConcreteItem, type DiffTier } from '../index.ts';

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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id)!;
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 10, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 13)));
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSup = (s: string) => Number([...s].map(c => SUPS.indexOf(c)).join(''));
const num = (s: string) => Number(s.replace(/−/g, '-'));

/** «2x³ − x + 5» → coefficients, highest power first. */
function parsePoly(src: string): number[] {
  const terms = src.replace(/\s+/g, '').replace(/−/g, '-').match(/[+-]?[^+-]+/g) ?? [];
  const byDeg = new Map<number, number>();
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)(x?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/);
    assert.ok(m, `cannot parse term «${t}» of «${src}»`);
    const hasX = m[3] === 'x';
    const deg = hasX ? (m[4] ? fromSup(m[4]) : 1) : 0;
    const mag = m[2] === '' ? 1 : Number(m[2]);
    byDeg.set(deg, (byDeg.get(deg) ?? 0) + (m[1] === '-' ? -mag : mag));
  }
  const n = Math.max(...byDeg.keys());
  return Array.from({ length: n + 1 }, (_, i) => byDeg.get(n - i) ?? 0);
}
const at = (c: number[], x: number) => c.reduce((a, k) => a * x + k, 0);
const mul = (a: number[], b: number[]) => {
  const o = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { o[i + j]! += x * y; }));
  return o;
};

/** Distinct real roots by Durand–Kerner, rounded. */
function realRoots(c: number[]): number[] {
  const lead = c[0]!;
  const p = c.map(k => k / lead);
  const n = p.length - 1;
  let re = Array.from({ length: n }, (_, i) => Math.cos(0.4 + (2 * Math.PI * i) / n) * 3);
  let im = Array.from({ length: n }, (_, i) => Math.sin(0.4 + (2 * Math.PI * i) / n) * 3);
  const ev = (x: number, y: number): [number, number] => {
    let a = 0, b = 0;
    for (const k of p) { const na = a * x - b * y + k, nb = a * y + b * x; a = na; b = nb; }
    return [a, b];
  };
  for (let it = 0; it < 2000; it++) {
    const nr = re.slice(), ni = im.slice();
    for (let i = 0; i < n; i++) {
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const xr = nr[i]! - nr[j]!, xi = ni[i]! - ni[j]!;
        [dr, di] = [dr * xr - di * xi, dr * xi + di * xr];
      }
      const [vr, vi] = ev(nr[i]!, ni[i]!);
      const den = dr * dr + di * di || 1e-30;
      nr[i] = nr[i]! - (vr * dr + vi * di) / den;
      ni[i] = ni[i]! - (vi * dr - vr * di) / den;
    }
    re = nr; im = ni;
  }
  const out = new Set<number>();
  re.forEach((r, i) => { if (Math.abs(im[i]!) < 1e-4) out.add(Math.round(r * 1e4) / 1e4); });
  return [...out].sort((a, b) => a - b);
}
const listOf = (s: string) => s.split(' ، ').map(num);
const fracVal = (s: string) => { const [a, b] = s.replace(/−/g, '-').split('/'); return Number(a) / Number(b ?? 1); };

describe('routing: the five lessons are generated, not refused', () => {
  const cases: Array<[string, string]> = [
    ['حل معادلات خاصة', 'special_eq'],
    ['تمثيل الاقترانات المثلثية', 'trig_graph'],
    ['حل مسائل ثلاثية الأبعاد', 'space_3d'],
    ['اقترانات كثيرات الحدود', 'poly_fn'],
    ['الاقترانات النسبية', 'rational_fn'],
    // the teacher guide's name for the same lesson, still in saved materials
    ['قسمة كثيرات الحدود والاقترانات النسبية', 'rational_fn'],
  ];
  for (const [title, id] of cases) {
    it(`${title} → ${id}, Grade 10 only`, () => {
      assert.equal(topicFor(title, 10)?.id, id);
      assert.ok(mathBankCovers(title, null, 10));
      assert.equal(topicFor(title, 9)?.id === id, false, 'no other grade is served these');
      // they have no banked family, so no worked example is claimed for them
      assert.equal(matchMathFamily(title, null), null);
    });
  }
  it('a lesson still without a generator keeps refusing', () => {
    assert.equal(mathBankCovers('أشكال الانتشار', null, 10), false);
  });
});

describe('«حل معادلات خاصة»', () => {
  it('every key is the complete set of real roots of the printed equation', () => {
    const kinds = new Set<string>();
    for (const item of draws('special_eq')) {
      const p = item.promptAr!;
      if (p.startsWith('أوجد جميع الجذور')) {
        kinds.add('roots');
        const c = parsePoly(p.split(': ')[1]!.replace(/ = 0$/, ''));
        assert.deepEqual(listOf(item.answer), realRoots(c), p);
        for (const w of item.wrongs) assert.notDeepEqual(listOf(w), realRoots(c), `a wrong option is right: ${p}`);
      } else if (p.startsWith('ما الجذر الحقيقي')) {
        kinds.add('cube');
        const c = parsePoly(p.match(/المعادلة (.+) = 0/)![1]!);
        const r = realRoots(c);
        assert.equal(r.length, 1, p);
        assert.ok(Math.abs(fracVal(item.answer) - r[0]!) < 1e-3, `${p} → ${item.answer}`);
      } else if (p.startsWith('كم جذرًا')) {
        kinds.add('count');
        assert.equal(Number(item.answer), realRoots(parsePoly(p.match(/للمعادلة: (.+) = 0/)![1]!)).length, p);
      } else {
        kinds.add('box');
        const [a, b] = p.match(/بمقدار (\d+) سم/g)!.map(s => Number(s.match(/\d+/)![0]));
        const V = Number(p.match(/حجمه (\d+)/)![1]);
        const h = Number(item.answer);
        assert.equal(h * (h - a!) * (h - b!), V, p);
        assert.ok(h > Math.max(a!, b!), p);
        for (const w of item.wrongs) assert.notEqual(Number(w) * (Number(w) - a!) * (Number(w) - b!) === V && Number(w) > Math.max(a!, b!), true, `wrong option ${w} solves ${p}`);
      }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });
});

describe('«تمثيل الاقترانات المثلثية»', () => {
  const rad = Math.PI / 180;
  const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan } as const;
  type N = keyof typeof F;
  /** Is x (degrees) inside a written union of intervals such as «0° ≤ x < 90° ∪ 270° < x ≤ 360°»? */
  const inside = (set: string, x: number) =>
    set.split(' ∪ ').some(iv => {
      const m = iv.match(/^(\d+)° (≤|<) x (≤|<) (\d+)°$/)!;
      const [lo, hi] = [Number(m[1]), Number(m[4])];
      return (m[2] === '≤' ? x >= lo : x > lo) && (m[3] === '≤' ? x <= hi : x < hi);
    });
  it('every key is read off the real function', () => {
    const kinds = new Set<string>();
    for (const item of draws('trig_graph')) {
      const p = item.promptAr!;
      if (p.includes('القيمة')) {
        kinds.add('extreme');
        const m = p.match(/y = (−?)(?:(\d+) )?(sin|cos) x/)!;
        const a = (m[1] ? -1 : 1) * Number(m[2] ?? 1);
        const vals = Array.from({ length: 361 }, (_, d) => a * F[m[3] as N](d * rad));
        const want = p.includes('العظمى') ? Math.max(...vals) : Math.min(...vals);
        assert.ok(Math.abs(num(item.answer) - want) < 1e-9, p);
      } else if (p.includes('متى يكون')) {
        kinds.add('sign');
        const fn = p.match(/(sin|cos|tan) x/)![1] as N;
        const pos = p.includes('موجبًا');
        const truth = (x: number) => (pos ? F[fn](x * rad) > 1e-9 : F[fn](x * rad) < -1e-9);
        const grid = Array.from({ length: 721 }, (_, i) => i / 2).filter(x => !(fn === 'tan' && (x === 90 || x === 270)));
        assert.ok(grid.every(x => inside(item.answer, x) === truth(x)), p);
        for (const w of item.wrongs) assert.ok(grid.some(x => inside(w, x) !== truth(x)), `wrong option is also right: ${p}`);
      } else if (p.includes('كم مرة')) {
        kinds.add('zeros');
        const fn = p.match(/y = (sin|cos|tan) x/)![1] as N;
        const zeros = Array.from({ length: 361 }, (_, d) => d).filter(d => !(fn === 'tan' && (d === 90 || d === 270)) && Math.abs(F[fn](d * rad)) < 1e-9);
        assert.equal(Number(item.answer), zeros.length, p);
      } else if (p.includes('معادلتا')) {
        kinds.add('asymptote');
        assert.equal(item.answer, 'x = 90° ، x = 270°');
        assert.ok(Math.abs(Math.cos(90 * rad)) < 1e-9 && Math.abs(Math.cos(270 * rad)) < 1e-9);
      } else if (p.includes('قيمتين')) {
        kinds.add('solve');
        const m = p.match(/(sin|cos|tan) x = (−?[\d.]+)/)!;
        for (const d of item.answer.split(' ، ').map(s => Number(s.replace('°', '')))) {
          assert.ok(d >= 0 && d <= 360 && Math.abs(F[m[1] as N](d * rad) - num(m[2]!)) < 1e-9, `${p} → ${item.answer}`);
        }
        assert.equal(item.answer.split(' ، ').length, 2);
      } else {
        kinds.add('table');
        const m = p.match(/قيمة (sin|cos) (\d+)°/)!;
        assert.ok(Math.abs(num(item.answer) - F[m[1] as 'sin' | 'cos'](Number(m[2]) * rad)) < 1e-9, p);
      }
    }
    assert.equal(kinds.size, 6, [...kinds].join());
  });
});

describe('«حل مسائل ثلاثية الأبعاد»', () => {
  it('every key follows from the printed lengths', () => {
    const kinds = new Set<string>();
    for (const item of draws('space_3d')) {
      const p = item.promptAr!;
      const n = (p.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
      if (p.includes('قطره (من رأس')) {
        kinds.add('diagonal');
        assert.equal(Number(item.answer), Math.sqrt(n[0]! ** 2 + n[1]! ** 2 + n[2]! ** 2), p);
      } else if (p.includes('بعده الثالث')) {
        kinds.add('edge');
        assert.equal(Number(item.answer) ** 2 + n[0]! ** 2 + n[1]! ** 2, n[2]! ** 2, p);
      } else if (p.includes('الارتفاع الجانبي')) {
        kinds.add('slant');
        assert.equal(Number(item.answer) ** 2, n[1]! ** 2 + (n[0]! / 2) ** 2, p);
      } else if (p.includes('حافته الجانبية')) {
        kinds.add('edge-pyramid');
        assert.equal(Number(item.answer) ** 2, n[1]! ** 2 + (n[0]! ** 2) / 2, p);
      } else if (p.includes('بين قطره وقاعدته')) {
        kinds.add('angle');
        const [a, b, c] = n as [number, number, number];
        const want = (Math.atan(c / Math.hypot(a, b)) * 180) / Math.PI;
        assert.equal(item.answer, `${want.toFixed(1)}°`, p);
      } else {
        kinds.add('tower');
        // 45° from B puts B at the tower's height from A; AC ⟂ AB
        assert.equal(Number(item.answer), Math.hypot(n[0]!, n[3]!), p);
      }
    }
    assert.equal(kinds.size, 6, [...kinds].join());
  });
});

describe('«اقترانات كثيرات الحدود»', () => {
  it('every key is recomputed from the printed polynomials', () => {
    const kinds = new Set<string>();
    for (const item of draws('poly_fn')) {
      const p = item.promptAr!;
      if (p.startsWith('ما درجة')) {
        kinds.add('degree');
        assert.equal(Number(item.answer), parsePoly(p.slice('ما درجة كثير الحدود '.length, -1)).length - 1, p);
      } else if (p.startsWith('ما المعامل')) {
        kinds.add('lead');
        assert.equal(num(item.answer), parsePoly(p.slice('ما المعامل الرئيس لكثير الحدود '.length, -1))[0], p);
      } else if (p.startsWith('ما الحد الثابت')) {
        kinds.add('constant');
        assert.equal(num(item.answer), parsePoly(p.slice('ما الحد الثابت في كثير الحدود '.length, -1)).at(-1), p);
      } else if (p.startsWith('أيُّ')) {
        kinds.add('which');
        const opts = p.slice(p.indexOf(': ') + 2, -1).split(' ، ');
        const isPoly = (s: string) => { try { parsePoly(s); return !/[|√^/]/.test(s) && !/⁻/.test(s); } catch { return false; } };
        assert.deepEqual(opts.filter(isPoly), [item.answer], p);
      } else if (p.startsWith('إذا كان f(x) = ') && p.includes('فما قيمة')) {
        kinds.add('value');
        const f = parsePoly(p.match(/f\(x\) = (.+)، فما/)![1]!);
        assert.equal(num(item.answer), at(f, num(p.match(/قيمة f\((.+)\)/)![1]!)), p);
      } else if (p.startsWith('إذا كان')) {
        kinds.add('sum');
        const m = p.match(/f\(x\) = (.+)، g\(x\) = (.+)، فأجد f\(x\) (\+|−) g\(x\)/)!;
        const f = parsePoly(m[1]!), g = parsePoly(m[2]!);
        const sign = m[3] === '+' ? 1 : -1;
        for (const x of [-3, -1, 0, 2, 5]) assert.equal(at(parsePoly(item.answer), x), at(f, x) + sign * at(g, x), p);
      } else {
        kinds.add('product');
        const m = p.match(/ناتج \((.+?)\)\((.+?)\) بالصورة/)!;
        for (const x of [-3, -1, 0, 2, 5]) assert.equal(at(parsePoly(item.answer), x), at(parsePoly(m[1]!), x) * at(parsePoly(m[2]!), x), p);
      }
    }
    assert.equal(kinds.size, 7, [...kinds].join());
  });
});

describe('«الاقترانات النسبية»', () => {
  it('every key is recomputed from the printed expression', () => {
    const kinds = new Set<string>();
    const asym = (p: string) => p.includes('الرأسي') ? 'x' : 'y';
    for (const item of draws('rational_fn')) {
      const p = item.promptAr!;
      if (p.startsWith('أجد باقي')) {
        kinds.add('remainder');
        const m = p.match(/قسمة (.+) على (.+)\.$/)!;
        const root = -parsePoly(m[2]!)[1]!;
        assert.equal(num(item.answer), at(parsePoly(m[1]!), root), p);
      } else if (p.startsWith('أجد ناتج قسمة')) {
        kinds.add('quotient');
        const m = p.match(/قسمة (.+) على (.+) \(/)!;
        const f = parsePoly(m[1]!), d = parsePoly(m[2]!);
        assert.deepEqual(mul(d, parsePoly(item.answer)), f, p); // exact: no remainder
      } else if (p.startsWith('ما مجال')) {
        kinds.add('domain');
        const m = p.match(/= \((.+?)\)\/\((.+?)\)؟/)!;
        const zeros = realRoots(parsePoly(m[2]!));
        assert.deepEqual(item.answer.split(' ، ').map(s => num(s.replace('x ≠ ', ''))), zeros, p);
      } else if (p.startsWith('ما مدى')) {
        kinds.add('range');
        const m = p.match(/= (−?)(\d+)\/\((.+?)\) ([+−]) (\d+)؟/)!;
        const c = (m[4] === '−' ? -1 : 1) * Number(m[5]);
        const b = -parsePoly(m[3]!)[1]!;
        // far from the pole the value approaches c, and it never equals c (a/(x − b) ≠ 0)
        const far = (Number(m[1] ? -1 : 1) * Number(m[2])) / (1e7 - b) + c;
        assert.ok(Math.abs(far - c) < 1e-5);
        assert.equal(item.answer, `y ≠ ${c < 0 ? '−' : ''}${Math.abs(c)}`, p);
      } else if (p.startsWith('ما معادلة')) {
        const axis = asym(p);
        const a1 = p.match(/= (−?)(\d+)\/\((.+?)\) ([+−]) (\d+)؟/);
        const a2 = p.match(/= \((.+?)\)\/\((.+?)\)؟/);
        let want: number;
        if (a1) {
          kinds.add('shifted');
          const c = (a1[4] === '−' ? -1 : 1) * Number(a1[5]);
          want = axis === 'x' ? -parsePoly(a1[3]!)[1]! : c;
        } else {
          kinds.add('mobius');
          const nu = parsePoly(a2![1]!), de = parsePoly(a2![2]!);
          want = axis === 'x' ? -de[1]! : (at(nu, 1e8) / at(de, 1e8));
          if (axis === 'y') assert.ok(Math.abs(want - nu[0]!) < 1e-5);
          if (axis === 'x') assert.notEqual(at(nu, want), 0, `a hole, not an asymptote: ${p}`);
          want = axis === 'y' ? nu[0]! : want;
        }
        assert.equal(item.answer, `${axis} = ${want < 0 ? '−' : ''}${Math.abs(want)}`, p);
        // no other option names the same line
        for (const w of item.wrongs) assert.notEqual(w, item.answer);
      } else {
        kinds.add('simplify');
        const m = p.match(/النسبي \((.+?)\)\/\((.+?)\) \(/)!;
        const nu = parsePoly(m[1]!), de = parsePoly(m[2]!);
        const q = parsePoly(item.answer);
        assert.deepEqual(mul(de, q), nu, p);
      }
    }
    assert.equal(kinds.size, 8, [...kinds].join());
  });
});
