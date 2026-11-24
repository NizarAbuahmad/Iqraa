/**
 * Grade 5 second pass (review, 2026-11-24): the generators were run over all 52 Grade 5 maths
 * lessons and each quiz was read against its NCCD objective and key concepts. Every key was
 * right; these are the places where a lesson did not ask its own skill.
 *
 * - «مقارنة الأعداد وترتيبها» says «ضمن الملايين» and «جمع الأعداد الكلية وطرحها» «ضمن 7 منازل»:
 *   neither drew a seven-digit number (the compare lesson drew 5 and 6 digits, and 1-digit stems).
 * - «الأعداد السالبة» («أُعيّنه على خط الأعداد») never used a number line.
 * - «مقارنة الكسور والأعداد الكسرية», «جمع الكسور» («أعدادًا كسرية غير متشابهة») and «طرح الكسور
 *   والأعداد الكسرية» never drew a mixed number; «ضرب الكسور» printed «3/8 × 2/2».
 * - «أجزاء الألف» and «التحويل بين الكسور والأعداد العشرية» shared one generator.
 * - «ضرب الأعداد العشرية وقسمتها» («في 10، 100، 1000») drew decimal × decimal three times in four.
 * - «الزمن» (key concept «توقيت 24 ساعة») never wrote a time past 12:59.
 * - «الانسحاب» printed «و وحدتين».
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
function draws(id: string, grade = 5, n = 400): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 31)));
}
const lesson = (title: string, grade = 5, n = 300) =>
  Array.from({ length: n }, (_, i) => makeElementaryItem(title, grade, TIERS[i % 3]!, new Set(), seeded(i * 104729 + 7)));
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
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const distinct3 = (i: ConcreteItem, w = p(i)) => {
  assert.equal(i.wrongs.length, 3, w);
  assert.equal(new Set([i.answer, ...i.wrongs]).size, 4, w);
};
const NUM = '(\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d+)'; // longest first: «1 1/2» before «1»
/** «3 1/4», «5/6» or «2»: written the way a Grade 5 book writes it — a proper fraction part, in lowest terms. */
const simplest = (s: string) => {
  const m = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (!m) return /^\d+$/.test(s);
  return +m[2]! < +m[3]! && gcd(+m[2]!, +m[3]!) === 1;
};

describe('Grade 5 second pass (review, 2026-11-24): each lesson asks its own skill', () => {
  it('routing: the new generators serve Grade 5 only', () => {
    for (const [title, id] of [
      ['أجزاء الألف', 'thousandths_g5'], ['التحويل بين الكسور والأعداد العشرية', 'dec_convert_g5'],
      ['مقارنة الكسور والأعداد الكسرية وترتيبها', 'frac_compare_g5'], ['جمع الكسور', 'frac_add_g5'],
      ['طرح الكسور', 'frac_sub_g5'], ['ضرب الأعداد العشرية وقسمتها', 'dec_shift_g5'], ['الزمن', 'time_24h_g5'],
    ] as const) assert.equal(topicFor(title, 5)?.id, id, title);
    assert.equal(topicFor('الزمن', 4)?.id, 'time_units_g4');
    assert.equal(topicFor('التحويل بين الكسور والأعداد العشرية', 4)?.id, 'dec_convert_g4');
    assert.equal(topicFor('أجزاء الألف', 6)?.id, 'frac_dec');
    assert.notEqual(topicFor('جمع الكسور', 6)?.id, 'frac_add_g5');
  });

  it('«مقارنة الأعداد وترتيبها» says «ضمن الملايين»: six and seven digits, never a one-digit stem', () => {
    const items = lesson('مقارنة الأعداد وترتيبها');
    let seven = 0;
    for (const item of items) {
      const s = p(item);
      if (/من الأرقام/.test(s)) { assert.ok(item.answer.length >= 6, s); if (item.answer.length >= 7) seven += 1; continue; }
      const ns = s.match(/\d+/g) ?? [];
      assert.ok(ns.length >= 2, s);
      for (const n of ns) assert.ok(n.length >= 6 && n.length <= 7, `${n.length} digits: ${s}`);
      if (ns.some(n => n.length === 7)) seven += 1;
    }
    assert.ok(seven >= items.length * 0.3, `only ${seven} of ${items.length} items reach seven digits`);
  });

  it('«جمع الأعداد الكلية وطرحها» says «ضمن 7 منازل»: sums stay within seven digits and seven digits are drawn', () => {
    const items = lesson('جمع الأعداد الكلية وطرحها');
    let seven = 0;
    for (const item of items) {
      const s = p(item);
      for (const n of s.match(/\d+/g) ?? []) assert.ok(n.length <= 7, s);
      assert.ok(String(item.answer).replace(/\D/g, '').length <= 7, s);
      if ((s.match(/\d+/g) ?? []).some(n => n.length === 7) || String(item.answer).length === 7) seven += 1;
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^أوجد ناتج: (\d+) ([+−]) (\d+)$/))) assert.equal(Number(item.answer), m[2] === '+' ? +m[1]! + +m[3]! : +m[1]! - +m[3]!, s);
      distinct3(item);
    }
    assert.ok(seven >= items.length * 0.25, `only ${seven} of ${items.length} items reach seven digits`);
  });

  it('«الأعداد السالبة»: the number line is used, and every comparison has a negative number', () => {
    const items = draws('int_intro');
    let line = 0;
    for (const item of items) {
      const s = p(item);
      let m: RegExpMatchArray | null;
      if (/خط الأعداد/.test(s)) {
        line += 1;
        if ((m = s.match(/ابدأ من العدد (−?\d+) وتحرّك (\d+) وحد(?:ات|ة) إلى (اليمين|اليسار)/))) {
          const a = +m[1]!.replace('−', '-'), k = +m[2]!;
          assert.equal(item.answer.replace('−', '-'), String(a + (m[3] === 'اليمين' ? k : -k)), s);
        } else if ((m = s.match(/أيّ العددين الآتيين يقع إلى (يسار|يمين) الآخر على خط الأعداد: (−?\d+) أم (−?\d+)؟/))) {
          const a = +m[2]!.replace('−', '-'), b = +m[3]!.replace('−', '-');
          assert.equal(item.answer.replace('−', '-'), String(m[1] === 'يسار' ? Math.min(a, b) : Math.max(a, b)), s);
          assert.ok(a < 0 || b < 0, s);
        } else if ((m = s.match(/ما العدد الصحيح الذي يقع بين (−?\d+) و (−?\d+) على خط الأعداد؟/))) {
          const a = +m[1]!.replace('−', '-'), b = +m[2]!.replace('−', '-');
          assert.equal(b - a, 2, s);
          assert.equal(item.answer.replace('−', '-'), String(a + 1), s);
        } else if ((m = s.match(/تبعد النقطة A (\d+) وحد(?:ات|ة) عن الصفر إلى (اليمين|اليسار) على خط الأعداد/))) {
          assert.equal(item.answer.replace('−', '-'), String(m[2] === 'اليسار' ? -+m[1]! : +m[1]!), s);
        } else assert.fail(`unrecognised number-line stem: ${s}`);
        distinct3(item);
      }
      if (/ضع الإشارة/.test(s)) assert.match(s, /−/, s);
    }
    assert.ok(line >= items.length * 0.25, `only ${line} of ${items.length} items use the number line`);
  });

  it('«مقارنة الكسور والأعداد الكسرية»: mixed numbers are compared, every key recomputed', () => {
    const items = draws('frac_compare_g5');
    let mix = 0;
    for (const item of items) {
      const s = p(item);
      if (/\d+ \d+\/\d+/.test(s)) mix += 1;
      let m: RegExpMatchArray | null;
      if ((m = s.match(new RegExp(`^ضع الإشارة المناسبة \\(> أو < أو =\\):\\n${NUM} ___ ${NUM}$`)))) {
        const a = val(m[1]!), b = val(m[2]!);
        assert.equal(item.answer, same(a, b) ? '=' : a > b ? '>' : '<', s);
      } else if ((m = s.match(/^ما (?:الكسر|العدد) (الأكبر|الأصغر) بين (?:الكسور|الأعداد) الآتية: (.+)؟$/))) {
        const xs = m[2]!.split('،').map(x => x.trim()), vs = xs.map(val);
        assert.equal(val(item.answer), m[1] === 'الأكبر' ? Math.max(...vs) : Math.min(...vs), s);
      } else if ((m = s.match(/^رتّب (?:الكسور|الأعداد) الآتية (تصاعديًّا|تنازليًّا): (.+)$/))) {
        const xs = m[2]!.split('،').map(x => x.trim());
        const want = xs.map(val).sort((a, b) => (m![1] === 'تصاعديًّا' ? a - b : b - a));
        assert.deepEqual(item.answer.split('،').map(x => val(x.trim())), want, s);
      } else assert.fail(`unrecognised stem: ${s}`);
    }
    assert.ok(mix >= items.length * 0.4, `only ${mix} of ${items.length} items hold a mixed number`);
  });

  it('«جمع الكسور»: unlike fractions and unlike mixed numbers, answers in lowest terms', () => {
    const items = draws('frac_add_g5');
    let mix = 0;
    for (const item of items) {
      const s = p(item);
      if (/\d+ \d+\/\d+/.test(s)) mix += 1;
      let m: RegExpMatchArray | null;
      if ((m = s.match(new RegExp(`^أوجد ناتج: ${NUM} \\+ ${NUM}`)))) {
        assert.ok(same(val(item.answer), val(m[1]!) + val(m[2]!)), s);
        assert.ok(simplest(item.answer), `${item.answer}: ${s}`);
      } else if ((m = s.match(new RegExp(`^اشترت \\S+ ${NUM} كغ من التفاح، و ?${NUM} كغ من البرتقال`)))) {
        assert.ok(same(val(item.answer), val(m[1]!) + val(m[2]!)), s);
        assert.ok(simplest(item.answer), `${item.answer}: ${s}`);
      } else if ((m = s.match(new RegExp(`^أوجد العدد المجهول: ${NUM} \\+ ؟ = ${NUM}$`)))) {
        assert.ok(same(val(item.answer), val(m[2]!) - val(m[1]!)), s);
        assert.ok(simplest(item.answer), `${item.answer}: ${s}`);
      } else if ((m = s.match(/^ما المقام المشترك الأصغر للكسرين (\d+)\/(\d+) و (\d+)\/(\d+)؟$/))) {
        const d1 = +m[2]!, d2 = +m[4]!;
        assert.equal(Number(item.answer), (d1 / gcd(d1, d2)) * d2, s);
      } else if ((m = s.match(/^جمع \S+ (\d+)\/(\d+) \+ (\d+)\/(\d+) فكتب (\d+)\/(\d+)\./))) {
        assert.ok(same(val(item.answer), +m[1]! / +m[2]! + +m[3]! / +m[4]!), s);
        assert.ok(simplest(item.answer), `${item.answer}: ${s}`);
      } else if ((m = s.match(new RegExp(`^(?:.*): ${NUM} \\+ ${NUM}`)))) {
        assert.ok(same(val(item.answer), val(m[1]!) + val(m[2]!)), s);
      } else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(mix >= items.length * 0.35, `only ${mix} of ${items.length} items hold a mixed number`);
  });

  it('«طرح الكسور والأعداد الكسرية»: mixed numbers, some needing a regroup, never a negative', () => {
    const items = draws('frac_sub_g5');
    let mix = 0, regroup = 0;
    /** a − b needs a regroup when the minuend's fraction part is the smaller: 3 1/4 − 1 1/2. */
    const needsRegroup = (x: string, y: string) => {
      const a = x.match(/^(\d+) (\d+)\/(\d+)$/), b = y.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
      return !!a && !!b && +a[2]! / +a[3]! < +b[2]! / +b[3]!;
    };
    for (const item of items) {
      const s = p(item);
      if (/\d+ \d+\/\d+/.test(s)) mix += 1;
      let m: RegExpMatchArray | null;
      if ((m = s.match(new RegExp(`^أوجد ناتج: ${NUM} − ${NUM}`))) || (m = s.match(new RegExp(`^في إبريق ${NUM} لتر من الحليب، شرب \\S+ منه ${NUM} لتر`))) || (m = s.match(new RegExp(`^بكم يزيد ${NUM} على ${NUM}؟`)))) {
        assert.ok(same(val(item.answer), val(m[1]!) - val(m[2]!)), s);
        assert.ok(val(item.answer) > 0, s);
        if (needsRegroup(m[1]!, m[2]!)) regroup += 1;
      } else if ((m = s.match(new RegExp(`^أوجد العدد المجهول: ${NUM} − ؟ = ${NUM}$`)))) {
        assert.ok(same(val(item.answer), val(m[1]!) - val(m[2]!)), s);
        if (needsRegroup(m[1]!, item.answer)) regroup += 1;
      } else assert.fail(`unrecognised stem: ${s}`);
      assert.ok(simplest(item.answer), `${item.answer}: ${s}`);
      distinct3(item);
    }
    assert.ok(mix >= items.length * 0.35, `only ${mix} of ${items.length} items hold a mixed number`);
    assert.ok(regroup >= items.length * 0.15, `only ${regroup} of ${items.length} items regroup`);
  });

  it('«ضرب الكسور»: no fraction equal to one, no improper factor («3/8 × 2/2»)', () => {
    for (const item of lesson('ضرب الكسور', 5, 600)) {
      const s = p(item);
      for (const [, n, d] of s.matchAll(/(\d+)\/(\d+)/g)) {
        if (/^أوجد ناتج|^أوجد العدد المجهول|مساحتها|منهم/.test(s) && !/= \d+\/\d+$/.test(s)) assert.ok(+n! < +d!, s);
        assert.notEqual(n, d, s);
      }
    }
  });

  it('«أجزاء الألف»: every item is about thousandths, every key recomputed', () => {
    const items = draws('thousandths_g5');
    for (const item of items) {
      const s = p(item);
      assert.ok(/\d\.\d{3}\b|\/1000\b|من ألف/.test(s + item.answer), `not about thousandths: ${s}`);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اكتب الكسر (\d+)\/1000 على صورة عدد عشري\.$/))) assert.ok(same(Number(item.answer), +m[1]! / 1000), s);
      else if ((m = s.match(/^اكتب العدد العشري (\d\.\d{3}) على صورة كسر مقامه 1000\.$/))) {
        assert.ok(same(val(item.answer), Number(m[1])), s);
        assert.match(item.answer, /^\d+\/1000$/, s);
      }
      else if ((m = s.match(/^ما القيمة المنزلية للرقم (\d) في العدد (\d+)\.(\d{3})؟$/))) {
        const frac = m[3]!, pos = frac.indexOf(m[1]!) + 1;
        assert.equal(frac.split(m[1]!).length, 2, s);
        assert.ok(same(Number(item.answer), Number(m[1]) / 10 ** pos), s);
      } else if ((m = s.match(/^اكتب العدد الآتي بالصيغة القياسية: (\d+) \+ 0\.(\d) \+ 0\.0(\d) \+ 0\.00(\d)$/))) assert.equal(item.answer, `${m[1]}.${m[2]}${m[3]}${m[4]}`, s);
      else if ((m = s.match(/^اكتب العدد (\d+)\.(\d)(\d)(\d) بالصيغة التحليلية\.$/))) assert.equal(item.answer, `${m[1]} + 0.${m[2]} + 0.0${m[3]} + 0.00${m[4]}`, s);
      else if ((m = s.match(/^ما الرقم الذي في منزلة الأجزاء من ألف في العدد (\d+)\.(\d)(\d)(\d)؟$/))) assert.equal(item.answer, m[4], s);
      else if (/^كيف يُقرأ العدد 0\.\d{3}؟$/.test(s)) assert.match(item.answer, /من ألف$/, s);
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
  });

  it('«التحويل بين الكسور والأعداد العشرية»: conversions only, both ways, mixed numbers too', () => {
    const items = draws('dec_convert_g5');
    let toDec = 0, toFrac = 0, mixedN = 0;
    for (const item of items) {
      const s = p(item);
      assert.doesNotMatch(s, /القيمة المنزلية|الصيغة القياسية|الصيغة التحليلية|منزلة/, s);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اكتب الكسر (\d+)\/(\d+) على صورة عدد عشري\.$/))) { toDec += 1; assert.ok(same(Number(item.answer), +m[1]! / +m[2]!), s); }
      else if ((m = s.match(/^اكتب العدد الكسري (\d+) (\d+)\/(\d+) على صورة عدد عشري\.$/))) { toDec += 1; mixedN += 1; assert.ok(same(Number(item.answer), +m[1]! + +m[2]! / +m[3]!), s); }
      else if ((m = s.match(/^اكتب العدد العشري (\d+(?:\.\d+)?) على صورة كسر في أبسط صورة\.$/))) { toFrac += 1; assert.ok(same(val(item.answer), Number(m[1])), s); assert.ok(simplest(item.answer), s); }
      else if ((m = s.match(/^اكتب العدد العشري (\d+(?:\.\d+)?) على صورة عدد كسري في أبسط صورة\.$/))) { toFrac += 1; mixedN += 1; assert.ok(same(val(item.answer), Number(m[1])), s); assert.match(item.answer, /^\d+ \d+\/\d+$/, s); assert.ok(simplest(item.answer), s); }
      else if ((m = s.match(/^أيّ الأعداد العشرية الآتية يساوي الكسر (\d+)\/(\d+): /))) { toDec += 1; assert.ok(same(Number(item.answer), +m[1]! / +m[2]!), s); }
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(toDec >= items.length * 0.3 && toFrac >= items.length * 0.3, `fraction→decimal ${toDec}, decimal→fraction ${toFrac}`);
    assert.ok(mixedN >= items.length * 0.15, `only ${mixedN} mixed numbers`);
  });

  it('«ضرب الأعداد العشرية وقسمتها»: by 10, 100 or 1000 only, every key recomputed', () => {
    const items = draws('dec_shift_g5');
    let mul = 0, div = 0;
    for (const item of items) {
      const s = p(item);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^اضرب العدد (\d+(?:\.\d+)?) في (10|100|1000)\.$/))) { mul += 1; assert.ok(same(Number(item.answer), Number(m[1]) * +m[2]!), s); }
      else if ((m = s.match(/^اقسم العدد (\d+(?:\.\d+)?) على (10|100|1000)\.$/))) { div += 1; assert.ok(same(Number(item.answer), Number(m[1]) / +m[2]!), s); }
      else if ((m = s.match(/^أكمل: (\d+(?:\.\d+)?) (×|÷) ؟ = (\d+(?:\.\d+)?)$/))) {
        const a = Number(m[1]), r = Number(m[3]), k = Number(item.answer);
        assert.ok([10, 100, 1000].includes(k), s);
        assert.ok(same(m[2] === '×' ? a * k : a / k, r), s);
      } else if ((m = s.match(/^ثمن القلم الواحد (\d+(?:\.\d+)?) دينار\. كم دينارًا ثمن (10|100|1000) (?:أقلام|قلم)؟$/))) { mul += 1; assert.ok(same(Number(item.answer), Number(m[1]) * +m[2]!), s); }
      else if ((m = s.match(/^عند (ضرب|قسمة) العدد (\d+(?:\.\d+)?) (?:في|على) (10|100|1000)، إلى أي جهة تنتقل الفاصلة العشرية وبكم منزلة؟$/))) {
        const k = String(m[3]).length - 1;
        assert.equal(item.answer, `${k === 1 ? 'منزلة واحدة' : k === 2 ? 'منزلتين' : '3 منازل'} إلى ${m[1] === 'ضرب' ? 'اليمين' : 'اليسار'}`, s);
      } else if ((m = s.match(/^حوّل (\d+(?:\.\d+)?) (م|كغ|لتر) إلى (سم|غ|مل)\.$/))) { mul += 1; assert.ok(same(Number(item.answer), Number(m[1]) * (m[2] === 'م' ? 100 : 1000)), s); }
      else if ((m = s.match(/^حوّل (\d+(?:\.\d+)?) (سم|غ|مل) إلى (م|كغ|لتر)\.$/))) { div += 1; assert.ok(same(Number(item.answer), Number(m[1]) / (m[2] === 'سم' ? 100 : 1000)), s); }
      else assert.fail(`unrecognised stem: ${s}`);
      assert.doesNotMatch(s, /× \d+\.\d|÷ \d+\.\d|العددين العشريين|على العدد العشري/, s);
      distinct3(item);
    }
    assert.ok(mul >= items.length * 0.25 && div >= items.length * 0.25, `× ${mul}, ÷ ${div}`);
  });

  it('«الزمن» is «توقيت 24 ساعة»: afternoon times written 13:00–23:59, every key recomputed', () => {
    const items = draws('time_24h_g5');
    let afternoon = 0;
    const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return h! * 60 + m!; };
    const two = (n: number) => String(n).padStart(2, '0');
    const to12 = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${two(m)} ${h < 12 ? 'ص' : 'م'}`;
    for (const item of items) {
      const s = p(item);
      if ((s.match(/\b(1[3-9]|2[0-3]):\d\d/g) ?? []).length > 0 || /\d:\d\d م/.test(s)) afternoon += 1;
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^الساعة (\d\d):(\d\d) بتوقيت 24 ساعةً\. كيف تُكتب بتوقيت 12 ساعةً؟$/))) assert.equal(item.answer, to12(+m[1]!, +m[2]!), s);
      else if ((m = s.match(/^اكتب الوقت (\d+):(\d\d) (ص|م) بتوقيت 24 ساعةً\.$/))) {
        const h = (+m[1]! % 12) + (m[3] === 'م' ? 12 : 0);
        assert.equal(item.answer, `${two(h)}:${m[2]}`, s);
      } else if ((m = s.match(/^انطلقت حافلة الساعة (\d\d:\d\d) ووصلت الساعة (\d\d:\d\d)\. كم دقيقة استغرقت الرحلة؟$/))) assert.equal(Number(item.answer), hm(m[2]!) - hm(m[1]!), s);
      else if ((m = s.match(/^بدأ عرض مسرحي الساعة (\d\d:\d\d) واستمر (?:ساعة واحدة|ساعتين|(\d+) ساعات?|(\d+) ساعة)(?: و ?(\d+) دقيقة| و ?(\d+) دقائق)?\. متى انتهى بتوقيت 24 ساعةً؟$/))) {
        const hh = /ساعة واحدة/.test(s) ? 1 : /ساعتين/.test(s) ? 2 : +(m[2] ?? m[3])!, mm = +(m[4] ?? m[5] ?? 0)!;
        const t = hm(m[1]!) + hh * 60 + mm;
        assert.ok(t < 24 * 60, s);
        assert.equal(item.answer, `${two(Math.floor(t / 60))}:${two(t % 60)}`, s);
      } else if ((m = s.match(/^انتهى الدرس الساعة (\d\d:\d\d) وكان قد استمر (\d+) دقيقة\. متى بدأ بتوقيت 24 ساعةً؟$/))) {
        const t = hm(m[1]!) - +m[2]!;
        assert.ok(t >= 0, s);
        assert.equal(item.answer, `${two(Math.floor(t / 60))}:${two(t % 60)}`, s);
      } else if ((m = s.match(/^كم دقيقة في (\d+) (?:ساعات|ساعة|ساعتين) و ?(\d+) دقيقة؟$/))) assert.equal(Number(item.answer), +m[1]! * 60 + +m[2]!, s);
      else if ((m = s.match(/^كم ثانية في (\d+) دقائق? و ?(\d+) ثانية؟$/)) || (m = s.match(/^كم ثانية في (\d+) دقائق؟$/))) assert.equal(Number(item.answer), +m[1]! * 60 + +(m[2] ?? 0), s);
      else assert.fail(`unrecognised stem: ${s}`);
      distinct3(item);
    }
    assert.ok(afternoon >= items.length * 0.5, `only ${afternoon} of ${items.length} items use an afternoon time`);
  });

  it('«الانسحاب»: «و وحدتين» is written «ووحدتين»', () => {
    const t = topicFor('الانسحاب', 5);
    assert.ok(t, 'no translation generator');
    for (let i = 0; i < 600; i++) {
      const item = makeTopicItem(t, 5, TIERS[i % 3]!, new Set(), seeded(i * 6151 + 3));
      assert.doesNotMatch(p(item), /و وحد/, p(item));
    }
  });
});
