/**
 * Grade 10 maths lessons that were still served from a thin shared bank family
 * (Grade 10 review, 2026-11-14), measured with the real KB lesson through
 * `takeConcreteMath`:
 *
 *   • «الأقواس والقطاعات الدائرية» got `circle` — 5 items, two of them circle equations;
 *   • «تركيب الاقترانات» and «الاقتران العكسي» shared `functions` — 5 items, «f(3)» and an
 *     arithmetic sequence among them;
 *   • «المتتاليات» got 7 items of sums and geometric sequences the book does not teach;
 *   • the four lessons of the derivatives unit shared `derivative`'s nine fixed items;
 *   • the three vector lessons shared `vectors`' five, the dot product in the first;
 *   • the two probability lessons got `stats`: a median, a mean and a die;
 *   • the scatter-plot lab («معمل برمجية جيوجبرا», u8) got linear–quadratic systems.
 *
 * Each now has its own generator following its student-book pages (S1 pp.41–46; S2 pp.25–49,
 * 54–75, 80–101, 115–116, 131–147). Every key below is recomputed from the numbers printed in
 * its own stem by code that shares nothing with the generators.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G10_LESSON_FIRST } from '../grade10.ts';
import { MATH_BANK, itemStem, mathBankCovers, takeConcreteMath, type ConcreteItem, type DiffTier, type PracticeLesson } from '../index.ts';

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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 10, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 101)));
}

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
const LESSONS_B: Array<[string, string, number]> = [
  ['g10_arcs', 'u2_l2', 1],
  ['g10_composition', 'u5_l3', 2],
  ['g10_inverse', 'u5_l4', 2],
  ['g10_sequences', 'u5_l5', 2],
  ['g10_slope', 'u6_lab', 2],
  ['g10_slope', 'u6_l1', 2],
  ['g10_derivative', 'u6_l2', 2],
  ['g10_extrema', 'u6_l3', 2],
  ['g10_vectors', 'u7_l1', 2],
  ['g10_vector_ops', 'u7_l2', 2],
  ['g10_dot', 'u7_l3', 2],
  ['g10_scatter_lab', 'u8_lab', 2],
  ['g10_exclusive', 'u8_l4', 2],
  ['g10_independent', 'u8_l5', 2],
];
const kbOf = (lesson: string, sem: number): PracticeLesson => ({
  id: `kbl-math-s${sem}-nccd-${lesson}`, titleAr: titleOf(lesson), titleEn: '', objectives: [], keyConceptsAr: [], keyConceptsEn: [],
});

// ─── stem readers ───────────────────────────────────────────────────────────

const sn = (s: string) => Number(s.replace(/−/g, '-'));
/** «3√5», «−2√3/2», «7», «−3/4», «0.35». */
function num(s: string): number {
  const t = s.trim().replace(/−/g, '-');
  let m = t.match(/^(-?)(\d*)√(\d+)(?:\/(\d+))?$/);
  if (m) return (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1) * Math.sqrt(Number(m[3])) / (m[4] ? Number(m[4]) : 1);
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  assert.match(t, /^-?\d+(?:\.\d+)?$/, `not a value: «${s}»`);
  return Number(t);
}
const close = (a: number, b: number, where: string, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}: ${where}`);
const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** «2x³ − x + 5» in variable `v` → coefficient by exponent. */
function poly(s: string, v = 'x'): Map<number, number> {
  const out = new Map<number, number>();
  const t = s.replace(/−/g, '-').replace(/\s+/g, '');
  const re = new RegExp(`([+-]?)(\\d*)(${v}([${SUPS}]*))?`, 'g');
  let m: RegExpExecArray | null;
  let seen = 0;
  while ((m = re.exec(t)) && m[0] !== '') {
    seen += m[0].length;
    assert.ok(m[2] || m[3], `bad term in «${s}»`);
    const coef = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
    const e = m[3] ? (m[4] ? Number([...m[4]].map(c => SUPS.indexOf(c)).join('')) : 1) : 0;
    out.set(e, (out.get(e) ?? 0) + coef);
  }
  assert.equal(seen, t.length, `unparsed text in «${s}»`);
  return out;
}
const at = (p: Map<number, number>, x: number) => [...p].reduce((s, [e, c]) => s + c * x ** e, 0);
const samePoly = (a: Map<number, number>, b: Map<number, number>) =>
  [...new Set([...a.keys(), ...b.keys()])].every(k => Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) < 1e-9);
const deriv = (p: Map<number, number>) => new Map([...p].filter(([e]) => e > 0).map(([e, c]) => [e - 1, c * e] as [number, number]));
/** «(x ، y)» points; values may be signed. */
const pts = (s: string) => [...s.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [sn(m[1]!), sn(m[2]!)] as [number, number]);
/** «⟨a ، b⟩» vectors; components may be surds. */
const vecs = (s: string) => [...s.matchAll(/⟨([^،⟩]+) ، ([^⟩]+)⟩/g)].map(m => [num(m[1]!), num(m[2]!)] as [number, number]);
/** «y = 2x − 3» → [m, c]. */
function line(s: string): [number, number] {
  const m = s.match(/^y = (.+)$/);
  assert.ok(m, `not a line: «${s}»`);
  const p = poly(m[1]!);
  for (const k of p.keys()) assert.ok(k <= 1, s);
  return [p.get(1) ?? 0, p.get(0) ?? 0];
}
const P = (name: string, s: string) => { const m = s.match(new RegExp(`${name.replace(/[()∩∪]/g, c => `\\${c}`)} = (0\\.\\d+)`)); assert.ok(m, `${name} not in «${s}»`); return Number(m[1]); };
const rad = (d: number) => (d * Math.PI) / 180;
/** The die faces an event phrase names. */
const DIE: Record<string, number[]> = {
  'عدد فردي': [1, 3, 5], 'عدد زوجي': [2, 4, 6], 'عدد أولي': [2, 3, 5], 'عدد أكبر من 4': [5, 6], 'عدد أكبر من 3': [4, 5, 6],
  'عدد أقل من 3': [1, 2], 'عدد أقل من 5': [1, 2, 3, 4], 'العدد 6': [6], 'عدد من مضاعفات 3': [3, 6],
  // the condition, as an adjective after «إذا كان العدد الظاهر»
  'زوجيًا': [2, 4, 6], 'فرديًا': [1, 3, 5], 'أقل من 5': [1, 2, 3, 4], 'أوليًا': [2, 3, 5],
};
const frac = (n: number, d: number) => n / d;

// ─── one checker per generator ──────────────────────────────────────────────

function check(id: string, item: ConcreteItem): string {
  const p = item.promptAr!, a = item.answer;
  const where = `${id} «${p}» → ${a}`;
  switch (id) {
    case 'g10_arcs': {
      if (p.includes('مرشّ')) {
        const [th, r] = [Number(p.match(/بزاوية (\d+)°/)![1]), Number(p.match(/مسافة (\d+) م/)![1])];
        close(Number(a), (th / 360) * Math.PI * r * r, where, 0.051);
        assert.match(a, /^\d+\.\d$/, where);
        return 'rounded';
      }
      if (p.includes('ما الكسر')) { close(num(a), Number(p.match(/زاويته (\d+)°/)![1]) / 360, where); return 'fraction'; }
      if (p.includes('ما قياس زاوية القطاع')) {
        const A = Number(p.match(/مساحة قطاع دائري (\d+)π/)![1]), r = Number(p.match(/نصف قطر دائرته (\d+)/)![1]);
        assert.equal(a, `${(360 * A) / (r * r)}°`, where);
        return 'angle';
      }
      const r = Number(p.match(/طول نصف قطرها (\d+)/)![1]), th = Number(p.match(/زاويته (\d+)°/)![1]);
      const arc = (th * 2 * r) / 360, area = (th * r * r) / 360;
      if (p.includes('ما طول قوس')) { assert.equal(a, `${arc}π`, where); return 'arc'; }
      if (p.includes('ما مساحة القطاع')) { assert.equal(a, `${area}π`, where); return 'area'; }
      assert.ok(p.includes('ما محيط القطاع'), where);
      assert.equal(a, `${arc}π + ${2 * r}`, where);
      return 'perimeter';
    }
    case 'g10_composition': {
      if (p.includes('مستثناة')) {
        const m = p.match(/f\(x\) = (\d+)\/\(x − (\d+)\) و g\(x\) = (\d+)\/\(x − (\d+)\)/)!;
        const [, , fm, q, gn] = m.map(Number) as number[];
        assert.ok(fm && q && gn, where);
        const ex = [gn, gn + q / fm].sort((x, y) => x - y);
        assert.equal(a, ex.join(' ، '), where);
        return 'domain';
      }
      if (p.includes('C(q)')) {
        const k = Number(p.match(/q\(t\) = (\d+)t/)![1]);
        const C = poly(p.match(/C\(q\) = ([^،.]+?)\. /)![1]!, 'q');
        const t0 = Number(p.match(/\(C∘q\)\((\d+)\)/)![1]);
        assert.equal(Number(a), at(C, k * t0), where);
        return 'cost';
      }
      if (p.includes('h(x) = (')) {
        const m = p.match(/h\(x\) = \((.+?)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/)!;
        assert.equal(a, `f(x) = x${m[2]} ، g(x) = ${m[1]}`, where);
        return 'decompose';
      }
      const m = p.match(/f\(x\) = (.+?) و g\(x\) = (.+?)، /)!;
      const f = poly(m[1]!), g = poly(m[2]!);
      const F: Record<string, (x: number) => number> = { f: x => at(f, x), g: x => at(g, x) };
      if (p.includes('ما قاعدة')) {
        const r = poly(a.replace(/^\(f∘g\)\(x\) = /, ''));
        for (const x of [-2, -1, 0, 1, 3]) close(at(r, x), F.f!(F.g!(x)), where);
        return 'rule';
      }
      const c = p.match(/\((f|g)∘(f|g)\)\((−?\d+)\)/)!;
      assert.equal(sn(a), F[c[1]!]!(F[c[2]!]!(sn(c[3]!))), where);
      return c[1] === c[2] ? 'self' : 'value';
    }
    case 'g10_inverse': {
      if (p.includes('مجال')) {
        const m = p.match(/√\((\d+)x − (\d+)\)/)!;
        assert.equal(a, `x ≥ ${Number(m[2]) / Number(m[1])}`, where);
        return 'domain';
      }
      if (p.includes('{(')) {
        const src = pts(p), out = pts(a);
        assert.deepEqual(out, src.map(([x, y]) => [y, x]), where);
        return 'relation';
      }
      if (p.includes('(f∘g)')) { assert.equal(a, p.match(/\(f∘g\)\((−?\d+)\)/)![1], where); return 'identity'; }
      const f = poly(p.match(/f\(x\) = ([^،.]+?)(?: حيث|، |\.)/)![1]!);
      if (p.includes('f⁻¹(') && !p.includes('الاقتران العكسي للاقتران')) {
        const k = sn(p.match(/f⁻¹\((−?\d+)\)/)![1]!);
        close(at(f, sn(a)), k, where);
        return 'value';
      }
      // a rule: f(f⁻¹(x)) = x where f⁻¹ is defined
      const sq = a.match(/^f⁻¹\(x\) = √\(\(x ([−+]) (\d+)\)\/(\d+)\)$/);
      if (sq) {
        const shift = (sq[1] === '−' ? -1 : 1) * Number(sq[2]), d = Number(sq[3]);
        for (const x of [20, 30, 50]) close(at(f, Math.sqrt((x + shift) / d)), x, where);
        assert.ok(p.includes('x ≥ 0'), where);
        return 'sqrt rule';
      }
      const ln = a.match(/^f⁻¹\(x\) = \(x ([−+]) (\d+)\)\/(\d+)$/);
      assert.ok(ln, where);
      const shift = (ln[1] === '−' ? -1 : 1) * Number(ln[2]), d = Number(ln[3]);
      for (const x of [-3, 0, 5]) close(at(f, (x + shift) / d), x, where);
      return 'rule';
    }
    case 'g10_sequences': {
      if (p.includes('ما الحد التالي')) {
        const t = p.match(/المتتالية: (.+?) ، …/)![1]!.split(' ، ').map(sn);
        const d = t[1]! - t[0]!, r = t[1]! / t[0]!;
        const arith = t.every((v, i) => i === 0 || v - t[i - 1]! === d);
        const geo = t.every((v, i) => i === 0 || Math.abs(v / t[i - 1]! - r) < 1e-12);
        assert.ok(arith !== geo, where);
        assert.equal(sn(a), arith ? t.at(-1)! + d : t.at(-1)! * r, where);
        return arith ? 'next arithmetic' : 'next geometric';
      }
      if (p.includes('أوجد الحد العام')) {
        const t = p.match(/للمتتالية: (.+?) ، …/)![1]!.split(' ، ').map(sn);
        const T = poly(a.replace(/^T\(n\) = /, ''), 'n');
        t.forEach((v, i) => assert.equal(at(T, i + 1), v, where));
        return Math.max(...T.keys()) === 1 ? 'rule linear' : 'rule power';
      }
      const T = poly(p.match(/T\(n\) = ([^،.؟:]+?)(?:\.(?: |$)|: |؟|،)/)![1]!, 'n');
      const deg = Math.max(...[...T].filter(([, c]) => c !== 0).map(([e]) => e));
      if (p.includes('صنّف')) { assert.equal(a, ['', 'متتالية خطية', 'متتالية تربيعية', 'متتالية تكعيبية'][deg], where); return 'classify'; }
      if (p.includes('الحدود الأربعة الأولى')) { assert.equal(a, [1, 2, 3, 4].map(n => String(at(T, n)).replace('-', '−')).join(' ، '), where); return 'first terms'; }
      const n0 = Number(p.match(/رتبته (\d+)/)![1]);
      assert.equal(sn(a), at(T, n0), where);
      return 'term';
    }
    case 'g10_slope': {
      if (p.includes('إشارة ميل')) {
        const want = p.includes('حادة') ? 'موجبة' : p.includes('منفرجة') ? 'سالبة' : 'صفر';
        assert.ok(p.includes('أفقيًا') || want !== 'صفر', where);
        assert.equal(a, want, where);
        return 'sign';
      }
      if (p.includes('معادلة المماس')) {
        const [[x0, y0]] = pts(p) as [[number, number]];
        const m = sn(p.match(/يساوي (−?\d+)/)![1]!);
        const [lm, lc] = line(a);
        assert.equal(lm, m, where);
        assert.equal(lm * x0 + lc, y0, where);
        return 'tangent equation';
      }
      if (p.includes('يمر بالنقطتين')) {
        const [[x1, y1], [x2, y2]] = pts(p) as [[number, number], [number, number]];
        close(num(a), (y2 - y1) / (x2 - x1), where);
        return 'tangent slope';
      }
      const [t1, t2] = p.match(/\[(\d+) ، (\d+)\]/)!.slice(1).map(Number) as [number, number];
      if (p.includes('s(t) =')) {
        const s = poly(p.match(/s\(t\) = (.+?) موقع/)![1]!, 't');
        assert.equal(sn(a), (at(s, t2) - at(s, t1)) / (t2 - t1), where);
        return 'average from rule';
      }
      const table = new Map(pts(p));
      assert.equal(sn(a), (table.get(t2)! - table.get(t1)!) / (t2 - t1), where);
      return 'average from table';
    }
    case 'g10_derivative': {
      if (p.includes('s(t) =')) {
        const s = poly(p.match(/s\(t\) = (.+?) موقع/)![1]!, 't');
        const t0 = Number(p.match(/t = (\d+)/)![1]);
        if (p.includes('تسارع')) { assert.equal(sn(a), at(deriv(deriv(s)), t0), where); return 'acceleration'; }
        assert.equal(sn(a), at(deriv(s), t0), where);
        return 'velocity';
      }
      const prod = p.match(/f\(x\) = \(x ([−+]) (\d+)\)\(x ([−+]) (\d+)\)/);
      const f = prod
        ? (() => { const r1 = (prod[1] === '−' ? -1 : 1) * Number(prod[2]), r2 = (prod[3] === '−' ? -1 : 1) * Number(prod[4]); return new Map([[2, 1], [1, r1 + r2], [0, r1 * r2]]); })()
        : poly(p.match(/f\(x\) = (.+?)(?:\.(?: |$)|، |؟| عند| يساوي)/)![1]!);
      if (p.includes('معادلة مماس')) {
        const x0 = sn(p.match(/عند x = (−?\d+)/)![1]!);
        const [lm, lc] = line(a);
        assert.equal(lm, at(deriv(f), x0), where);
        assert.equal(lm * x0 + lc, at(f, x0), where);
        return 'tangent';
      }
      if (p.includes('ما ميل')) { assert.equal(sn(a), at(deriv(f), sn(p.match(/x = (−?\d+)/)![1]!)), where); return 'slope at'; }
      if (p.includes('عند أيّ قيمة')) {
        const k = sn(p.match(/يساوي (−?\d+)؟/)![1]!);
        assert.equal(at(deriv(f), sn(a.replace('x = ', ''))), k, where);
        return 'slope equals';
      }
      assert.ok(samePoly(poly(a.replace(/^f′\(x\) = /, '')), deriv(f)), where);
      return prod ? 'product' : f.size === 1 ? 'power' : 'polynomial';
    }
    case 'g10_extrema': {
      if (p.includes('s(t) =')) {
        const s = poly(p.match(/s\(t\) = (.+?) ارتفاع/)![1]!, 't');
        const top = -(s.get(1)! / (2 * s.get(2)!));
        assert.equal(sn(a), at(s, top), where);
        return 'projectile';
      }
      if (p.includes('A(x) = x(')) {
        const L = Number(p.match(/A\(x\) = x\((\d+) − 2x\)/)![1]);
        assert.equal(sn(a), (L * L) / 8, where);
        return 'fence';
      }
      const f = poly(p.match(/f\(x\) = (.+?)؟/)![1]!);
      const crit: number[] = [];
      for (let x = -30; x <= 30; x++) if (Math.abs(at(deriv(f), x)) < 1e-9) crit.push(x);
      assert.ok(crit.length > 0, `no whole critical value: ${where}`);
      if (p.includes('القيم الحرجة') || p.includes('القيمة الحرجة')) {
        assert.equal(a, crit.map(x => `x = ${String(x).replace('-', '−')}`).join(' ، '), where);
        return f.has(3) ? 'cubic critical' : 'critical';
      }
      const second = (x: number) => at(deriv(deriv(f)), x);
      const want = p.includes('العظمى') ? crit.filter(x => second(x) < 0) : crit.filter(x => second(x) > 0);
      assert.equal(want.length, 1, where);
      assert.equal(sn(a), at(f, want[0]!), where);
      return f.has(3) ? 'cubic value' : 'quadratic value';
    }
    case 'g10_vectors': {
      if (p.includes('مقدار المتجه')) {
        const ps = pts(p);
        const [vx, vy] = ps.length === 2 ? [ps[1]![0] - ps[0]![0], ps[1]![1] - ps[0]![1]] : vecs(p)[0]!;
        close(num(a), Math.hypot(vx, vy), where);
        return ps.length === 2 ? 'magnitude from points' : 'magnitude';
      }
      if (p.includes('الزاوية التي يصنعها')) {
        const [[vx, vy]] = vecs(p) as [[number, number]];
        let d = (Math.atan2(vy, vx) * 180) / Math.PI;
        if (d < 0) d += 360;
        close(Number(a.replace('°', '')), d, where, 1e-6);
        return 'direction';
      }
      if (p.includes('بسرعة مقدارها')) {
        const s = Number(p.match(/مقدارها (\d+)/)![1]), th = Number(p.match(/بزاوية (\d+)°/)![1]);
        const [[vx, vy]] = vecs(a) as [[number, number]];
        close(vx, s * Math.cos(rad(th)), where, 1e-9);
        close(vy, s * Math.sin(rad(th)), where, 1e-9);
        return 'velocity';
      }
      const [A] = pts(p);
      if (p.includes('نقطة نهايته')) {
        const [[vx, vy]] = vecs(p) as [[number, number]];
        assert.deepEqual(pts(a)[0], [A![0] + vx, A![1] + vy], where);
        return 'endpoint';
      }
      const [, B] = pts(p);
      assert.deepEqual(vecs(a)[0], [B![0] - A![0], B![1] - A![1]], where);
      return 'components';
    }
    case 'g10_vector_ops': {
      if (p.includes('بُعده عن نقطة انطلاقه')) {
        const [d1, d2] = [...p.matchAll(/(\d+) كم/g)].map(m => Number(m[1]));
        close(num(a), Math.hypot(d1!, d2!), where);
        return 'journey';
      }
      if (p.includes('موازيًا')) {
        const [[k0, c2], [va, vb]] = [[0, sn(p.match(/⟨k ، (−?\d+)⟩/)![1]!)], vecs(p.replace(/⟨k ، −?\d+⟩/, ''))[0]!];
        void k0;
        assert.equal(sn(a) * vb!, c2 * va!, where);
        return 'parallel';
      }
      const chain = p.match(/ما ناتج (.+)؟/);
      if (chain && chain[1]!.includes('⃗')) {
        const parts = chain[1]!.split(' + ').map(s => s.replace('⃗', ''));
        parts.forEach((s, i) => i > 0 && assert.equal(s[0], parts[i - 1]![1], where));
        assert.equal(a, `${parts[0]![0]}${parts.at(-1)![1]}⃗`, where);
        return 'chain';
      }
      const [va, vb] = vecs(p) as [[number, number], [number, number]];
      const ex = p.match(/فأوجد (.+)\.$/)![1]!;
      const m = ex.match(/^(−?\d*)a ([+−]) (\d*)b$/)!;
      assert.ok(m, where);
      const ca = m[1] === '' ? 1 : m[1] === '−' ? -1 : sn(m[1]!), cb = (m[2] === '−' ? -1 : 1) * (m[3] ? Number(m[3]) : 1);
      assert.deepEqual(vecs(a)[0], [ca * va[0] + cb * vb[0], ca * va[1] + cb * vb[1]], where);
      return ca === 1 && Math.abs(cb) === 1 ? (cb > 0 ? 'add' : 'subtract') : 'combination';
    }
    case 'g10_dot': {
      if (p.includes('الشغل')) {
        const F = Number(p.match(/مقدارها (\d+) N/)![1]), d = Number(p.match(/(\d+) m/)![1]), th = Number(p.match(/زاوية (\d+)°/)![1]);
        close(Number(a), F * d * Math.cos(rad(th)), where, 1e-6);
        return 'work';
      }
      if (p.includes('|a| =')) {
        const ma = Number(p.match(/\|a\| = (\d+)/)![1]), mb = Number(p.match(/\|b\| = (\d+)/)![1]), th = Number(p.match(/(\d+)°/)![1]);
        close(sn(a), ma * mb * Math.cos(rad(th)), where, 1e-6);
        return 'from angle';
      }
      if (p.includes('متعامدين')) {
        const [[ux, uy]] = vecs(p.replace(/⟨k ، −?\d+⟩/, '')) as [[number, number]];
        const c = sn(p.match(/⟨k ، (−?\d+)⟩/)![1]!);
        assert.equal(sn(a) * ux + c * uy, 0, where);
        return 'perpendicular';
      }
      const [u, v] = vecs(p) as [[number, number], [number, number]];
      const dot = u[0] * v[0] + u[1] * v[1];
      if (p.includes('قياس الزاوية')) {
        const d = (Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...u) * Math.hypot(...v))))) * 180) / Math.PI;
        close(Number(a.replace('°', '')), d, where, 1e-4);
        return 'angle';
      }
      assert.equal(sn(a), dot, where);
      return 'dot';
    }
    case 'g10_scatter_lab': {
      if (p.includes('ما ميله')) {
        const [[x1, y1], [x2, y2]] = pts(p) as [[number, number], [number, number]];
        assert.equal(sn(a), (y2 - y1) / (x2 - x1), where);
        return 'slope';
      }
      if (p.includes('القيمة التقديرية')) {
        const m = p.match(/y = (−?\d+)x \+ (\d+)/)!;
        const [lm, lc] = [sn(m[1]!), Number(m[2])];
        if (p.includes('لـ y')) { assert.equal(sn(a), lm * Number(p.match(/x = (\d+)/)![1]) + lc, where); return 'predict y'; }
        assert.equal(sn(a), (Number(p.match(/y = (\d+)؟/)![1]) - lc) / lm, where);
        return 'predict x';
      }
      const ps = pts(p);
      const n = ps.length, mx = ps.reduce((s, q) => s + q[0], 0) / n, my = ps.reduce((s, q) => s + q[1], 0) / n;
      const sxy = ps.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0), sxx = ps.reduce((s, q) => s + (q[0] - mx) ** 2, 0), syy = ps.reduce((s, q) => s + (q[1] - my) ** 2, 0);
      const r = sxy / Math.sqrt(sxx * syy);
      assert.equal(a, r > 0.85 ? 'ارتباط طردي (موجب)' : r < -0.85 ? 'ارتباط عكسي (سالب)' : 'لا يوجد ارتباط', where);
      return 'correlation';
    }
    case 'g10_exclusive': {
      if (p.includes('بطاقة')) {
        const N = Number(p.match(/من 1 إلى (\d+)/)![1]), k = Number(p.match(/مضاعفات العدد (\d+)/)![1]);
        let c = 0;
        for (let x = 1; x <= N; x++) if (x % 2 === 0 || x % k === 0) c++;
        close(num(a), frac(c, N), where);
        return 'cards';
      }
      if (p.includes('متنافيين') && !p.includes('غير متنافيين')) {
        close(Number(a), P('P(A)', p) + P('P(B)', p), where);
        return 'union exclusive';
      }
      if (p.includes('متممة')) { close(Number(a), 1 - P('P(A)', p), where); return 'complement'; }
      const pa = P('P(A)', p), pb = P('P(B)', p);
      if (p.includes('فما P(A ∩ B)')) { close(Number(a), pa + pb - P('P(A ∪ B)', p), where); return 'intersection'; }
      const pab = P('P(A ∩ B)', p);
      if (p.includes('A فقط')) { close(Number(a), pa - pab, where); return 'only'; }
      if (p.includes('عدم وقوع أيٍّ')) { close(Number(a), 1 - (pa + pb - pab), where); return 'neither'; }
      close(Number(a), pa + pb - pab, where);
      return 'union';
    }
    case 'g10_independent': {
      if (p.includes('حجرا نرد')) {
        const ev = [...p.matchAll(/ظهور (.+?) على (?:الأول|الثاني)/g)].map(m => DIE[m[1]!]);
        assert.ok(ev.length === 2 && ev[0] && ev[1], where);
        close(num(a), (ev[0]!.length * ev[1]!.length) / 36, where);
        return 'two dice';
      }
      if (p.includes('حجر نرد')) {
        const A = DIE[p.match(/احتمال ظهور (.+?) إذا/)![1]!], B = DIE[p.match(/إذا كان العدد الظاهر (.+?)؟/)![1]!];
        assert.ok(A && B, where);
        close(num(a), A.filter(x => B.includes(x)).length / B.length, where);
        return 'conditional die';
      }
      if (p.includes('كرات')) {
        const r = Number(p.match(/(\d+) كرات حمراء/)![1]), g = Number(p.match(/و ?(\d+) كرات خضراء/)![1]), n = r + g;
        const back = !p.includes('دون إرجاع');
        const k = p.includes('حمراوين') ? r : g;
        close(num(a), back ? (k * k) / (n * n) : (k * (k - 1)) / (n * (n - 1)), where);
        return back ? 'with replacement' : 'without replacement';
      }
      if (p.includes('P(A | B)')) { close(Number(a), P('P(A ∩ B)', p) / P('P(B)', p), where); return 'conditional'; }
      close(Number(a), P('P(A)', p) * P('P(B)', p), where);
      assert.ok(p.includes('مستقلين'), where);
      return 'independent';
    }
  }
  throw new Error(`no checker for ${id}`);
}

const KINDS: Record<string, string[]> = {
  g10_arcs: ['angle', 'arc', 'area', 'fraction', 'perimeter', 'rounded'],
  g10_composition: ['cost', 'decompose', 'domain', 'rule', 'self', 'value'],
  g10_inverse: ['domain', 'identity', 'relation', 'rule', 'sqrt rule', 'value'],
  g10_sequences: ['classify', 'first terms', 'next arithmetic', 'next geometric', 'rule linear', 'rule power', 'term'],
  g10_slope: ['average from rule', 'average from table', 'sign', 'tangent equation', 'tangent slope'],
  g10_derivative: ['acceleration', 'polynomial', 'power', 'product', 'slope at', 'slope equals', 'tangent', 'velocity'],
  g10_extrema: ['critical', 'cubic critical', 'cubic value', 'fence', 'projectile', 'quadratic value'],
  g10_vectors: ['components', 'direction', 'endpoint', 'magnitude', 'magnitude from points', 'velocity'],
  g10_vector_ops: ['add', 'chain', 'combination', 'journey', 'parallel', 'subtract'],
  g10_dot: ['angle', 'dot', 'from angle', 'perpendicular', 'work'],
  g10_scatter_lab: ['correlation', 'predict x', 'predict y', 'slope'],
  g10_exclusive: ['cards', 'complement', 'intersection', 'neither', 'only', 'union', 'union exclusive'],
  g10_independent: ['conditional', 'conditional die', 'independent', 'two dice', 'with replacement', 'without replacement'],
};

describe('Grade 10 lessons the shared bank served thinly (second batch)', () => {
  it('the lesson-first list is exactly the first batch and this one', () => {
    const FIRST = ['g10_circle_equation', 'g10_trig_ratios', 'g10_trig_full_turn', 'g10_trig_graphs', 'g10_trig_equations', 'g10_sine_law', 'g10_cosine_law', 'g10_3d', 'g10_polynomials', 'g10_rational'];
    assert.deepEqual([...G10_LESSON_FIRST].sort(), [...new Set([...FIRST, ...LESSONS_B.map(([id]) => id)])].sort());
  });

  for (const [id, lesson, sem] of LESSONS_B) {
    const title = titleOf(lesson);
    const kb = kbOf(lesson, sem);
    it(`«${title}» (${lesson}) is served by its own generator`, () => {
      assert.equal(topicFor(title, 10)?.id, id);
      assert.ok(mathBankCovers(title, kb, 10));
      const session = new Set<string>();
      const texts = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const q = takeConcreteMath('short_answer', title, kb, TIERS[i % 3]!, 'ar', 1, session, false);
        assert.ok(q, `nothing came back on draw ${i + 1}`);
        texts.add(q.text);
        assert.ok(!MATH_BANK.some(b => itemStem(b, true) === q.text), `a banked item: ${q.text}`);
        check(id, { id: 'x', family: 'topic', diff: 'medium', eq: '', answer: q.answer, wrongs: [], promptAr: q.text });
      }
      assert.ok(texts.size >= 10, `only ${texts.size} distinct questions in one session`);
    });
  }

  for (const id of Object.keys(KINDS)) {
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
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{4,}/.test(s), `float residue: ${s}`);
          assert.ok(!/\+ −|− −|\+ \+/.test(s), `doubled sign: ${s}`);
        }
        const v = (s: string) => { try { return num(s.replace(/°$/, '')); } catch { return null; } };
        const av = v(item.answer);
        if (av !== null) for (const w of item.wrongs) { const wv = v(w); if (wv !== null) assert.ok(Math.abs(wv - av) > 1e-9, `wrong «${w}» equals the answer: ${where}`); }
      }
    });
  }

  it('a multiple-choice question offers its key among the options', () => {
    for (const [, lesson, sem] of LESSONS_B) {
      const session = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const q = takeConcreteMath('multiple_choice', titleOf(lesson), kbOf(lesson, sem), 'medium', 'ar', 1, session)!;
        assert.ok(q, lesson);
        assert.equal(q.options?.length, 4, q.text);
        assert.ok(q.options!.includes(q.answer), q.text);
      }
    }
  });
});
