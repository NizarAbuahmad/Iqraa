/**
 * Ten Grade 10 maths lessons whose offline questions were thin or absent
 * (measured 2026-11-13): «قانون الجيوب» and «قانون جيب التمام» shared the
 * `trig_apps` family — 3 items in all, one per rule and one area — the three
 * trigonometry lessons shared `trig`'s 6, «معادلة الدائرة» got `circle`, half
 * of it arc length and area, and «تمثيل الاقترانات المثلثية», «حل مسائل
 * ثلاثية الأبعاد», «اقترانات كثيرات الحدود» and «قسمة كثيرات الحدود والاقترانات
 * النسبية» got nothing at all.
 *
 * Each now has its own generator, following its lesson in the student book
 * (S1 pp. 54-61, 66-95, 106-118, 124-129; S2 pp. 8-24). Every answer is
 * recomputed here from the numbers printed in its own stem, by code that
 * shares nothing with the generator: trigonometry by Math.sin/cos/tan, the
 * equations by a brute-force sweep of 0°–359°, the polynomials by a parser and
 * long division of its own.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G10_LESSON_FIRST } from '../grade10.ts';
import { MATH_BANK, itemStem, matchMathFamily, mathBankCovers, takeConcreteMath, type ConcreteItem, type DiffTier, type PracticeLesson } from '../index.ts';

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
function draws(id: string, n = 400): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 10, TIERS[i % 3]!, new Set(), seeded(i * 104729 + 17)));
}

// ─── the catalog's own titles ───────────────────────────────────────────────

type Unit = { lessons: Array<{ id: string; title_ar: string }> };
const catalog = (sem: number) =>
  (JSON.parse(readFileSync(new URL(`../../../curriculum/src/data/iqra_curriculum_g10_math_sem${sem}.json`, import.meta.url), 'utf8')) as { units: Unit[] }).units
    .flatMap(u => u.lessons);
const CATALOG = [...catalog(1), ...catalog(2)];
const titleOf = (lesson: string) => {
  const l = CATALOG.find(x => x.id === lesson);
  assert.ok(l, `no catalog lesson ${lesson}`);
  return l.title_ar;
};

/** [generator, catalog lesson, semester] */
const LESSONS: Array<[string, string, number]> = [
  ['g10_circle_equation', 'u2_l4', 1],
  ['g10_trig_ratios', 'u3_l1', 1],
  ['g10_trig_full_turn', 'u3_l2', 1],
  ['g10_trig_graphs', 'u3_l3', 1],
  ['g10_trig_equations', 'u3_l4', 1],
  ['g10_sine_law', 'u4_l2', 1],
  ['g10_cosine_law', 'u4_l3', 1],
  ['g10_3d', 'u4_l5', 1],
  ['g10_polynomials', 'u5_l1', 2],
  ['g10_rational', 'u5_l2', 2],
];
const kbOf = (lesson: string, sem: number): PracticeLesson => ({
  id: `kbl-math-s${sem}-nccd-${lesson}`, titleAr: titleOf(lesson), titleEn: '', objectives: [], keyConceptsAr: [], keyConceptsEn: [],
});

// ─── stem readers (independent of the generators) ──────────────────────────

const close = (a: number, b: number, where: string) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}: ${where}`);
const rad = (d: number) => (d * Math.PI) / 180;
const FN: Record<string, (d: number) => number> = {
  sin: d => Math.sin(rad(d)),
  cos: d => Math.cos(rad(d)),
  tan: d => Math.tan(rad(d)),
};
/** An exact value as printed: «−3/5», «4», «−1.5», «2√3», «√37», «−√3/2», «1/√3»; «غير معرّف» is NaN. */
function num(s: string): number {
  const t = s.trim().replace(/−/g, '-');
  if (t === 'غير معرّف') return NaN;
  let m = t.match(/^(-?)(\d*)√(\d+)(?:\/(\d+))?$/);
  if (m) return (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1) * Math.sqrt(Number(m[3])) / (m[4] ? Number(m[4]) : 1);
  m = t.match(/^(-?)(\d+)\/√(\d+)$/);
  if (m) return (m[1] ? -1 : 1) * Number(m[2]) / Math.sqrt(Number(m[3]));
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  assert.match(t, /^-?\d+(?:\.\d+)?$/, `not a value: «${s}»`);
  return Number(t);
}
const sn = (s: string) => Number(s.replace(/−/g, '-'));
/** «30° ، 150°» → [30, 150] */
const degList = (s: string) => s.split(' ، ').map(x => { assert.match(x, /^\d+°$/, s); return Number(x.slice(0, -1)); });
/** Every «(x ، y)» point in a stem; coordinates may be fractions. */
const pts = (s: string) => [...s.matchAll(/\((−?[\d/]+) ، (−?[\d/]+)\)/g)].map(m => [num(m[1]!), num(m[2]!)] as [number, number]);
const nums = (s: string) => (s.match(/−?\d+(?:\.\d+)?/g) ?? []).map(sn);

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** «−4 + 6x − 2x³ + x²» → coefficient by exponent. Several terms of one degree add up. */
function poly(s: string, v = 'x'): Map<number, number> {
  const out = new Map<number, number>();
  const t = s.replace(/−/g, '-').replace(/\s+/g, '');
  const re = new RegExp(`([+-]?)(\\d*)(${v}([${SUPS}]*))?`, 'g');
  let m: RegExpExecArray | null;
  let seen = 0;
  while ((m = re.exec(t)) && m[0] !== '') {
    seen += m[0].length;
    const coef = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
    assert.ok(m[2] || m[3], `bad term in «${s}»`);
    const e = m[3] ? (m[4] ? Number([...m[4]].map(c => SUPS.indexOf(c)).join('')) : 1) : 0;
    out.set(e, (out.get(e) ?? 0) + coef);
  }
  assert.equal(seen, t.length, `unparsed text in «${s}»`);
  return out;
}
const evalPoly = (p: Map<number, number>, x: number) => [...p].reduce((s, [e, c]) => s + c * x ** e, 0);
const degree = (p: Map<number, number>) => Math.max(...[...p].filter(([, c]) => c !== 0).map(([e]) => e));
/** Long division by (x − r): [quotient, remainder]. */
function divide(p: Map<number, number>, r: number): [Map<number, number>, number] {
  const n = degree(p);
  const q = new Map<number, number>();
  let carry = 0;
  for (let e = n; e >= 1; e--) { carry = (p.get(e) ?? 0) + carry * r; q.set(e - 1, carry); }
  return [q, (p.get(0) ?? 0) + carry * r];
}
const samePoly = (a: Map<number, number>, b: Map<number, number>) => {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].every(k => Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) < 1e-9);
};
/** «(x − 5)² + (y + 3)² = 16» → [a, b, r²]. */
function stdCircle(s: string): [number, number, number] {
  const m = s.match(/(?:\(x ([−+]) (\d+)\)²|x²) \+ (?:\(y ([−+]) (\d+)\)²|y²) = (\d+)/);
  assert.ok(m, `no circle in «${s}»`);
  const a = m[1] ? (m[1] === '−' ? 1 : -1) * Number(m[2]) : 0;
  const b = m[3] ? (m[3] === '−' ? 1 : -1) * Number(m[4]) : 0;
  return [a, b, Number(m[5])];
}

/** The degrees in 0°–359° where `f` (an equation's left minus right side) is zero. */
function sweep(f: (d: number) => number, hasTan: boolean): number[] {
  const out: number[] = [];
  for (let d = 0; d < 360; d++) {
    if (hasTan && Math.abs(Math.cos(rad(d))) < 1e-9) continue;
    if (Math.abs(f(d)) < 1e-9) out.push(d);
  }
  return out;
}
/** «2 sin x + 3 = 4», «sin x (2 cos x − 1) = 0», «2 sin² x − sin x − 1 = 0» as a function of degrees. */
function equation(eq: string): (d: number) => number {
  const [l, r] = eq.split(' = ');
  const js = (side: string) => side
    .replace(/−/g, '-')
    .replace(/(sin|cos|tan)² x/g, '(F.$1(d)**2)')
    .replace(/(sin|cos|tan) x/g, 'F.$1(d)')
    .replace(/√(\d)/g, 'Math.sqrt($1)')
    .replace(/(\d|\))\s+(?=F\.|\(|Math)/g, '$1*');
  return new Function('F', 'd', `return (${js(l!)}) - (${js(r!)});`).bind(null, FN) as (d: number) => number;
}

// ─── one checker per generator: recompute the key, name the kind ────────────

function check(id: string, item: ConcreteItem): string {
  const p = item.promptAr!, a = item.answer;
  const where = `${id} «${p}» → ${a}`;
  switch (id) {
    case 'g10_circle_equation': {
      if (p.includes('بالصورة القياسية')) {
        const m = p.match(/x² \+ y² ([−+]) (\d+)x ([−+]) (\d+)y ([−+]) (\d+) = 0/);
        assert.ok(m, where);
        const D = (m[1] === '−' ? -1 : 1) * Number(m[2]), E = (m[3] === '−' ? -1 : 1) * Number(m[4]), F = (m[5] === '−' ? -1 : 1) * Number(m[6]);
        const cx = -D / 2, cy = -E / 2, r2 = cx * cx + cy * cy - F;
        assert.ok(r2 > 0, where);
        if (p.includes('نصف قطرها')) { close(num(a), Math.sqrt(r2), where); return 'general radius'; }
        assert.deepEqual(pts(a)[0], [cx, cy], where);
        return 'general centre';
      }
      if (p.includes('القطعة المماسية')) {
        const [P] = pts(p);
        const [ca, cb, r2] = stdCircle(p);
        const d2 = (P![0] - ca) ** 2 + (P![1] - cb) ** 2;
        assert.ok(d2 > r2, `the point is not outside the circle: ${where}`);
        close(num(a), Math.sqrt(d2 - r2), where);
        return 'tangent';
      }
      if (p.includes('وتمر بالنقطة')) {
        const [C, P] = pts(p);
        close(num(a), Math.hypot(P![0] - C![0], P![1] - C![1]), where);
        return 'through a point';
      }
      if (p.includes('ما معادلة الدائرة')) {
        const [C] = pts(p);
        const r = nums(p.split('نصف قطرها')[1]!)[0]!;
        assert.deepEqual(stdCircle(a), [C![0], C![1], r * r], where);
        return 'write the equation';
      }
      const [ca, cb, r2] = stdCircle(p);
      if (p.includes('ما إحداثيا مركز')) { assert.deepEqual(pts(a)[0], [ca, cb], where); return 'centre'; }
      assert.ok(p.includes('ما طول نصف قطر الدائرة التي معادلتها'), `unrecognised: ${where}`);
      close(num(a), Math.sqrt(r2), where);
      return 'radius';
    }
    case 'g10_trig_ratios': {
      if (p.includes('ضلع الانتهاء نفسه')) {
        const t = nums(p).find(n => n !== 0 && n !== 360)!;
        const want = ((t % 360) + 360) % 360;
        assert.equal(num(a.replace('°', '')), want, where);
        assert.ok(want > 0 && want !== t, where);
        return 'coterminal';
      }
      if (p.includes('دائرة الوحدة')) {
        const [[x, y]] = pts(p) as [[number, number]];
        close(x * x + y * y, 1, `not on the unit circle: ${where}`);
        const fn = p.match(/ما قيمة (sin|cos|tan) θ/)![1]!;
        close(num(a), fn === 'sin' ? y : fn === 'cos' ? x : y / x, where);
        return 'point on the unit circle';
      }
      if (p.includes('< θ <')) {
        const m = p.match(/إذا كان (sin|cos) θ = (−?\d+\/\d+)، حيث (\d+)° < θ < (\d+)°، فما قيمة (sin|cos|tan) θ/);
        assert.ok(m, where);
        const given = num(m[2]!), lo = Number(m[3]), hi = Number(m[4]);
        assert.equal(hi - lo, 90, where);
        // the one angle in the quadrant with that ratio
        const base = m[1] === 'sin' ? Math.asin(given) : Math.acos(given);
        const cands = [base, Math.PI - base, Math.PI + base, -base, 2 * Math.PI - base].map(r => ((r * 180) / Math.PI + 360) % 360);
        const t = cands.find(d => d > lo && d < hi && Math.abs(FN[m[1]!]!(d) - given) < 1e-9);
        assert.ok(t !== undefined, `no angle in the quadrant: ${where}`);
        close(num(a), FN[m[5]!]!(t), where);
        return 'identity';
      }
      const m = p.match(/^ما قيمة (sin|cos|tan) (\d+)°؟$/);
      assert.ok(m, `unrecognised: ${where}`);
      const d = Number(m[2]);
      assert.equal(d % 90, 0, where);
      if (m[1] === 'tan' && d % 180 === 90) assert.equal(a, 'غير معرّف', where);
      else close(num(a), FN[m[1]!]!(d), where);
      return 'quadrantal';
    }
    case 'g10_trig_full_turn': {
      if (p.includes('الزاوية المرجعية')) {
        const t = nums(p)[0]!;
        const want = t < 90 ? t : t < 180 ? 180 - t : t < 270 ? t - 180 : 360 - t;
        assert.equal(num(a.replace('°', '')), want, where);
        return 'reference angle';
      }
      if (p.includes('القيمة الدقيقة')) {
        const m = p.match(/(sin|cos|tan) (\d+)°/)!;
        close(num(a), FN[m[1]!]!(Number(m[2])), where);
        return 'exact value';
      }
      if (p.includes('لها نسبة')) {
        const t = nums(p).filter(n => n !== 0 && n !== 360)[0]!;
        const fn = p.includes('جيب التمام') ? 'cos' : p.includes('الظل') ? 'tan' : 'sin';
        const c = num(a.replace('°', ''));
        assert.ok(c > 0 && c < 360 && c !== t, where);
        close(FN[fn]!(c), FN[fn]!(t), where);
        return `same ${fn}`;
      }
      const m = p.match(/h = (\d+) − (\d+) cos θ.+θ = (\d+)°/);
      assert.ok(m && m[1] === m[2], `unrecognised: ${where}`);
      close(num(a), Number(m[1]) - Number(m[2]) * FN.cos!(Number(m[3])), where);
      return 'wheel';
    }
    case 'g10_trig_graphs': {
      if (p.includes('c ≠')) {
        const m = p.match(/(sin|cos|tan) (\d+)° = \1 c°/)!;
        const t = Number(m[2]), c = num(a.replace('°', ''));
        assert.ok(c >= 0 && c <= 360 && c !== t, where);
        close(FN[m[1]!]!(c), FN[m[1]!]!(t), where);
        // the only other angle in the interval
        const others = Array.from({ length: 361 }, (_, d) => d).filter(d => d !== t && Math.abs(FN[m[1]!]!(d) - FN[m[1]!]!(t)) < 1e-9);
        assert.deepEqual(others, [c], where);
        return 'mirror';
      }
      if (p.includes('يقطع المستقيم')) {
        const m = p.match(/y = (−?[\d.]+) منحنى الاقتران y = (sin|cos|tan) x/)!;
        const v = sn(m[1]!);
        const want = Array.from({ length: 361 }, (_, d) => d).filter(d => (m[2] !== 'tan' || Math.abs(Math.cos(rad(d))) > 1e-9) && Math.abs(FN[m[2]!]!(d) - v) < 1e-9);
        assert.deepEqual(degList(a), want, where);
        return 'where a line cuts';
      }
      const f = p.match(/y = (−?\d+) (sin|cos) x/);
      assert.ok(f, `unrecognised: ${where}`);
      const k = sn(f[1]!), fn = f[2]!;
      const ys = Array.from({ length: 360 }, (_, d) => k * FN[fn]!(d));
      if (p.includes('القيمة العظمى')) { close(num(a), Math.max(...ys), where); return 'greatest value'; }
      if (p.includes('القيمة الصغرى')) { close(num(a), Math.min(...ys), where); return 'least value'; }
      if (p.includes('عند أي قيمة لـ x')) {
        const target = p.includes('العظمى') ? Math.max(...ys) : Math.min(...ys);
        const at = ys.map((y, d) => [y, d] as const).filter(([y]) => Math.abs(y - target) < 1e-9).map(([, d]) => d);
        assert.deepEqual(at, [num(a.replace('°', ''))], where);
        return 'where it peaks';
      }
      const x = nums(p.split('عندما')[1]!)[0]!;
      close(num(a), k * FN[fn]!(x), where);
      return 'value at a point';
    }
    case 'g10_trig_equations': {
      const eq = p.match(/المعادلة (.+) في الفترة 0° ≤ x < 360°/)![1]!;
      assert.deepEqual(degList(a), sweep(equation(eq), eq.includes('tan')), where);
      assert.ok(degList(a).length >= 1, where);
      return eq.includes('²') ? 'quadratic' : eq.includes('(') ? 'factored' : eq.includes('tan') ? 'tan' : 'sin or cos';
    }
    case 'g10_sine_law': {
      const ang = (L: string) => Number(p.match(new RegExp(`قياس الزاوية ${L} يساوي (\\d+)°`))?.[1] ?? NaN);
      const side = (l: string) => num(p.match(new RegExp(`طول الضلع ${l} يساوي ([\\d√]+) سم`))?.[1] ?? 'x');
      if (p.includes('ما قياس الزاوية B')) {
        const A = ang('A'), sB = (side('b') * Math.sin(rad(A))) / side('a');
        const B = (Math.asin(sB) * 180) / Math.PI;
        // the obtuse angle with that sine does not fit beside A
        assert.ok(A + (180 - B) >= 180 - 1e-9, `ambiguous: ${where}`);
        close(num(a.replace('°', '')), B, where);
        return 'angle';
      }
      assert.ok(p.includes('ما طول الضلع b'), `unrecognised: ${where}`);
      const A = ang('A'), B = Number.isNaN(ang('B')) ? 180 - A - ang('C') : ang('B');
      close(num(a), (side('a') * Math.sin(rad(B))) / Math.sin(rad(A)), where);
      return Number.isNaN(ang('B')) ? 'side, third angle first' : 'side';
    }
    case 'g10_cosine_law': {
      let x: number, y: number, t: number, kind: string;
      if (p.includes('عقرب')) {
        [x, y] = nums(p);
        const h = Number(p.match(/(\d+):00/)![1]);
        t = 30 * Math.min(h, 12 - h);
        kind = 'clock';
      } else if (p.includes('سفينتان')) {
        const n = nums(p);
        [t, x, y] = [n[0]!, n[1]!, n[2]!];
        kind = 'ships';
      } else if (p.includes('ما قياس الزاوية C')) {
        const [A, B, C] = nums(p);
        const cosC = (A! ** 2 + B! ** 2 - C! ** 2) / (2 * A! * B!);
        close(num(a.replace('°', '')), (Math.acos(cosC) * 180) / Math.PI, where);
        return 'angle';
      } else {
        const n = nums(p);
        [x, y, t] = [n[0]!, n[1]!, n[2]!];
        assert.ok(p.includes('ما طول الضلع c'), `unrecognised: ${where}`);
        kind = 'side';
      }
      close(num(a), Math.sqrt(x ** 2 + y ** 2 - 2 * x * y * Math.cos(rad(t))), where);
      return kind;
    }
    case 'g10_3d': {
      const n = nums(p);
      if (p.includes('هرم')) { close(num(a), Math.sqrt(n[1]! ** 2 - n[0]! ** 2 / 2), where); return 'pyramid height'; }
      if (p.includes('القطر FH')) { close(num(a), Math.hypot(n[0]!, n[1]!), where); return 'base diagonal'; }
      if (p.includes('الزاوية بين')) {
        const [l, w, h] = n as [number, number, number];
        const want = (Math.acos(Math.hypot(l, w) / Math.hypot(l, w, h)) * 180) / Math.PI;
        assert.match(a, /^\d+\.\d°$/, where);
        assert.ok(Math.abs(num(a.replace('°', '')) - want) <= 0.05 + 1e-9, where);
        return 'angle with the base';
      }
      assert.ok(p.includes('ما طول قطره'), `unrecognised: ${where}`);
      close(num(a), Math.hypot(n[0]!, n[1]!, n[2]!), where);
      return 'space diagonal';
    }
    case 'g10_polynomials': {
      if (p.includes('موقع جسم')) {
        const q = poly(p.match(/s\(t\) = (.+?) موقع/)![1]!, 't');
        if (p.includes('نقطة الأصل')) {
          const ts = [...a.matchAll(/t = (\d+)/g)].map(m => Number(m[1]));
          assert.equal(ts.length, degree(q), where);
          for (const t of ts) close(evalPoly(q, t), 0, where);
          assert.equal(new Set(ts).size, ts.length, where);
          return 'at the origin';
        }
        const t = Number(p.match(/بعد (\d+) ثوانٍ/)![1]);
        close(num(a), evalPoly(q, t), where);
        return 'position';
      }
      if (p.includes('ما معامل x')) {
        const e = (() => { const m = p.match(new RegExp(`معامل x([${SUPS}]*) في`))!; return m[1] ? Number([...m[1]].map(c => SUPS.indexOf(c)).join('')) : 1; })();
        if (p.includes('ناتج ضرب')) {
          const [f, g] = [...p.matchAll(/\(([^()]+)\)/g)].map(m => poly(m[1]!));
          let c = 0;
          for (const [e1, c1] of f!) for (const [e2, c2] of g!) if (e1 + e2 === e) c += c1 * c2;
          close(num(a), c, where);
          return 'product';
        }
        const f = poly(p.match(/f\(x\) = (.+?) و g/)![1]!), g = poly(p.match(/g\(x\) = (.+?)، فما/)![1]!);
        const minus = p.includes('f(x) − g(x)');
        close(num(a), (f.get(e) ?? 0) + (minus ? -1 : 1) * (g.get(e) ?? 0), where);
        return minus ? 'difference' : 'sum';
      }
      const q = poly(p.match(/كثير الحدود (.+)؟$/)![1]!);
      const n = degree(q);
      if (p.includes('ما درجة')) { assert.equal(num(a), n, where); return 'degree'; }
      if (p.includes('المعامل الرئيس')) { assert.equal(num(a), q.get(n), where); return 'leading coefficient'; }
      assert.ok(p.includes('الحد الثابت'), `unrecognised: ${where}`);
      assert.equal(num(a), q.get(0) ?? 0, where);
      return 'constant term';
    }
    case 'g10_rational': {
      const div = p.match(/على (x [−+] \d+)/);
      if (p.includes('باقي قسمة')) {
        const f = poly(p.match(/f\(x\) = (.+?) على/)![1]!), d = poly(div![1]!);
        assert.equal(num(a), evalPoly(f, -(d.get(0) ?? 0)), where);
        return 'remainder';
      }
      if (p.includes('ناتج قسمة')) {
        const f = poly(p.match(/قسمة (.+?) على/)![1]!), d = poly(div![1]!);
        assert.ok(samePoly(poly(a), divide(f, -(d.get(0) ?? 0))[0]), where);
        return 'quotient';
      }
      if (p.includes('مجال')) {
        const den = poly(p.match(/\)\/\((.+?)\)/)![1]!);
        const roots = Array.from({ length: 41 }, (_, i) => i - 20).filter(x => evalPoly(den, x) === 0);
        assert.deepEqual(a.split(' ، ').map(sn), roots, where);
        const top = poly(p.match(/= \((.+?)\)\//)![1]!);
        for (const r of roots) assert.notEqual(evalPoly(top, r), 0, `a hole, not an asymptote: ${where}`);
        return 'domain';
      }
      if (p.includes('فجوة')) {
        const top = poly(p.match(/= \((.+?)\)\//)![1]!), bot = poly(p.match(/\)\/\((.+?)\)/)![1]!);
        const r = -(bot.get(0) ?? 0);
        close(evalPoly(top, r), 0, where);
        assert.equal(a, `x = ${r < 0 ? `−${-r}` : r}`, where);
        return 'hole';
      }
      // a/(x − b) + c, or px/(x + q)
      let vert: number, horiz: number;
      const m1 = p.match(/f\(x\) = (−?\d+)\/\(x ([−+]) (\d+)\) ([−+]) (\d+)/);
      const m2 = p.match(/f\(x\) = (\d+)x\/\(x ([−+]) (\d+)\)/);
      if (m1) { vert = (m1[2] === '−' ? 1 : -1) * Number(m1[3]); horiz = (m1[4] === '−' ? -1 : 1) * Number(m1[5]); }
      else { assert.ok(m2, `unrecognised: ${where}`); vert = (m2[2] === '−' ? 1 : -1) * Number(m2[3]); horiz = Number(m2[1]); }
      // the curve really runs off near the vertical line and levels out at the horizontal one
      const f = (x: number) => (m1 ? sn(m1[1]!) / (x - vert) + horiz : (horiz * x) / (x - vert));
      assert.ok(Math.abs(f(vert + 1e-7)) > 1e5 && Math.abs(f(1e9) - horiz) < 1e-6, where);
      if (p.includes('الرأسي')) { assert.equal(sn(a.replace('x = ', '')), vert, where); assert.match(a, /^x = /, where); return 'vertical asymptote'; }
      assert.ok(p.includes('الأفقي'), where);
      assert.equal(sn(a.replace('y = ', '')), horiz, where);
      assert.match(a, /^y = /, where);
      return 'horizontal asymptote';
    }
  }
  throw new Error(`no checker for ${id}`);
}

const KINDS: Record<string, string[]> = {
  g10_circle_equation: ['centre', 'general centre', 'general radius', 'radius', 'tangent', 'through a point', 'write the equation'],
  g10_trig_ratios: ['coterminal', 'identity', 'point on the unit circle', 'quadrantal'],
  g10_trig_full_turn: ['exact value', 'reference angle', 'same cos', 'same sin', 'same tan', 'wheel'],
  g10_trig_graphs: ['greatest value', 'least value', 'mirror', 'value at a point', 'where a line cuts', 'where it peaks'],
  g10_trig_equations: ['factored', 'quadratic', 'sin or cos', 'tan'],
  g10_sine_law: ['angle', 'side', 'side, third angle first'],
  g10_cosine_law: ['angle', 'clock', 'ships', 'side'],
  g10_3d: ['angle with the base', 'base diagonal', 'pyramid height', 'space diagonal'],
  g10_polynomials: ['at the origin', 'constant term', 'degree', 'difference', 'leading coefficient', 'position', 'product', 'sum'],
  g10_rational: ['domain', 'hole', 'horizontal asymptote', 'quotient', 'remainder', 'vertical asymptote'],
};

// ─── the tests ──────────────────────────────────────────────────────────────

describe('Grade 10 lessons with thin or no offline questions', () => {
  it('the lesson-first list holds these ten generators', () => {
    // The second batch (2026-11-14) is listed and checked in grade10LessonsB.test.ts.
    for (const [id] of LESSONS) assert.ok(G10_LESSON_FIRST.has(id), id);
  });

  for (const [id, lesson, sem] of LESSONS) {
    const title = titleOf(lesson);
    const kb = kbOf(lesson, sem);

    it(`«${title}» (${lesson}) is served by its own generator`, () => {
      assert.equal(topicFor(title, 10)?.id, id);
      assert.ok(mathBankCovers(title, kb, 10), 'covered with its lesson');
      assert.ok(mathBankCovers(title, null, 10), 'covered by its title');
      const session = new Set<string>();
      const texts = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const q = takeConcreteMath('short_answer', title, kb, TIERS[i % 3]!, 'ar', 1, session, false);
        assert.ok(q, `nothing came back on draw ${i + 1}`);
        texts.add(q.text);
        // never a banked item: each text is one of this generator's questions
        assert.ok(!MATH_BANK.some(b => itemStem(b, true) === q.text), `a banked item: ${q.text}`);
        check(id, { id: 'x', family: 'topic', diff: 'medium', eq: '', answer: q.answer, wrongs: [], promptAr: q.text });
      }
      assert.ok(texts.size >= 10, `only ${texts.size} distinct questions in one session`);
    });

    it(`${id}: every answer recomputed from its stem, every kind drawn`, () => {
      const kinds = new Set<string>();
      for (const item of draws(id)) kinds.add(check(id, item));
      assert.deepEqual([...kinds].sort(), KINDS[id]);
    });

    it(`${id}: three distinct wrong options, clean text, English too`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        assert.ok(item.promptEn && item.promptEn !== item.promptAr, where);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!, item.eq]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{4,}/.test(s), `float residue: ${s}`);
        }
        // a wrong option worth the answer would be a second right one («x = 3» and «y = 3» are not values)
        const v = (s: string) => { try { return num(s.replace(/°$/, '')); } catch { return null; } };
        const av = v(item.answer);
        if (av !== null && !Number.isNaN(av)) {
          for (const w of item.wrongs) { const wv = v(w); if (wv !== null && !Number.isNaN(wv)) assert.ok(Math.abs(wv - av) > 1e-9, `wrong «${w}» equals the answer: ${where}`); }
        }
      }
    });
  }

  it('a multiple-choice question offers its key among the options', () => {
    for (const [, lesson, sem] of LESSONS) {
      const session = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const q = takeConcreteMath('multiple_choice', titleOf(lesson), kbOf(lesson, sem), 'medium', 'ar', 1, session)!;
        assert.equal(q.options?.length, 4, q.text);
        assert.ok(q.options!.includes(q.answer), q.text);
      }
    }
  });
});

describe('every other Grade 10 lesson keeps the bank', () => {
  // «المتتاليات», «الاشتقاق» and «الضرب القياسي» have their own generators since 2026-11-14.
  for (const title of ['حل المعادلة الأسية', 'تبسيط المقادير الأسية']) {
    it(`«${title}» still draws banked items`, () => {
      const fam = matchMathFamily(title, null);
      assert.ok(fam, 'has a family');
      const gen = topicFor(title, 10);
      assert.ok(!gen || !G10_LESSON_FIRST.has(gen.id), `${title} is on the lesson-first list`);
      const session = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const q = takeConcreteMath('short_answer', title, null, 'medium', 'ar', 1, session, false);
        assert.ok(q, title);
        assert.ok(MATH_BANK.some(b => b.family === fam && itemStem(b, true) === q.text), `not a banked ${fam} item: ${q.text}`);
      }
    });
  }

  it('a typed English topic still reaches the bank family', () => {
    const q = takeConcreteMath('short_answer', 'law of sines', null, 'medium', 'en', 1, new Set());
    assert.ok(q && MATH_BANK.some(b => b.family === 'trig_apps' && itemStem(b, false) === q.text), q?.text);
  });
});
