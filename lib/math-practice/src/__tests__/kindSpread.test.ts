/**
 * A topic generator with several kinds of question puts each kind on the paper
 * before repeating one.
 *
 * The kind used to be drawn uniformly, so a paper could hold four «ما بُعد الوتر
 * عن المركز؟» and no «ما طول المماس؟» (measured 2026-10-15; see `stemFrame`).
 * The bank is deliberately left uniform — see `makeTopicItem`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sameKind, stemFrame, topicFor } from '../index.ts';
import { makeTopicItem } from '../topics.ts';
import { makeElementaryItem } from '../elementary.ts';
import type { Topic } from '../topicKit.ts';

/** mulberry32 — a seeded rng so a failure names a reproducible draw. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kindsOf = (stems: string[]) => {
  const counts = new Map<string, number>();
  for (const s of stems) counts.set(stemFrame(s), (counts.get(stemFrame(s)) ?? 0) + 1);
  return counts;
};

describe('a topic generator spreads its draws over its kinds of question', () => {
  // Three kinds: distance of a chord from the centre, length of a chord, length of a tangent.
  const chords = topicFor('أوتار الدائرة وأقطارها ومماساتها', 10)!;

  // Deterministic: seeded draws, so the count below is exact for this code. A
  // kind's own numbers can run out (no fresh tangent left), so not every seed
  // balances; a uniform draw balanced 17 of these 40, this one 37.
  it('puts each kind on a nine-item paper three times, nearly always', () => {
    let balanced = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const used = new Set<string>();
      const rng = seeded(seed * 7919);
      const stems = Array.from({ length: 9 }, () => makeTopicItem(chords, 10, 'medium', used, rng).promptAr!);
      const kinds = kindsOf(stems);
      assert.equal(kinds.size, 3, `seed ${seed}: ${[...kinds.keys()].join(' | ')}`);
      if (Math.max(...kinds.values()) === 3) balanced += 1;
    }
    assert.ok(balanced >= 35, `only ${balanced} of 40 papers balanced`);
  });

  it('still draws one item when nothing has been served — the first draw is not searched', () => {
    const item = makeTopicItem(chords, 10, 'medium', new Set(), seeded(1));
    assert.ok(item.promptAr);
  });
});

/**
 * A kind written in several sentences takes one kind's share, not one share per
 * sentence (2026-10-16). Spreading by sentence alone gave «ناتج جمع/ضرب/طرح/
 * قسمة العدد …» four turns for every one a single-sentence kind got.
 */
describe('a kind written several ways is still one kind', () => {
  // algebra.ts's own four sentences for «write an expression».
  const VARIANTS = ['اكتب مقدارًا جبريًا يعبّر عن: ناتج جمع العدد x و 3.', 'اكتب مقدارًا جبريًا يعبّر عن: ناتج ضرب العدد x في 3.',
    'اكتب مقدارًا جبريًا يعبّر عن: ناتج طرح 3 من العدد x.', 'اكتب مقدارًا جبريًا يعبّر عن: ناتج قسمة العدد x على 3.'];
  const OTHERS = ['أوجد قيمة المقدار 2x + 1 عندما x = 3', 'فكّرت سلمى في عدد، ثم أضافت إليه 3 فكان الناتج 7. ما العدد؟'];
  const sentences = [...VARIANTS, ...OTHERS];
  // Each draw picks one of the six sentences uniformly, with fresh numbers so no stem repeats.
  let k = 0;
  const fake: Topic = {
    id: 'fake', match: /fake/, grades: [5, 5],
    make: ({ rng }) => {
      const s = sentences[Math.floor(rng() * sentences.length)]!.replace(/3/g, String(3 + (k++ % 50)));
      return { eq: s, answer: '1', wrongs: ['2', '3', '4'], ar: s, en: s };
    },
  };

  // `sameKind` is not transitive — «ضرب العدد # في #» and «طرح # من العدد #» are
  // each near «جمع العدد #», not near each other — so a served sentence counts
  // against every sentence near it, and four rewordings stay linked.
  it('links the four sentences into one kind and keeps the others apart', () => {
    for (const a of VARIANTS) assert.ok(VARIANTS.some(b => b !== a && sameKind(stemFrame(a), stemFrame(b))), a);
    for (const a of VARIANTS) for (const b of OTHERS) assert.ok(!sameKind(stemFrame(a), stemFrame(b)), `${a} / ${b}`);
    assert.ok(!sameKind(stemFrame(OTHERS[0]!), stemFrame(OTHERS[1]!)));
  });

  it('gives the four-sentence kind a third of a twelve-item paper, not two thirds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const used = new Set<string>();
      const rng = seeded(seed * 104729);
      const stems = Array.from({ length: 12 }, () => makeTopicItem(fake, 5, 'medium', used, rng).promptAr!);
      const many = stems.filter(s => VARIANTS.some(v => sameKind(stemFrame(v), stemFrame(s)))).length;
      assert.ok(many <= 5, `seed ${seed}: ${many} of 12 were the four-sentence kind`);
    }
  });
});

describe('an elementary drill spreads its draws over its kinds too', () => {
  // Grade 2 addition: a sum, a missing addend (two places), a word problem, three addends, a fact family.
  it('keeps any one kind to at most two more than an even share of a twelve-item paper', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const used = new Set<string>();
      const rng = seeded(seed * 15485863);
      const frames = Array.from({ length: 12 }, () => {
        const item = makeElementaryItem('جمع الأعداد ضمن 1000', 2, 'medium', used, rng);
        return stemFrame(item.promptAr ?? item.eq);
      });
      const groups: string[][] = [];
      for (const f of frames) { const g = groups.find(g => sameKind(g[0]!, f)); if (g) g.push(f); else groups.push([f]); }
      assert.ok(groups.length >= 3, `seed ${seed}: ${groups.length} kinds`);
      const fair = Math.ceil(12 / groups.length);
      assert.ok(Math.max(...groups.map(g => g.length)) <= fair + 2, `seed ${seed}: ${groups.map(g => g.length).join(',')}`);
    }
  });
});
