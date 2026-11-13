/**
 * Grade 1 operation lessons that used to have no generator of their own.
 *
 * Swept 2026-11-13: «جمع العشرات», «طرح العشرات», «جمع/طرح عددين من منزلتين»,
 * «الطرح باستعمال الضعف», «الطرح بإيجاد عشرة», «الجمع بالإكمال إلى العشرة» and
 * «جمع ثلاثة أعداد» fell through to generic one-digit drills, so a «جمع
 * العشرات» quiz asked «3 + ؟ = 4» and nothing about tens. Each answer here is
 * recomputed from the numbers in the Arabic stem, and each item is checked to
 * be about its lesson's own skill.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 1, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);

const ROUTES: Array<[string, string]> = [
  ['جَمْعُ الْعَشَراتِ', 'add_tens_g1'], ['طَرْحُ الْعَشَراتِ', 'sub_tens_g1'],
  ['جَمْعُ عَدَدَيْنِ مِنْ مَنْزِلَتَيْنِ', 'add_2digit_g1'], ['طَرْحُ عَدَدَيْنِ مِنْ مَنْزِلَتَيْنِ', 'sub_2digit_g1'],
  ['الطَّرْحُ بِاسْتِعْمالِ الضِّعْفِ', 'sub_doubles_g1'], ['الطَّرْحُ بِإيجادِ عَشَرَةٍ', 'sub_make_ten_g1'],
  ['الْجَمْعُ بِالْإِكْمالِ إِلى الْعَشَرَةِ', 'add_make_ten_g1'], ['جَمْعُ ثَلاثَةِ أَعْدادٍ', 'add_three_g1'],
];

describe('Grade 1 operation lessons route to their own generator', () => {
  for (const [title, id] of ROUTES) {
    it(`${title} → ${id}`, () => {
      assert.equal(topicFor(title, 1)?.id, id);
      assert.ok(mathBankCovers(title, null, 1));
    });
  }
  it('and only at Grade 1', () => {
    for (const [title] of ROUTES) assert.equal(topicFor(title, 2)?.id?.endsWith('_g1') ?? false, false, title);
  });
});

describe('Grade 1 operation generators: shape and answers', () => {
  for (const [, id] of ROUTES) {
    it(`${id}: four distinct options, no stray text`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, where);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) assert.ok(!/NaN|undefined|-\d/.test(s), where);
        for (const n of [...nums(item.promptAr!), ...item.wrongs.map(Number)]) assert.ok(n <= 99, `beyond Grade 1: ${where}`);
      }
    });
  }

  it('whole tens: every number is a ten, the answer is right', () => {
    for (const id of ['add_tens_g1', 'sub_tens_g1']) {
      const add = id.startsWith('add'), kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, a = Number(item.answer);
        if (has(p, 'إذا كان')) {
          kinds.add('hint'); const [x, y, , X, Y] = nums(p);
          assert.equal(X, x! * 10); assert.equal(Y, y! * 10); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        } else if (has(p, 'قلم')) {
          kinds.add('story'); const [X, Y] = nums(p); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        } else if (has(p, '___ =')) {
          kinds.add('missing'); const [X, R] = nums(p); assert.equal(add ? X! + a : X! - a, R, p);
        } else {
          kinds.add('plain'); const [X, Y] = nums(p); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        }
        for (const n of nums(p).filter(n => n >= 10)) assert.equal(n % 10, 0, `not a ten: ${p}`);
        assert.ok(a > 0 && a <= 90, p);
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
  });

  it('two-digit numbers: no regrouping, the answer is right', () => {
    for (const id of ['add_2digit_g1', 'sub_2digit_g1']) {
      const add = id.startsWith('add'), kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, a = Number(item.answer), [x, y] = nums(p);
        assert.ok(x! >= 10 && x! <= 99, p);
        if (has(p, 'رقم الآحاد')) { kinds.add('ones'); assert.equal(a, (add ? x! + y! : x! - y!) % 10, p); }
        else if (has(p, '___ =')) { kinds.add('missing'); const r = nums(p)[1]!; assert.equal(add ? x! + a : x! - a, r, p); assert.ok(a >= 10, p); }
        else { kinds.add(has(p, 'قرش') ? 'story' : 'plain'); assert.equal(a, add ? x! + y! : x! - y!, p); assert.ok(y! >= 10, p); }
        const other = has(p, '___ =') ? a : y!;
        const ones = add ? (x! % 10) + (other % 10) : (x! % 10) - (other % 10);
        assert.ok(ones >= 0 && ones <= 9, `regrouping: ${p}`);
        if (add) assert.ok(x! + other <= 99, p); else assert.ok(x! - other >= 10, p);
      }
      assert.equal(kinds.size, 4, `${id}: ${[...kinds]}`);
    }
  });

  it('subtraction using doubles: the minuend is a double of the answer', () => {
    for (const item of draws('sub_doubles_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'إذا كان')) { assert.equal(n[0], n[1]); assert.equal(n[2], 2 * n[0]!); assert.equal(a, n[3]! - n[4]!); }
      else if (has(p, '___ =')) assert.equal(n[0]! - a, n[1], p);
      else assert.equal(a, n[0]! - n[1]!, p);
      assert.equal(n[0], has(p, 'إذا كان') ? a : 2 * a, p);
    }
  });

  it('subtraction by making ten: a teen minus a number that crosses ten', () => {
    const kinds = new Set<string>();
    for (const item of draws('sub_make_ten_g1')) {
      const p = item.promptAr!, a = Number(item.answer), [x, y, z] = nums(p);
      assert.ok(x! >= 11 && x! <= 18 && y! <= 9 && y! > x! - 10, `does not cross ten: ${p}`);
      if (has(p, 'نطرح')) { kinds.add('steps'); assert.equal(z, x! - 10); assert.equal(a, y! - z!, p); }
      else if (has(p, '10 − ___')) { kinds.add('complete'); assert.equal(10 - a, x! - y!, p); }
      else { kinds.add(has(p, 'برتقال') ? 'story' : 'plain'); assert.equal(a, x! - y!, p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('adding by making ten: crosses ten, the steps are right', () => {
    const kinds = new Set<string>();
    for (const item of draws('add_make_ten_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'نأخذ')) { kinds.add('steps'); const [x, y, need] = n; assert.equal(need, 10 - x!); assert.equal(a, y! - need!, p); assert.ok(x! + y! > 10, p); }
      else if (has(p, '10 + ___')) { kinds.add('complete'); assert.equal(10 + a, n[0]! + n[1]!, p); assert.ok(n[0]! + n[1]! > 10, p); }
      else if (has(p, '___ = 10')) { kinds.add('ten'); assert.equal(n[0]! + a, 10, p); }
      else { kinds.add('plain'); assert.equal(a, n[0]! + n[1]!, p); assert.ok(a > 10 && a <= 18, p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('three addends: the sum is right and within 20', () => {
    const kinds = new Set<string>();
    for (const item of draws('add_three_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'مجموعهما 10')) { kinds.add('ten'); const [, x, m, y] = n; assert.equal(x! + y!, 10, p); assert.equal(a, x! + m! + y!, p); }
      else if (has(p, '___ =')) { kinds.add('missing'); assert.equal(n[0]! + n[1]! + a, n[2], p); }
      else { kinds.add(has(p, 'كرة') ? 'story' : 'plain'); assert.equal(n.length, 3, p); assert.equal(a, n[0]! + n[1]! + n[2]!, p); }
      assert.ok((has(p, '___ =') ? n[2]! : a) <= 20, p);
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });
});
