/**
 * The Grade 9 lessons that had no generator until 2026-11-13: «تمثيل المتباينات
 * الخطية بمتغيرين بيانيًا» (and its GeoGebra lab), «تفسير التمثيلات البيانية» and
 * the Semester 2 lab «توسع: مثلث القطع المنصفة». Each answer is recomputed from
 * the printed stem by a route that shares no code with the generators (a point
 * tested against the inequality, a shoelace area, two lines set equal).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { mathBankCovers, takeElementaryMath, type ConcreteItem, type DiffTier } from '../index.ts';

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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 9, TIERS[i % 3]!, new Set(), seeded(i * 15485863 + 29)));
}

const sn = (s: string) => Number(s.replace('−', '-'));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);
/** Every «(x ، y)» in a string, in order. */
const pts = (s: string) => [...s.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [sn(m[1]!), sn(m[2]!)] as [number, number]);
const cmp = (v: number, s: string, c: number) => (s === '<' ? v < c : s === '>' ? v > c : s === '≤' ? v <= c : v >= c);
const SIGN = '[<>≤≥]';

/** «−2x + 3y ≤ 5» → a, b, sign, c. */
function twoVar(s: string) {
  const m = s.match(new RegExp(`(−?)(\\d*)x ([+−]) (\\d*)y (${SIGN}) (−?\\d+)`));
  assert.ok(m, `no two-variable inequality in: ${s}`);
  const a = (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
  const b = (m[3] === '−' ? -1 : 1) * (m[4] ? Number(m[4]) : 1);
  return { a, b, s: m[5]!, c: sn(m[6]!) };
}

describe('ineq_two_var', () => {
  it('every kind is asked, and every answer holds up', () => {
    const kinds = new Set<string>();
    for (const item of draws('ineq_two_var')) {
      const p = item.promptAr!;
      if (p.startsWith('أيّ النقاط')) {
        kinds.add('points');
        const { a, b, s, c } = twoVar(p);
        const listed = pts(p.split(': ')[1]!);
        assert.equal(listed.length, 4, p);
        const ok = (q: [number, number]) => cmp(a * q[0] + b * q[1], s, c);
        const [ans] = pts(item.answer);
        assert.ok(ok(ans!), `answer is not a solution: ${p} → ${item.answer}`);
        assert.equal(listed.filter(ok).length, 1, `exactly one listed point is a solution: ${p}`);
        for (const w of item.wrongs) assert.ok(!ok(pts(w)[0]!), `wrong ${w} is a solution: ${p}`);
        continue;
      }
      if (p.startsWith('عند تمثيل')) {
        kinds.add('shading');
        // the inequality may be y ⋈ mx + k, x ⋈ c or y ⋈ c; test it with points either side of the line and ON it
        const m = p.match(new RegExp(`المتباينة (x|y) (${SIGN}) (.+?) بيانيًا`))!;
        const v = m[1]!, s = m[2]!, rhs = m[3]!;
        const eq = (x: number) => Function('x', `return ${rhs.replace(/−/g, '-').replace(/(\d)x/g, '$1*x').replace(/(^|[^\d])x/g, '$1(x)').replace(/\(x\)\*/g, '(x)*')}`)(x) as number;
        const holdsAt = (x: number, y: number) => (v === 'x' ? cmp(x, s, sn(rhs)) : cmp(y, s, eq(x)));
        // a point on the line is a solution only for ≤ and ≥
        const onLine: [number, number] = v === 'x' ? [sn(rhs), 0] : [0, eq(0)];
        const dashed = !holdsAt(...onLine);
        const upper = v === 'x' ? holdsAt(sn(rhs) + 1, 0) : holdsAt(0, eq(0) + 1);
        const want = (d: boolean, u: boolean) => `${d ? 'متقطع' : 'متصل'}، ويُظلَّل ما ${v === 'x' ? (u ? 'على يمينه' : 'على يساره') : (u ? 'فوقه' : 'تحته')}`;
        assert.ok(item.answer.endsWith(want(dashed, upper)), `${p} → ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!w.endsWith(want(dashed, upper)), `${w} also describes ${p}`);
        assert.equal(new Set([item.answer, ...item.wrongs].map(o => o.replace(/^.*?(متقطع|متصل)/, '$1'))).size, 4, p);
        continue;
      }
      if (p.startsWith('ما معادلة المستقيم الحدودي')) {
        kinds.add('boundary');
        const q = twoVar(p), a = twoVar(`${item.answer.replace(' = ', ' ≤ ')}`);
        assert.deepEqual([a.a, a.b, a.c], [q.a, q.b, q.c], p);
        for (const w of item.wrongs) {
          const o = twoVar(w.replace(' = ', ' ≤ '));
          assert.notDeepEqual([o.a, o.b, o.c], [q.a, q.b, q.c], `${w} is the same line: ${p}`);
        }
        continue;
      }
      if (p.startsWith('ما نقطة تقاطع')) {
        kinds.add('intercept');
        const { a, b, c } = twoVar(p), onY = has(p, 'المحور y');
        const good = (q: [number, number]) => a * q[0] + b * q[1] === c && (onY ? q[0] === 0 : q[1] === 0);
        assert.ok(good(pts(item.answer)[0]!), p);
        for (const w of item.wrongs) assert.ok(!good(pts(w)[0]!), `${w} is also an intercept: ${p}`);
        continue;
      }
      kinds.add('model');
      const [a, b, c] = nums(p);
      assert.equal(item.answer, `${a}x + ${b}y ≤ ${c}`, p);
      assert.ok(a !== b && a! >= 3 && b! >= 3, p);
      for (const w of item.wrongs) assert.notEqual(w, item.answer);
    }
    assert.equal(kinds.size, 5, `kinds drawn: ${[...kinds]}`);
  });
});

describe('interpret_graphs', () => {
  it('every kind is asked, and every answer holds up', () => {
    const kinds = new Set<string>();
    for (const item of draws('interpret_graphs', 600)) {
      const p = item.promptAr!;
      if (p.startsWith('منحنى التحويل')) {
        // the only digits in the stem are the point (p0, q0) and the count asked about
        const [p0, q0, n] = nums(p);
        // the line goes through the origin and (p0, q0): its rate is q0 / p0
        const rate = q0! / p0!;
        const forward = n! < rate;
        kinds.add(forward ? 'convert' : 'convert back');
        assert.equal(Number(item.answer), forward ? n! * rate : n! / rate, p);
        assert.ok(Number.isInteger(Number(item.answer)), p);
        continue;
      }
      if (p.startsWith('يمثّل منحنى الموقع – الزمن حركة جسمين')) {
        kinds.add('meet');
        const [, vA, d, vB] = nums(p);
        const t = Number(item.answer);
        assert.equal(vA! * t, d! + vB! * t, p);
        for (const w of item.wrongs) assert.notEqual(vA! * Number(w), d! + vB! * Number(w), `${w} also meets: ${p}`);
        continue;
      }
      if (p.startsWith('يمثّل منحنى الموقع – الزمن حركة جسم')) {
        const [[t1, s1], [t2, s2]] = pts(p) as [[number, number], [number, number]];
        const v = (s2 - s1) / (t2 - t1);
        assert.ok(Number.isInteger(v) && v > 0, p);
        if (has(p, 'ما سرعة')) { kinds.add('speed'); assert.equal(Number(item.answer), v, p); }
        else {
          kinds.add('position');
          const T = nums(p.split('عند الثانية ')[1]!)[0]!;
          assert.equal(Number(item.answer), s1 + v * (T - t1), p);
          assert.ok(T > t2, p);
        }
        for (const w of item.wrongs) assert.notEqual(w, item.answer);
        continue;
      }
      if (has(p, 'جزءٌ أفقيٌّ')) { kinds.add('flat'); assert.ok(has(item.answer, 'ساكن'), p); for (const w of item.wrongs) assert.ok(!has(w, 'ساكن'), w); continue; }
      kinds.add('faster');
      // [0 (the start), T, dA, dB]
      const [, , dA, dB] = nums(p);
      assert.notEqual(dA, dB, p);
      assert.ok(item.answer.endsWith(dA! > dB! ? 'A' : 'B'), `${p} → ${item.answer}`);
    }
    assert.equal(kinds.size, 7, `kinds drawn: ${[...kinds]}`);
  });
});

describe('midsegment_triangle', () => {
  const area = ([a, b, c]: Array<[number, number]>) => Math.abs((b![0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (b![1] - a![1])) / 2;
  it('every kind is asked, and every answer holds up', () => {
    const kinds = new Set<string>();
    for (const item of draws('midsegment_triangle')) {
      const p = item.promptAr!;
      const n = nums(p.replace(/ABC/g, ''));
      if (has(p, 'رؤوس')) {
        kinds.add('coordinates');
        const [A, B, C] = pts(p) as [[number, number], [number, number], [number, number]];
        const mid = (u: [number, number], v: [number, number]): [number, number] => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
        assert.equal(Number(item.answer), area([mid(A, B), mid(B, C), mid(C, A)]), p);
      } else if (has(p, 'أطوال أضلاع')) {
        kinds.add('perimeter');
        // the midsegments are half the sides they are parallel to
        assert.equal(Number(item.answer), (n[0]! + n[1]! + n[2]!) / 2, p);
      } else if (has(p, 'نسبة')) {
        kinds.add('ratio');
        assert.equal(item.answer, '1 : 4');
      } else if (has(p, 'مساحة مثلث القطع المنصفة للمثلث')) {
        kinds.add('original area');
        assert.equal(Number(item.answer), 4 * n[0]!, p);
      } else {
        kinds.add('midsegment area');
        assert.equal(Number(item.answer), n[0]! / 4, p);
      }
      for (const w of item.wrongs) assert.notEqual(w, item.answer);
    }
    assert.equal(kinds.size, 5, `kinds drawn: ${[...kinds]}`);
  });
});

describe('routing of the lessons that had no bank', () => {
  const cases: Array<[string, string]> = [
    ['تمثيل المتباينات الخطية بمتغيرين بيانيًا', 'ineq_two_var'],
    ['معمل برمجية جيوجبرا: تمثيل المتباينات الخطية بمتغيرين بيانيًا', 'ineq_two_var'],
    ['تفسير التمثيلات البيانية', 'interpret_graphs'],
    ['معمل برمجية جيوجبرا: توسع: مثلث القطع المنصفة', 'midsegment_triangle'],
  ];
  for (const [title, id] of cases) {
    it(`${title} → ${id}, served in every format`, () => {
      assert.equal(topicFor(title, 9)?.id, id);
      assert.ok(mathBankCovers(title, null, 9));
      for (const type of ['multiple_choice', 'short_answer', 'true_false', 'fill_blank'] as const) {
        assert.ok(takeElementaryMath(type, title, null, 9, 'medium', 'ar', 2, new Set()), `${type} refused for ${title}`);
      }
    });
    it(`${title} is not claimed by another grade`, () => {
      assert.equal(topicFor(title, 10), null);
    });
  }
});
