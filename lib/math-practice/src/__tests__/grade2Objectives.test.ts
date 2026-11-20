/**
 * Grade 2 maths lessons whose questions did not fit their objective (Grade 2 review, 2026-11-15). Their keys were
 * right; what they asked was not what the lesson teaches:
 * - «القيمة المنزلية», «مقارنة الأعداد», «ترتيب الأعداد», «الطرح» and «تمثيل الأعداد على خط الأعداد» name numbers
 *   «ضمن 3 منازل» (or a subtraction «من عدد يتكون من 3 منازل»), and an easy paper asked about «10 + 2», «10، 6، 22»,
 *   «11 − 4» and «بين 10 و 70»;
 * - «كسر الوحدة كجزء من مجموعة» divided by 6, a table Grade 2 does not have.
 * The data, time, centimetre, equal-groups and division-relation lessons are pinned in `stats.test.ts` and
 * `early.test.ts`. Every check here reads the printed question, not the generator.
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
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
/** A drill item has no prompt of its own: its sum (and the story told with it) is the question. */
const text = (item: ConcreteItem) => item.promptAr ?? `${item.eq} ${item.wordAr ?? ''}`;
const ops = (title: string, n = 300): ConcreteItem[] =>
  Array.from({ length: n }, (_, i) => makeElementaryItem(title, 2, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 17)));
const draws = (id: string, n = 300): ConcreteItem[] => {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 2, TIERS[i % 3]!, new Set(), seeded(i * 6151 + 29)));
};

describe('Grade 2 lessons ask about their own objective', () => {
  it('the four data lessons: two about pictures, two about tallies', () => {
    for (const [title, id] of [
      ['تَمْثيلُ الْبَياناتِ بِالصُّوَرِ', 'read_data_g12'], ['تَفْسيرُ الْبَياناتِ الْمُمَثَّلَةِ بِالصُّوَرِ', 'read_data_g12'],
      ['جَمْعُ الْبَياناتِ وَتَنْظيمُها', 'read_data_tally_g2'], ['تَفْسيرُ الْبَياناتِ الْمُمَثَّلَةِ بِجَدْوَلِ الْإِشاراتِ', 'read_data_tally_g2'],
    ] as const) {
      assert.equal(topicFor(title, 2)?.id, id, title);
      assert.ok(mathBankCovers(title, null, 2), title);
      assert.ok(takeElementaryMath('short_answer', title, null, 2, 'medium', 'ar', 2)?.answer, title);
    }
  });

  it('«القيمة المنزلية»: every number has three digits', () => {
    for (const item of ops('القيمة المنزلية')) {
      const p = text(item), xs = nums(p);
      // the parts of an expanded form (500 + 60 + 9) are not the number; their sum is
      const asked = /التحليلية/.test(p) && /\+/.test(p) ? xs.reduce((a, b) => a + b, 0) : Math.max(...xs);
      assert.ok(asked >= 100 && asked <= 999, p);
    }
  });

  it('«مقارنة الأعداد» and «ترتيب الأعداد»: every number compared has three digits', () => {
    for (const title of ['مقارنة الأعداد', 'ترتيب الأعداد']) for (const item of ops(title)) {
      const p = text(item);
      // «ما أكبر عدد يمكن تكوينه من الأرقام 9، 6، 5» lists digits, and its answer is the three-digit number
      const xs = /الأرقام/.test(p) ? [Number(item.answer)] : nums(p);
      for (const x of xs) assert.ok(x >= 100 && x <= 999, `${x} in «${p}»`);
    }
  });

  it('«الطرح»: the number taken from has three digits', () => {
    for (const item of ops('الطرح')) {
      const p = text(item), xs = nums(p);
      // the largest number printed is the minuend, or (in «؟ − b = d») the minuend is the answer
      const minuend = Math.max(...xs, /^\D*؟ −/.test(p.replace(/^أوجد العدد المجهول: /, '')) ? Number(item.answer) : 0);
      assert.ok(minuend >= 100 && minuend <= 999, p);
    }
  });

  it('«تمثيل الأعداد على خط الأعداد»: every number has three digits', () => {
    for (const item of draws('number_line_g2')) {
      const p = item.promptAr!;
      // a jump length (5, 10) and a count of parts or jumps are not numbers on the line
      const onLine = /قفزات/.test(p) ? [nums(p)[0]!, Number(item.answer)] : /أقسام/.test(p) ? [nums(p)[0]!, nums(p)[1]!, Number(item.answer)] : [...nums(p), ...nums(item.answer)];
      for (const x of onLine) assert.ok(x >= 100 && x <= 1000, `${x} in «${p}»`);
    }
  });

  it('«كسر الوحدة كجزء من مجموعة»: the unit fraction is one of Grade 2’s tables', () => {
    for (const item of draws('unit_fraction_set')) {
      const d = Number(item.promptAr!.match(/1\/(\d+)/)![1]);
      assert.ok([2, 3, 4, 5, 10].includes(d), item.promptAr);
    }
  });
});
