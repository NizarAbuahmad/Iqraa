/**
 * Grade 3 maths lessons whose questions did not match their objective
 * (Grade 3 review, 2026-11-14):
 * - «الوقت بالدقائق» (S2 u10_l1) and «الفترات الزمنية (1)» (u10_l4) drew the
 *   elapsed-time questions of «الفترات الزمنية (2)», across hours — the first is
 *   about reading the clock to the minute, the second keeps within one hour;
 * - «المساحة» (u11_l6) drew «مساحة المستطيل»'s length × width — it counts unit squares;
 * - «تقدير ناتج القسمة» (u8_l2) divided three-digit numbers — the objective is two-digit;
 * - «الكسور المتكافئة» (u9_l5) multiplied by up to 9 («36/45») — it works with models and
 *   the number line;
 * - «القيمة المنزلية ضمن الألوف» (S1 u1_l2) asked about «الرقم 8 في العدد 18».
 * Every answer is recomputed here from the numbers printed in its own stem, by code
 * that shares nothing with the generators.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { makeElementaryItem } from '../elementary.ts';
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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 3, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 211)));
}
const nums = (s: string) => (s.match(/[0-9]+/g) ?? []).map(Number);
const pad = (m: number) => String(m).padStart(2, '0');
/** Minutes written out: «دقيقة واحدة», «دقيقتين», «7 دقائق», «35 دقيقة» — and the noun must agree. */
const minutes = (s: string) => {
  if (/^دقيقة واحدة/.test(s)) return 1;
  if (/^دقيقتين/.test(s)) return 2;
  const m = s.match(/^(\d+) (دقائق|دقيقة)/);
  assert.ok(m, `minutes not read: «${s}»`);
  const n = Number(m[1]);
  assert.equal(m[2], n <= 10 ? 'دقائق' : 'دقيقة', `«${s}»: the noun does not agree`);
  return n;
};
const HOUR = ['', 'الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
const ORDINAL: Record<string, number> = { 'الأولى': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4 };

const TITLES: Array<[string, string]> = [
  ['الوَقْتُ بِالدَّقائِقِ', 'clock_minutes_g3'],
  ['الفَتَراتُ الزَّمَنِيَّةُ (1)', 'elapsed_hour_g3'],
  ['الفَتَراتُ الزَّمَنِيَّةُ (2)', 'time_g3'],
  ['المِساحَةُ', 'area_units_g3'],
  ['مِساحَةُ المُسْتَطيلِ', 'area_rect'],
  ['تَقْديرُ ناتِجِ القِسْمَةِ', 'est_quot'],
  ['الكُسورُ المُتَكافِئَةُ', 'equiv_frac'],
];

describe('Grade 3 lessons draw questions about their own objective', () => {
  for (const [title, id] of TITLES) {
    it(`«${title}» reaches ${id}`, () => {
      assert.equal(topicFor(title, 3)?.id, id);
      assert.ok(mathBankCovers(title, null, 3), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 3, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
    });
  }
  it('the new generators are Grade 3 only', () => {
    for (const g of [2, 4, 5]) for (const t of ['الوقت بالدقائق', 'الفترات الزمنية (1)', 'المساحة']) {
      assert.ok(!['clock_minutes_g3', 'elapsed_hour_g3', 'area_units_g3'].includes(topicFor(t, g)?.id ?? ''), `${t} at grade ${g}`);
    }
    assert.equal(topicFor('المساحة', 4)?.id, 'area_rect');
  });

  it('every item has three distinct wrong options, none the answer', () => {
    for (const id of ['clock_minutes_g3', 'elapsed_hour_g3', 'area_units_g3', 'est_quot', 'equiv_frac', 'am_pm']) for (const item of draws(id)) {
      const where = `${id}: ${item.promptAr} → ${item.answer} | ${item.wrongs.join(' | ')}`;
      assert.equal(item.wrongs.length, 3, where);
      assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, where);
      assert.ok(!/NaN|undefined/.test(where), where);
    }
  });

  it('«الوقت بالدقائق»: the time read to the minute, counted on, read in words, and a few minutes later', () => {
    const kinds = new Set<string>();
    for (const item of draws('clock_minutes_g3')) {
      const p = item.promptAr!;
      let m = p.match(/التدريجة (\S+) بعد العدد (\d+)، ويقع عقرب الساعات بين العددين (\d+) و (\d+)/);
      if (m) {
        kinds.add('hands');
        const s = ORDINAL[m[1]!]!, n = Number(m[2]), h = Number(m[3]);
        assert.equal(Number(m[4]), h + 1, p);
        assert.equal(item.answer, `${h}:${pad(5 * n + s)}`, p);
        continue;
      }
      m = p.match(/عدّ بالخمسات من العدد 12 حتى العدد (\d+)، ثم عدّ (.+?) أخرى/);
      if (m) { kinds.add('count'); assert.equal(Number(item.answer), 5 * Number(m[1]) + minutes(m[2]!), p); continue; }
      m = p.match(/^كيف نقرأ الوقت (\d+):(\d+)؟$/);
      if (m) {
        kinds.add('words');
        const h = Number(m[1]), mm = Number(m[2]);
        assert.ok(mm % 5 !== 0, `a minute not on a number: ${p}`);
        assert.equal(item.answer, `${HOUR[h]} و ${mm} دقيقة`, p);
        continue;
      }
      m = p.match(/^تشير الساعة إلى (\d+):(\d+)\. إلى أي وقت تشير بعد (.+?)؟$/);
      assert.ok(m, `unrecognised stem: ${p}`);
      kinds.add('later');
      const t = (Number(m[1]) * 60 + Number(m[2]) + minutes(m[3]!)) % 720;
      const hh = Math.floor(t / 60) || 12;
      assert.equal(item.answer, `${hh}:${pad(t % 60)}`, p);
      assert.ok(item.wrongs.some(w => Number(w.split(':')[1]) >= 60), `the «4:63» slip is offered: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['count', 'hands', 'later', 'words']);
  });

  it('«الفترات الزمنية (1)»: every interval stays inside one hour', () => {
    const kinds = new Set<string>();
    for (const item of draws('elapsed_hour_g3')) {
      const p = item.promptAr!;
      const clocks = [...p.matchAll(/(\d+):(\d+)/g)].map(c => [Number(c[1]), Number(c[2])] as const);
      assert.equal(new Set(clocks.map(c => c[0])).size, 1, `one hour throughout: ${p}`);
      let m = p.match(/^بدأت حصة الرسم الساعة \d+:(\d+) وانتهت الساعة \d+:(\d+)\. كم دقيقة استغرقت؟$/);
      if (m) { kinds.add('how long'); assert.equal(Number(item.answer), Number(m[2]) - Number(m[1]), p); continue; }
      m = p.match(/^بدأ سامي حلّ واجبه الساعة (\d+):(\d+)، واستمر (.+?)\. متى انتهى؟$/);
      if (m) {
        kinds.add('ends');
        const end = Number(m[2]) + minutes(m[3]!);
        assert.ok(end < 60, p);
        assert.equal(item.answer, `${m[1]}:${pad(end)}`, p);
        continue;
      }
      m = p.match(/^انتهت مباراة الساعة (\d+):(\d+)، وقد استمرت (.+?)\. متى بدأت؟$/);
      if (m) {
        kinds.add('starts');
        const start = Number(m[2]) - minutes(m[3]!);
        assert.ok(start >= 0, p);
        assert.equal(item.answer, `${m[1]}:${pad(start)}`, p);
        continue;
      }
      m = p.match(/^قرأت ليلى من الساعة \d+:(\d+) إلى الساعة \d+:(\d+)، ورسم أخوها سامي من الساعة \d+:(\d+) إلى الساعة \d+:(\d+)\. بكم دقيقة تزيد مدة (قراءة ليلى|رسم سامي) على مدة (قراءة ليلى|رسم سامي)؟$/);
      assert.ok(m, `unrecognised stem: ${p}`);
      kinds.add('compare');
      const read = Number(m[2]) - Number(m[1]), draw = Number(m[4]) - Number(m[3]);
      const [longer, shorter] = m[5] === 'قراءة ليلى' ? [read, draw] : [draw, read];
      assert.notEqual(m[5], m[6], p);
      assert.ok(longer > shorter, `the longer one is named first: ${p}`);
      assert.equal(Number(item.answer), longer - shorter, p);
    }
    assert.deepEqual([...kinds].sort(), ['compare', 'ends', 'how long', 'starts']);
  });

  it('«المساحة»: unit squares counted, never a length times a width', () => {
    const kinds = new Set<string>();
    for (const item of draws('area_units_g3')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      assert.doesNotMatch(p, /طوله|عرضه/, `the formula is the next lesson's: ${p}`);
      if (/جزأين/.test(p)) { kinds.add('two parts'); assert.equal(a, n[0]! * n[1]! + n[2]! * n[3]!, p); }
      else if (/الشكل \(أ\)/.test(p)) { kinds.add('compare'); assert.equal(a, Math.abs(n[0]! * n[1]! - n[2]! * n[3]!), p); assert.ok(a > 0, p); }
      else if (/كم مربعًا في كل صف/.test(p)) { kinds.add('missing'); assert.equal(a * n[1]!, n[0], p); }
      else if (/بالسنتيمتر المربع/.test(p)) { kinds.add('cm'); assert.equal(n[0], 1, p); assert.equal(a, n[1]! * n[2]!, p); }
      else if (/بلاط/.test(p)) { kinds.add('tiles'); assert.equal(a, n[0]! * n[1]!, p); }
      else { assert.match(p, /كم مربع وحدة يغطي/, p); kinds.add('grid'); assert.equal(a, n[0]! * n[1]!, p); }
      // «صفوف», «مربعات», «بلاطات» are the 3–10 plural
      for (const c of p.matchAll(/(\d+) (صفوف|مربعات|بلاطات)/g)) assert.ok(Number(c[1]) >= 3 && Number(c[1]) <= 10, p);
    }
    assert.equal(kinds.size, 6, [...kinds].join(', '));
  });

  it('«تقدير ناتج القسمة» (Grade 3): a two-digit dividend, rounded to a ten or to a nearby fact', () => {
    const kinds = new Set<string>();
    for (const item of draws('est_quot')) {
      const p = item.promptAr!, m = p.match(/(\d+) ÷ (\d+)/) ?? p.match(/وُزّع (\d+) \S+ بالتساوي على (\d+) مجموعات/);
      assert.ok(m, p);
      const n = Number(m[1]), d = Number(m[2]), a = Number(item.answer);
      assert.ok(n >= 10 && n <= 99, `two-digit dividend: ${p}`);
      if (/المتناغمة/.test(p)) {
        kinds.add('compatible');
        // the multiple of d nearest n, found by walking the multiples
        let best = 0;
        for (let x = d; x <= 120; x += d) if (Math.abs(x - n) < Math.abs(best - n)) best = x;
        assert.equal(a, best / d, p);
      } else {
        kinds.add(/وُزّع/.test(p) ? 'story' : 'rounding');
        const ten = n % 10 >= 5 ? n - (n % 10) + 10 : n - (n % 10);
        assert.equal(a * d, ten, p);
      }
    }
    assert.deepEqual([...kinds].sort(), ['compatible', 'rounding', 'story']);
  });

  it('«القيمة المنزلية ضمن الألوف»: no number below a hundred', () => {
    for (let i = 0; i < 300; i++) {
      const item = makeElementaryItem('القيمة المنزلية ضمن الألوف', 3, TIERS[i % 3]!, new Set(), seeded(i * 31 + 7));
      const p = item.promptAr!, xs = nums(p);
      // the parts of an expanded form (500 + 60 + 9) are not the number asked about; their sum is
      const asked = /التحليلية/.test(p) && /\+/.test(p) ? xs.reduce((a, b) => a + b, 0) : Math.max(...xs);
      assert.ok(asked >= 100, `«${p}»`);
      assert.doesNotMatch(p, /للرقم 0 /, p);
    }
  });
});
