/**
 * The three Grade 7 maths lessons that had no offline questions until
 * 2026-11-13 (`../g7.ts`): «خطة حل المسألة: الحل العكسي», «التطابق» and
 * «خطة حل المسألة: الرسم». There is no extracted Grade 7 book, so the kinds
 * follow the lessons' NCCD objectives.
 *
 * Every key is recomputed from the numbers printed in its own Arabic stem by a
 * route that shares no code with the generator: the forward story is replayed
 * from the claimed start (working backward), the vertex correspondence is read
 * off the printed letters (congruence), and the sketch is simulated — posts laid
 * one by one, a snail stepped day by day, handshakes counted pair by pair.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G7_TOPICS } from '../g7.ts';
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
function draws(id: string, n = 600): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 7, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 13)));
}
/** Every number printed in a stem, «−» read as a minus sign. */
const nums = (s: string) => [...s.matchAll(/−?\d+/g)].map(m => Number(m[0].replace('−', '-')));
const signedNum = (s: string) => Number(s.replace('−', '-').replace('°', ''));
const minutesOf = (s: string) => { const [h, m] = s.split(':').map(Number); return h! * 60 + m!; };

const TITLES = {
  g7_work_backward: 'خطة حل المسألة: الحل العكسي',
  g7_congruence: 'التطابق',
  g7_draw_diagram: 'خطة حل المسألة: الرسم',
};

describe('Grade 7 lessons that had no offline questions: routing', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches ${id} in Grade 7, and nowhere else`, () => {
      assert.equal(topicFor(title, 7)?.id, id);
      assert.ok(mathBankCovers(title, null, 7), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 7, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
      for (const g of [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
        const t = topicFor(title, g);
        assert.ok(!t || !t.id.startsWith('g7_'), `Grade ${g} «${title}» captured by ${t?.id}`);
      }
    });
  }

  it('the generators cover only Grade 7 and are not reached by a similar title', () => {
    for (const t of G7_TOPICS) assert.deepEqual(t.grades, [7, 7], t.id);
    for (const title of ['تطابق المثلثات', 'التطابق والتشابه', 'خطة حل المسألة: البحث عن نمط', 'خطة حل المسألة', 'الرسم البياني', 'الحل العكسي للمعادلات']) {
      assert.ok(!topicFor(title, 7)?.id.startsWith('g7_'), title);
    }
  });

  it('every title written the way a book writes it (diacritics, ة, أ) is found', () => {
    for (const [id, title] of [
      ['g7_work_backward', 'خُطّةُ حَلِّ المَسْأَلَةِ: الحَلُّ العَكْسِيُّ'], ['g7_work_backward', 'خطه حل المساله الحل العكسي'],
      ['g7_congruence', 'التَّطابُقُ'], ['g7_draw_diagram', 'خطّةُ حلِّ المسألةِ: الرّسمُ'],
    ] as const) assert.equal(topicFor(title, 7)?.id, id, title);
  });
});

describe('Grade 7 generators: shape', () => {
  for (const t of G7_TOPICS) {
    it(`${t.id}: distinct options, clean text, never verified, no check, both languages`, () => {
      for (const item of draws(t.id)) {
        const where = `${t.id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        assert.ok(!('check' in item) && !('verified' in item), `carries a check: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
        }
        assert.ok(!/[٠-٩]/.test(item.promptAr! + item.answer + item.wrongs.join('')), where);
        // counts, money and lengths are positive; a number-machine answer is any integer, so 0 is a fair wrong option there
        if (!item.promptAr!.startsWith('فكّرتُ')) for (const s of [item.answer, ...item.wrongs]) if (/^\d+$/.test(s)) assert.ok(Number(s) > 0, `non-positive option: ${where}`);
        // a counted noun after 1 or 2 takes its own form, never «2 دينارًا»
        assert.ok(!/(^|[^\d])[12] (دينار|دنانير|درجة|درجات|دقيقة|دقائق|طاولة|طاولات|شخص|أشخاص|قطع)/.test(item.promptAr!), `1/2 + noun: ${where}`);
      }
    });
  }

  it('every tier gets several kinds, and a paper of 10 does not repeat a stem', () => {
    for (const t of G7_TOPICS) {
      const used = new Set<string>();
      const stems = Array.from({ length: 10 }, (_, i) => makeTopicItem(t, 7, TIERS[i % 3]!, used, seeded(i + 1)).promptAr);
      assert.equal(new Set(stems).size, 10, t.id);
    }
  });
});

describe('Grade 7 keys, recomputed from the printed stem', () => {
  it('working backward: replaying the story forward from the key gives the printed result', () => {
    const kinds = new Set<string>();
    for (const it of draws('g7_work_backward')) {
      const s = it.promptAr!, n = nums(s), where = `«${s}» → ${it.answer}`;
      if (s.startsWith('فكّرتُ')) {
        kinds.add('machine');
        let v = signedNum(it.answer);
        const m = Number(s.match(/ضربته في (\d+)/)![1]);
        v *= m;
        const add = s.match(/أضفتُ إلى الناتج (\d+)/), sub = s.match(/طرحتُ من الناتج (\d+)/), div = s.match(/قسمتُ الناتج على (\d+)/);
        if (add) v += Number(add[1]);
        if (sub) v -= Number(sub[1]);
        if (div) { assert.equal(Math.abs(v % Number(div[1])), 0, where); v /= Number(div[1]); }
        assert.equal(v, signedNum(s.match(/النتيجة (−?\d+)/)![1]!), where);
      } else if (s.startsWith('مع سلمى')) {
        kinds.add('money');
        const [spent, left] = n as [number, number];
        assert.equal((Number(it.answer) - spent) / 2, left, where);
      } else if (s.startsWith('أنفق تاجرٌ')) {
        kinds.add('fractions');
        const part: Record<string, number> = { نصف: 2, ثلث: 3, ربع: 4, خمس: 5 };
        const [, p, q] = s.match(/أنفق تاجرٌ (\S+) ما معه من نقود، ثم أنفق (\S+) ما تبقّى/)!;
        let v = Number(it.answer);
        v -= v / part[p!]!;
        v -= v / part[q!]!;
        assert.equal(v, n[n.length - 1], where);
      } else if (s.startsWith('انخفضت')) {
        kinds.add('temperature');
        const [fall, rise, end] = n as [number, number, number];
        assert.equal(signedNum(it.answer) - fall + rise, end, where);
      } else {
        kinds.add('clock');
        const arrive = minutesOf(s.match(/الساعة (\d+:\d+)/)![1]!);
        const durations = [...s.matchAll(/(\d+) (?:دقيقة|دقائق)/g)].map(m => Number(m[1]));
        assert.equal(durations.length, 3, where);
        assert.equal(minutesOf(it.answer) + durations.reduce((a, b) => a + b, 0), arrive, where);
      }
    }
    assert.deepEqual([...kinds].sort(), ['clock', 'fractions', 'machine', 'money', 'temperature']);
  });

  it('congruence: the key is the part the printed letter order pairs with', () => {
    const kinds = new Set<string>();
    for (const it of draws('g7_congruence')) {
      const s = it.promptAr!, where = `«${s}» → ${it.answer}`;
      const [, a, b] = s.match(/إذا كان △?([A-Z]+) ≅ △?([A-Z]+)/)!;
      const map = new Map([...a!].map((c, i) => [c, b![i]!]));
      const back = new Map([...b!].map((c, i) => [c, a![i]!]));
      // the second name runs round its polygon: each letter's neighbours in the name are its neighbours in the shape
      assert.equal(new Set(b).size, a!.length, where);
      if (/الضلع المناظر للضلع ([A-Z]{2})/.test(s)) {
        kinds.add('side');
        const [p, q] = [...s.match(/الضلع المناظر للضلع ([A-Z]{2})/)![1]!];
        assert.equal(it.answer, `${map.get(p!)}${map.get(q!)}`, where);
      } else if (/الزاوية المناظرة للزاوية ([A-Z])/.test(s)) {
        kinds.add('angle');
        assert.equal(it.answer, `∠${map.get(s.match(/الزاوية المناظرة للزاوية ([A-Z])/)![1]!)}`, where);
      } else if (/قياس الزاوية ([A-Z])/.test(s)) {
        const target = back.get(s.match(/قياس الزاوية ([A-Z])/)![1]!)!;
        const given = new Map([...s.matchAll(/m∠([A-Z]) = (\d+)°/g)].map(m => [m[1]!, Number(m[2])]));
        const total = a!.length === 3 ? 180 : 360;
        const sum = [...given.values()].reduce((x, y) => x + y, 0);
        const want = given.has(target) ? given.get(target)! : total - sum;
        kinds.add(given.has(target) ? 'measure' : 'angle sum');
        if (given.size === a!.length) assert.equal(sum, total, `angles do not close: ${where}`);
        assert.equal(it.answer, `${want}°`, where);
      } else if (/محيط/.test(s)) {
        kinds.add('perimeter');
        // read each printed side, carry it across the correspondence onto the first triangle, add the three sides
        const sides = new Map<string, number>();
        for (const m of s.matchAll(/([A-Z])([A-Z]) = (\d+) سم/g)) {
          const [p, q] = [m[1]!, m[2]!].map(c => (a!.includes(c) ? c : back.get(c)!));
          sides.set([p, q].sort().join(''), Number(m[3]));
        }
        assert.equal(sides.size, 3, `three different sides: ${where}`);
        const [x, y, z] = [...sides.values()] as [number, number, number];
        assert.ok(x + y > z && x + z > y && y + z > x, `not a triangle: ${where}`);
        assert.equal(Number(it.answer), x + y + z, where);
      } else {
        kinds.add('x');
        const [, p, q, k, c, r, t, len] = s.match(/([A-Z])([A-Z]) = \((\d+)x \+ (\d+)\) سم، ([A-Z])([A-Z]) = (\d+) سم/)!;
        assert.equal(map.get(p!), r, where);
        assert.equal(map.get(q!), t, where);
        assert.equal(Number(k) * Number(it.answer) + Number(c), Number(len), where);
      }
    }
    assert.deepEqual([...kinds].sort(), ['angle', 'angle sum', 'measure', 'perimeter', 'side', 'x']);
  });

  it('draw a diagram: the sketch, simulated, gives the key', () => {
    const kinds = new Set<string>();
    for (const it of draws('g7_draw_diagram')) {
      const s = it.promptAr!, n = nums(s), key = Number(it.answer), where = `«${s}» → ${it.answer}`;
      if (s.startsWith('سياج مستقيم')) {
        kinds.add('fence');
        const [len, gap] = n as [number, number];
        let posts = 0;
        for (let at = 0; at <= len; at += gap) posts++;
        assert.equal(key, posts, where);
      } else if (s.startsWith('حديقة')) {
        kinds.add('ring');
        const [w, h, gap] = n as [number, number, number];
        assert.notEqual(w, h, `a rectangle that is a square: ${where}`);
        // walk the boundary and mark each post position once
        const posts = new Set<string>();
        for (let x = 0; x <= w; x += gap) { posts.add(`${x},0`); posts.add(`${x},${h}`); }
        for (let y = 0; y <= h; y += gap) { posts.add(`0,${y}`); posts.add(`${w},${y}`); }
        assert.equal(key, posts.size, where);
      } else if (s.startsWith('يحتاج نجّار')) {
        kinds.add('cuts');
        const [t, pieces] = n as [number, number];
        let cuts = 0;
        for (let have = 1; have < pieces; have++) cuts++;
        assert.equal(key, cuts * t, where);
      } else if (s.startsWith('في اجتماع')) {
        kinds.add('handshakes');
        const [people] = n as [number];
        let shakes = 0;
        for (let i = 0; i < people; i++) for (let j = i + 1; j < people; j++) shakes++;
        assert.equal(key, shakes, where);
      } else if (s.startsWith('حلزون')) {
        kinds.add('snail');
        const [depth, up, down] = n as [number, number, number];
        let height = 0, day = 0;
        for (;;) { day++; height += up; if (height >= depth) break; height -= down; }
        assert.equal(key, day, where);
      } else if (s.startsWith('يقع منزل')) {
        kinds.add('road');
        const [a, b] = n as [number, number];
        const east = (x: number, side: string) => (side === 'شرق' ? x : -x);
        const [, side2] = s.match(/منزل باسل على بُعد \d+ كم (\S+)/)!;
        assert.equal(key, Math.abs(east(a, 'شرق') - east(b, side2!)), where);
      } else {
        kinds.add('tables');
        const [t] = n as [number];
        // each table has 4 sides; each joint between two tables hides 2
        assert.equal(key, 4 * t - 2 * (t - 1), where);
      }
    }
    assert.deepEqual([...kinds].sort(), ['cuts', 'fence', 'handshakes', 'ring', 'road', 'snail', 'tables']);
  });
});
