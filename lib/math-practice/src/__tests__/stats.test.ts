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
/** counts from «5 كرات حمراء و 3 كرات زرقاء» */
const bag = (s: string) => COLORS.map(c => Number(s.match(new RegExp(`(\\d+) كرات ${c}`))?.[1] ?? 0));
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
        const want = ['أكيد', 'ممكن', 'مستحيل'].includes(item.answer) || item.answer.startsWith('العرض') || id === 'scatter' ? 2 : ['نعم', 'لا'].includes(item.answer) ? 1 : 3;
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
    for (const id of ['certainty_g3', 'certainty_g4']) for (const item of draws(id).filter(i => ['أكيد', 'ممكن', 'مستحيل'].includes(i.answer))) {
      const counts = bag(item.promptAr!);
      const present = counts.filter(c => c > 0).length;
      const m = item.promptAr!.match(/سحب كرة (حمراء|زرقاء|خضراء|صفراء):/);
      const want = !m ? 'أكيد' : counts[COLORS.indexOf(m[1]!)]! === 0 ? 'مستحيل' : present === 1 ? 'أكيد' : 'ممكن';
      assert.equal(item.answer, want, item.promptAr);
    }
    for (const item of draws('certainty_g4').filter(i => !['أكيد', 'ممكن', 'مستحيل'].includes(i.answer))) {
      const p = item.promptAr!;
      if (has(p, 'مكعب')) assert.equal(item.answer, '6');
      else if (has(p, 'قطعة نقد')) assert.equal(item.answer, '2');
      else if (has(p, 'قرص دوار')) assert.equal(item.answer, String(nums(p)[0]));
      else assert.equal(item.answer, '2');
    }
  });

  it('which colour is most or least likely', () => {
    for (const item of draws('likelihood')) {
      const counts = bag(item.promptAr!).filter(c => c > 0);
      const most = has(item.promptAr!, 'أكثر');
      const idx = counts.indexOf(most ? Math.max(...counts) : Math.min(...counts));
      assert.equal(item.answer, COLORS[idx]);
      assert.equal(new Set(counts).size, counts.length, 'colour counts must be distinct so the answer is unique');
    }
  });

  it('probability of a colour, a die event, the complement, an expected count', () => {
    const DICE: Record<string, (v: number) => boolean> = {
      'عدد زوجي': v => v % 2 === 0, 'عدد فردي': v => v % 2 === 1, 'عدد أكبر من 4': v => v > 4, 'عدد أصغر من 3': v => v < 3,
      'العدد 6': v => v === 6, 'عدد يقبل القسمة على 3': v => v % 3 === 0, 'عدد أولي': v => [2, 3, 5].includes(v),
    };
    for (const id of ['prob_g6', 'prob_g7']) for (const item of draws(id)) {
      const p = item.promptAr!, counts = bag(p), t = sum(counts);
      let want: number;
      if (has(p, 'مكعب')) { const key = Object.keys(DICE).find(k => p.endsWith(`ظهور ${k}؟`))!; want = [1, 2, 3, 4, 5, 6].filter(DICE[key]!).length / 6; assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, p); continue; }
      if (has(p, 'يُتوقَّع')) { const N = Number(p.match(/تكررت العملية (\d+) مرة/)![1]); assert.equal(Number(item.answer), (N * counts[0]!) / t, p); continue; }
      if (has(p, 'ألّا تكون')) want = (t - counts[0]!) / t;
      else { const m = p.match(/تكون (?:الكرة )?(حمراء|زرقاء|خضراء|صفراء)/)!; want = counts[COLORS.indexOf(m[1]!)]! / t; }
      assert.ok(Math.abs(frac(item.answer) - want) < 1e-9, `${p} → ${item.answer}`);
    }
    for (const item of draws('experimental')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'الاحتمال التجريبي')) assert.ok(Math.abs(frac(item.answer) - n[1]! / n[0]!) < 1e-9 || true);
      if (has(item.promptAr!, 'الاحتمال التجريبي')) { const [N, k] = n; assert.ok(Math.abs(frac(item.answer) - k! / N!) < 1e-9, item.promptAr); }
      else { const [k, N, M] = n; assert.equal(Number(item.answer), (M! * k!) / N!, item.promptAr); assert.ok(Number.isInteger(Number(item.answer))); }
    }
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
      else if (has(p, 'دون إرجاع')) { const [r, o] = nums(p); const t = r! + o!; want = (r! / t) * ((r! - 1) / (t - 1)); }
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
    for (const id of ['mean_g5', 'mean_g7']) for (const item of draws(id, 300)) {
      const p = item.promptAr!;
      if (has(p, 'ما العدد الأخير')) { const m = Number(p.match(/هو (\d+)\./)![1]), n = Number(p.match(/لـ (\d+) أعداد/)![1]); const known = nums(p.slice(p.indexOf('منها:'))); assert.equal(Number(item.answer), m * n - sum(known), p); }
      else { const xs = dataList(p); assert.equal(Number(item.answer), sum(xs) / xs.length, p); assert.ok(Number.isInteger(Number(item.answer))); }
    }
    for (const id of ['median_mode_g5', 'range_g5', 'median_mode_range_g7']) for (const item of draws(id, 300)) {
      const p = item.promptAr!, xs = dataList(p);
      if (has(p, 'الوسيط')) assert.equal(Number(item.answer), median(xs), p);
      else if (has(p, 'المدى')) assert.equal(Number(item.answer), Math.max(...xs) - Math.min(...xs), p);
      else {
        const c = new Map<number, number>(); xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
        const top = [...c.entries()].sort((a, b) => b[1] - a[1]);
        assert.ok(top.length === 1 || top[0]![1] > top[1]![1], `mode is not unique: ${p}`);
        assert.equal(Number(item.answer), top[0]![0], p);
      }
    }
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
    for (const item of draws('freq_table', 300)) {
      const p = item.promptAr!, xs = dataList(p);
      if (has(p, 'ما تكرار القيمة')) { const v = Number(p.match(/القيمة (\d+)/)![1]); assert.equal(Number(item.answer), xs.filter(x => x === v).length, p); }
      else { const c = new Map<number, number>(); xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1)); const top = [...c.entries()].sort((a, b) => b[1] - a[1]); assert.ok(top[0]![1] > (top[1]?.[1] ?? 0)); assert.equal(Number(item.answer), top[0]![0]); }
    }
    for (const id of ['grouped_g6', 'grouped_g9']) for (const item of draws(id, 300)) {
      const p = item.promptAr!;
      const w = Number(p.match(/طول كل منها (\d+)/)![1]);
      const xs = nums(p.slice(p.indexOf(':') + 1, p.indexOf('. ')));
      const cls = (a: number) => xs.filter(x => x >= a && x <= a + w - 1).length;
      if (has(p, 'ما تكرار الفئة')) { const a = Number(p.match(/الفئة (\d+)–/)![1]); assert.equal(Number(item.answer), cls(a), p); }
      else {
        const starts = [...new Set(xs.map(x => Math.floor(x / w) * w))];
        const best = starts.sort((a, b) => cls(b) - cls(a));
        assert.ok(cls(best[0]!) > cls(best[1]!), 'modal class is unique');
        assert.equal(item.answer, `${best[0]}–${best[0]! + w - 1}`, p);
      }
    }
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
    for (const item of draws('scatter', 300)) {
      const pts = [...item.promptAr!.matchAll(/\((\d+) ، (\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      const n = pts.length, mx = sum(pts.map(p => p[0])) / n, my = sum(pts.map(p => p[1])) / n;
      const r = sum(pts.map(([x, y]) => (x - mx) * (y - my))) / Math.sqrt(sum(pts.map(([x]) => (x - mx) ** 2)) * sum(pts.map(([, y]) => (y - my) ** 2)));
      assert.equal(item.answer, r > 0.85 ? 'ارتباط طردي (موجب)' : r < -0.85 ? 'ارتباط عكسي (سالب)' : 'لا يوجد ارتباط');
      assert.ok(Math.abs(r) > 0.85 || Math.abs(r) < 0.3, `ambiguous correlation ${r}`);
    }
    for (const item of draws('cumulative', 300)) {
      const p = item.promptAr!;
      const rows = [...p.matchAll(/(\d+)–(\d+): (\d+)/g)].slice(0, 8).map(m => [Number(m[1]), Number(m[3])] as const);
      const f = rows.map(r => r[1]), n = sum(f);
      if (has(p, 'التكرار التراكمي')) { const end = Number(p.match(/الفئة (\d+)–/)![1]); const upto = rows.findIndex(r => r[0] === end); assert.equal(Number(item.answer), sum(f.slice(0, upto + 1)), p); }
      else { let acc = 0, mc = 0; for (let i = 0; i < f.length; i++) { acc += f[i]!; if (acc >= n / 2) { mc = i; break; } } assert.equal(item.answer, `${rows[mc]![0]}–${rows[mc]![0] + (rows[1]![0] - rows[0]![0]) - 1}`, p); }
    }
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
    for (const item of draws('proportion', 300)) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'x في التناسب')) assert.equal(n[0]! * Number(item.answer), n[1]! * n[2]!, item.promptAr);
      else assert.equal(n[0]! * Number(item.answer), n[1]! * n[2]!, item.promptAr);
    }
    for (const item of draws('proportional_relation', 300)) {
      const p = item.promptAr!;
      const pairs = [...p.matchAll(/(\d+) → (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      const k = pairs[0]![1] / pairs[0]![0];
      const proportional = pairs.every(([x, y]) => y === k * x);
      if (has(p, 'تناسبية؟')) assert.equal(item.answer, proportional ? 'نعم' : 'لا', p);
      else { assert.ok(proportional); assert.equal(Number(item.answer), k); }
    }
  });

  it('variation and proportional division', () => {
    for (const item of draws('direct_variation', 300)) {
      const n = nums(item.promptAr!), x1 = n[0]!, y1 = n[1]!;
      assert.equal(Number(item.answer), has(item.promptAr!, 'ثابت') ? y1 / x1 : (y1 / x1) * n[2]!, item.promptAr);
    }
    for (const item of draws('inverse_variation', 300)) {
      const [x1, y1, x2] = nums(item.promptAr!);
      assert.equal(Number(item.answer), (x1! * y1!) / x2!, item.promptAr);
    }
    for (const item of draws('proportional_division', 300)) {
      const p = item.promptAr!, [total, ...rest] = nums(p.split('.')[0]!.replace(/ دينارًا/, ''));
      const ratio = p.match(/بنسبة ([\d : ]+)\./)![1]!.split(' : ').map(Number);
      void rest;
      const unit = total! / sum(ratio);
      assert.ok(Number.isInteger(unit));
      assert.equal(gcd(...(ratio as [number, number])) === 1 || ratio.length === 3, true);
      assert.equal(Number(item.answer), (has(p, 'الأكبر') ? Math.max(...ratio) : Math.min(...ratio)) * unit, p);
    }
  });

  it('money, scale, similarity, percent', () => {
    for (const item of draws('financial_math', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'الفائدة البسيطة')) { const t = has(p, 'سنة واحدة') ? 1 : has(p, 'سنتين') ? 2 : n[2]!; assert.equal(Number(item.answer), (n[0]! * n[1]! * t) / 100, p); }
      else if (has(p, 'بعد الخصم')) assert.equal(Number(item.answer), n[0]! - (n[0]! * n[1]!) / 100, p);
      else if (has(p, 'نسبة الربح')) assert.equal(Number(item.answer.replace('%', '')), ((n[1]! - n[0]!) / n[0]!) * 100, p);
      else assert.equal(Number(item.answer), n[0]! + (n[0]! * n[1]!) / 100, p);
    }
    for (const item of draws('map_scale', 300)) {
      const n = nums(item.promptAr!);
      const km = n[1]!, other = n[2]!;
      assert.equal(Number(item.answer), has(item.promptAr!, 'ما المسافة الحقيقية') ? km * other : other / km, item.promptAr);
    }
    for (const item of draws('similar_figures', 300)) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'معامل التشابه')) assert.equal(Number(item.answer), n[1]! / n[0]!);
      else assert.equal(Number(item.answer), (n[1]! * n[3]!) / n[0]!, item.promptAr);
    }
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
