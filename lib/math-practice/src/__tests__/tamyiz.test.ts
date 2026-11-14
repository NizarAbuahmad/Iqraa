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
  ['أمتار', 'مترًا', 'متر'], ['سنتيمترات', 'سنتيمترًا', 'سنتيمتر'], ['كيلوغرامات', 'كيلوغرامًا', 'كيلوغرام'],
  ['غرامات', 'غرامًا', 'غرام'], ['لترات', 'لترًا', 'لتر'], ['مليلترات', 'مليلترًا', 'مليلتر'],
  // Grade 3's calendar printed «بعد 9 يومًا» and «في 2 أسابيع» (found 2026-11-13).
  ['أيام', 'يومًا', 'يوم'], ['أسابيع', 'أسبوعًا', 'أسبوع'], ['ساعات', 'ساعةً', 'ساعة'],
  // Grade 2's equal groups printed «2 مجموعات» and «30 قطع».
  ['مجموعات', 'مجموعةً', 'مجموعة'], ['قطع', 'قطعةً', 'قطعة'], ['قروش', 'قرشًا', 'قرش'],
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
            // The noun ends at anything but a letter or a mark: U+0600-U+0620 are
            // punctuation, and counting «؟» as a letter hid every noun that ends a question.
            // Not a fraction's denominator either («1/4 مجموعة»).
            const re = new RegExp(`(?<![\\d./])(\\d+) (${forms.join('|')})(?![\\u0621-\\u065F\\u0670-\\u06FF])`, 'g');
            for (const m of ar.matchAll(re)) {
              const n = Number(m[1]);
              // One and two are said with the noun alone: «قلم واحد», «قلمان» / «قلمين»,
              // never «1 قلمًا» or «2 أقلام» (Grade 2 and Grade 7 printed the latter).
              // A unit fact is an equation the books print with the digit: «1 متر = 100 سنتيمتر».
              const isFact = /^\s*=/.test(ar.slice(m.index! + m[0].length));
              if ((n === 1 || n === 2) && !isFact) { bad.add(`${topic.id}: «${m[0]}» — write ${n} as the noun itself — ${ar}`); continue; }
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
    assert.deepEqual([...bad].slice(0, 400), []);
  });
});
