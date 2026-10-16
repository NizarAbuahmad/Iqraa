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
import { stemFrame } from '../stemFrame.ts';

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
/** Arabic number words read back to a number, written apart from the generator's own table. */
const WORD: Record<string, number> = { 'صفر': 0, 'واحد': 1, 'أحد': 1, 'اثنان': 2, 'اثنا': 2, 'ثلاثة': 3, 'أربعة': 4, 'خمسة': 5, 'ستة': 6, 'سبعة': 7, 'ثمانية': 8, 'تسعة': 9, 'عشرة': 10, 'عشرون': 20, 'ثلاثون': 30, 'أربعون': 40, 'خمسون': 50, 'ستون': 60, 'سبعون': 70, 'ثمانون': 80, 'تسعون': 90, 'مئة': 100, 'مئتان': 200, 'ثلاثمئة': 300, 'أربعمئة': 400, 'خمسمئة': 500, 'ستمئة': 600, 'سبعمئة': 700, 'ثمانمئة': 800, 'تسعمئة': 900 };
const readWords = (s: string) => s.split(' و').reduce((sum, part) => {
  const teen = part.match(/^(\S+) عشر$/);
  if (teen) return sum + WORD[teen[1]!]! + 10;
  assert.ok(part in WORD, `unknown number word «${part}» in «${s}»`);
  return sum + WORD[part]!;
}, 0);
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
    for (const [id, [lo, hi]] of Object.entries(R)) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        if (has(p, 'نجمة')) { kinds.add('stars'); assert.equal(a, p.split('★').length - 1, p); }
        else if (has(p, 'بالأرقام')) { kinds.add('word'); assert.equal(a, WORD[p.match(/«(.+)»/)![1]!], p); }
        else if (has(p, 'بعد')) { kinds.add('after'); assert.equal(a, n[0]! + 1); }
        else if (has(p, 'قبل')) { kinds.add('before'); assert.equal(a, n[0]! - 1); }
        else { kinds.add('between'); assert.equal(n[1], n[0]! + 2); assert.equal(a, n[0]! + 1); }
        assert.ok(a >= lo && a <= hi && n.every(v => v >= lo && v <= hi), `${p} leaves ${lo}–${hi}`);
      }
      assert.equal(kinds.size, hi - lo >= 2 ? 5 : 4, `${id}: ${[...kinds]}`);
    }
    const zeroKinds = new Set<string>();
    for (const item of draws('count_zero')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما العدد الذي يدل')) { zeroKinds.add('meaning'); assert.equal(item.answer, '0'); }
      else if (has(p, 'أُخرجت الكرات كلها')) { zeroKinds.add('story'); assert.equal(Number(item.answer), n[0]! - n[0]!); }
      else if (has(p, ' − ') && n[0] === n[1]) { zeroKinds.add('n−n'); assert.equal(item.answer, '0'); }
      else { zeroKinds.add('±0'); assert.equal(Number(item.answer), n[0]); }
    }
    assert.equal(zeroKinds.size, 4);
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
    for (const grade of [1, 2]) {
      const kinds = new Set<string>();
      for (const item of draws('expanded_form', 240, grade)) {
        const p = item.promptAr!, n = nums(p);
        if (has(p, 'كيف نقرأ')) { kinds.add('read'); assert.equal(readWords(item.answer), n[0], p); item.wrongs.forEach(w => assert.notEqual(readWords(w), n[0])); }
        else if (has(p, 'قيمة الرقم')) {
          kinds.add('value');
          const [d, x] = n, digits = String(x).split('').map(Number), at = digits.indexOf(d!);
          assert.equal(digits.filter(v => v === d).length, 1, `${p}: the digit must be unambiguous`);
          assert.equal(Number(item.answer), d! * 10 ** (digits.length - 1 - at), p);
        }
        else { kinds.add('expanded'); assert.equal(Number(item.answer), n.reduce((x, y) => x + y, 0), p); }
        assert.ok(n[n.length - 1]! < (grade === 1 ? 100 : 1000), p);
      }
      assert.equal(kinds.size, 3, `grade ${grade}: ${[...kinds]}`);
    }
    for (const item of draws('thousands')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'ما رقم الألوف')) assert.equal(a, Math.floor(n[0]! / 1000));
      else if (has(p, 'آلاف و')) assert.equal(a, n[0]! * 1000 + n[1]! * 100 + n[2]! * 10 + n[3]!);
      else { const [d, big] = n; const pos = String(big).indexOf(String(d)); void pos; assert.ok(String(big).includes(String(d))); const place = has(p, 'الألوف') ? 1000 : has(p, 'المئات') ? 100 : 10; assert.equal(a, d! * place); assert.equal(Math.floor(big! / place) % 10, d); }
    }
  });

  it('even and odd, number chart, counting up and down, skip counting', () => {
    for (const id of ['even_odd_g1', 'even_odd_g2']) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, wantEven = has(p, 'زوجي'), a = Number(item.answer);
        assert.equal(a % 2 === 0, wantEven, p);
        if (has(p, 'أول عدد')) {
          kinds.add(`next ${wantEven}`);
          const n = nums(p)[0]!;
          assert.ok(a > n && a <= n + 2, p);
          for (let v = n + 1; v < a; v++) assert.notEqual(v % 2 === 0, wantEven, `${v} comes first: ${p}`);
          continue;
        }
        kinds.add(`list ${wantEven}`);
        const list = nums(p.slice(p.indexOf(':')));
        assert.equal(list.filter(v => (v % 2 === 0) === wantEven).length, 1, p);
        assert.ok(list.includes(a));
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
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
    const upDown = new Set<string>();
    for (const item of draws('count_up_down')) {
      const p = item.promptAr!, s = nums(p), up = has(p, 'تصاعديًا'), a = Number(item.answer);
      if (has(p, 'ابدأ من')) { upDown.add(`from ${up}`); assert.equal(a, s[0]! + (up ? s[1]! : -s[1]!), p); assert.ok(a >= 0 && a <= 20); continue; }
      upDown.add(`seq ${up}`);
      assert.equal(a, s[2]! + (up ? 1 : -1));
      assert.ok(s[1]! - s[0]! === (up ? 1 : -1) && s[2]! - s[1]! === (up ? 1 : -1));
    }
    assert.equal(upDown.size, 4);
    for (const [id, grade, limit] of [['skip_g1', 1, 100], ['skip_g2', 2, 999], ['skip_g3', 3, 9999]] as const) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, a = Number(item.answer);
        if (has(p, 'مقدار القفزة')) { kinds.add('step'); const v = nums(p); assert.ok(v.every((x, i) => i === 0 || x - v[i - 1]! === a), p); assert.ok(a > 0); continue; }
        if (has(p, 'خط الأعداد')) { kinds.add('line'); const [st, size, jumps] = nums(p); assert.equal(a, st! + size! * jumps!, p); assert.ok(a <= limit, p); continue; }
        const shown = p.slice(p.indexOf(':') + 1).split('،').map(s => s.trim());
        const hole = shown.indexOf('___'), v = shown.map(Number);
        const step = v[1]! - v[0]!, down = has(p, 'التنازلي');
        kinds.add(down ? 'down' : 'up');
        assert.ok((down ? step < 0 : step > 0) && v[2]! - v[1]! === step, p);
        assert.equal(a, v[0]! + hole * step, p);
        assert.ok(a >= 0 && Math.max(...v.filter(Number.isFinite)) <= limit, p);
      }
      assert.equal(kinds.size, 4, `${id} (G${grade}): ${[...kinds]}`);
    }
    for (const id of ['before_after_g1', 'before_after_g2']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'السابق')) assert.equal(a, n[0]! - 1); else if (has(p, 'التالي')) assert.equal(a, n[0]! + 1); else { assert.equal(n[1], n[0]! + 2); assert.equal(a, n[0]! + 1); }
    }
    const near = new Set<string>();
    for (const item of draws('nearest_ten_g1')) {
      const p = item.promptAr!;
      if (has(p, 'بين أي عشرتين')) { near.add('between'); const n = nums(p)[0]!, [lo, hi] = nums(item.answer); assert.equal(lo, Math.floor(n / 10) * 10, p); assert.equal(hi, lo! + 10); continue; }
      if (has(p, 'أي الأعداد الآتية')) {
        near.add('closest');
        const [ten, ...list] = nums(p), dist = (v: number) => Math.abs(v - ten!);
        assert.equal(list.length, 4, p);
        list.filter(v => v !== Number(item.answer)).forEach(v => assert.ok(dist(v) > dist(Number(item.answer)), p));
        continue;
      }
      near.add('tens');
      const n = nums(p)[0]!, a = Number(item.answer);
      assert.ok(a % 10 === 0 && Math.abs(n - a) < 5, `${n} → ${a}`);
    }
    assert.equal(near.size, 3);
  });
});

describe('early arithmetic: answers recomputed', () => {
  it('number line, doubles, make ten, properties, related facts, missing numbers, mental maths', () => {
    for (const add of [true, false]) {
      const kinds = new Set<string>(), sign = add ? 1 : -1;
      for (const item of draws(add ? 'line_add' : 'line_sub')) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        if (has(p, 'كم قفزة')) { kinds.add('jumps'); assert.equal(n[0]! + sign * a, n[1], p); }
        else if (has(p, 'من أي عدد بدأت')) { kinds.add('start'); assert.equal(a + sign * n[0]!, n[n.length - 1], p); }
        else { kinds.add(has(p, 'استعمل') ? 'sentence' : 'walk'); assert.equal(a, n[0]! + sign * n[1]!, p); }
        assert.ok(n.every(v => v >= 0 && v <= 20) && a >= 0 && a <= 20, p);
        assert.ok(!/ [12] قفزات/.test(p), `${p}: «قفزات» after 1 or 2`);
      }
      assert.equal(kinds.size, 4, `${add}: ${[...kinds]}`);
    }
    const dbl = new Set<string>();
    for (const item of draws('double_a')) {
      const p = item.promptAr!, n = nums(p)[0]!, a = Number(item.answer);
      if (has(p, 'ما العدد الذي ضعفه')) { dbl.add('half'); assert.equal(2 * a, n); }
      else if (has(p, 'العدد نفسه')) { dbl.add('story'); assert.equal(a, n + n); }
      else { dbl.add('double'); assert.equal(a, 2 * n); }
      assert.ok(Math.min(a, n) <= 10, `doubles up to 10: ${p}`);
    }
    assert.equal(dbl.size, 3);
    const dbl1 = new Set<string>();
    for (const item of draws('double_b')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'ضعف ___')) { dbl1.add('blank'); assert.equal(n[0]! + n[1]!, 2 * a + 1, p); assert.equal(n[1], n[0]! + 1); }
      else if (has(p, 'لإيجاد')) { dbl1.add('use'); const [x, y] = n.slice(-2); assert.equal(a, x! + y!, p); assert.equal(y, x! + 1); }
      else { dbl1.add('double+1'); assert.equal(a, 2 * n[0]! + 1); }
    }
    assert.equal(dbl1.size, 3);
    for (const item of draws('doubling_g3')) {
      const p = item.promptAr!, n = nums(p)[0]!, a = Number(item.answer);
      if (has(p, 'ضعف ضعف')) assert.equal(a, 4 * n); else if (has(p, 'ما العدد الذي ضعفه')) assert.equal(a * 2, n); else assert.equal(a, 2 * n);
    }
    const ten = new Set<string>();
    for (const item of draws('make_ten', 300)) {
      const p = item.promptAr!;
      ten.add(stemFrame(p));
      if (has(p, 'أي جمع')) { const sum = (s: string) => s.split(' + ').map(Number).reduce((x, y) => x + y, 0); assert.equal(sum(item.answer), 10); item.wrongs.forEach(w => assert.notEqual(sum(w), 10, `${w} also makes 10`)); }
      else { const a = nums(p.replace('10', ''))[0]!; assert.equal(Number(item.answer), 10 - a); }
    }
    assert.ok(ten.size >= 4, [...ten].join(' | '));
    for (const id of ['add_props_g1', 'add_props_g2']) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        if (has(p, 'فما ناتج')) { kinds.add('order'); assert.equal(n[0]! + n[1]!, n[2]); assert.equal(a, n[3]! + n[4]!); assert.equal(a, n[2]); }
        else if (has(p, 'أسهل طريقة')) { kinds.add('three'); assert.equal(a, n[0]! + n[1]! + n[2]!); assert.equal((n[0]! + n[2]!) % 10, 0, p); }
        else if (has(p, '= ___ +')) { kinds.add('swap'); assert.equal(a, n[1]); }
        else if (has(p, '+ 0')) { kinds.add('zero'); assert.equal(a, n[0]); }
        else { kinds.add('group'); assert.equal(a, n[2]); }
      }
      assert.equal(kinds.size, 5, `${id}: ${[...kinds]}`);
    }
    for (const id of ['related_g1', 'related_g3']) {
      const kinds = new Set<string>(), mul = id === 'related_g3';
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        if (has(p, 'مثلث الحقائق')) { kinds.add('triangle'); assert.equal(mul ? n[0]! * n[1]! : n[0]! + n[1]!, n[2]); assert.equal(n[3], n[2]); assert.equal(a, mul ? n[3]! / n[4]! : n[3]! - n[4]!); }
        else if (has(p, 'العدد المفقود')) { kinds.add('missing'); assert.equal(mul ? a * n[0]! : n[0]! - a, n[1], p); }
        else if (has(p, 'فإن') && has(p, mul ? '× ' : '+ ') && p.indexOf(mul ? '×' : '+') < p.indexOf('فإن')) { kinds.add('if1'); assert.equal((mul ? n[0]! * n[1]! : n[0]! + n[1]!), n[2]); assert.equal(a, n[1]); }
        else { kinds.add('if2'); assert.equal(a, mul ? n[1]! * n[2]! : n[1]! + n[2]!); }
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
    const missing = new Set<string>();
    for (const item of draws('missing_number')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer), q = p.replace('أكمل جملة الطرح: ', '');
      if (has(p, 'كم كرة كانت معها')) { missing.add('story'); assert.equal(a + n[0]!, n[1], p); assert.ok(n[0]! >= 3 && n[0]! <= 10, `«كرات» needs 3–10: ${p}`); continue; }
      missing.add(has(p, '+') ? 'add' : 'sub');
      assert.equal(has(p, 'جملة الطرح'), has(p, '−'), p);
      if (/^\d+ \+ ___/.test(q)) assert.equal(n[0]! + a, n[1]); else if (/^___ \+/.test(q)) assert.equal(a + n[0]!, n[1]); else if (/^\d+ − ___/.test(q)) assert.equal(n[0]! - a, n[1]); else assert.equal(a - n[0]!, n[1]);
    }
    assert.equal(missing.size, 3);
    for (const id of ['mental_add', 'mental_sub']) {
      const kinds = new Set<string>(), add = id === 'mental_add';
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        kinds.add(has(p, 'قرشًا') ? 'money' : has(p, 'ذهنيًا') ? 'ones' : has(p, 'فكّر') ? 'nine' : 'tens');
        assert.equal(a, add ? n[0]! + n[1]! : n[0]! - n[1]!, p);
        assert.ok(a > 0 && a <= 99);
        if (has(p, 'ذهنيًا')) { assert.ok(n[1]! <= 9 && n[0]! >= 10, p); assert.equal(Math.floor(a / 10), Math.floor(n[0]! / 10), `${p}: no regrouping`); }
        if (has(p, 'قرشًا')) assert.ok(n[0]! >= 11 && n[1]! >= 20 && n[1]! % 10 === 0 && a >= 11, `«قرشًا» needs 11 or more: ${p}`);
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
    for (const id of ['mental_mult_add_g2', 'mental_mult_sub_g2', 'mental_mult_add_g3', 'mental_mult_sub_g3']) {
      const kinds = new Set<string>(), add = id.includes('add'), g2 = id.endsWith('g2');
      for (const item of draws(id)) {
        const p = item.promptAr!, [x, y] = nums(p), a = Number(item.answer);
        if (has(p, 'لنحصل على')) {
          kinds.add('missing');
          assert.equal(add ? x! + a : x! - a, y, p);
        } else {
          kinds.add(has(p, 'بمقدار') ? 'more-less' : has(p, 'ذهنيًا') ? 'mental' : 'multiples');
          assert.equal(a, add ? x! + y! : x! - y!, p);
          if (!has(p, '= ___')) {
            // only one digit of the big number changes: nothing to carry or borrow
            const changed = String(x).padStart(4, '0').split('').filter((c, i) => c !== String(a).padStart(4, '0')[i]).length;
            assert.equal(changed, 1, `${p} → ${a}`);
            assert.ok(x! >= (g2 ? 100 : 1000) && x! <= (g2 ? 999 : 9999), p);
          }
        }
        const m = has(p, 'لنحصل على') ? a : y!;
        assert.ok(a > 0 && /^[1-9]0*$/.test(String(m)), `a multiple of 10, 100 or 1000: ${p}`);
        if (g2) assert.ok(Math.max(x!, y!, a) <= 999, 'Grade 2 stays within hundreds');
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
  });

  it('equal groups, division relation, multiplication and division facts', () => {
    for (const id of ['equal_groups_a', 'equal_groups_b']) for (const item of draws(id)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كم قلمًا')) assert.equal(a, n[0]! * n[1]!); else if (has(p, 'كم قطعة')) assert.equal(a * n[1]!, n[0]); else assert.equal(a * n[1]!, n[0]);
    }
    for (const grade of [2, 3]) {
      const kinds = new Set<string>();
      for (const item of draws('division_relation', 240, grade)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        if (has(p, 'إذا ضُرب')) { kinds.add('factor'); assert.equal(a * n[0]!, n[1], p); }
        else if (has(p, 'فإن')) { kinds.add('if'); assert.equal(n[0]! * n[1]!, n[2]); assert.equal(a, n[1]); }
        else { kinds.add('because'); assert.equal(a * n[1]!, n[0]); }
      }
      assert.equal(kinds.size, 3, `G${grade}: ${[...kinds]}`);
    }
    const mulKinds = new Set<string>();
    for (const item of draws('mul_properties', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, '× 1')) { mulKinds.add('one'); assert.equal(a, n[0]); }
      else if (has(p, '× 0')) { mulKinds.add('zero'); assert.equal(a, 0); }
      else if (has(p, ') × ')) { mulKinds.add('assoc'); assert.ok(has(p, 'التجميع')); assert.equal(a, n[2]); assert.equal(n[0]! * n[1]! * n[2]!, n[3]! * n[4]! * a); }
      else if (has(p, ' × (')) { mulKinds.add('dist'); assert.ok(has(p, 'التوزيع')); assert.equal(n[0]! * (n[1]! + n[2]!), n[3]! * n[4]! + n[5]! * a); }
      else { mulKinds.add('comm'); assert.ok(has(p, 'التبديل')); assert.equal(n[0]! * n[1]!, a * n[2]!); }
    }
    assert.equal(mulKinds.size, 5);
    const divKinds = new Set<string>();
    for (const item of draws('div_properties')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'على نفسه')) { divKinds.add('self'); assert.equal(a, n[0]! / n[0]!); }
      else if (has(p, 'أكمل')) { divKinds.add('blank'); assert.equal(n[0]! / a, n[1], p); assert.equal(n[0], n[1]); }
      else if (has(p, '÷ 1')) { divKinds.add('one'); assert.equal(a, n[0]!); }
      else { divKinds.add('zero'); assert.ok(has(p, 'ما ناتج 0')); assert.equal(a, 0 / n[1]!); }
    }
    assert.equal(divKinds.size, 4);
    const remKinds = new Set<string>();
    for (const item of draws('remainder', 300)) {
      const p = item.promptAr!, a = Number(item.answer);
      if (has(p, 'كان الخارج')) { remKinds.add('inverse'); const [d, q, r] = nums(p); assert.ok(r! < d! && r! > 0, p); assert.equal(a, d! * q! + r!); continue; }
      const [n, d] = nums(p);
      remKinds.add(has(p, 'قطع حلوى') ? 'story' : has(p, 'ما الباقي') ? 'rem' : 'quot');
      assert.equal(a, has(p, 'ما الباقي') || has(p, 'بقيت') ? n! % d! : Math.floor(n! / d!), p);
      assert.notEqual(n! % d!, 0);
      if (has(p, 'أطفال')) assert.ok(d! >= 3 && d! <= 10, `«أطفال» needs 3–10: ${p}`);
    }
    assert.equal(remKinds.size, 4);
    for (const id of ['div_no_rem', 'div_rem_2', 'div_rem_1']) {
      const kinds = new Set<string>();
      for (const item of draws(id, 300)) {
        const p = item.promptAr!, a = Number(item.answer);
        let n: number, d: number;
        if (has(p, 'ما العدد الذي')) {
          kinds.add('inverse');
          const v = nums(p); d = v[0]!; n = a;
          assert.equal(Math.floor(a / d), v[1], p);
          assert.equal(a % d, v[2] ?? 0, p);
        } else {
          [n, d] = nums(p) as [number, number];
          if (has(p, 'ما الباقي') || has(p, 'بقيت')) { kinds.add(has(p, 'بقيت') ? 'story-left' : 'rem'); assert.equal(a, n % d, p); }
          else { kinds.add(has(p, 'أخذ كل طفل') ? 'story-share' : 'quot'); assert.equal(a, Math.floor(n / d), p); }
          if (has(p, 'أطفال')) assert.ok(d >= 3, `«أطفال» needs 3–10: ${p}`);
        }
        assert.equal(n % d === 0, id === 'div_no_rem');
        assert.ok(n >= 10 && n <= 99 && d >= 2 && d <= 9, `${p}: a two-digit number by a one-digit number`);
        assert.equal(Math.floor(n / d) >= 10, id !== 'div_rem_1', `${p}: quotient digits`);
      }
      assert.equal(kinds.size, id === 'div_no_rem' ? 3 : 5, `${id}: ${[...kinds]}`);
    }
    const tm = new Set<string>();
    for (const item of draws('tens_mul_g3')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'إذا كان')) { tm.add('pattern'); assert.equal(n[0]! * n[1]!, n[2]); assert.equal(a, n[3]! * n[4]!); assert.equal(n[4], n[1]! * 10); }
      else if (has(p, 'صندوق')) { tm.add('story'); assert.equal(a, n[0]! * n[1]!); assert.ok(n[1]! >= 3 && n[0]! % 10 === 0 && n[0]! >= 20, p); }
      else { tm.add('plain'); assert.equal(a, n[0]! * n[1]!); assert.ok(n[0]! % 10 === 0 || n[1]! % 10 === 0); }
    }
    assert.equal(tm.size, 3);
    const td = new Set<string>();
    for (const item of draws('tens_div_g3')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'إذا كان')) { td.add('pattern'); assert.equal(n[0]! / n[1]!, n[2]); assert.equal(n[3], n[0]! * 10); assert.equal(a * n[4]!, n[3]); }
      else { td.add(has(p, 'صناديق') ? 'story' : 'plain'); assert.equal(a * n[1]!, n[0]); assert.equal(n[0]! % 10, 0); }
    }
    assert.equal(td.size, 3);
    const dist = new Set<string>();
    for (const item of draws('mul_distribute')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'الجزئيين')) { dist.add('partial'); assert.equal(n[0]! * n[1]!, n[2]! + a); assert.equal(n[2]! % 10, 0); }
      else if (has(p, 'أكمل')) { dist.add('blank'); assert.equal(n[0]! * n[1]!, n[0]! * n[3]! + n[0]! * a); }
      else if (has(p, 'كرسيًا')) { dist.add('story'); assert.equal(a, n[0]! * n[1]!); assert.ok(n[0]! >= 3 && n[1]! >= 11, p); }
      else { dist.add('use'); assert.equal(a, n[0]! * n[1]!); }
    }
    assert.equal(dist.size, 4);
    for (const id of ['mul_no_regroup', 'mul_regroup']) {
      const kinds = new Set<string>();
      for (const item of draws(id, 300)) {
        const p = item.promptAr!, a = Number(item.answer), [n, k] = nums(p), r = n! * k!;
        if (has(p, 'رقم الآحاد')) { kinds.add('ones'); assert.equal(a, r % 10); }
        else if (has(p, 'رقم العشرات')) { kinds.add('tens'); assert.equal(a, Math.floor(r / 10) % 10); }
        else if (has(p, 'نُعيد تجميعها')) { kinds.add('carry'); const [, , o, kk, ok] = nums(p); assert.equal(o, n! % 10); assert.equal(kk, k); assert.equal(o! * kk!, ok); assert.equal(a, Math.floor(ok! / 10)); }
        else { kinds.add(has(p, 'صناديق') ? 'story' : 'plain'); assert.equal(a, r); if (has(p, 'صناديق')) assert.ok(k! >= 3, p); }
        const carryOnes = (n! % 10) * k! >= 10, carryTens = Math.floor(n! / 10) * k! >= 10;
        if (id === 'mul_no_regroup') assert.ok(!carryOnes && !carryTens, p); else assert.ok(carryOnes, p);
      }
      assert.equal(kinds.size, id === 'mul_regroup' ? 5 : 4, `${id}: ${[...kinds]}`);
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
    const N: Record<string, string> = { '◯': 'دائرة', '△': 'مثلث', '□': 'مربع', '◇': 'معين' };
    const period = (seq: string[]) => { let len = 1; while (!seq.every((s, i) => s === seq[i % len])) len++; return len; };
    const geo = new Set<string>();
    for (const item of draws('geo_pattern', 300)) {
      const p = item.promptAr!, a = item.answer;
      if (has(p, 'الأعواد')) {
        const m = p.match(/الشكل 1 فيه (\d+) أعواد والشكل 2 فيه (\d+) والشكل 3 فيه (\d+)\./)!, [t1, t2, t3] = [m[1], m[2], m[3]].map(Number), d = t2! - t1!, last = nums(p).slice(-1)[0]!;
        assert.equal(t3! - t2!, d);
        assert.ok(t1! >= 3, `«أعواد» after ${t1}`);
        if (has(p, 'بكم عودًا يزيد')) { geo.add('sticks-step'); assert.equal(Number(a), d); }
        else if (has(p, 'ما رقم الشكل')) { geo.add('sticks-which'); assert.equal(t1! + (Number(a) - 1) * d, last, p); }
        else { geo.add('sticks-count'); assert.equal(Number(a), t1! + (last - 1) * d, p); }
        continue;
      }
      if (has(p, 'وحدة النمط')) { geo.add('unit'); const seq = p.slice(p.indexOf(':') + 1, p.indexOf('؟')).trim().split(' '); assert.equal(Number(a), period(seq), p); continue; }
      const seq = item.eq.split(' '), len = period(seq);
      if (has(p, 'الشكل رقم')) { geo.add('position'); const pos = nums(p)[0]!; assert.ok(pos > seq.length, p); assert.equal(a, N[seq[(pos - 1) % len]!], p); continue; }
      geo.add('next');
      assert.equal(a, N[seq[seq.length % len]!], p);
    }
    assert.equal(geo.size, 6, [...geo].join(', '));
  });

  it('half, quarter, parts, fractions of a set, unit fractions, fractions of a whole', () => {
    for (const id of ['half', 'quarter']) {
      const kinds = new Set<string>(), d = id === 'half' ? 2 : 4;
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p)[0]!, a = Number(item.answer);
        if (has(p, 'في الكل الواحد')) { kinds.add('whole'); assert.equal(a, d); }
        else if (has(p, 'ما العدد الذي')) { kinds.add('inverse'); assert.equal(a, n * d); }
        else if (has(p, 'أعطى')) { kinds.add('share'); assert.equal(a * d, n); assert.ok(n >= 3 && n <= 10, `«كرات» needs 3–10: ${p}`); }
        else { kinds.add('part'); assert.equal(a * d, n); }
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
    const NAMES: Record<number, string> = { 2: 'نصف', 3: 'ثلث', 4: 'ربع' };
    const parts = new Set<string>();
    for (const item of draws('equal_parts')) {
      const p = item.promptAr!, n = nums(p), d = has(p, 'جزأين متطابقين') ? 2 : n[n.length - 1]!;
      assert.ok(!/ 2 أجزاء/.test(p), p);
      if (has(p, 'كم جزءًا بقي')) { parts.add('left'); assert.equal(Number(item.answer), d - 1); }
      else if (has(p, 'مكعبًا')) { parts.add('share'); assert.equal(Number(item.answer) * d, n[0]); }
      else { parts.add('name'); assert.equal(item.answer, NAMES[d]); }
    }
    assert.equal(parts.size, 3);
    for (const item of draws('fraction_of_set_g1')) { const n = nums(item.promptAr!)[0]!, d = has(item.promptAr!, 'نصف') ? 2 : has(item.promptAr!, 'ثلث') ? 3 : 4; assert.equal(Number(item.answer) * d, n); }
    const set3 = new Set<string>();
    for (const item of draws('fraction_of_set_g3', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (/^ما \d+\/\d+ من/.test(p)) { set3.add('of'); assert.equal(Number(item.answer), (n[0]! * n[2]!) / n[1]!); assert.ok(Number.isInteger(Number(item.answer))); continue; }
      const c = n[0]!, k = n[1] ?? (has(p, 'يلبس واحد') ? 1 : NaN), top = has(p, 'لا يلبسون') ? c - k : k;
      set3.add(has(p, 'لا يلبسون') ? 'without' : 'with');
      assert.ok(c >= 3 && c <= 10, `«طلاب» needs 3–10: ${p}`);
      assert.equal(item.answer, `${top}/${c}`, p); assert.equal(gcd(top, c), 1);
    }
    assert.equal(set3.size, 3);
    const unit = new Set<string>();
    for (const item of draws('unit_fraction')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'أكبر')) { unit.add('compare'); assert.equal(item.answer, `1/${Math.min(n[1]!, n[3]!)}`); }
      else if (has(p, 'إلى كم جزءًا')) { unit.add('parts'); assert.equal(Number(item.answer), n[1]); assert.equal(n[0], 1); }
      else { unit.add(has(p, 'كعكة') ? 'cake' : 'name'); assert.equal(item.answer, `1/${n[0]}`); assert.ok(n[0]! >= 3, `«أجزاء» needs 3 or more: ${p}`); }
    }
    assert.equal(unit.size, 4);
    const unitSet = new Set<string>();
    for (const item of draws('unit_fraction_set')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'المجموعة كلها')) { unitSet.add('whole'); assert.equal(n[0], 1); assert.equal(a, n[1]! * n[2]!); assert.ok(n[2]! >= 3 && n[2]! <= 10, p); }
      else if (has(p, 'تفاحة')) { unitSet.add('apples'); assert.equal(n[1], 1); assert.equal(a * n[2]!, n[0]); assert.ok(n[0]! >= 11, `«تفاحة» needs 11 or more: ${p}`); }
      else { unitSet.add('of'); assert.equal(a * n[1]!, n[2]); }
    }
    assert.equal(unitSet.size, 3);
    const whole = new Set<string>();
    for (const item of draws('fraction_of_whole')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما مقام')) { whole.add('denominator'); assert.equal(Number(item.answer), n[1]); continue; }
      if (has(p, 'كم جزءًا لُوّن')) { whole.add('numerator'); assert.equal(Number(item.answer), n[0]); continue; }
      const [d, k] = [n[0]!, n[1]!], top = has(p, 'غير الملوّن') ? d - k : k;
      whole.add(has(p, 'غير الملوّن') ? 'uncoloured' : 'coloured');
      assert.equal(item.answer, `${top}/${d}`); assert.equal(gcd(top, d), 1);
    }
    assert.equal(whole.size, 4);
    const line = new Set<string>();
    for (const item of draws('fraction_number_line')) {
      const p = item.promptAr!, n = nums(p);
      assert.deepEqual(n.slice(0, 2), [0, 1]);
      if (has(p, 'كم جزءًا نعدّ')) { line.add('count'); assert.equal(Number(item.answer), n[3]); assert.equal(n[4], n[2]); }
      else if (has(p, 'مباشرة بعد')) { line.add('next'); assert.equal(item.answer, `${n[3]! + 1}/${n[2]}`); assert.equal(n[4], n[2]); assert.equal(gcd(n[3]! + 1, n[2]!), 1); assert.ok(n[3]! + 1 < n[2]!); }
      else { line.add('mark'); const [d, k] = [n[2]!, n[3]!]; assert.equal(item.answer, `${k}/${d}`); assert.equal(gcd(k, d), 1); }
    }
    assert.equal(line.size, 3);
    const one = new Set<string>();
    for (const item of draws('fraction_equals_one')) {
      const p = item.promptAr!;
      if (has(p, 'أي الكسور')) {
        one.add('which');
        const list = p.slice(p.indexOf(':') + 1, p.indexOf('؟')).split('،').map(x => x.trim());
        assert.equal(list.filter(f => frac(f) === 1).length, 1, p);
        assert.ok(list.includes(item.answer) && frac(item.answer) === 1);
        item.wrongs.forEach(w => assert.notEqual(frac(w), 1, `${w} equals 1`));
      } else { one.add(has(p, 'شريط') ? 'strip' : 'blank'); assert.equal(Number(item.answer), nums(p).slice(-1)[0], p); }
    }
    assert.equal(one.size, 3);
    const nl2 = new Set<string>();
    for (const item of draws('number_line_g2')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'منتصف')) { nl2.add('half'); assert.equal(a, (n[0]! + n[1]!) / 2); }
      else if (has(p, 'أقسام متساوية')) { nl2.add('marks'); assert.equal(n[1], n[0]! + 100); assert.equal(a, n[0]! + ((n[1]! - n[0]!) / n[2]!) * n[3]!, p); }
      else if (has(p, 'مئتين')) { nl2.add('hundreds'); const [lo, hi] = nums(item.answer); assert.ok(lo! <= n[0]! && n[0]! < hi! && hi! - lo! === 100 && lo! % 100 === 0, p); }
      else { nl2.add('jumps'); assert.equal(a, n[0]! + n[1]! * n[2]!, p); assert.ok(n[1]! >= 3, `«قفزات» after ${n[1]}`); }
    }
    assert.equal(nl2.size, 4);
  });

  it('angles, lines, patterns and tables', () => {
    const PT: Record<string, number> = { 'القطعة المستقيمة': 2, 'الشعاع': 1, 'المستقيم': 0 };
    for (const item of draws('point_line_ray')) assert.equal(Number(item.answer), PT[item.eq]);
    const kindOf = (a: number) => (a < 90 ? 'حادة' : a === 90 ? 'قائمة' : 'منفرجة');
    const angles = new Set<string>();
    for (const item of draws('angle_kind_g3', 300)) {
      const p = item.promptAr!;
      if (has(p, 'أي القياسات')) {
        const want = p.match(/قياس زاوية (\S+):/)![1]!, list = nums(p.slice(p.indexOf(':')));
        angles.add(`which ${want}`);
        assert.equal(list.length, 4, p);
        assert.deepEqual(list.filter(a => kindOf(a) === want).map(a => `${a}°`), [item.answer], p);
        continue;
      }
      angles.add('name');
      const a = nums(p)[0]!; assert.equal(item.answer, kindOf(a));
    }
    assert.equal(angles.size, 4, [...angles].join(', '));
    const REL: Array<[string, string]> = [['لا يلتقيان', 'متوازيان'], ['زاوية التقاطع بينهما قائمة', 'متعامدان'], ['ليست قائمة', 'متقاطعان']];
    for (const id of ['lines_g3', 'lines_g4']) for (const item of draws(id)) assert.equal(item.answer, REL.find(([k]) => item.promptAr!.includes(k))![1]);
    for (const item of draws('angle_measure', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer.replace('°', ''));
      if (has(p, 'متجاورتان')) assert.equal(a, n[0]! + n[1]!); else if (has(p, 'على مستقيم')) assert.equal(a, 180 - n[0]!); else if (has(p, 'تتمم')) assert.equal(a, 90 - n[0]!); else assert.equal(a, n[0]! - n[1]!);
      assert.ok(a > 0);
    }
    const pat = new Set<string>();
    for (const item of draws('number_patterns_g4', 300)) {
      const p = item.promptAr!;
      if (has(p, 'العدد المفقود')) {
        pat.add('missing');
        const [s0, s1, s3] = nums(p), d = s1! - s0!;
        assert.equal(Number(item.answer), s1! + d, p); assert.equal(s3! - Number(item.answer), d, p);
        continue;
      }
      if (has(p, 'وقاعدته')) {
        pat.add('rule given');
        const [first, d] = nums(p), sign = has(p, '«أضف') ? 1 : -1;
        assert.ok(has(p, '«أضف') || has(p, '«اطرح'), p);
        assert.equal(Number(item.answer), first! + sign * 4 * d!, p); assert.ok(Number(item.answer) > 0, p);
        continue;
      }
      pat.add(has(p, 'قاعدة') ? 'rule' : 'next');
      const s = nums(p.slice(p.indexOf(':'))).slice(0, 4);
      const d = s[1]! - s[0]!, up = d > 0, rule = `${up ? '+' : '−'}${Math.abs(d)}`;
      const seqDiffs = [s[1]! - s[0]!, s[2]! - s[1]!, s[3]! - s[2]!];
      assert.ok(seqDiffs.every(x => x === d) || (!up && seqDiffs.every(x => x === seqDiffs[0])), p);
      if (has(p, 'قاعدة')) assert.equal(item.answer, rule); else assert.equal(Number(item.answer), s[3]! + (seqDiffs[0] ?? 0));
      assert.ok(s.every(v => v > 0) && Number(item.answer.replace(/[^\d]/g, '') || 1) > 0);
    }
    assert.equal(pat.size, 4);
    const io = new Set<string>();
    for (const item of draws('input_output', 300)) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما المدخل')) {
        const [, op, c] = p.match(/«(ضرب في|جمع) (\d+)»/)!, y = n[n.length - 1]!, x = Number(item.answer);
        io.add(`back ${op}`);
        assert.equal(op === 'جمع' ? x + Number(c) : x * Number(c), y, p);
        continue;
      }
      io.add(has(p, 'ما المخرج') ? 'output' : 'rule');
      const pairs = [...p.matchAll(/المدخل (\d+) ← المخرج (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      const mulC = pairs.every(([x, y]) => y % x === 0 && y / x === pairs[0]![1] / pairs[0]![0]) && pairs[0]![1] / pairs[0]![0] !== 1;
      const addC = pairs.every(([x, y]) => y - x === pairs[0]![1] - pairs[0]![0]);
      if (has(p, 'ما المخرج')) { const q = Number(p.match(/المدخل يكون? (\d+)|المدخل (\d+)\؟/)?.[0] ? nums(p.slice(p.indexOf('عندما')))[0] : n[n.length - 1]); const f = addC && !(mulC && pairs[0]![0] === 2 && pairs[0]![1] === 4) ? (x: number) => x + (pairs[0]![1] - pairs[0]![0]) : (x: number) => x * (pairs[0]![1] / pairs[0]![0]); assert.equal(Number(item.answer), f(q), p); }
      else { const c = mulC ? pairs[0]![1] / pairs[0]![0] : pairs[0]![1] - pairs[0]![0]; assert.equal(item.answer, mulC ? `ضرب في ${c}` : `جمع ${c}`, p); }
    }
    assert.equal(io.size, 4, [...io].join(', '));
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
    const halfKinds = new Set<string>();
    for (const item of draws('hour_half')) {
      const p = item.promptAr!;
      if (has(p, 'عقرب الساعات')) { halfKinds.add('hands'); const [h, nx, mark] = nums(p); assert.equal(nx, h! % 12 + 1); assert.equal(mark, 6); assert.equal(item.answer, `${h}:${String(mark! * 5).padStart(2, '0')}`); continue; }
      if (has(p, 'قبل نصف ساعة')) { halfKinds.add('before'); const h = Number(p.match(/(\d+):30/)![1]); assert.equal(mins(item.answer), (mins(`${h}:30`) - 30 + 720) % 720); continue; }
      halfKinds.add('after');
      const h = Number(p.match(/(\d+):00/)![1]); assert.equal(mins(item.answer), (mins(`${h}:00`) + 30) % 720);
    }
    assert.equal(halfKinds.size, 3);
    for (const [id, step] of [['time_5', 5], ['time_15', 15]] as const) {
      const kinds = new Set<string>();
      for (const item of draws(id, 400)) {
      const p = item.promptAr!;
      if (has(p, 'عقرب الساعات')) { kinds.add('hands'); const [h, nx, mark] = nums(p); assert.equal(nx, h! % 12 + 1); assert.equal(item.answer, `${h}:${String(mark! * 5).padStart(2, '0')}`); assert.equal((mark! * 5) % step, 0); assert.ok(mark! > 0 && mark! < 12); continue; }
      if (has(p, 'عقرب الدقائق')) { kinds.add('minutes'); const mark = nums(p)[0]!; assert.equal(Number(item.answer), mark * 5); assert.equal((mark * 5) % step, 0); continue; }
      kinds.add('nearest');
      const t = mins(item.eq), a = mins(item.answer);
      let best = Infinity, bestT = 0;
      for (let c = 0; c <= 720; c += step) { const d = Math.abs(c - t); if (d < best) { best = d; bestT = c % 720; } }
      assert.equal(a, bestT, `${item.eq} → ${item.answer}`);
      assert.ok(t % step !== 0 && Math.abs(t % step - step / 2) > 0, 'no tie');
      }
      assert.equal(kinds.size, 3, `${id}: ${[...kinds]}`);
    }
    for (const item of draws('months')) {
      const p = item.promptAr!, i = MONTHS.findIndex(m => p.includes(`شهر ${m}`));
      if (has(p, 'كم شهرًا')) assert.equal(item.answer, '12');
      else if (has(p, 'ترتيبه')) assert.equal(item.answer, MONTHS[Number(p.match(/ترتيبه (\d+)/)![1]) - 1]);
      else assert.equal(item.answer, MONTHS[(i + (has(p, 'بعد') ? 1 : 11)) % 12]);
    }
    const ampm = new Set<string>();
    for (const item of draws('am_pm')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كم ساعة')) { ampm.add('duration'); assert.equal(a, 12 - n[0]! + n[2]!); }
      else if (has(p, 'بنظام 24 ساعة. كم تكون')) { ampm.add('from 24'); assert.equal(a + 12, n[0]); assert.ok(a >= 1 && a <= 11); }
      else if (has(p, 'في أي ساعة بعد الظهر')) { ampm.add('ends'); assert.equal(a, n[0]! + n[2]! - 12, p); assert.ok(a >= 1 && a <= 11 && n[2]! >= 3, p); }
      else { ampm.add('to 24'); assert.equal(a, n[0]! + 12); }
    }
    assert.equal(ampm.size, 4);
    for (const item of draws('calendar')) {
      const p = item.promptAr!, n = nums(p), a = item.answer;
      if (has(p, 'كم يومًا')) assert.equal(Number(a), n[0]! * 7); else if (has(p, 'كم أسبوعًا')) assert.equal(Number(a) * 7, n[0]); else { const i = DAYS.findIndex(d => p.includes(`اليوم ${d}`)); assert.equal(a, DAYS[(i + n[0]!) % 7]); }
    }
  });

  it('comparing measures and Grade 2 units', () => {
    for (const id of ['compare_len', 'compare_mass', 'compare_cap']) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), v = Number(item.answer);
        assert.equal(new Set(n).size, n.length, p);
        if (has(p, 'ثلاثة أشياء')) { const up = has(p, 'تصاعديًا'); kinds.add(`order ${up}`); assert.equal(n.length, 3); assert.equal(v, up ? Math.min(...n) : Math.max(...n)); continue; }
        const [a, b] = n;
        kinds.add(has(p, 'بكم') ? 'difference' : 'larger');
        assert.equal(v, has(p, 'بكم') ? Math.abs(a! - b!) : Math.max(a!, b!));
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
    for (const item of draws('cm_lengths', 300)) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'معًا')) assert.equal(a, n[0]! + n[1]!); else if (has(p, 'بكم')) assert.equal(a, n[0]! - n[1]!); else assert.equal(a, n[0]! * 2);
    }
    for (const [id, f] of [['units_m_g2', 100], ['units_kg_g2', 1000], ['units_l_g2', 1000]] as const) {
      const kinds = new Set<string>(), big = ['متر', 'كيلوغرام', 'لتر'][id === 'units_m_g2' ? 0 : id === 'units_kg_g2' ? 1 : 2];
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p), a = Number(item.answer);
        assert.equal(n[0], 1); assert.equal(n[1], f);
        if (has(p, 'نضيف')) { kinds.add('complete'); assert.equal(a + n[2]!, f * n[3]!); assert.equal(n[3], 1); assert.ok(n[2]! > 0 && n[2]! < f); }
        else if (has(p, ` ${big} و `)) { kinds.add('mixed'); assert.equal(a, n[2]! * f + n[3]!); assert.ok(n[3]! < f); }
        else if (has(p, 'في ' + n[2] + ' ' + big)) { kinds.add('to small'); assert.equal(a, n[2]! * f); }
        else { kinds.add('to big'); assert.equal(a * f, n[2]); }
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
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
