/**
 * Addition and subtraction with regrouping, Grades 2 and 3 (Grade 2 audit,
 * 2026-11-14). These lessons are defined by one skill each — the catalog's
 * objective names the column that regroups — but they were served the generic
 * «جمع/طرح» drill, so about half the items needed no regrouping at all, and
 * «الطرح مع وجود أصفار» put a zero to work in 9 of 151 sums (Grade 2) and 24 of
 * 161 (Grade 3). Every answer here is recomputed from the two numbers printed in
 * the stem, by column arithmetic that shares nothing with the generator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { elementaryOpsForTitle, mathBankCovers, takeElementaryMath, type ConcreteItem, type DiffTier } from '../index.ts';

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
function draws(id: string, grade: number, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 17)));
}

/** Digits, ones first. */
const cols = (n: number) => [...String(n)].reverse().map(Number);
/** For each column (ones = 0), whether adding a and b carries out of it. */
function carriesOut(a: number, b: number): boolean[] {
  const x = cols(a), y = cols(b), out: boolean[] = [];
  let c = 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const s = (x[i] ?? 0) + (y[i] ?? 0) + c;
    c = s >= 10 ? 1 : 0;
    out.push(c === 1);
  }
  return out;
}
/** For each column, whether subtracting b from a must borrow into it. */
function borrowsInto(a: number, b: number): boolean[] {
  const x = cols(a), y = cols(b), out: boolean[] = [];
  let br = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i]! - br - (y[i] ?? 0);
    br = d < 0 ? 1 : 0;
    out.push(br === 1);
  }
  return out;
}
const PLACE: Record<string, number> = { 'الآحاد': 0, 'العشرات': 1, 'المئات': 2, 'الألوف': 3 };

type Spec = {
  title: string; grade: number; id: string; add: boolean;
  /** Sizes and the lesson's regrouping rule, checked on every draw. */
  ok: (a: number, b: number) => string | null;
};
const len = (n: number) => String(n).length;
const SPECS: Spec[] = [
  {
    title: 'الْجَمْعُ مَعَ إِعادَةِ التَّجْميعِ (1)', grade: 2, id: 'add_regroup_ones', add: true,
    // «جمع عددين مع إعادة تجميع الآحاد»
    ok: (a, b) => { const c = carriesOut(a, b); return a + b > 999 ? 'past 999' : !c[0] ? 'no carry from the ones' : c[1] ? 'the tens carry too' : null; },
  },
  {
    title: 'الْجَمْعُ مَعَ إِعادَةِ التَّجْميعِ (2)', grade: 2, id: 'add_regroup_tens', add: true,
    // «جمع عددين مع إعادة تجميع العشرات»
    ok: (a, b) => (a + b > 999 ? 'past 999' : !carriesOut(a, b)[1] ? 'no carry from the tens' : null),
  },
  {
    title: 'الطَّرْحُ مَعَ إِعادَةِ التَّجْميعِ (1)', grade: 2, id: 'sub_regroup_tens', add: false,
    // «الطرح مع إعادة تجميع العشرات»: a ten becomes ten ones
    ok: (a, b) => { const r = borrowsInto(a, b); return a > 999 ? 'past 999' : !r[0] ? 'the ones do not borrow' : r[1] ? 'the tens borrow too' : null; },
  },
  {
    title: 'الطَّرْحُ مَعَ إِعادَةِ التَّجْميعِ (2)', grade: 2, id: 'sub_regroup_hundreds', add: false,
    // «الطرح مع إعادة تجميع المئات»: a hundred becomes ten tens
    ok: (a, b) => (len(a) !== 3 ? 'not three digits' : !borrowsInto(a, b)[1] ? 'the tens do not borrow' : null),
  },
  {
    title: 'الطَّرْحُ مَعَ وُجودِ أَصْفارٍ', grade: 2, id: 'sub_zeros_g2', add: false,
    // «طرح عددين كل منهما من ثلاث منازل أحدهما يحوي أصفارًا»: the borrow passes through a zero
    ok: (a, b) => (len(a) !== 3 || len(b) !== 3 ? 'not two three-digit numbers' : cols(a)[1] !== 0 ? 'no zero in the tens' : !borrowsInto(a, b)[0] ? 'nothing borrows across the zero' : null),
  },
  {
    title: 'الجَمْعُ مَعَ إِعادَةِ التَّجْميعِ 1', grade: 3, id: 'add_regroup_g3_hundreds', add: true,
    // «جمع عددين من ثلاث منازل مع إعادة تجميع المئات»
    ok: (a, b) => (len(a) !== 3 || len(b) !== 3 ? 'not two three-digit numbers' : !carriesOut(a, b)[2] ? 'no carry from the hundreds' : null),
  },
  {
    title: 'الجَمْعُ مَعَ إِعادَةِ التَّجْميعِ 2', grade: 3, id: 'add_regroup_g3_four', add: true,
    // «جمع عددين كل منهما مكون من أربع منازل مع إعادة التجميع»
    ok: (a, b) => (len(a) !== 4 || len(b) !== 4 ? 'not two four-digit numbers' : a + b > 9999 ? 'past 9999' : !carriesOut(a, b).some(Boolean) ? 'no carry' : null),
  },
  {
    title: 'الطَّرْحُ مَعَ إِعادَةِ التَّجْميعِ', grade: 3, id: 'sub_regroup_g3', add: false,
    // «طرح عددين كل منهما مكون من 4 منازل مع إعادة التجميع»
    ok: (a, b) => (len(a) !== 4 || len(b) !== 4 ? 'not two four-digit numbers' : !borrowsInto(a, b).some(Boolean) ? 'no borrow' : null),
  },
  {
    title: 'الطَّرْحُ مَعَ وُجودِ أَصْفارٍ', grade: 3, id: 'sub_zeros_g3', add: false,
    // «طرح عددين كل منهما مكون من 4 منازل أحدهما يحوي أصفارًا»
    ok: (a, b) => {
      if (len(a) !== 4 || len(b) !== 4) return 'not two four-digit numbers';
      const x = cols(a), r = borrowsInto(a, b);
      // a borrow reaches a zero digit of a: that zero had to be regrouped
      return [1, 2].some(i => x[i] === 0 && r[i - 1]) ? null : 'no borrow passes through a zero';
    },
  },
];

describe('addition and subtraction with regrouping (Grades 2 and 3)', () => {
  for (const s of SPECS) {
    it(`«${s.title}» (G${s.grade}) reaches ${s.id}, and only in its grade`, () => {
      assert.equal(topicFor(s.title, s.grade)?.id, s.id);
      for (const g of [1, 2, 3, 4]) if (g !== s.grade) assert.notEqual(topicFor(s.title, g)?.id, s.id, `grade ${g}`);
    });

    it(`«${s.title}» (G${s.grade}) is served by it, not by the «${s.add ? 'جمع' : 'طرح'}» drill`, () => {
      // The drill used to claim any title naming «جمع/طرح» before a topic was asked.
      assert.deepEqual(elementaryOpsForTitle(s.title), []);
      assert.ok(mathBankCovers(s.title, null, s.grade));
      const used = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const q = takeElementaryMath('short_answer', s.title, null, s.grade, TIERS[i % 3]!, 'ar', 2, used);
        assert.ok(q, 'an item comes back');
        const nums = (q.text.match(/[0-9]+/g) ?? []).map(Number);
        assert.ok(nums.length >= 2, q.text);
        assert.equal(s.ok(nums[0]!, nums[1]!), null, `${s.ok(nums[0]!, nums[1]!)}: ${q.text}`);
      }
    });

    it(`«${s.title}» (G${s.grade}): every item needs the lesson's regrouping, and its key is right`, () => {
      const kinds = new Set<string>();
      const op = s.add ? '+' : '−';
      for (const item of draws(s.id, s.grade)) {
        const p = item.promptAr!;
        const m = p.match(new RegExp(`([0-9]+) ${s.add ? '\\+' : op} ([0-9]+)`)) ?? null;
        let a: number, b: number;
        if (m) { a = Number(m[1]); b = Number(m[2]); } else {
          // a story: the two numbers in order
          const n = (p.match(/[0-9]+/g) ?? []).map(Number);
          assert.equal(n.length, 2, `a story names two numbers: ${p}`);
          [a, b] = n as [number, number];
        }
        assert.equal(s.ok(a, b), null, `${s.ok(a, b)}: ${p}`);
        const r = s.add ? a + b : a - b;
        assert.ok(r > 0, p);
        const dm = p.match(/ما رقم (\S+) في ناتج/);
        if (dm) {
          kinds.add('digit');
          const place = PLACE[dm[1]!];
          assert.ok(place !== undefined, p);
          assert.equal(item.answer, String(Math.floor(r / 10 ** place!) % 10), p);
        } else {
          kinds.add(m ? 'bare' : 'story');
          assert.equal(item.answer, String(r), p);
          // the classic slip is offered: dropping the carry, or taking the smaller digit from the larger
          const slip = s.add
            ? Number(cols(a).map((d, i) => (d + (cols(b)[i] ?? 0)) % 10).reverse().join(''))
            : Number(cols(a).map((d, i) => Math.abs(d - (cols(b)[i] ?? 0))).reverse().join(''));
          assert.ok(item.wrongs.includes(String(slip)), `the slip ${slip} is an option: ${p} {${item.wrongs.join(' | ')}}`);
        }
        assert.equal(item.wrongs.length, 3, p);
        assert.equal(new Set(item.wrongs).size, 3, p);
        assert.ok(!item.wrongs.includes(item.answer), p);
        for (const w of item.wrongs) assert.ok(/^[0-9]+$/.test(w), `a whole-number option: «${w}» in ${p}`);
      }
      assert.deepEqual([...kinds].sort(), ['bare', 'digit', 'story']);
    });
  }
});

describe('«لـ» before a word without «ال» (Grade 2 audit)', () => {
  it('a name with no article takes a plain «ل»: «لمتوازي المستطيلات», never «لـمتوازي»', () => {
    let seen = false;
    for (const t of TOPICS) {
      for (const g of [1, 2, 3, 4]) {
        if (g < t.grades[0] || g > t.grades[1]) continue;
        for (let i = 0; i < 60; i++) {
          const item = makeTopicItem(t, g, TIERS[i % 3]!, new Set(), seeded(i * 31 + g));
          // «لـ 3 دراجات», «لـ x» are right: a preposition cannot join a digit or a Latin letter
          assert.ok(!/لـ[ء-ي]/.test(item.promptAr ?? ''), `${t.id}: ${item.promptAr}`);
          if (/لمتوازي المستطيلات/.test(item.promptAr ?? '')) seen = true;
        }
      }
    }
    assert.ok(seen, 'the solid-parts lesson asks about «متوازي المستطيلات»');
  });
});
