/**
 * Grade 4 second pass (review, 2026-11-21): the generators were run over all 50 Grade 4 maths
 * lessons and each quiz was read against its NCCD objective. Every key was right; these are the
 * places where a lesson did not ask its own skill.
 *
 * - «قسمة الأعداد» (u3_l3) says «من دون باقٍ» and «مع باقٍ» and drew no remainder in 300 items;
 *   «القسمة مع وجود أصفار في الناتج» (u3_l4) drew the same bank, so «174 ÷ 6» had no zero.
 * - «أجزاء العشرة», «أجزاء المئة» and «التحويل بين الكسور والأعداد العشرية» shared one generator:
 *   the tenths lesson asked «0.25» and «1/25».
 * - «مقارنة الكسور والأعداد الكسرية» never drew a mixed number.
 * - «مقارنة الأعداد وترتيبها» says «ضمن مئات الألوف» and never drew six digits (and drew 91).
 * - «تقدير المجموع والفرق» drew 3-digit numbers, rounded to tens and hundreds only.
 * - «الزمن» («أُحوّل بين وحدات قياس الزمن») asked start and end times, which Grade 3 teaches.
 * - «المحيط» is «المربع أو المستطيل»; a third of its items were triangles.
 * - «المساحة» («أستعمل شبكة المربعات لتقدير…») never estimated; «قياس الزوايا» never read a protractor.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { makeElementaryItem } from '../elementary.ts';
import type { ConcreteItem, DiffTier } from '../index.ts';

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
function draws(id: string, grade = 4, n = 400): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 29)));
}
const lesson = (title: string, grade = 4, n = 300) =>
  Array.from({ length: n }, (_, i) => makeElementaryItem(title, grade, TIERS[i % 3]!, new Set(), seeded(i * 104729 + 5)));
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const p = (i: ConcreteItem) => i.promptAr ?? i.eq;
const val = (s: string): number => {
  const t = s.trim().replace('−', '-');
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return Number(t);
};
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const distinct3 = (i: ConcreteItem, w = p(i)) => {
  assert.equal(i.wrongs.length, 3, w);
  assert.equal(new Set([i.answer, ...i.wrongs]).size, 4, w);
};

describe('Grade 4 second pass (review, 2026-11-21): each lesson asks its own skill', () => {
  it('routing: the new generators serve Grade 4 only', () => {
    for (const [title, id] of [
      ['قسمة الأعداد', 'div_g4'], ['القسمة مع وجود أصفار في الناتج', 'div_zeros_g4'],
      ['أجزاء العشرة', 'tenths_g4'], ['أجزاء المئة', 'hundredths_g4'],
      ['التحويل بين الكسور والأعداد العشرية', 'dec_convert_g4'],
      ['مقارنة الكسور والأعداد الكسرية وترتيبها', 'frac_compare_g4'], ['الزمن', 'time_units_g4'],
    ] as const) assert.equal(topicFor(title, 4)?.id, id, title);
    assert.equal(topicFor('الزمن', 5)?.id, 'time_g45');
    assert.notEqual(topicFor('قسمة الأعداد', 5)?.id, 'div_g4');
    assert.equal(topicFor('أجزاء المئة', 5)?.id, 'frac_dec');
  });

  it('«قسمة الأعداد»: three digits by one, half of it with a remainder, every key recomputed', () => {
    let withRem = 0;
    const items = draws('div_g4');
    for (const item of items) {
      const s = p(item), n = nums(s);
      let want: number | null = null, rem = 0, a = 0, b = 0;
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^أوجد ناتج: (\d+) ÷ (\d+)$/))) { a = +m[1]!; b = +m[2]!; assert.equal(a % b, 0, s); want = a / b; }
      else if ((m = s.match(/^ما خارج قسمة (\d+) على (\d+)؟/))) { a = +m[1]!; b = +m[2]!; want = Math.floor(a / b); rem = a % b; assert.ok(rem > 0, s); }
      else if ((m = s.match(/^ما الباقي عند قسمة (\d+) على (\d+)؟/))) { a = +m[1]!; b = +m[2]!; want = a % b; rem = want; assert.ok(rem > 0, s); }
      else if (/كم رفًّا امتلأ/.test(s)) { a = n[0]!; b = n[1]!; want = Math.floor(a / b); rem = a % b; }
      else if (/كم كتابًا بقي/.test(s)) { a = n[0]!; b = n[1]!; want = a % b; rem = want; assert.ok(rem > 0, s); }
      else if ((m = s.match(/^قُسم عدد على (\d+) فكان الخارج (\d+) والباقي (\d+)\. ما العدد؟$/))) { b = +m[1]!; want = b * +m[2]! + +m[3]!; rem = +m[3]!; assert.ok(rem < b, s); a = want; }
      else if ((m = s.match(/^أوجد العدد المجهول: (\d+) ÷ ؟ = (\d+)$/))) { a = +m[1]!; want = a / +m[2]!; assert.ok(Number.isInteger(want), s); b = want; }
      else if ((m = s.match(/^أوجد العدد المجهول: ؟ ÷ (\d+) = (\d+)$/))) { b = +m[1]!; want = b * +m[2]!; a = want; }
      else assert.fail(`unrecognised stem: ${s}`);
      assert.equal(Number(item.answer), want, s);
      assert.ok(a >= 10 && a <= 999 && b >= 2 && b <= 9, `outside «3 منازل على الأكثر» ÷ one digit: ${s}`);
      if (rem > 0) withRem += 1;
      distinct3(item);
    }
    assert.ok(withRem >= items.length * 0.4, `only ${withRem} of ${items.length} items have a remainder`);
  });

  it('«القسمة مع وجود أصفار في الناتج»: every quotient has a zero, three digits by one, exact', () => {
    let middle = 0;
    for (const item of draws('div_zeros_g4')) {
      const s = p(item);
      let m: RegExpMatchArray | null;
      let a = 0, b = 0, q = 0, want = '';
      if ((m = s.match(/^أوجد ناتج: (\d+) ÷ (\d+)$/))) { a = +m[1]!; b = +m[2]!; q = a / b; want = String(q); }
      else if ((m = s.match(/^كم صفرًا في ناتج (\d+) ÷ (\d+)؟$/))) { a = +m[1]!; b = +m[2]!; q = a / b; want = String((String(q).match(/0/g) ?? []).length); }
      else if ((m = s.match(/^ما رقم (الآحاد|العشرات) في ناتج (\d+) ÷ (\d+)؟$/))) { a = +m[2]!; b = +m[3]!; q = a / b; const d = String(q).split('').reverse(); want = d[m[1] === 'الآحاد' ? 0 : 1]!; }
      else if ((m = s.match(/^حلّ سامر (\d+) ÷ (\d+) فكتب (\d+)\. ما الناتج الصحيح؟$/))) { a = +m[1]!; b = +m[2]!; q = a / b; want = String(q); assert.notEqual(m[3], String(q), s); }
      else if ((m = s.match(/^وُزّعت (\d+) (?:قطع|قطعةً|قطعة) من الحلوى بالتساوي على (\d+) صناديق\. كم قطعة في كل صندوق؟$/))) { a = +m[1]!; b = +m[2]!; q = a / b; want = String(q); }
      else if ((m = s.match(/^أوجد العدد المجهول: ؟ ÷ (\d+) = (\d+)$/))) { b = +m[1]!; q = +m[2]!; a = b * q; want = String(a); }
      else assert.fail(`unrecognised stem: ${s}`);
      assert.ok(Number.isInteger(q) && String(q).includes('0'), `no zero in the quotient: ${s}`);
      assert.ok(a >= 100 && a <= 999 && b >= 2 && b <= 9, s);
      assert.equal(item.answer, want, s);
      if (/^\d0\d$/.test(String(q))) middle += 1;
      distinct3(item);
    }
    assert.ok(middle >= 40, `only ${middle} items have a zero between two digits (103, 207…)`);
  });

  const decimals = (s: string) => [...s.matchAll(/(?<![\d/])\d+\.(\d+)/g)].map(m => m[1]!.length);

  it('«أجزاء العشرة» is tenths only: one decimal place, denominator 10', () => {
    const kinds = new Set<string>();
    for (const item of draws('tenths_g4')) {
      const s = p(item);
      for (const d of decimals(s)) assert.equal(d, 1, `not tenths: ${s}`);
      for (const m of s.matchAll(/(\d+)\/(\d+)/g)) assert.equal(m[2], '10', `not tenths: ${s}`);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اكتب الكسر (\d)\/10 على صورة عدد عشري\.$/))) { kinds.add('frac→dec'); assert.equal(item.answer, `0.${m[1]}`, s); }
      else if ((m = s.match(/^اكتب العدد العشري 0\.(\d) على صورة كسر مقامه 10\.$/))) { kinds.add('dec→frac'); assert.equal(item.answer, `${m[1]}/10`, s); }
      else if ((m = s.match(/^اكتب العدد الآتي بالصيغة القياسية: (\d+) \+ 0\.(\d)$/))) { kinds.add('standard'); assert.equal(item.answer, `${m[1]}.${m[2]}`, s); }
      else if ((m = s.match(/^ما القيمة المنزلية للرقم (\d) في العدد (\d+)\.(\d)؟$/))) { kinds.add('place'); assert.equal(m[1], m[3], s); assert.notEqual(m[1], m[2], s); assert.equal(item.answer, `0.${m[1]}`, s); }
      else if ((m = s.match(/^كيف يُقرأ العدد 0\.(\d)؟$/))) { kinds.add('words'); const n = +m[1]!; assert.equal(item.answer, n === 1 ? 'جزء واحد من عشرة' : n === 2 ? 'جزءان من عشرة' : `${n} أجزاء من عشرة`, s); }
      else if ((m = s.match(/^قُسّمت المسافة بين (\d+) و (\d+) على خط الأعداد إلى 10 أجزاء متساوية\. ما العدد العشري الذي يدل على النقطة الواقعة بعد (\d) أجزاء من (?:الصفر|\d+)؟$/))) {
        kinds.add('number line'); assert.equal(+m[2]!, +m[1]! + 1, s); assert.equal(item.answer, `${m[1]}.${m[3]}`, s);
      }
      else if ((m = s.match(/^ما الرقم الذي في منزلة الأجزاء من عشرة في العدد (\d+)\.(\d)؟$/))) { kinds.add('tenths digit'); assert.equal(item.answer, m[2], s); }
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(kinds.size >= 6, [...kinds].join());
  });

  it('«أجزاء المئة» is hundredths: two decimal places, denominator 100', () => {
    const kinds = new Set<string>();
    for (const item of draws('hundredths_g4')) {
      const s = p(item);
      // an expanded form «6 + 0.8 + 0.01» has a tenths term too; the largest place is hundredths
      const ds = decimals(s);
      if (ds.length) assert.ok(Math.max(...ds) === 2 && ds.every(d => d <= 2), `not hundredths: ${s}`);
      for (const m of s.matchAll(/(\d+)\/(\d+)/g)) assert.equal(m[2], '100', `not hundredths: ${s}`);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اكتب الكسر (\d+)\/100 على صورة عدد عشري\.$/))) { kinds.add('frac→dec'); const n = +m[1]!; assert.ok(n % 10 !== 0 && n < 100, s); assert.equal(item.answer, (n / 100).toFixed(2), s); }
      else if ((m = s.match(/^اكتب العدد الآتي بالصيغة القياسية: (\d+) \+ 0\.(\d) \+ 0\.0(\d)$/))) { kinds.add('standard'); assert.equal(item.answer, `${m[1]}.${m[2]}${m[3]}`, s); }
      else if ((m = s.match(/^اكتب العدد (\d+)\.(\d)(\d) بالصيغة التحليلية\.$/))) { kinds.add('expanded'); assert.equal(item.answer, `${m[1]} + 0.${m[2]} + 0.0${m[3]}`, s); }
      else if ((m = s.match(/^ما القيمة المنزلية للرقم (\d) في العدد (\d+)\.(\d)(\d)؟$/))) {
        kinds.add('place'); const [, d, w, a, b] = m; assert.equal(new Set([w, a, b]).size, 3, s);
        assert.equal(item.answer, d === a ? `0.${a}` : d === b ? `0.0${b}` : 'x', s);
      }
      else if ((m = s.match(/^كيف يُقرأ العدد 0\.(\d\d)؟$/))) { kinds.add('words'); const n = +m[1]!; assert.equal(item.answer, n === 1 ? 'جزء واحد من مئة' : n === 2 ? 'جزءان من مئة' : n <= 10 ? `${n} أجزاء من مئة` : `${n} جزءًا من مئة`, s); }
      else if ((m = s.match(/^ما الرقم الذي في منزلة الأجزاء من مئة في العدد (\d+)\.(\d)(\d)؟$/))) { kinds.add('hundredths digit'); assert.equal(item.answer, m[3], s); }
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(kinds.size >= 5, [...kinds].join());
  });

  it('«التحويل بين الكسور والأعداد العشرية» only converts, and every key is equal in value', () => {
    const kinds = new Set<string>();
    for (const item of draws('dec_convert_g4')) {
      const s = p(item);
      assert.doesNotMatch(s, /القيمة المنزلية|بالصيغة|منزلة/, s);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اكتب الكسر (\d+)\/(\d+) على صورة عدد عشري\.$/))) { kinds.add('frac→dec'); assert.ok(same(Number(item.answer), +m[1]! / +m[2]!), s); }
      else if ((m = s.match(/^اكتب العدد العشري (\d+\.\d+) على صورة كسر في أبسط صورة\.$/))) {
        kinds.add('dec→frac'); const [n, d] = item.answer.split('/').map(Number); assert.ok(same(n! / d!, Number(m[1])), s);
        const g = (x: number, y: number): number => (y ? g(y, x % y) : x); assert.equal(g(n!, d!), 1, `not simplest: ${item.answer}`);
      }
      else if ((m = s.match(/^اكتب العدد الكسري (\d+) (\d+)\/(\d+) على صورة عدد عشري\.$/))) { kinds.add('mixed→dec'); assert.ok(same(Number(item.answer), +m[1]! + +m[2]! / +m[3]!), s); }
      else if ((m = s.match(/^اكتب العدد العشري (\d+\.\d+) على صورة عدد كسري في أبسط صورة\.$/))) { kinds.add('dec→mixed'); assert.ok(same(val(item.answer), Number(m[1])), s); assert.match(item.answer, /^\d+ \d+\/\d+$/, s); }
      else if ((m = s.match(/^أيّ الأعداد العشرية الآتية يساوي الكسر (\d+)\/(\d+): /))) { kinds.add('which'); assert.ok(same(Number(item.answer), +m[1]! / +m[2]!), s); }
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(kinds.size >= 5, [...kinds].join());
  });

  it('«مقارنة الكسور والأعداد الكسرية وترتيبها» draws mixed numbers, and every key is by value', () => {
    const items = draws('frac_compare_g4');
    let withMixed = 0;
    const NUM = String.raw`(?:\d+ \d+\/\d+|\d+\/\d+)`;
    for (const item of items) {
      const s = p(item);
      const list = [...s.slice(s.indexOf(':') + 1).matchAll(new RegExp(NUM, 'g'))].map(m => m[0]);
      if (list.some(x => /^\d+ /.test(x))) withMixed += 1;
      const vs = list.map(val);
      if (/^ضع الإشارة/.test(s)) {
        // two numbers, three signs: «2 1/2 ___ 5/2» is a real «=» item
        assert.equal(vs.length, 2, s);
        const sign = same(vs[0]!, vs[1]!) ? '=' : vs[0]! > vs[1]! ? '>' : '<';
        assert.equal(item.answer, sign, s);
        assert.deepEqual([...item.wrongs].sort(), ['>', '<', '='].filter(x => x !== sign).sort(), s);
        continue;
      }
      assert.equal(new Set(vs.map(v => v.toFixed(9))).size, vs.length, `equal values: ${s}`);
      if (/الأكبر/.test(s)) assert.ok(same(val(item.answer), Math.max(...vs)), s);
      else if (/الأصغر/.test(s)) assert.ok(same(val(item.answer), Math.min(...vs)), s);
      else if (/^رتّب/.test(s)) {
        const asc = /تصاعديًّا/.test(s), sorted = [...vs].sort((x, y) => (asc ? x - y : y - x));
        const got = item.answer.split('، ').map(val);
        assert.deepEqual(got.map(v => v.toFixed(9)), sorted.map(v => v.toFixed(9)), s);
      } else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(withMixed >= items.length * 0.35, `only ${withMixed} of ${items.length} items hold a mixed number`);
  });

  it('«مقارنة الأعداد وترتيبها» at Grade 4 uses five- and six-digit numbers', () => {
    let six = 0;
    const items = lesson('مقارنة الأعداد وترتيبها');
    for (const item of items) {
      const s = p(item);
      if (/الأرقام/.test(s)) continue; // «أكبر عدد يمكن تكوينه من الأرقام …» lists digits
      for (const n of nums(s)) assert.ok(n >= 10000 && n <= 999999, `outside «ضمن مئات الألوف»: ${s}`);
      if (nums(s).some(n => n >= 100000)) six += 1;
    }
    assert.ok(six >= items.length * 0.2, `only ${six} items have six digits`);
  });

  it('«تقدير المجموع والفرق» at Grade 4 rounds four- to six-digit numbers to 100, 1000 or 10000', () => {
    const items = draws('est_sum');
    const places = new Set<string>();
    let big = 0;
    for (const item of items) {
      const s = p(item);
      for (const n of nums(s)) assert.ok(n <= 999999, s);
      const m = s.match(/^قدّر ناتج (\d+) ([+−]) (\d+) بتقريب كل عدد إلى أقرب (عشرة آلاف|ألف|مئة|عشرة)\.$/);
      if (m) {
        const P = { 'عشرة آلاف': 10000, 'ألف': 1000, 'مئة': 100, 'عشرة': 10 }[m[4]!]!;
        places.add(m[4]!);
        const r = (x: number) => Math.round(x / P) * P;
        assert.equal(Number(item.answer), m[2] === '+' ? r(+m[1]!) + r(+m[3]!) : r(+m[1]!) - r(+m[3]!), s);
        assert.ok(+m[1]! >= 1000, `a Grade 4 estimate starts at four digits: ${s}`);
      }
      if (nums(s).some(n => n >= 10000)) big += 1;
    }
    assert.ok(places.has('ألف') && places.has('عشرة آلاف'), [...places].join());
    assert.ok(big >= items.length * 0.4, `only ${big} items reach five digits`);
  });

  it('«الزمن» at Grade 4 converts units of time: no start or end times', () => {
    // seconds per unit, on one scale; months and years on another
    const NAME: Array<[RegExp, string]> = [[/^ساع/, 'h'], [/^دقيق|^دقائق/, 'min'], [/^ثوان|^ثانية/, 'sec'], [/^يوم|^أيام/, 'd'], [/^أسبوع|^أسابيع/, 'w'], [/^شهر|^أشهر/, 'mo'], [/^سنة|^سنوات/, 'y']];
    const SCALE: Record<string, [string, number]> = { sec: ['time', 1], min: ['time', 60], h: ['time', 3600], d: ['time', 86400], w: ['time', 604800], mo: ['cal', 1], y: ['cal', 12] };
    const unit = (w: string) => NAME.find(([re]) => re.test(w))?.[1];
    const kinds = new Set<string>();
    for (const item of draws('time_units_g4')) {
      const s = p(item);
      assert.doesNotMatch(s, /الساعة \d|متى|انتهى|بدأ/, `a clock time is Grade 3's: ${s}`);
      const target = unit(s.match(/كم (\S+)/)![1]!)!;
      assert.ok(target, s);
      const parts = [...s.matchAll(/(\d+) (\S+)/g)].map(m => ({ n: +m[1]!, u: unit(m[2]!)! }));
      assert.ok(parts.length >= 1 && parts.every(x => x.u), s);
      assert.ok(parts.every(x => SCALE[x.u]![0] === SCALE[target]![0]), `mixed families: ${s}`);
      const total = parts.reduce((t, x) => t + x.n * SCALE[x.u]![1], 0);
      assert.ok(same(Number(item.answer), total / SCALE[target]![1]), `${s} → ${item.answer}`);
      assert.ok(Number.isInteger(total / SCALE[target]![1]), s);
      kinds.add(parts.length > 1 ? 'mixed' : SCALE[parts[0]!.u]![1] > SCALE[target]![1] ? 'big→small' : 'small→big');
      distinct3(item);
    }
    assert.deepEqual([...kinds].sort(), ['big→small', 'mixed', 'small→big']);
  });

  it('«المحيط» at Grade 4 is the square or rectangle: no triangle, a missing side, an L, a grid', () => {
    const kinds = new Set<string>();
    for (const item of draws('perimeter')) {
      const s = p(item);
      assert.doesNotMatch(s, /مثلث/, `a triangle is Grade 3's: ${s}`);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^ما محيط مستطيل طوله (\d+) سم وعرضه (\d+) سم؟$/))) { kinds.add('rect'); assert.equal(+item.answer, 2 * (+m[1]! + +m[2]!), s); }
      else if ((m = s.match(/^ما محيط مربع طول ضلعه (\d+) سم؟$/))) { kinds.add('square'); assert.equal(+item.answer, 4 * +m[1]!, s); }
      else if ((m = s.match(/^محيط مستطيل (\d+) سم وطوله (\d+) سم\. ما عرضه؟$/))) { kinds.add('missing'); assert.equal(+item.answer, +m[1]! / 2 - +m[2]!, s); }
      else if ((m = s.match(/^محيط مربع (\d+) سم\. ما طول ضلعه؟$/))) { kinds.add('square side'); assert.equal(+item.answer, +m[1]! / 4, s); }
      else if ((m = s.match(/^شكل على صورة حرف L، يمكن رسمه داخل مستطيل طوله (\d+) سم وعرضه (\d+) سم بعد قصّ مربع من إحدى زواياه\. ما محيطه بالسنتيمتر؟$/))) { kinds.add('L'); assert.equal(+item.answer, 2 * (+m[1]! + +m[2]!), s); }
      else if ((m = s.match(/^مستطيل مرسوم على شبكة مربعات، طوله (\d+) مربعات وعرضه (\d+) مربعات، وطول ضلع كل مربع 1 سم\. ما محيطه بالسنتيمتر؟$/))) { kinds.add('grid'); assert.equal(+item.answer, 2 * (+m[1]! + +m[2]!), s); }
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    for (const k of ['rect', 'square', 'missing', 'L', 'grid']) assert.ok(kinds.has(k), `${k} not drawn: ${[...kinds]}`);
  });

  it('…and Grade 3 keeps its triangle', () => {
    assert.ok(draws('perimeter', 3).some(i => /مثلث/.test(p(i))));
  });

  it('«المساحة» at Grade 4 estimates the area of an irregular shape on a grid', () => {
    let est = 0;
    for (const item of draws('area_rect')) {
      const m = p(item).match(/^غُطّي شكل غير منتظم على شبكة مربعات بـ (\d+) مربعًا كاملًا و (\d+) مربعات غير كاملة\. قدّر مساحته بالمربعات الوحدة، علمًا أن كل مربعين غير كاملين يُعدّان مربعًا واحدًا\.$/);
      if (!m) continue;
      est += 1;
      assert.equal(+m[2]! % 2, 0);
      assert.equal(+item.answer, +m[1]! + +m[2]! / 2, p(item));
    }
    assert.ok(est >= 25, `only ${est} of 400 estimate a shape`);
  });

  it('«قياس الزوايا ورسمها» reads and draws with a protractor', () => {
    const items = draws('angle_measure');
    let protractor = 0;
    for (const item of items) {
      const s = p(item);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^وُضعت المنقلة على زاوية بحيث ينطبق أحد ضلعيها على العدد 0، ويمرّ الضلع الآخر بالعدد (\d+) على التدريج نفسه\. ما قياس الزاوية؟$/))) assert.equal(item.answer, `${m[1]}°`, s);
      else if ((m = s.match(/^ينطبق ضلعا زاوية على المنقلة عند العددين (\d+) و (\d+) على التدريج نفسه\. ما قياس الزاوية؟$/))) assert.equal(item.answer, `${Math.abs(+m[1]! - +m[2]!)}°`, s);
      else if ((m = s.match(/^قرأ طالب قياس زاوية حادة على المنقلة فكانت القراءتان على التدريجين (\d+)° و (\d+)°\. ما قياس الزاوية؟$/))) { assert.equal(+m[1]! + +m[2]!, 180, s); assert.equal(item.answer, `${Math.min(+m[1]!, +m[2]!)}°`, s); }
      else if ((m = s.match(/^لرسم زاوية قياسها (\d+)° بالمنقلة بعد وضع مركزها على رأس الزاوية وقاعدتها على أحد الضلعين، عند أي عدد على التدريج الذي يبدأ من الصفر نعلّم النقطة؟$/))) assert.equal(item.answer, `${m[1]}°`, s);
      else continue;
      protractor += 1;
      distinct3(item);
    }
    assert.ok(protractor >= items.length * 0.3, `only ${protractor} protractor items`);
  });
});
