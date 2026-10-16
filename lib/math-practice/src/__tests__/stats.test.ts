/**
 * Statistics, probability and proportion generators (`../stats.ts`,
 * `../proportion.ts`). Each answer is recomputed from the data printed in the
 * Arabic stem — parsed back out of the text and worked with separately written
 * code — and every option set is checked for shape.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { STATS_TOPICS } from '../stats.ts';
import { PROPORTION_TOPICS } from '../proportion.ts';
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
const IDS = [...STATS_TOPICS, ...PROPORTION_TOPICS].map(t => t.id);
function draws(id: string, n = 240): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) =>
    makeTopicItem(t, t.grades[0] + (i % (t.grades[1] - t.grades[0] + 1)), TIERS[i % 3]!, new Set(), seeded(i * 7368787 + 5)));
}

const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sorted = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const median = (xs: number[]) => { const s = sorted(xs), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const frac = (s: string) => { const [a, b] = s.split('/').map(Number); return b === undefined ? a! : a! / b; };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const COLORS = ['حمراء', 'زرقاء', 'خضراء', 'صفراء'];
const DUAL = ['حمراوان', 'زرقاوان', 'خضراوان', 'صفراوان'];
/** counts from «5 كرات حمراء وكرتان زرقاوان» */
const bag = (s: string) => COLORS.map((c, i) => (s.includes(`كرتان ${DUAL[i]}`) ? 2 : Number(s.match(new RegExp(`(\\d+) (?:كرات|كرةً|كرة) ${c}`))?.[1] ?? 0)));
/** the data after the first colon up to the final sentence */
const dataList = (s: string) => { const from = s.indexOf(':') + 1, q = s.indexOf('؟'), dot = s.indexOf('. ', from); return nums(s.slice(from, dot > 0 ? dot : q < 0 ? undefined : q)); };
const lowestTerms = (s: string) => { const [a, b] = s.split('/').map(Number); return b === undefined || gcd(a!, b) === 1; };

describe('data and proportion generators: shape', () => {
  it('there are many', () => assert.ok(IDS.length >= 35, String(IDS.length)));
  for (const id of IDS) {
    it(`${id}: distinct options, clean text, both languages`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        const want = ['أكيد', 'ممكن', 'مستحيل'].includes(item.answer) || ['الوسط الحسابي', 'الوسيط', 'المنوال'].includes(item.answer) || item.answer.startsWith('العرض') || item.answer.startsWith('ارتباط') || item.answer === 'لا يوجد ارتباط' ? 2 : ['نعم', 'لا'].includes(item.answer) ? 1 : 3;
        assert.equal(item.wrongs.length, want, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, want + 1, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{3,}/.test(s), `unrounded number: ${s}`);
        }
        // a wrong fraction worth the same as the answer is a second right answer; fractions are in lowest terms
        if (/^\d+\/\d+$/.test(item.answer)) for (const w of item.wrongs) if (/^\d+(\/\d+)?$/.test(w)) assert.ok(Math.abs(frac(w) - frac(item.answer)) > 1e-9 && lowestTerms(w), `wrong fraction ${w}: ${where}`);
        for (const s of [item.answer, ...item.wrongs]) if (/^\d+$/.test(s)) assert.ok(Number(s) >= 0, where);
      }
    });
  }
});

describe('probability and counting: answers recomputed', () => {
  it('certain, possible, impossible', () => {
    const DIE: Record<string, (v: number) => boolean> = {
      'العدد 7': v => v === 7, 'عدد أكبر من 6': v => v > 6, 'العدد 0': v => v === 0, 'عدد أصغر من 7': v => v < 7,
      'عدد من 1 إلى 6': v => v >= 1 && v <= 6, 'عدد زوجي': v => v % 2 === 0, 'العدد 4': v => v === 4, 'عدد أكبر من 3': v => v > 3,
    };
    const kinds = new Set<string>();
    for (const id of ['certainty_g3', 'certainty_g4']) for (const item of draws(id).filter(i => ['أكيد', 'ممكن', 'مستحيل'].includes(i.answer))) {
      if (has(item.promptAr!, 'مكعب')) {
        if (id === 'certainty_g3') kinds.add('die');
        const ev = item.promptAr!.match(/ظهور (.+): أكيد/)![1]!;
        const c = [1, 2, 3, 4, 5, 6].filter(DIE[ev]!).length;
        assert.equal(item.answer, c === 0 ? 'مستحيل' : c === 6 ? 'أكيد' : 'ممكن', item.promptAr);
        continue;
      }
      if (id === 'certainty_g3') kinds.add('bag');
      const counts = bag(item.promptAr!);
      const present = counts.filter(c => c > 0).length;
      const m = item.promptAr!.match(/سحب كرة (حمراء|زرقاء|خضراء|صفراء):/);
      const want = !m ? 'أكيد' : counts[COLORS.indexOf(m[1]!)]! === 0 ? 'مستحيل' : present === 1 ? 'أكيد' : 'ممكن';
      assert.equal(item.answer, want, item.promptAr);
    }
    for (const id of ['certainty_g3', 'certainty_g4']) for (const item of draws(id).filter(i => has(i.promptAr!, 'يجب إخراجه'))) {
      // take out every other ball to make a colour certain, or every ball of it to make it impossible
      const p = item.promptAr!, counts = bag(p), c = counts[COLORS.indexOf(p.match(/سحب كرة (حمراء|زرقاء|خضراء|صفراء)/)![1]!)]!;
      assert.ok(c > 0, p);
      assert.equal(Number(item.answer), has(p, 'أكيدًا') ? sum(counts) - c : c, p);
      if (id === 'certainty_g3') kinds.add('takeOut');
    }
    assert.equal(kinds.size, 3, `certainty_g3 kinds: ${[...kinds]}`);
    for (const item of draws('certainty_g4').filter(i => !['أكيد', 'ممكن', 'مستحيل'].includes(i.answer) && !has(i.promptAr!, 'يجب إخراجه'))) {
      const p = item.promptAr!;
      if (has(p, 'مكعب')) assert.equal(item.answer, '6');
      else if (has(p, 'قطعة نقد')) assert.equal(item.answer, '2');
      else if (has(p, 'قرص دوار')) assert.equal(item.answer, String(nums(p)[0]));
      else assert.equal(item.answer, '2');
    }
  });

  it('which colour is most or least likely, and whether two chances are equal', () => {
    const FACES: Record<string, (v: number) => boolean> = {
      'عدد زوجي': v => v % 2 === 0, 'عدد فردي': v => v % 2 === 1, 'عدد أكبر من 4': v => v > 4, 'عدد أصغر من 3': v => v < 3,
      'العدد 6': v => v === 6, 'العدد 1': v => v === 1, 'عدد أكبر من 2': v => v > 2, 'عدد أصغر من 5': v => v < 5,
    };
    const kinds = new Set<string>();
    for (const item of draws('likelihood')) {
      const p = item.promptAr!;
      if (has(p, 'مكعب')) {
        kinds.add('die');
        const [, a, b] = p.match(/فرصة ظهور (.+) تساوي فرصة ظهور (.+)؟/)!;
        const n = (e: string) => [1, 2, 3, 4, 5, 6].filter(FACES[e]!).length;
        assert.notEqual(a, b, p);
        assert.equal(item.answer, n(a!) === n(b!) ? 'نعم' : 'لا', p);
        continue;
      }
      if (has(p, 'تساوي فرصة')) {
        kinds.add('bagEqual');
        const counts = bag(p), [, a, b] = p.match(/فرصة سحب كرة (\S+) تساوي فرصة سحب كرة (\S+)؟/)!;
        assert.notEqual(a, b, p);
        assert.equal(item.answer, counts[COLORS.indexOf(a!)] === counts[COLORS.indexOf(b!)] ? 'نعم' : 'لا', p);
        continue;
      }
      kinds.add('mostLeast');
      const counts = bag(item.promptAr!).filter(c => c > 0);
      const most = has(item.promptAr!, 'أكثر');
      const idx = counts.indexOf(most ? Math.max(...counts) : Math.min(...counts));
      assert.equal(item.answer, COLORS[idx]);
      assert.equal(new Set(counts).size, counts.length, 'colour counts must be distinct so the answer is unique');
    }
    assert.equal(kinds.size, 3, `likelihood kinds: ${[...kinds]}`);
  });

  it('probability of a colour, a die event, the complement, an expected count', () => {
    const DICE: Record<string, (v: number) => boolean> = {
      'عدد زوجي': v => v % 2 === 0, 'عدد فردي': v => v % 2 === 1, 'عدد أكبر من 4': v => v > 4, 'عدد أصغر من 3': v => v < 3,
      'العدد 6': v => v === 6, 'عدد يقبل القسمة على 3': v => v % 3 === 0, 'عدد أولي': v => [2, 3, 5].includes(v),
    };
    const SCALE = ['عند 0', 'بين 0 و 1/2', 'عند 1/2', 'بين 1/2 و 1', 'عند 1'];
    const g6 = new Set<string>();
    for (const id of ['prob_g6', 'prob_g7']) for (const item of draws(id)) {
      const p = item.promptAr!, counts = bag(p), t = sum(counts);
      if (id === 'prob_g6') g6.add(has(p, 'مقياس الاحتمال') ? 'scale' : has(p, 'مكعب') ? 'die' : 'bag');
      if (has(p, 'مقياس الاحتمال')) {
        assert.equal(id, 'prob_g6', p);
        const c = counts[COLORS.indexOf(p.match(/سحب كرة (حمراء|زرقاء|خضراء|صفراء) من/)![1]!)]!, pr = c / t;
        assert.equal(item.answer, pr === 0 ? SCALE[0] : pr === 1 ? SCALE[4] : pr === 0.5 ? SCALE[2] : pr < 0.5 ? SCALE[1] : SCALE[3], p);
        assert.ok(item.wrongs.every(w => SCALE.includes(w)), p);
        continue;
      }
      let want: number;
      if (has(p, 'مكعب')) { const key = Object.keys(DICE).find(k => p.endsWith(`ظهور ${k}؟`))!; want = [1, 2, 3, 4, 5, 6].filter(DICE[key]!).length / 6; assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, p); continue; }
      if (has(p, 'يُتوقَّع')) { const N = Number(p.match(/تكررت العملية (\d+) مرة/)![1]); assert.equal(Number(item.answer), (N * counts[0]!) / t, p); continue; }
      if (has(p, 'ألّا تكون')) want = (t - counts[0]!) / t;
      else { const m = p.match(/تكون (?:الكرة )?(حمراء|زرقاء|خضراء|صفراء)/)!; want = counts[COLORS.indexOf(m[1]!)]! / t; }
      assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, `${p} → ${item.answer}`);
    }
    assert.equal(g6.size, 3, `prob_g6 kinds: ${[...g6]}`);
    const scaleAnswers = new Set(draws('prob_g6', 600).filter(i => has(i.promptAr!, 'مقياس')).map(i => i.answer));
    assert.equal(scaleAnswers.size, 5, `every point of the scale is drawn: ${[...scaleAnswers]}`);
    const expKinds = new Set<string>();
    for (const item of draws('experimental', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'فكانت النتائج')) {
        expKinds.add('table');
        const res = COLORS.map(c => Number(p.match(new RegExp(`${c}: (\\d+)`))?.[1] ?? 0));
        assert.equal(sum(res), n[0], `the results add up to the number of draws: ${p}`);
        const c = p.match(/لسحب كرة (حمراء|زرقاء|خضراء|صفراء)/)![1]!;
        assert.ok(Math.abs(frac(item.answer) - res[COLORS.indexOf(c)]! / n[0]!) < 1e-9, p);
      } else if (has(p, 'الاحتمال النظري')) {
        expKinds.add('theoretical');
        const [T, , , face, c] = n; // T, «1 إلى 6», the face, its count
        assert.equal(face, n[5], p);
        assert.ok(Math.abs(frac(item.answer) - 1 / 6) < 1e-9, p);
        assert.ok(item.wrongs.some(w => Math.abs(frac(w) - c! / T!) < 1e-9), `the experimental value is offered as the slip: ${p}`);
      } else if (has(p, 'عادلة')) {
        expKinds.add('fair');
        const angles = [...p.matchAll(/(\d+)°/g)].map(m => Number(m[1]));
        assert.equal(sum(angles), 360, p);
        assert.equal(angles.length, n[0], p);
        assert.equal(item.answer, new Set(angles).size === 1 ? 'نعم' : 'لا', p);
      } else if (has(p, 'الاحتمال التجريبي')) { expKinds.add('experimental'); const [N, k] = n; assert.ok(Math.abs(frac(item.answer) - k! / N!) < 1e-9, p); }
      else { expKinds.add('expected'); const [k, N, M] = n; assert.equal(Number(item.answer), (M! * k!) / N!, p); assert.ok(Number.isInteger(Number(item.answer))); }
    }
    assert.equal(expKinds.size, 5, `experimental kinds drawn: ${[...expKinds]}`);
  });

  it('counting: the multiplication principle, arrangements, permutations and combinations', () => {
    const perms = (n: number, r: number) => { let p = 1; for (let i = 0; i < r; i++) p *= n - i; return p; };
    const fact = (n: number) => perms(n, n);
    for (const item of draws('counting', 300)) {
      const p = item.promptAr!, n = nums(p);
      let want: number;
      if (has(p, 'ترتيب ') && has(p, 'على رف')) want = fact(n[0]!);
      else if (has(p, 'الترتيب غير مهم')) want = perms(n[1]!, n[0]!) / fact(n[0]!);
      else if (has(p, 'الترتيب مهم')) want = perms(n[1]!, n[0]!);
      else if (has(p, 'وجبة')) want = n[0]! * n[1]! * n[2]!;
      else want = n[0]! * n[1]!;
      assert.equal(Number(item.answer), want, p);
    }
  });

  it('compound events', () => {
    for (const item of draws('compound_prob', 300)) {
      const p = item.promptAr!;
      let want: number;
      if (has(p, 'قطعة نقد')) { const DICE: Array<[string, (v: number) => boolean]> = [['عدد زوجي', v => v % 2 === 0], ['عدد فردي', v => v % 2 === 1], ['عدد أكبر من 4', v => v > 4], ['عدد أصغر من 3', v => v < 3]]; const f = DICE.find(([k]) => p.includes(`و${k} على`))![1]; want = (1 / 2) * ([1, 2, 3, 4, 5, 6].filter(f).length / 6); }
      else if (has(p, 'مستقلتان')) { const n = nums(p); want = (n[0]! / n[1]!) * (n[2]! / n[3]!); }
      else if (has(p, 'دون إرجاع')) { const [r, o] = bag(p); const t = r! + o!; want = (r! / t) * ((r! - 1) / (t - 1)); }
      else { const c = bag(p), t = sum(c); want = (c[0]! + c[1]!) / t; }
      assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, `${p} → ${item.answer}`);
    }
  });

  it('Venn diagrams', () => {
    for (const id of ['venn_g3', 'venn_g4', 'venn_g9']) for (const item of draws(id, 300)) {
      const [total, A, B, both] = nums(item.promptAr!);
      const p = item.promptAr!;
      const q = p.slice(p.indexOf('. ') + 2);
      let val: number;
      if (has(q, 'على الأقل')) val = A! + B! - both!;
      else if (has(q, 'فقط')) val = A! - both!;
      else if (has(q, 'لا يحب أيًّا') || has(q, 'لا يحبون أيًّا')) val = total! - (A! + B! - both!);
      else if (has(q, 'الاثنين')) val = both!;
      else val = total! - A!;
      assert.ok(A! + B! - both! <= total!, 'the groups fit in the total');
      if (id === 'venn_g9') assert.ok(Math.abs(frac(item.answer) - val / total!) < 1e-9, `${p} → ${item.answer}`);
      else assert.equal(Number(item.answer), val, p);
    }
  });

  it('geometric probability', () => {
    for (const item of draws('geometric_prob', 300)) {
      const p = item.promptAr!, n = nums(p);
      const want = has(p, 'مربع') ? (n[1]! ** 2) / (n[0]! ** 2) : has(p, 'قرص دوار') ? n[0]! / 360 : n[1]! / n[0]!;
      assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, `${p} → ${item.answer}`);
      assert.ok(frac(item.answer) < 1);
    }
  });
});

describe('statistics: answers recomputed', () => {
  it('mean, median, mode, range', () => {
    const meanKinds: Record<string, Set<string>> = { mean_g5: new Set(), mean_g7: new Set() };
    for (const id of ['mean_g5', 'mean_g7']) for (const item of draws(id, 300)) {
      const p = item.promptAr!, n = nums(p), kinds = meanKinds[id]!;
      if (has(p, 'ما العدد الأخير')) { kinds.add('missing'); const m = Number(p.match(/هو (\d+)\./)![1]), n = Number(p.match(/لـ (\d+) أعداد/)![1]); const known = nums(p.slice(p.indexOf('منها:'))); assert.equal(Number(item.answer), m * n - sum(known), p); }
      else if (has(p, 'مجموع علامات')) { kinds.add('fromSum'); const [count, S] = n; assert.equal(Number(item.answer), S! / count!, p); }
      else if (has(p, 'ما مجموع')) { kinds.add('toSum'); const [count, m] = n; assert.equal(Number(item.answer), m! * count!, p); }
      else if (has(p, 'الجدول التكراري')) {
        kinds.add('table');
        const rows = [...p.matchAll(/(\d+): (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
        assert.equal(Number(item.answer), sum(rows.map(([v, f]) => v * f)) / sum(rows.map(([, f]) => f)), p);
      } else if (has(p, 'قيمة متطرفة')) {
        const xs = dataList(p);
        // the outlier is the value farthest from the median of the rest, and it is far from all of them
        const far = (v: number) => { const rest = xs.filter((_, i) => i !== xs.indexOf(v)); return Math.min(...rest.map(r => Math.abs(r - v))); };
        const out = xs.reduce((a, b) => (far(b) > far(a) ? b : a));
        const rest = xs.slice(); rest.splice(xs.indexOf(out), 1);
        assert.ok(far(out) > Math.max(...rest) - Math.min(...rest), `not clearly an outlier: ${p}`);
        if (has(p, 'بعد حذف')) { kinds.add('withoutOutlier'); assert.equal(Number(item.answer), sum(rest) / rest.length, p); }
        else { kinds.add('outlier'); assert.equal(Number(item.answer), out, p); }
      } else if (has(p, 'أُضيف')) { kinds.add('added'); const [count, m, v] = n; assert.equal(Number(item.answer), (m! * count! + v!) / (count! + 1), p); }
      else { kinds.add('mean'); const xs = dataList(p); assert.equal(Number(item.answer), sum(xs) / xs.length, p); }
      assert.ok(Number.isInteger(Number(item.answer)), p);
    }
    assert.equal(meanKinds.mean_g5!.size, 4, `mean_g5 kinds: ${[...meanKinds.mean_g5!]}`);
    assert.equal(meanKinds.mean_g7!.size, 8, `mean_g7 kinds: ${[...meanKinds.mean_g7!]}`);
    const mmKinds = new Set<string>();
    for (const id of ['median_mode_g5', 'range_g5', 'median_mode_range_g7']) for (const item of draws(id, 300)) {
      const p = item.promptAr!, xs = dataList(p);
      if (has(p, 'ووسيطها')) {
        mmKinds.add(`${id}:medianMissing`);
        const shown = p.slice(p.indexOf(':') + 1, p.indexOf('، ووسيطها')).split('،').map(s => s.trim());
        const md = Number(p.match(/ووسيطها (\d+)/)![1]), h = shown.length / 2, xi = shown.indexOf('x');
        assert.ok(shown.length % 2 === 0 && (xi === h || xi === h - 1), p);
        const other = Number(shown[xi === h ? h - 1 : h]);
        const x = 2 * md - other;
        assert.equal(Number(item.answer), x, p);
        const filled = shown.map(s => (s === 'x' ? x : Number(s)));
        assert.deepEqual(filled, sorted(filled), `x keeps the list in order: ${p}`);
      } else if (has(p, 'العمر بالسنوات')) {
        mmKinds.add(`${id}:rangeTable`);
        const ages = [...p.matchAll(/(\d+): (\d+)/g)].map(m => Number(m[1]));
        assert.equal(Number(item.answer), Math.max(...ages) - Math.min(...ages), p);
      } else if (has(p, 'مدى مجموعة')) {
        mmKinds.add(`${id}:rangeEnd`);
        const [r, v] = nums(p);
        assert.equal(Number(item.answer), has(p, 'وأصغر قيمة') ? v! + r! : v! - r!, p);
        assert.ok(Number(item.answer) > 0, p);
      } else if (has(p, 'الوسيط')) { mmKinds.add(`${id}:median`); assert.equal(Number(item.answer), median(xs), p); }
      else if (has(p, 'المدى')) { mmKinds.add(`${id}:range`); assert.equal(Number(item.answer), Math.max(...xs) - Math.min(...xs), p); }
      else {
        mmKinds.add(`${id}:${has(p, 'الأهداف') ? 'modeContext' : 'mode'}`);
        const c = new Map<number, number>(); xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
        const top = [...c.entries()].sort((a, b) => b[1] - a[1]);
        assert.ok(top.length === 1 || top[0]![1] > top[1]![1], `mode is not unique: ${p}`);
        assert.equal(Number(item.answer), top[0]![0], p);
      }
    }
    for (const k of ['median_mode_g5:median', 'median_mode_g5:mode', 'median_mode_g5:medianMissing', 'median_mode_g5:modeContext', 'range_g5:range', 'range_g5:rangeTable', 'range_g5:rangeEnd'])
      assert.ok(mmKinds.has(k), `${k} never drawn: ${[...mmKinds]}`);
  });

  it('stem-and-leaf plots', () => {
    for (const item of draws('stem_leaf', 300)) {
      const lines = item.eq.split('\n');
      const xs = lines.flatMap(l => { const [s, rest] = l.split(' | '); return rest!.split(' ').map(leaf => Number(s) * 10 + Number(leaf)); });
      const q = item.promptAr!.split('\n').pop()!;
      const want = has(q, 'أعلى') ? Math.max(...xs) : has(q, 'مدى') ? Math.max(...xs) - Math.min(...xs) : has(q, 'وسيط') ? median(xs) : xs.length;
      assert.equal(Number(item.answer), want, item.promptAr);
    }
  });

  it('reading a table of counts', () => {
    for (const id of ['read_data_g12', 'read_data_g34']) for (const item of draws(id, 300)) {
      const p = item.promptAr!;
      const cats = [...p.matchAll(/(التفاح|الموز|البرتقال|العنب|الكرز): (\d+)/g)].map(m => [m[1]!, Number(m[2])] as const);
      const key = has(p, 'كل صورة تمثل 2') ? 2 : 1;
      const vals = cats.map(([, c]) => c * key);
      const q = p.slice(p.lastIndexOf('. ') + 2);
      if (has(q, 'بكم')) assert.equal(Number(item.answer), Math.max(...vals) - Math.min(...vals));
      else if (has(q, 'الأكثر')) assert.equal(item.answer, cats[vals.indexOf(Math.max(...vals))]![0]);
      else if (has(q, 'الأقل')) assert.equal(item.answer, cats[vals.indexOf(Math.min(...vals))]![0]);
      else assert.equal(Number(item.answer), sum(vals));
      assert.equal(new Set(vals).size, vals.length, 'counts are distinct so the answer is unique');
    }
  });

  it('frequency tables and grouped data', () => {
    const freqKinds = new Set<string>();
    for (const item of draws('freq_table', 300)) {
      const p = item.promptAr!, xs = dataList(p);
      if (has(p, 'حجم')) {
        freqKinds.add('sample');
        const [P, s] = nums(p);
        assert.ok(s! < P!, p);
        assert.equal(Number(item.answer), has(p, 'حجم العينة') ? s : P, p);
      } else if (has(p, 'عدد الكتب: عدد الطلاب')) {
        const rows = [...p.matchAll(/(\d+): (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
        const all = rows.flatMap(([v, f]) => Array<number>(f).fill(v));
        if (has(p, 'الوسط الحسابي')) { freqKinds.add('tableMean'); assert.equal(Number(item.answer), sum(all) / all.length, p); }
        else { freqKinds.add('tableMedian'); assert.equal(Number(item.answer), median(all), p); }
      } else if (has(p, 'ما تكرار القيمة')) { freqKinds.add('frequency'); const v = Number(p.match(/القيمة (\d+)/)![1]); assert.equal(Number(item.answer), xs.filter(x => x === v).length, p); }
      else { freqKinds.add('mode'); const c = new Map<number, number>(); xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1)); const top = [...c.entries()].sort((a, b) => b[1] - a[1]); assert.ok(top[0]![1] > (top[1]?.[1] ?? 0)); assert.equal(Number(item.answer), top[0]![0]); }
    }
    assert.equal(freqKinds.size, 5, `freq_table kinds drawn: ${[...freqKinds]}`);
    const groupedKinds: Record<string, Set<string>> = { grouped_g6: new Set(), grouped_g9: new Set() };
    for (const id of ['grouped_g6', 'grouped_g9']) for (const item of draws(id, 300)) {
      const p = item.promptAr!, kinds = groupedKinds[id]!;
      if (has(p, 'ما مركز الفئة')) {
        kinds.add('midpoint');
        const [a, b] = nums(p);
        assert.equal(Number(item.answer), (a! + b!) / 2, p);
        continue;
      }
      if (!has(p, 'طول كل منها')) {
        const rows = [...p.matchAll(/(\d+)–(\d+): (\d+)/g)].map(m => ({ lo: Number(m[1]), hi: Number(m[2]), f: Number(m[3]) }));
        assert.ok(rows.length >= 4 && rows.every((r, i) => i === 0 || r.lo === rows[i - 1]!.hi + 1), `classes are contiguous: ${p}`);
        const N = sum(rows.map(r => r.f));
        if (has(p, 'كم طالبًا علامته')) {
          kinds.add('atLeast');
          const cut = Number(p.match(/علامته (?:أقل من )?(\d+)/)![1]);
          const want = has(p, 'فأكثر') ? sum(rows.filter(r => r.lo >= cut).map(r => r.f)) : sum(rows.filter(r => r.hi < cut).map(r => r.f));
          assert.equal(Number(item.answer), want, p);
        } else if (has(p, 'ما عدد النباتات الكلي')) { kinds.add('histTotal'); assert.equal(Number(item.answer), N, p); }
        else if (has(p, 'أطول عمود')) {
          kinds.add('histTallest');
          const top = Math.max(...rows.map(r => r.f));
          assert.equal(rows.filter(r => r.f === top).length, 1, `one tallest bar: ${p}`);
          const r = rows.find(r => r.f === top)!;
          assert.equal(item.answer, `${r.lo}–${r.hi}`, p);
        } else {
          kinds.add('groupedMean');
          assert.ok(has(p, 'مراكز الفئات'), p);
          assert.equal(Number(item.answer), sum(rows.map(r => r.f * (r.lo + r.hi) / 2)) / N, p);
        }
        continue;
      }
      const w = Number(p.match(/طول كل منها (\d+)/)![1]);
      const xs = nums(p.slice(p.indexOf(':') + 1, p.indexOf('. ')));
      const cls = (a: number) => xs.filter(x => x >= a && x <= a + w - 1).length;
      if (has(p, 'ما تكرار الفئة')) { kinds.add('classFrequency'); const a = Number(p.match(/الفئة (\d+)–/)![1]); assert.equal(Number(item.answer), cls(a), p); }
      else {
        kinds.add('modalClass');
        const starts = [...new Set(xs.map(x => Math.floor(x / w) * w))];
        const best = starts.sort((a, b) => cls(b) - cls(a));
        assert.ok(cls(best[0]!) > cls(best[1]!), 'modal class is unique');
        assert.equal(item.answer, `${best[0]}–${best[0]! + w - 1}`, p);
      }
    }
    assert.equal(groupedKinds.grouped_g6!.size, 5, `grouped_g6 kinds: ${[...groupedKinds.grouped_g6!]}`);
    assert.equal(groupedKinds.grouped_g9!.size, 7, `grouped_g9 kinds: ${[...groupedKinds.grouped_g9!]}`);
  });

  it('dispersion', () => {
    for (const item of draws('dispersion', 400)) {
      const p = item.promptAr!, xs = dataList(p.split('؟')[0]! + '؟');
      if (has(p, 'المدى الربيعي')) { const s = sorted(xs), h = s.length / 2; assert.equal(Number(item.answer), median(s.slice(h)) - median(s.slice(0, h)), p); }
      else if (has(p, 'الانحراف المعياري')) { const m = sum(xs) / xs.length; assert.equal(Number(item.answer), Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / xs.length), p); }
      else assert.equal(Number(item.answer), Math.max(...xs) - Math.min(...xs), p);
    }
  });

  it('Grade 10: scatter, cumulative frequency, grouped data', () => {
    const num = (s: string) => Number(s.replace('−', '-'));
    /** «y = −2x + 50» → [−2, 50] */
    const line = (p: string) => { const m = p.match(/y = (−?\d+)x \+ (\d+)/)!; return [num(m[1]!), Number(m[2])] as const; };
    const scatterKinds = new Set<string>();
    for (const item of draws('scatter', 300)) {
      const p = item.promptAr!;
      if (has(p, 'المستقيم الأفضل مطابقة لشكل انتشار هي')) {
        const [m, b] = line(p);
        if (has(p, 'لـ y عندما')) { scatterKinds.add('predict-y'); assert.equal(Number(item.answer), m * Number(p.match(/x = (\d+)/)![1]) + b, p); }
        else { scatterKinds.add('predict-x'); assert.equal(Number(item.answer), (Number(p.match(/y = (\d+)؟/)![1]) - b) / m, p); }
        continue;
      }
      const pts = [...p.matchAll(/\((\d+) ، (\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      if (has(p, 'ما ميله')) {
        scatterKinds.add('slope');
        const [[x1, y1], [x2, y2]] = pts as [readonly [number, number], readonly [number, number]];
        assert.equal(num(item.answer), (y2 - y1) / (x2 - x1), p);
        continue;
      }
      scatterKinds.add('correlation');
      const n = pts.length, mx = sum(pts.map(p => p[0])) / n, my = sum(pts.map(p => p[1])) / n;
      const r = sum(pts.map(([x, y]) => (x - mx) * (y - my))) / Math.sqrt(sum(pts.map(([x]) => (x - mx) ** 2)) * sum(pts.map(([, y]) => (y - my) ** 2)));
      assert.equal(item.answer, r > 0.85 ? 'ارتباط طردي (موجب)' : r < -0.85 ? 'ارتباط عكسي (سالب)' : 'لا يوجد ارتباط');
      assert.ok(Math.abs(r) > 0.85 || Math.abs(r) < 0.3, `ambiguous correlation ${r}`);
    }
    assert.equal(scatterKinds.size, 4, `scatter kinds drawn: ${[...scatterKinds]}`);
    const cumKinds = new Set<string>();
    for (const item of draws('cumulative', 300)) {
      const p = item.promptAr!;
      if (has(p, 'المدى الربيعي')) { cumKinds.add('iqr'); const [q1, q3] = nums(p.replace(/Q[13]/g, '')); assert.equal(Number(item.answer), q3! - q1!, p); continue; }
      if (has(p, 'الرتبة المئينية')) {
        cumKinds.add('percentile');
        const [n, score, c, score2] = nums(p);
        assert.equal(score, score2, p);
        assert.equal(item.answer, `${(100 * c!) / n!}%`, p);
        assert.ok(c! <= n!, p);
        continue;
      }
      const rows = [...p.matchAll(/(\d+)–(\d+): (\d+)/g)].slice(0, 8).map(m => [Number(m[1]), Number(m[3])] as const);
      const f = rows.map(r => r[1]), n = sum(f);
      if (has(p, 'ما ترتيب')) { cumKinds.add('quartile'); assert.equal(Number(item.answer), has(p, 'Q3') ? (3 * n) / 4 : n / 4, p); assert.ok(Number.isInteger(Number(item.answer)), p); }
      else if (has(p, 'التكرار التراكمي')) { cumKinds.add('cf'); const end = Number(p.match(/الفئة (\d+)–/)![1]); const upto = rows.findIndex(r => r[0] === end); assert.equal(Number(item.answer), sum(f.slice(0, upto + 1)), p); }
      else { cumKinds.add('median'); let acc = 0, mc = 0; for (let i = 0; i < f.length; i++) { acc += f[i]!; if (acc >= n / 2) { mc = i; break; } } assert.equal(item.answer, `${rows[mc]![0]}–${rows[mc]![0] + (rows[1]![0] - rows[0]![0]) - 1}`, p); }
    }
    assert.equal(cumKinds.size, 5, `cumulative kinds drawn: ${[...cumKinds]}`);
    for (const item of draws('grouped_mean', 300)) {
      const p = item.promptAr!;
      const rows = [...p.matchAll(/(\d+) إلى أقل من (\d+): (\d+)/g)].map(m => ({ lo: Number(m[1]), hi: Number(m[2]), f: Number(m[3]) }));
      assert.ok(rows.length >= 3 && rows.every((r, i) => i === 0 || r.lo === rows[i - 1]!.hi), 'classes are contiguous');
      const n = sum(rows.map(r => r.f)), mids = rows.map(r => (r.lo + r.hi) / 2);
      const mean = sum(rows.map((r, i) => r.f * mids[i]!)) / n;
      const variance = sum(rows.map((r, i) => r.f * (mids[i]! - mean) ** 2)) / n;
      assert.equal(Number(item.answer), has(p, 'الوسط الحسابي') ? mean : variance, p);
    }
  });
});

describe('proportion and percent: answers recomputed', () => {
  it('unit rate and proportion', () => {
    for (const item of draws('unit_rate', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'العرض الأول')) { const [q1, c1, q2, c2] = n; const first = c1! / q1! < c2! / q2!; assert.equal(item.answer, first ? 'العرض الأول' : 'العرض الثاني'); assert.notEqual(c1! / q1!, c2! / q2!); }
      else assert.equal(Number(item.answer), has(p, 'ثمن') ? n[1]! / n[0]! : n[0]! / n[1]!, p);
    }
    const propKinds = new Set<string>();
    for (const item of draws('proportion', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'تناسبًا؟')) { propKinds.add('isProportion'); const [a, b, c, d] = n; assert.equal(item.answer, a! * d! === b! * c! ? 'نعم' : 'لا', p); }
      else if (has(p, 'وصفة')) { propKinds.add('recipe'); const [f, e, F] = n; assert.equal(Number(item.answer), (e! * F!) / f!, p); assert.ok(Number.isInteger(Number(item.answer)), p); }
      else { propKinds.add(has(p, 'x في التناسب') ? 'solve' : 'pens'); assert.equal(n[0]! * Number(item.answer), n[1]! * n[2]!, p); }
    }
    assert.equal(propKinds.size, 4, `proportion kinds drawn: ${[...propKinds]}`);
    const relKinds = new Set<string>();
    for (const item of draws('proportional_relation', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'أجر عامل')) { relKinds.add('pay'); const [pay, h, h2] = n; assert.equal(Number(item.answer), (pay! / h!) * h2!, p); continue; }
      if (has(p, 'نقطة الأصل')) { relKinds.add('graph'); const [x, y] = n; assert.equal(Number(item.answer), y! / x!, p); continue; }
      const pairs = [...p.matchAll(/(\d+) → (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      const k = pairs[0]![1] / pairs[0]![0];
      const proportional = pairs.every(([x, y]) => y === k * x);
      if (has(p, 'تناسبية؟')) { relKinds.add('isProportional'); assert.equal(item.answer, proportional ? 'نعم' : 'لا', p); continue; }
      assert.ok(proportional, p);
      if (has(p, 'ما قيمة y عندما')) { relKinds.add('complete'); assert.equal(Number(item.answer), k * Number(p.match(/x = (\d+)؟/)![1]), p); }
      else if (has(p, 'ما المعادلة')) { relKinds.add('equation'); assert.equal(item.answer, `y = ${k}x`, p); }
      else { relKinds.add('constant'); assert.equal(Number(item.answer), k, p); }
    }
    assert.equal(relKinds.size, 6, `proportional_relation kinds drawn: ${[...relKinds]}`);
  });

  it('variation and proportional division', () => {
    const dirKinds = new Set<string>();
    for (const item of draws('direct_variation', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'هل تمثل المعادلة')) {
        dirKinds.add('isDirect');
        const eq = p.match(/المعادلة (.+) تغيرًا/)![1]!;
        assert.equal(item.answer, /^y = \d+x$/.test(eq) ? 'نعم' : 'لا', p);
        continue;
      }
      const x1 = n[0]!, y1 = n[1]!, k = y1 / x1;
      if (has(p, 'معادلة التغير')) { dirKinds.add('equation'); assert.equal(item.answer, `y = ${k}x`, p); }
      else if (has(p, 'ما قيمة x')) { dirKinds.add('findX'); assert.equal(Number(item.answer), n[2]! / k, p); }
      else if (has(p, 'ثابت')) { dirKinds.add('constant'); assert.equal(Number(item.answer), k, p); }
      else { dirKinds.add('findY'); assert.equal(Number(item.answer), k * n[2]!, p); }
      assert.ok(item.answer.startsWith('y = ') || Number.isInteger(Number(item.answer)), p);
    }
    assert.equal(dirKinds.size, 5, `direct_variation kinds drawn: ${[...dirKinds]}`);
    const invKinds = new Set<string>();
    for (const item of draws('inverse_variation', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'عمال') || has(p, 'عاملًا')) { invKinds.add('workers'); const [w1, d1, w2] = n; assert.equal(Number(item.answer), (w1! * d1!) / w2!, p); assert.ok(Number.isInteger(Number(item.answer)), p); continue; }
      if (has(p, 'الجدول')) {
        invKinds.add('isInverse');
        const pairs = [...p.matchAll(/(\d+) → (\d+)/g)].map(m => Number(m[1]) * Number(m[2]));
        assert.equal(item.answer, new Set(pairs).size === 1 ? 'نعم' : 'لا', p);
        continue;
      }
      const [x1, y1] = n, K = x1! * y1!;
      if (has(p, 'ثابت التغير')) { invKinds.add('constant'); assert.equal(Number(item.answer), K, p); }
      else if (has(p, 'معادلة التغير')) { invKinds.add('equation'); assert.equal(item.answer, `y = ${K}/x`, p); }
      else { invKinds.add('findY'); assert.equal(Number(item.answer), K / n[2]!, p); }
    }
    assert.equal(invKinds.size, 5, `inverse_variation kinds drawn: ${[...invKinds]}`);
    const divKinds = new Set<string>();
    for (const item of draws('proportional_division', 300)) {
      const p = item.promptAr!;
      const ratio = p.match(/بنسبة ([\d : ]+)[.،]/)![1]!.trim().split(' : ').map(Number);
      if (has(p, 'زوايا مثلث')) {
        divKinds.add('triangle');
        const u = 180 / sum(ratio);
        assert.ok(Number.isInteger(u), p);
        assert.equal(item.answer, `${(has(p, 'أكبر') ? Math.max(...ratio) : Math.min(...ratio)) * u}°`, p);
        continue;
      }
      if (has(p, 'نصيب الأول')) {
        divKinds.add('fromShare');
        const share = nums(p.slice(p.indexOf('نصيب الأول')))[0]!;
        assert.equal(Number(item.answer), (share / ratio[0]!) * sum(ratio), p);
        assert.ok(Number.isInteger(share / ratio[0]!), p);
        continue;
      }
      const total = nums(p)[0]!, unit = total / sum(ratio);
      assert.ok(Number.isInteger(unit), p);
      assert.equal(gcd(...(ratio as [number, number])) === 1 || ratio.length === 3, true);
      if (has(p, 'بكم دينارًا يزيد')) { divKinds.add('difference'); assert.equal(Number(item.answer), (Math.max(...ratio) - Math.min(...ratio)) * unit, p); }
      else { divKinds.add('share'); assert.equal(Number(item.answer), (has(p, 'الأكبر') ? Math.max(...ratio) : Math.min(...ratio)) * unit, p); }
    }
    assert.equal(divKinds.size, 4, `proportional_division kinds drawn: ${[...divKinds]}`);
  });

  it('money, scale, similarity, percent', () => {
    for (const item of draws('financial_math', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'الفائدة البسيطة')) { const t = has(p, 'سنة واحدة') ? 1 : has(p, 'سنتين') ? 2 : n[2]!; assert.equal(Number(item.answer), (n[0]! * n[1]! * t) / 100, p); }
      else if (has(p, 'بعد الخصم')) assert.equal(Number(item.answer), n[0]! - (n[0]! * n[1]!) / 100, p);
      else if (has(p, 'نسبة الربح')) assert.equal(Number(item.answer.replace('%', '')), ((n[1]! - n[0]!) / n[0]!) * 100, p);
      else assert.equal(Number(item.answer), n[0]! + (n[0]! * n[1]!) / 100, p);
    }
    const scaleKinds = new Set<string>();
    for (const item of draws('map_scale', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'كم كيلومترًا يمثل')) { scaleKinds.add('findScale'); const [cm, real] = n; assert.equal(Number(item.answer), real! / cm!, p); }
      else if (has(p, 'الطول الحقيقي')) { scaleKinds.add('modelToReal'); const [, s, L] = n; assert.equal(Number(item.answer), (L! * s!) / 100, p); } // cm → m
      else if (has(p, 'ما طول النموذج')) { scaleKinds.add('realToModel'); const [R, , s] = n; assert.equal(Number(item.answer), (R! * 100) / s!, p); } // m → cm
      else { const km = n[1]!, other = n[2]!; scaleKinds.add(has(p, 'ما المسافة الحقيقية') ? 'real' : 'map'); assert.equal(Number(item.answer), has(p, 'ما المسافة الحقيقية') ? km * other : other / km, p); }
      assert.ok(Number.isInteger(Number(item.answer)), p);
    }
    assert.equal(scaleKinds.size, 5, `map_scale kinds drawn: ${[...scaleKinds]}`);
    const simKinds = new Set<string>();
    for (const item of draws('similar_figures', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'يشابه المثلث')) {
        simKinds.add('angles');
        const [A, B] = n;
        assert.equal(item.answer, `${p.endsWith('الزاوية F؟') ? 180 - A! - B! : B}°`, p);
      } else if (has(p, 'ظل')) { simKinds.add('shadow'); const [h, s, S] = n; assert.equal(Number(item.answer), (h! * S!) / s!, p); }
      else if (has(p, 'هل المستطيلان متشابهان')) { simKinds.add('isSimilar'); const [a, b, c, d] = n; assert.equal(item.answer, a! * d! === b! * c! || a! * c! === b! * d! ? 'نعم' : 'لا', p); }
      else if (has(p, 'محيط')) { simKinds.add('perimeter'); const [k, P] = n; assert.equal(Number(item.answer), k! * P!, p); }
      else if (has(p, 'معامل التشابه')) { simKinds.add('factor'); assert.equal(Number(item.answer), n[1]! / n[0]!, p); }
      else { simKinds.add('side'); assert.equal(Number(item.answer), (n[1]! * n[3]!) / n[0]!, p); }
    }
    assert.equal(simKinds.size, 6, `similar_figures kinds drawn: ${[...simKinds]}`);
    for (const item of draws('percent_g8', 400)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما النسبة المئوية التي يمثلها')) assert.equal(Number(item.answer.replace('%', '')), (n[0]! / n[1]!) * 100, p);
      else if (has(p, 'نسبة')) { const [from, to] = n; assert.equal(Number(item.answer.replace('%', '')), (Math.abs(to! - from!) / from!) * 100, p); }
      else if (has(p, 'ما السعر الأصلي') || has(p, 'سعرها الأصلي')) assert.ok(Math.abs(Number(item.answer) - n[1]! / (1 + n[0]! / 100)) < 1e-9, p);
      else if (has(p, 'ما العدد')) assert.equal(Number(item.answer), (n[1]! * 100) / n[0]!, p);
      else assert.equal(Number(item.answer), (n[0]! * n[1]!) / 100, p);
    }
  });
});

describe('data and proportion routing', () => {
  const cases: Array<[string, number, string | null]> = [
    ['أكيد، ممكن، مستحيل', 3, 'certainty_g3'], ['التجربة العشوائية وأنواع الحوادث', 4, 'certainty_g4'], ['فرص الحدوث', 5, 'likelihood'],
    ['الاحتمالات', 6, 'prob_g6'], ['الاحتمالات', 7, 'prob_g7'], ['الاحتمال التجريبي', 7, 'experimental'], ['عد النواتج', 8, 'counting'],
    ['احتمال الحوادث المركبة', 8, 'compound_prob'], ['الاحتمال الهندسي', 9, 'geometric_prob'], ['الاحتمالات وأشكال ڤن', 9, 'venn_g9'],
    ['أشكال ڤن', 3, 'venn_g3'], ['تمثيل البيانات بأشكال ڤن', 4, 'venn_g4'],
    ['الوسط الحسابي', 5, 'mean_g5'], ['الوسط الحسابي', 7, 'mean_g7'], ['الوسيط والمنوال', 5, 'median_mode_g5'], ['المدى', 5, 'range_g5'],
    ['الوسيط، والمنوال، والمدى', 7, 'median_mode_range_g7'], ['التمثيل بالساق والورقة', 7, 'stem_leaf'],
    ['تمثيل البيانات بالصور', 2, 'read_data_g12'], ['تمثيل البيانات بالأعمدة', 3, 'read_data_g34'], ['الجداول التكرارية', 6, 'freq_table'],
    ['الجداول والمخططات التكرارية ذات الفئات', 6, 'grouped_g6'], ['المدرجات التكرارية', 9, 'grouped_g9'], ['مقاييس التشتت', 9, 'dispersion'],
    ['أشكال الانتشار', 10, 'scatter'], ['المنحنى التكراري التراكمي', 10, 'cumulative'], ['مقاييس التشتت للجداول التكرارية ذات الفئات', 10, 'grouped_mean'],
    ['معدل الوحدة', 7, 'unit_rate'], ['التناسب', 7, 'proportion'], ['العلاقات التناسبية', 7, 'proportional_relation'], ['التغير الطردي', 7, 'direct_variation'],
    ['التغير العكسي', 7, 'inverse_variation'], ['التقسيم التناسبي', 7, 'proportional_division'], ['تطبيقات مالية', 7, 'financial_math'], ['مقياس الرسم', 7, 'map_scale'],
    ['التشابه', 7, 'similar_figures'], ['النسبة المئوية', 8, 'percent_g8'],
    ['اختيار التمثيل الأنسب', 8, null], ['تفسير التمثيلات البيانية', 9, null], ['الربيعيات', 8, null],
  ];
  for (const [title, grade, id] of cases) {
    it(`${title} (G${grade}) → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, grade)?.id ?? null, id);
      if (id) assert.ok(mathBankCovers(title, null, grade));
    });
  }
});
