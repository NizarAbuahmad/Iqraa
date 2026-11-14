/**
 * Grade 7 lessons that had no offline questions (`../g7.ts`): «التطابق» and the
 * two problem-solving plans «الحل العكسي» and «الرسم». Every answer is
 * recomputed from the Arabic stem with separately written code. (Grade 7
 * audit, 2026-11-14.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G7_TOPICS } from '../g7.ts';
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
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 7, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 101)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);

describe('Grade 7 generators: shape', () => {
  for (const t of G7_TOPICS) {
    it(`${t.id}: distinct options, clean text, both languages`, () => {
      for (const item of draws(t.id)) {
        const where = `${t.id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        if (!/^(?:نعم|لا)$/.test(item.answer)) assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, item.wrongs.length + 1, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
        }
        // counted nouns: no «2 أضلاع», «5 قطعة», «8 مرة», «3 دقيقة»
        assert.ok(!/(?:^|[^\d])(?:[3-9]|10) (?:قطعة|مرة|دقيقة|مترًا|عمودًا|يومًا|مصافحةً|دينارًا)(?:[^؀-ۿ]|$)/.test(item.promptAr!), `agreement: ${item.promptAr}`);
      }
    });
  }
});

describe('Grade 7 generators: answers recomputed from the stem', () => {
  it('congruence', () => {
    const kinds = new Set<string>();
    for (const item of draws('congruence_g7')) {
      const p = item.promptAr!, n = nums(p), a = item.answer;
      const corr = p.match(/المثلث (\w)(\w)(\w) يطابق المثلث (\w)(\w)(\w)/);
      if (has(p, 'هل الشكلان متطابقان')) {
        kinds.add('yesno');
        const [a1, b1, a2, b2] = n;
        const same = (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
        assert.equal(a, same ? 'نعم' : 'لا', p);
        continue;
      }
      if (has(p, 'ما قيمة x')) {
        kinds.add('solve');
        const m = p.match(/\((\d+)x \+ (\d+)\) سم/)!, k = Number(m[1]), c = Number(m[2]);
        const known = Number(p.match(/وطول الضلع المناظر له (\d+) سم/)![1]);
        assert.equal(k * Number(a) + c, known, p);
        continue;
      }
      if (has(p, 'محيط')) {
        kinds.add('perimeter');
        const sides = (p.match(/أطوال أضلاعه ([\d، سم و]+?)\./)?.[1] ?? '').match(/\d+/g)!.map(Number);
        assert.equal(Number(a), sides.reduce((x, y) => x + y, 0), p);
        continue;
      }
      assert.ok(corr, p);
      const [, A, B, C, D, E, F] = corr!;
      const map: Record<string, string> = { [A!]: D!, [B!]: E!, [C!]: F! };
      if (has(p, 'ما الضلع المناظر')) {
        kinds.add('side');
        const s = p.match(/للضلع (\w\w)/)![1]!;
        assert.equal(a, map[s[0]!]! + map[s[1]!]!, p);
        continue;
      }
      if (has(p, 'ما طول الضلع')) {
        kinds.add('length');
        const asked = p.match(/ما طول الضلع (\w\w)/)![1]!;
        const given = [...p.matchAll(/(\w\w) = (\d+) سم/g)].map(m => [m[1]!, Number(m[2])] as const);
        const src = given.filter(([s]) => { const t = map[s[0]!]! + map[s[1]!]!; return t === asked || [...t].reverse().join('') === asked; });
        assert.equal(src.length, 1, p);
        assert.equal(Number(a), src[0]![1], p);
        continue;
      }
      kinds.add('angle');
      const angs = [...p.matchAll(/الزاوية (\w) يساوي (\d+)°/g)].map(m => [m[1]!, Number(m[2])] as const);
      const askedV = p.match(/فما قياس الزاوية (\w)؟/)![1]!;
      const back = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
      const src = back[askedV]!;
      const known = Object.fromEntries(angs);
      const v = known[src] ?? 180 - Object.values(known).reduce((x, y) => x + y, 0);
      assert.equal(a, `${v}°`, p);
    }
    assert.equal(kinds.size, 6, [...kinds].join(', '));
  });

  it('working backwards', () => {
    const kinds = new Set<string>();
    for (const item of draws('work_backwards_g7')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer.replace(/[^\d]/g, ''));
      if (has(p, 'فكّر')) {
        kinds.add('number');
        // «ضربه في m ثم أضاف/طرح c ثم قسم الناتج على d فكان الناتج r»
        const m = Number(p.match(/ضربه في (\d+)/)![1]), c = Number(p.match(/(?:أضاف|طرح) (\d+)/)![1]);
        const d = Number(p.match(/قسم الناتج على (\d+)/)![1]), r = Number(p.match(/فكان الناتج النهائي (\d+)/)![1]);
        const plus = has(p, 'أضاف');
        assert.equal(((a * m + (plus ? c : -c)) / d), r, p);
        continue;
      }
      if (has(p, 'دنانير') || has(p, 'دينارًا') || has(p, 'دينار')) {
        kinds.add('money');
        const spent = Number(p.match(/ثم (\d+) /)![1]), left = Number(p.match(/فبقي معها (\d+)/)![1]);
        assert.equal(a / 2 - spent, left, p);
        continue;
      }
      kinds.add('time');
      const [h, mm] = item.answer.split(':').map(Number);
      const [H, M] = p.match(/الساعة (\d+):(\d+)/)!.slice(1).map(Number);
      const mins = [...p.matchAll(/(\d+) دقيقة|(\d+) دقائق/g)].map(m => Number(m[1] ?? m[2]));
      assert.equal(h! * 60 + mm! + mins.reduce((x, y) => x + y, 0), H! * 60 + M!, p);
      void n;
    }
    assert.equal(kinds.size, 3, [...kinds].join(', '));
  });

  it('drawing a diagram', () => {
    const kinds = new Set<string>();
    for (const item of draws('draw_diagram_g7')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'أعمدة')) { kinds.add('posts'); assert.equal(a, n[0]! / n[1]! + 1, p); assert.ok(Number.isInteger(n[0]! / n[1]!), p); continue; }
      if (has(p, 'قطع')) { kinds.add('cuts'); assert.equal(a, (n[0]! - 1) * n[1]!, p); continue; }
      if (has(p, 'صافح')) { kinds.add('handshakes'); assert.equal(a, (n[0]! * (n[0]! - 1)) / 2, p); continue; }
      kinds.add('snail');
      const [depth, up, down] = n;
      let h = 0, day = 0;
      while (true) { day++; h += up!; if (h >= depth!) break; h -= down!; }
      assert.equal(a, day, p);
    }
    assert.equal(kinds.size, 4, [...kinds].join(', '));
  });
});

describe('Grade 7 routing', () => {
  const cases: Array<[string, string]> = [
    ['التَّطابُقُ', 'congruence_g7'],
    ['خُطَّةُ حَلِّ الْمَسْأَلَةِ: الْحَلُّ الْعَكْسِيُّ', 'work_backwards_g7'],
    ['خُطَّةُ حَلِّ الْمَسْأَلَةِ: الرَّسْمُ', 'draw_diagram_g7'],
  ];
  for (const [title, id] of cases) {
    it(`${title} → ${id}`, () => {
      assert.equal(topicFor(title, 7)?.id ?? null, id);
      assert.ok(mathBankCovers(title, null, 7));
    });
  }
  it('only Grade 7 gets them', () => {
    for (const t of G7_TOPICS) assert.deepEqual(t.grades, [7, 7], t.id);
  });
});
