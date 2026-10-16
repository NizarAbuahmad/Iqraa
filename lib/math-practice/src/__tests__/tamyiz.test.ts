/**
 * A counted noun after a numeral agrees with it, in every generator.
 *
 * «باعت مدرسة 18 تذكرة» and «جمع 44 نقطة» shipped in the 2026-10-16 kinds
 * (11–99 take the accusative singular: «18 تذكرةً»), and the dinar stems had
 * one fixed form whatever the amount. Each generator now spells these through
 * `tamyiz` / `dinars` (topicKit), and this reads every stem they print.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../topics.ts';
import { tamyiz } from '../topicKit.ts';

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [plural, accusative singular, genitive singular] */
const NOUNS: Array<[string, string, string]> = [
  ['دنانير', 'دينارًا', 'دينار'],
  ['نقاط', 'نقطةً', 'نقطة'],
  ['تذاكر', 'تذكرةً', 'تذكرة'],
  ['أقلام', 'قلمًا', 'قلم'],
  ['أكواب', 'كوبًا', 'كوب'],
];

describe('counted nouns', () => {
  it('agree with the numeral before them', () => {
    const rng = seeded(7);
    const bad = new Set<string>();
    let seen = 0;
    for (const topic of TOPICS) {
      for (let grade = topic.grades[0]; grade <= topic.grades[1]; grade++) {
        for (let i = 0; i < 150; i++) {
          const ar = topic.make({ rng, diff: (['easy', 'medium', 'hard'] as const)[i % 3], grade }).ar;
          for (const forms of NOUNS) {
            // A whole number not inside a decimal («2.50 دينارًا» is read as an amount).
            const re = new RegExp(`(?<![\\d.])(\\d+) (${forms.join('|')})(?![\\u0600-\\u06FF])`, 'g');
            for (const m of ar.matchAll(re)) {
              const n = Number(m[1]);
              if (n < 3) continue;
              seen++;
              const want = tamyiz(n, ...forms);
              if (m[2] !== want) bad.add(`${topic.id}: «${m[0]}» should be «${n} ${want}» — ${ar}`);
            }
          }
        }
      }
    }
    assert.ok(seen > 200, `only ${seen} counted nouns read`);
    assert.deepEqual([...bad].slice(0, 15), []);
  });
});
