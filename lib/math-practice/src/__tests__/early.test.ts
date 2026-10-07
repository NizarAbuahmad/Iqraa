/**
 * Grades 1–4 early number sense, shapes, money, time and measurement
 * (`../early.ts`). Each answer is recomputed from the numbers and words in the
 * Arabic stem with separately written code; option sets are checked for shape.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { EARLY_TOPICS } from '../early.ts';
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
const IDS = EARLY_TOPICS.map(t => t.id);
function draws(id: string, n = 240, grade?: number): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) =>
    makeTopicItem(t, grade ?? t.grades[0] + (i % (t.grades[1] - t.grades[0] + 1)), TIERS[i % 3]!, new Set(), seeded(i * 6700417 + 3)));
}
const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);
const frac = (s: string) => { const [a, b] = s.split('/').map(Number); return b === undefined ? a! : a! / b; };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

describe('early generators: shape', () => {
  it('there are many', () => assert.ok(IDS.length >= 100, String(IDS.length)));
  for (const id of IDS) {
    it(`${id}: three distinct wrong options, clean text, both languages`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{3,}/.test(s), `unrounded number: ${s}`);
        }
        for (const s of [item.answer, ...item.wrongs]) if (/^\d+$/.test(s)) assert.ok(Number(s) >= 0, where);
        if (/^\d+\/\d+$/.test(item.answer)) for (const w of item.wrongs) if (/^\d+\/\d+$/.test(w)) assert.ok(Math.abs(frac(w) - frac(item.answer)) > 1e-9, `wrong fraction ${w}: ${where}`);
      }
    });
  }
});

describe('counting and place value: answers recomputed', () => {
  it('counting ranges, zero, ordinals', () => {
    const R: Record<string, [number, number]> = { count_123: [1, 3], count_45: [4, 5], count_678: [6, 8], count_910: [9, 10] };
    for (const [id, [lo, hi]] of Object.entries(R)) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'بعد')) assert.equal(a, n[0]! + 1);
      else if (has(p, 'قبل')) assert.equal(a, n[0]! - 1);
      else { assert.equal(n[1], n[0]! + 2); assert.equal(a, n[0]! + 1); }
      assert.ok(a >= lo && a <= hi && n.every(v => v >= lo && v <= hi), `${p} leaves ${lo}–${hi}`);
    }
    for (const item of draws('count_zero')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما العدد الذي يدل')) assert.equal(item.answer, '0');
      else if (has(p, ' − ') && n[0] === n[1]) assert.equal(item.answer, '0');
      else assert.equal(Number(item.answer), n[0]);
    }
    for (const item of draws('ordinal')) {
      const p = item.promptAr!;
      const idx = ORD.findIndex(o => p.includes(`«${o}»`) || p.includes(`المكان ${o}`));
      if (has(p, 'كم طفلًا')) assert.equal(Number(item.answer), idx);
      else if (has(p, 'أي رقم')) assert.equal(Number(item.answer), idx + 1);
      else assert.equal(item.answer, ORD[idx + 1]);
    }
  });

  it('tens and ones, hundreds, expanded form, thousands', () => {
    for (const id of ['tens_ones_a', 'tens_ones_b', 'tens_ones_c']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كم عشرة')) assert.equal(a, Math.floor(n[0]! / 10));
      else if (has(p, 'كم آحادًا')) assert.equal(a, n[0]! % 10);
      else if (has(p, 'عشرات و')) assert.equal(a, n[0]! * 10 + n[1]!);
      else assert.equal(a, n[0]! * 10);
    }
    for (const id of ['hundreds_a', 'hundreds_b']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'مئات و')) assert.equal(a, n[0]! * 100 + n[1]! * 10 + n[2]!);
      else if (has(p, 'رقم العشرات')) assert.equal(a, Math.floor(n[0]! / 10) % 10);
      else assert.equal(a, Math.floor(n[0]! / 100));
    }
    for (const item of draws('expanded_form')) assert.equal(Number(item.answer), nums(item.promptAr!).reduce((x, y) => x + y, 0), item.promptAr);
    for (const item of draws('thousands')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'ما رقم الألوف')) assert.equal(a, Math.floor(n[0]! / 1000));
      else if (has(p, 'آلاف و')) assert.equal(a, n[0]! * 1000 + n[1]! * 100 + n[2]! * 10 + n[3]!);
      else { const [d, big] = n; const pos = String(big).indexOf(String(d)); void pos; assert.ok(String(big).includes(String(d))); const place = has(p, 'الألوف') ? 1000 : has(p, 'المئات') ? 100 : 10; assert.equal(a, d! * place); assert.equal(Math.floor(big! / place) % 10, d); }
    }
  });

  it('even and odd, number chart, counting up and down, skip counting', () => {
    for (const id of ['even_odd_g1', 'even_odd_g2']) for (const item of draws(id)) {
      const p = item.promptAr!, list = nums(p.slice(p.indexOf(':')));
      const wantEven = has(p, 'زوجي');
      assert.equal(list.filter(v => (v % 2 === 0) === wantEven).length, 1, p);
      assert.equal(Number(item.answer) % 2 === 0, wantEven);
      assert.ok(list.includes(Number(item.answer)));
    }
    for (const item of draws('number_chart')) {
      const p = item.promptAr!, n = nums(p.slice(p.indexOf('؟') - 20))[0] ?? 0;
      const x = Number(p.match(/العدد (\d+) مباشرة/)![1]), a = Number(item.answer);
      void n;
      if (has(p, 'تحت')) assert.equal(a, x + 10);
      else if (has(p, 'فوق')) assert.equal(a, x - 10);
      else if (has(p, 'يمين')) { assert.equal(a, x + 1); assert.notEqual(x % 10, 0); }
      else { assert.equal(a, x - 1); assert.notEqual(x % 10, 1); }
    }
    for (const item of draws('count_up_down')) {
      const s = nums(item.promptAr!), up = has(item.promptAr!, 'تصاعديًا');
      assert.equal(Number(item.answer), s[2]! + (up ? 1 : -1));
      assert.ok(s[1]! - s[0]! === (up ? 1 : -1) && s[2]! - s[1]! === (up ? 1 : -1));
    }
    for (const id of ['skip_g1', 'skip_g2', 'skip_g3']) for (const item of draws(id)) {
      const shown = item.promptAr!.slice(item.promptAr!.indexOf(':') + 1).split('،').map(s => s.trim());
      const hole = shown.indexOf('___'), v = shown.map(Number);
      const step = v[1]! - v[0]!;
      assert.ok(step > 0 && v[2]! - v[1]! === step, item.promptAr);
      assert.equal(Number(item.answer), v[0]! + hole * step, item.promptAr);
    }
    for (const id of ['before_after_g1', 'before_after_g2']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'السابق')) assert.equal(a, n[0]! - 1); else if (has(p, 'التالي')) assert.equal(a, n[0]! + 1); else { assert.equal(n[1], n[0]! + 2); assert.equal(a, n[0]! + 1); }
    }
    for (const item of draws('nearest_ten_g1')) {
      const n = Number(item.eq), a = Number(item.answer);
      assert.ok(a % 10 === 0 && Math.abs(n - a) < 5, `${n} → ${a}`);
    }
  });
});

describe('early arithmetic: answers recomputed', () => {
  it('number line, doubles, make ten, properties, related facts, missing numbers, mental maths', () => {
    for (const item of draws('line_add')) { const [a, b] = nums(item.promptAr!); assert.equal(Number(item.answer), a! + b!); assert.ok(a! + b! <= 20); }
    for (const item of draws('line_sub')) { const [a, b] = nums(item.promptAr!); assert.equal(Number(item.answer), a! - b!); assert.ok(a! - b! >= 0); }
    for (const item of draws('double_a')) assert.equal(Number(item.answer), 2 * nums(item.promptAr!)[0]!);
    for (const item of draws('double_b')) assert.equal(Number(item.answer), 2 * nums(item.promptAr!)[0]! + 1);
    for (const item of draws('doubling_g3')) {
      const p = item.promptAr!, n = nums(p)[0]!, a = Number(item.answer);
      if (has(p, 'ضعف ضعف')) assert.equal(a, 4 * n); else if (has(p, 'ما العدد الذي ضعفه')) assert.equal(a * 2, n); else assert.equal(a, 2 * n);
    }
    for (const item of draws('make_ten', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أي جمع')) { const sum = (s: string) => s.split(' + ').map(Number).reduce((x, y) => x + y, 0); assert.equal(sum(item.answer), 10); item.wrongs.forEach(w => assert.notEqual(sum(w), 10, `${w} also makes 10`)); }
      else { const a = nums(p.replace('10', ''))[0]!; assert.equal(Number(item.answer), 10 - a); }
    }
    for (const id of ['add_props_g1', 'add_props_g2']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, '= ___ +')) assert.equal(a, n[1]); else if (has(p, '+ 0')) assert.equal(a, n[0]); else assert.equal(a, n[2]);
    }
    for (const id of ['related_g1', 'related_g3']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer), mul = id === 'related_g3';
      if (has(p, 'فإن') && has(p, mul ? '× ' : '+ ') && p.indexOf(mul ? '×' : '+') < p.indexOf('فإن')) { assert.equal((mul ? n[0]! * n[1]! : n[0]! + n[1]!), n[2]); assert.equal(a, n[1]); }
      else { assert.equal(a, mul ? n[1]! * n[2]! : n[1]! + n[2]!); }
    }
    for (const item of draws('missing_number')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (/^\d+ \+ ___/.test(p)) assert.equal(n[0]! + a, n[1]); else if (/^___ \+/.test(p)) assert.equal(a + n[0]!, n[1]); else if (/^\d+ − ___/.test(p)) assert.equal(n[0]! - a, n[1]); else assert.equal(a - n[0]!, n[1]);
    }
    for (const id of ['mental_add', 'mental_sub']) for (const item of draws(id)) {
      const n = nums(item.promptAr!), a = Number(item.answer), add = id === 'mental_add';
      assert.equal(a, add ? n[0]! + n[1]! : n[0]! - n[1]!);
      assert.ok(a > 0 && a <= 99);
    }
    for (const id of ['mental_mult_add_g2', 'mental_mult_sub_g2', 'mental_mult_add_g3', 'mental_mult_sub_g3']) for (const item of draws(id)) {
      const [x, y] = nums(item.promptAr!), a = Number(item.answer), add = id.includes('add');
      assert.equal(a, add ? x! + y! : x! - y!); assert.ok(a > 0);
      if (id.endsWith('g2')) assert.ok(x! <= 900 && y! <= 900, 'Grade 2 stays within hundreds');
    }
  });

  it('equal groups, division relation, multiplication and division facts', () => {
    for (const id of ['equal_groups_a', 'equal_groups_b']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كم قلمًا')) assert.equal(a, n[0]! * n[1]!); else if (has(p, 'كم قطعة')) assert.equal(a * n[1]!, n[0]); else assert.equal(a * n[1]!, n[0]);
    }
    for (const item of draws('division_relation')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'فإن')) { assert.equal(n[0]! * n[1]!, n[2]); assert.equal(a, n[1]); } else assert.equal(a * n[1]!, n[0]);
    }
    for (const item of draws('mul_properties', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, '× 1')) assert.equal(a, n[0]); else if (has(p, '× 0')) assert.equal(a, 0);
      else if (has(p, ') × ')) assert.equal(a, n[2]);
      else if (has(p, ' × (')) assert.equal(a, n[2]);
      else assert.equal(a, n[1]);
    }
    for (const item of draws('div_properties')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      assert.equal(a, has(p, '÷ 1') ? n[0]! : has(p, 'ما ناتج 0') ? 0 : 1);
    }
    for (const item of draws('remainder', 300)) {
      const [n, d] = nums(item.promptAr!), a = Number(item.answer);
      assert.equal(a, has(item.promptAr!, 'ما الباقي') ? n! % d! : Math.floor(n! / d!));
      assert.notEqual(n! % d!, 0);
    }
    for (const id of ['div_no_rem', 'div_rem_2', 'div_rem_1']) for (const item of draws(id, 300)) {
      const p = item.promptAr!, [n, d] = nums(p), a = Number(item.answer);
      if (has(p, 'ما الباقي')) assert.equal(a, n! % d!); else assert.equal(a, Math.floor(n! / d!));
      assert.equal(n! % d! === 0, id === 'div_no_rem');
      assert.equal(Math.floor(n! / d!) >= 10, id !== 'div_rem_1', `${p}: quotient digits`);
    }
    for (const item of draws('tens_mul_g3')) { const [a, b] = nums(item.promptAr!); assert.equal(Number(item.answer), a! * b!); assert.ok(a! % 10 === 0 || b! % 10 === 0); }
    for (const item of draws('tens_div_g3')) { const [n, d] = nums(item.promptAr!); assert.equal(Number(item.answer) * d!, n); }
    for (const item of draws('mul_distribute')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'أكمل')) { assert.equal(n[0]! * n[1]!, n[0]! * n[3]! + n[0]! * a); } else assert.equal(a, n[0]! * n[1]!);
    }
    for (const id of ['mul_no_regroup', 'mul_regroup']) for (const item of draws(id, 300)) {
      const [n, k] = nums(item.promptAr!), a = Number(item.answer);
      assert.equal(a, n! * k!);
      const carryOnes = (n! % 10) * k! >= 10, carryTens = Math.floor(n! / 10) * k! >= 10;
      if (id === 'mul_no_regroup') assert.ok(!carryOnes && !carryTens, item.promptAr); else assert.ok(carryOnes, item.promptAr);
    }
    for (const item of draws('two_way_table')) {
      const [bt, bj, gt, gj] = nums(item.promptAr!.split('.')[0]!), p = item.promptAr!, a = Number(item.answer);
      assert.equal(a, has(p, 'كم ولدًا') ? bt! + bj! : has(p, 'كم بنتًا') ? gt! + gj! : has(p, 'يحبون العصير؟') ? bj! + gj! : bt! + bj! + gt! + gj!);
    }
  });
});

describe('shapes, fractions, patterns: answers recomputed', () => {
  it('solids, plane shapes, patterns', () => {
    const SOLID: Record<string, string> = { 'كرة القدم': 'كرة', 'حجر النرد': 'مكعب', 'علبة المعلبات': 'أسطوانة', 'قبعة الحفلات المدببة': 'مخروط', 'علبة الأحذية': 'متوازي مستطيلات' };
    for (const item of draws('solid_names')) assert.equal(item.answer, SOLID[item.eq]);
    const SIDES: Record<string, number> = { 'المثلث': 3, 'المربع': 4, 'المستطيل': 4, 'الخماسي المنتظم': 5, 'السداسي المنتظم': 6 };
    for (const id of ['plane_shapes', 'plane_sides_g1', 'plane_sides_g2']) for (const item of draws(id)) {
      if (SIDES[item.eq] !== undefined) assert.equal(Number(item.answer), SIDES[item.eq]);
      else { const c = Number(item.eq); assert.equal(SIDES[item.answer], c); assert.notEqual(c, 4, 'a count of 4 is ambiguous'); item.wrongs.forEach(w => assert.notEqual(SIDES[w], c, `${w} also has ${c}`)); }
    }
    for (const item of draws('solid_parts')) {
      const T: Record<string, [number, number, number]> = { 'المكعب': [6, 12, 8], 'متوازي المستطيلات': [6, 12, 8], 'المنشور الثلاثي': [5, 9, 6], 'الهرم الرباعي': [5, 8, 5], 'الهرم الثلاثي': [4, 6, 4] };
      const [f, e, v] = T[item.eq]!;
      assert.equal(f - e + v, 2, 'Euler');
      assert.equal(Number(item.answer), has(item.promptAr!, 'وجهًا') ? f : has(item.promptAr!, 'حرفًا') ? e : v);
    }
    for (const item of draws('geo_pattern', 300)) {
      const p = item.promptAr!;
      if (has(p, 'الأعواد')) { const [t1, t2, t3, n] = [...p.matchAll(/(?:فيه|والشكل \d فيه) (\d+)/g)].map(m => Number(m[1])).concat(nums(p.slice(p.indexOf('الشكل', p.indexOf('الشكل 3') + 3))).slice(-1)); const d = t2! - t1!; assert.equal(t3! - t2!, d); assert.equal(Number(item.answer), t1! + (n! - 1) * d); continue; }
      const seq = item.eq.split(' '), N: Record<string, string> = { '◯': 'دائرة', '△': 'مثلث', '□': 'مربع', '◇': 'معين' };
      let len = 1; while (!seq.every((s, i) => s === seq[i % len])) len++;
      assert.equal(item.answer, N[seq[seq.length % len]!], p);
    }
  });

  it('half, quarter, parts, fractions of a set, unit fractions, fractions of a whole', () => {
    for (const id of ['half', 'quarter']) for (const item of draws(id)) {
      const n = nums(item.promptAr!)[0]!, d = id === 'half' ? 2 : 4;
      if (has(item.promptAr!, 'كم')) assert.equal(Number(item.answer), d); else { assert.equal(Number(item.answer) * d, n); }
    }
    const NAMES: Record<number, string> = { 2: 'نصف', 3: 'ثلث', 4: 'ربع' };
    for (const item of draws('equal_parts')) assert.equal(item.answer, NAMES[nums(item.promptAr!)[0]!]);
    for (const item of draws('fraction_of_set_g1')) { const n = nums(item.promptAr!)[0]!, d = has(item.promptAr!, 'نصف') ? 2 : has(item.promptAr!, 'ثلث') ? 3 : 4; assert.equal(Number(item.answer) * d, n); }
    for (const item of draws('fraction_of_set_g3', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (/^ما \d+\/\d+ من/.test(p)) { assert.equal(Number(item.answer), (n[0]! * n[2]!) / n[1]!); assert.ok(Number.isInteger(Number(item.answer))); }
      else { assert.equal(item.answer, `${n[1]}/${n[0]}`); assert.equal(gcd(n[0]!, n[1]!), 1); }
    }
    for (const item of draws('unit_fraction')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'أكبر')) assert.equal(item.answer, `1/${Math.min(n[1]!, n[3]!)}`); else assert.equal(item.answer, `1/${n[0]}`);
    }
    for (const item of draws('unit_fraction_set')) { const [d, n] = nums(item.promptAr!).slice(1); assert.equal(Number(item.answer) * d!, n); }
    for (const id of ['fraction_of_whole', 'fraction_number_line']) for (const item of draws(id)) {
      const n = nums(item.promptAr!), [d, k] = id === 'fraction_of_whole' ? [n[0]!, n[1]!] : [n[2]!, n[3]!];
      assert.equal(item.answer, `${k}/${d}`); assert.equal(gcd(k, d), 1);
    }
    for (const item of draws('fraction_equals_one')) {
      assert.equal(frac(item.answer), 1);
      item.wrongs.forEach(w => assert.notEqual(frac(w), 1, `${w} equals 1`));
    }
    for (const item of draws('number_line_g2')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'منتصف')) assert.equal(a, (n[0]! + n[1]!) / 2); else assert.equal(a, n[0]! + n[1]! * n[2]!, p);
    }
  });

  it('angles, lines, patterns and tables', () => {
    const PT: Record<string, number> = { 'القطعة المستقيمة': 2, 'الشعاع': 1, 'المستقيم': 0 };
    for (const item of draws('point_line_ray')) assert.equal(Number(item.answer), PT[item.eq]);
    for (const item of draws('angle_kind_g3')) { const a = Number(item.eq.replace('°', '')); assert.equal(item.answer, a < 90 ? 'حادة' : a === 90 ? 'قائمة' : 'منفرجة'); }
    const REL: Array<[string, string]> = [['لا يلتقيان', 'متوازيان'], ['زاوية التقاطع بينهما قائمة', 'متعامدان'], ['ليست قائمة', 'متقاطعان']];
    for (const id of ['lines_g3', 'lines_g4']) for (const item of draws(id)) assert.equal(item.answer, REL.find(([k]) => item.promptAr!.includes(k))![1]);
    for (const item of draws('angle_measure', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer.replace('°', ''));
      if (has(p, 'متجاورتان')) assert.equal(a, n[0]! + n[1]!); else if (has(p, 'على مستقيم')) assert.equal(a, 180 - n[0]!); else if (has(p, 'تتمم')) assert.equal(a, 90 - n[0]!); else assert.equal(a, n[0]! - n[1]!);
      assert.ok(a > 0);
    }
    for (const item of draws('number_patterns_g4', 300)) {
      const p = item.promptAr!, s = nums(p.slice(p.indexOf(':'))).slice(0, 4);
      const d = s[1]! - s[0]!, up = d > 0, rule = `${up ? '+' : '−'}${Math.abs(d)}`;
      const seqDiffs = [s[1]! - s[0]!, s[2]! - s[1]!, s[3]! - s[2]!];
      assert.ok(seqDiffs.every(x => x === d) || (!up && seqDiffs.every(x => x === seqDiffs[0])), p);
      if (has(p, 'قاعدة')) assert.equal(item.answer, rule); else assert.equal(Number(item.answer), s[3]! + (seqDiffs[0] ?? 0));
      assert.ok(s.every(v => v > 0) && Number(item.answer.replace(/[^\d]/g, '') || 1) > 0);
    }
    for (const item of draws('input_output', 300)) {
      const p = item.promptAr!, n = nums(p);
      const pairs = [...p.matchAll(/المدخل (\d+) ← المخرج (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      const mulC = pairs.every(([x, y]) => y % x === 0 && y / x === pairs[0]![1] / pairs[0]![0]) && pairs[0]![1] / pairs[0]![0] !== 1;
      const addC = pairs.every(([x, y]) => y - x === pairs[0]![1] - pairs[0]![0]);
      if (has(p, 'ما المخرج')) { const q = Number(p.match(/المدخل يكون? (\d+)|المدخل (\d+)\؟/)?.[0] ? nums(p.slice(p.indexOf('عندما')))[0] : n[n.length - 1]); const f = addC && !(mulC && pairs[0]![0] === 2 && pairs[0]![1] === 4) ? (x: number) => x + (pairs[0]![1] - pairs[0]![0]) : (x: number) => x * (pairs[0]![1] / pairs[0]![0]); assert.equal(Number(item.answer), f(q), p); }
      else { const c = mulC ? pairs[0]![1] / pairs[0]![0] : pairs[0]![1] - pairs[0]![0]; assert.equal(item.answer, mulC ? `ضرب في ${c}` : `جمع ${c}`, p); }
    }
  });
});

describe('money, time and measurement: answers recomputed', () => {
  it('decimal money, coins, dinars, banknotes', () => {
    for (const item of draws('decimal_money', 300)) {
      const p = item.promptAr!, d = p.match(/\d+\.\d+|\d+(?= دينار)/g)!.map(Number), a = Number(item.answer);
      if (has(p, 'كم دينارًا دفع')) assert.ok(Math.abs(a - (d[0]! + d[1]!)) < 1e-9, p);
      else if (has(p, 'يستردّ')) assert.ok(Math.abs(a - (d[0]! - d[1]!)) < 1e-9 && a > 0, p);
      else assert.equal(a, Math.max(d[0]!, d[1]!), p);
    }
    for (const id of ['coins_a', 'coins_b', 'coins_c']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كم قطعة')) assert.equal(a * n[0]!, n[1]); else if (has(p, 'و ') && n.length === 4) assert.equal(a, n[0]! * n[1]! + n[2]! * n[3]!); else assert.equal(a, n[0]! * n[1]!);
    }
    for (const item of draws('dinar')) {
      const p = item.promptAr!, a = Number(item.answer);
      const words = (w: string) => (w === 'دينار واحد' ? 1 : w === 'ديناران' ? 2 : Number(w.match(/\d+/)![0]));
      if (has(p, 'كم قرشًا')) assert.equal(a, words(p.match(/في (.+?)؟/)![1]!) * 100); else assert.equal(a * 100, Number(p.match(/في (\d+) قرش/)![1]));
    }
    for (const item of draws('banknotes', 300)) {
      const p = item.promptAr!, a = Number(item.answer);
      const money = (s: string) => (s.includes('دينار واحد') ? 1 : s.includes('ديناران') ? 2 : Number(s.match(/\d+/)![0]));
      if (has(p, 'كم ورقة')) { const f = money(p.match(/فئة (.+?) تلزم/)![1]!), t = money(p.match(/لدفع (.+?)؟/)![1]!); assert.equal(a * f, t); }
      else if (has(p, 'و ') && has(p, 'أوراق من فئة') && p.split('فئة').length === 3) { const m = p.match(/(\d+) أوراق من فئة (.+?) و (\d+) أوراق من فئة (.+?)\./)!; assert.equal(a, Number(m[1]) * money(m[2]!) + Number(m[3]) * money(m[4]!)); }
      else { const m = p.match(/في (\d+) أوراق نقدية من فئة (.+?)؟/)!; assert.equal(a, Number(m[1]) * money(m[2]!)); }
    }
  });

  it('days, months, clock times, calendar', () => {
    for (const item of draws('week_days')) {
      const p = item.promptAr!, i = DAYS.findIndex(d => p.includes(`يوم ${d}`));
      if (has(p, 'كم يومًا')) assert.equal(item.answer, '7'); else assert.equal(item.answer, DAYS[(i + (has(p, 'بعد') ? 1 : 6)) % 7]);
    }
    const mins = (s: string) => { const [h, m] = s.split(':').map(Number); return (h! % 12) * 60 + m!; };
    for (const item of draws('hour_full')) { const [h, j] = [Number(item.promptAr!.match(/(\d+):00/)![1]), has(item.promptAr!, 'ساعتين') ? 2 : has(item.promptAr!, '3 ساعات') ? 3 : 1]; assert.equal(mins(item.answer), mins(`${h}:00`) + j * 60 === 0 ? 0 : (mins(`${h}:00`) + j * 60) % 720); }
    for (const item of draws('hour_half')) { const h = Number(item.promptAr!.match(/(\d+):00/)![1]); assert.equal(mins(item.answer), (mins(`${h}:00`) + 30) % 720); }
    for (const [id, step] of [['time_5', 5], ['time_15', 15]] as const) for (const item of draws(id, 400)) {
      const t = mins(item.eq), a = mins(item.answer);
      let best = Infinity, bestT = 0;
      for (let c = 0; c <= 720; c += step) { const d = Math.abs(c - t); if (d < best) { best = d; bestT = c % 720; } }
      assert.equal(a, bestT, `${item.eq} → ${item.answer}`);
      assert.ok(t % step !== 0 && Math.abs(t % step - step / 2) > 0, 'no tie');
    }
    for (const item of draws('months')) {
      const p = item.promptAr!, i = MONTHS.findIndex(m => p.includes(`شهر ${m}`));
      if (has(p, 'كم شهرًا')) assert.equal(item.answer, '12');
      else if (has(p, 'ترتيبه')) assert.equal(item.answer, MONTHS[Number(p.match(/ترتيبه (\d+)/)![1]) - 1]);
      else assert.equal(item.answer, MONTHS[(i + (has(p, 'بعد') ? 1 : 11)) % 12]);
    }
    for (const item of draws('am_pm')) {
      const n = nums(item.promptAr!), a = Number(item.answer);
      if (has(item.promptAr!, 'كم ساعة')) assert.equal(a, 12 - n[0]! + n[2]!); else assert.equal(a, n[0]! + 12);
    }
    for (const item of draws('calendar')) {
      const p = item.promptAr!, n = nums(p), a = item.answer;
      if (has(p, 'كم يومًا')) assert.equal(Number(a), n[0]! * 7); else if (has(p, 'كم أسبوعًا')) assert.equal(Number(a) * 7, n[0]); else { const i = DAYS.findIndex(d => p.includes(`اليوم ${d}`)); assert.equal(a, DAYS[(i + n[0]!) % 7]); }
    }
  });

  it('comparing measures and Grade 2 units', () => {
    for (const id of ['compare_len', 'compare_mass', 'compare_cap']) for (const item of draws(id)) {
      const [a, b] = nums(item.promptAr!), v = Number(item.answer);
      assert.notEqual(a, b);
      assert.equal(v, has(item.promptAr!, 'بكم') ? Math.abs(a! - b!) : Math.max(a!, b!));
    }
    for (const item of draws('cm_lengths', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'معًا')) assert.equal(a, n[0]! + n[1]!); else if (has(p, 'بكم')) assert.equal(a, n[0]! - n[1]!); else assert.equal(a, n[0]! * 2);
    }
    for (const [id, f] of [['units_m_g2', 100], ['units_kg_g2', 1000], ['units_l_g2', 1000]] as const) for (const item of draws(id)) {
      const n = nums(item.promptAr!), a = Number(item.answer);
      assert.equal(n[1], f);
      if (has(item.promptAr!, 'في ' + n[2] + ' ' + ['متر', 'كيلوغرام', 'لتر'][id === 'units_m_g2' ? 0 : id === 'units_kg_g2' ? 1 : 2])) assert.equal(a, n[2]! * f); else assert.equal(a * f, n[2]);
    }
  });
});

describe('early routing', () => {
  const cases: Array<[string, number, string | null]> = [
    ['الأعداد: 1 ,2 ,3', 1, 'count_123'], ['العددان: 9 ,10', 1, 'count_910'], ['العدد صفر', 1, 'count_zero'], ['العد الترتيبي', 1, 'ordinal'],
    ['الآحاد والعشرات', 1, 'tens_ones_b'], ['المئات', 2, 'hundreds_a'], ['قراءة الأعداد وكتابتها', 2, 'expanded_form'], ['الألوف', 3, 'thousands'],
    ['الأعداد الزوجية والأعداد الفردية', 1, 'even_odd_g1'], ['الأعداد الزوجية والأعداد الفردية', 2, 'even_odd_g2'], ['لوحة الأعداد', 1, 'number_chart'],
    ['العد القفزي', 1, 'skip_g1'], ['العد القفزي', 3, 'skip_g3'], ['العد بالواحدات والعشرات والمئات', 2, 'skip_g2'],
    ['الجمع باستعمال خط الأعداد', 1, 'line_add'], ['الضعف مضافا إليه 1', 1, 'double_b'], ['المضاعفة', 3, 'doubling_g3'], ['مكونات العدد 10', 1, 'make_ten'],
    ['الحقائق المترابطة', 1, 'related_g1'], ['الحقائق المترابطة', 3, 'related_g3'], ['العدد المفقود', 1, 'missing_number'], ['الجمع الذهني', 1, 'mental_add'],
    ['المجسمات', 1, 'solid_names'], ['الأحرف والأوجه والرؤوس', 2, 'solid_parts'], ['الأنماط الهندسية', 1, 'geo_pattern'], ['الأنماط الهندسية', 4, 'geo_pattern'],
    ['النصف', 1, 'half'], ['الكسر كجزء من مجموعة', 1, 'fraction_of_set_g1'], ['الكسر كجزء من مجموعة', 3, 'fraction_of_set_g3'], ['كسر الوحدة', 2, 'unit_fraction'],
    ['الكسور المساوية للواحد', 3, 'fraction_equals_one'], ['الكسور المتكافئة', 3, 'equiv_frac'], ['تقريب الأعداد', 2, 'round_whole'], ['تقدير ناتج الجمع', 2, 'est_add'],
    ['تقدير ناتج الضرب', 3, 'est_prod'], ['تقدير ناتج القسمة', 3, 'est_quot'], ['جمع مضاعفات العشرة والمئة ذهنيا', 2, 'mental_mult_add_g2'], ['طرح مضاعفات 10 و100 و1000', 3, 'mental_mult_sub_g3'],
    ['خواص الضرب', 3, 'mul_properties'], ['الباقي', 3, 'remainder'], ['القسمة مع باق (الناتج من رقمين)', 3, 'div_rem_2'], ['الضرب مع إعادة التجميع', 3, 'mul_regroup'],
    ['الضرب من دون إعادة التجميع', 3, 'mul_no_regroup'], ['الجدول ذو الاتجاهين', 3, 'two_way_table'], ['الزوايا', 3, 'angle_kind_g3'], ['مستقيمات خاصة', 3, 'lines_g3'],
    ['قياس الزوايا ورسمها', 4, 'angle_measure'], ['الأنماط', 4, 'number_patterns_g4'], ['جداول المدخلات والمخرجات', 4, 'input_output'], ['الأعداد العشرية والنقود', 4, 'decimal_money'],
    ['الدينار', 2, 'dinar'], ['فئات النقود الورقية', 2, 'banknotes'], ['أيام الأسبوع', 1, 'week_days'], ['الوقت لأقرب ربع ساعة', 2, 'time_15'], ['أشهر السنة', 2, 'months'], ['التقويم', 3, 'calendar'],
    ['مقارنة الأطوال وترتيبها', 1, 'compare_len'], ['السنتيمتر', 2, 'cm_lengths'], ['اللتر والمليلتر', 2, 'units_l_g2'],
    // lessons that stay refused: they need pictures, objects, or a digit form the app converts itself
    ['الأرقام الهندية', 3, null], ['التصنيف وفق خاصية واحدة', 1, null], ['الموقع والاتجاه', 1, null], ['ترتيب الأعمال اليومية', 1, null],
  ];
  for (const [title, grade, id] of cases) {
    it(`${title} (G${grade}) → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, grade)?.id ?? null, id);
      if (id) assert.ok(mathBankCovers(title, null, grade));
    });
  }
});
