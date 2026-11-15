/**
 * The three Grade 6 maths lessons that had no offline questions (audit,
 * 2026-11-13): «القياس: تطبيقات العمليات على الأعداد العشرية», «خطة حل المسألة:
 * حل مسألة أبسط» and «إنشاءات هندسية». Each generator follows its lesson in the
 * student book (S1 pp. 81-87, 117-124), and every answer is recomputed here
 * from the quantities printed in its own stem, by code that shares nothing with
 * the generator.
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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 6, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 101)));
}
const close = (a: number, b: number, where: string) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}: ${where}`);
/** At most three decimal places, as the book writes measures (and fils). */
const tidy = (s: string, where: string) => assert.ok(/^\d+(?:\.\d{1,3})?$/.test(s), `not a tidy decimal «${s}»: ${where}`);

const TITLES = {
  dec_measure: 'القِياسُ: تَطْبيقاتُ العَمَلِيّاتِ عَلى الأَعْدادِ العَشْرِيَّةِ',
  simpler_problem: 'خُطَّةُ حَلِّ المَسْأَلَةِ: حَلُّ مَسْأَلَةٍ أَبْسَطَ',
  constructions: 'إِنْشاءاتٌ هَنْدَسِيَّةٌ',
};

describe('Grade 6 lessons that had no offline questions', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches its own generator`, () => {
      assert.equal(topicFor(title, 6)?.id, id);
      assert.ok(mathBankCovers(title, null, 6), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 6, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
    });
  }

  it('measurement with decimals: convert one unit, then multiply or divide (book p. 81-84)', () => {
    const FACTOR: Record<string, number> = { 'm cm': 100, 'cm mm': 10, 'L mL': 1000, 'kg g': 1000, 'm2 cm': 100 };
    const kinds = new Set<string>();
    for (const item of draws('dec_measure')) {
      const p = item.promptAr!;
      tidy(item.answer, p);
      const got = Number(item.answer);
      let m = p.match(/([\d.]+)(m|cm) × ([\d.]+)(cm|mm)/) ?? p.match(/طولها ([\d.]+)(m)، وعرضها ([\d.]+)(cm)/);
      if (m) {
        kinds.add(p.includes('مساحة') ? 'area' : 'product');
        close(got, (Number(m[1]) * Number(m[3])) / FACTOR[`${m[2]} ${m[4]}`]!, p);
        continue;
      }
      m = p.match(/([\d.]+)(L|kg|m) ÷ ([\d.]+)(mL|g|cm)/);
      if (m) {
        kinds.add('quotient');
        close(got, (Number(m[1]) * FACTOR[`${m[2]} ${m[4]}`]!) / Number(m[3]), p);
        continue;
      }
      m = p.match(/(\d+)kg, (\d+)g[^\d]+([\d.]+)kg/);
      assert.ok(m, `unrecognised stem: ${p}`);
      kinds.add('compound');
      const per = Number(m[3]);
      close(got, (Number(m[1]) + Number(m[2]) / 1000) / per, p);
      assert.ok(Number.isInteger(got), `a count of whole items: ${p}`);
    }
    assert.deepEqual([...kinds].sort(), ['area', 'compound', 'product', 'quotient']);
  });

  it('solve a simpler problem: a rate with awkward decimals, scaled to a new amount (book p. 86-87)', () => {
    const kinds = new Set<string>();
    for (const item of draws('simpler_problem')) {
      const p = item.promptAr!;
      tidy(item.answer, p);
      const got = Number(item.answer);
      // a decimal count of hours takes the singular «ساعة»; the plural is a wording bug (2026-11-14)
      assert.ok(!/[\d.]+ ساعات/.test(p), `«ساعات» after a decimal: ${p}`);
      let m = p.match(/مسافة ([\d.]+)km في ([\d.]+) ساعة.+في ([\d.]+) ساعة/);
      if (m) { kinds.add('distance'); close(got, (Number(m[1]) / Number(m[2])) * Number(m[3]), p); continue; }
      m = p.match(/([\d.]+)L من الوقود لقطع مسافة ([\d.]+)km.+مسافة ([\d.]+)km/);
      if (m) { kinds.add('fuel'); close(got, (Number(m[1]) / Number(m[2])) * Number(m[3]), p); continue; }
      m = p.match(/سعر ([\d.]+)kg .+ ([\d.]+) (?:دينار|دنانير).+سعر (\d+)g/);
      assert.ok(m, `unrecognised stem: ${p}`);
      kinds.add('price');
      close(got, (Number(m[2]) / Number(m[1])) * (Number(m[3]) / 1000), p);
    }
    assert.deepEqual([...kinds].sort(), ['distance', 'fuel', 'price']);
  });

  it('the simpler problem it rests on is offered as a distractor, never as the answer', () => {
    // The book's method: round to friendly numbers, solve, then solve the real
    // problem the same way. The rounded answer is the classic wrong one.
    let offered = 0;
    for (const item of draws('simpler_problem')) {
      assert.ok(!item.wrongs.includes(item.answer), item.promptAr);
      if (item.wrongs.some(w => Number.isInteger(Number(w)))) offered++;
    }
    assert.ok(offered > 0, 'no estimate-style distractor was ever offered');
  });

  it('geometric constructions: bisect a segment or an angle, the right angle of a perpendicular bisector (book p. 117-124)', () => {
    const kinds = new Set<string>();
    for (const item of draws('constructions')) {
      const p = item.promptAr!;
      const n = (p.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
      if (p.includes('طول AM')) { kinds.add('segment'); tidy(item.answer, p); close(Number(item.answer), n[0]! / 2, p); continue; }
      const deg = Number(item.answer.replace('°', ''));
      assert.ok(item.answer.endsWith('°'), `an angle in degrees: ${p}`);
      if (p.includes('الزاوية ABD')) { kinds.add('half angle'); close(deg, n[0]! / 2, p); continue; }
      if (p.includes('الزاوية NPM؟')) { kinds.add('whole angle'); close(deg, 2 * n[0]!, p); assert.ok(deg < 180, p); continue; }
      assert.ok(p.includes('العمود المنصف') && p.includes('ما قياس الزاوية'), `unrecognised stem: ${p}`);
      kinds.add('right angle');
      assert.equal(deg, 90, p);
    }
    assert.deepEqual([...kinds].sort(), ['half angle', 'right angle', 'segment', 'whole angle']);
  });
});
