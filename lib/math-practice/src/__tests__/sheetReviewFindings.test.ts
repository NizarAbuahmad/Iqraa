/**
 * What the hand review of the ready-made sheets found (2026-11-20), pinned on
 * the generators so it cannot come back. Two independent passes read every
 * question of the 432 Grades 1–9 sheets and found no wrong arithmetic; these are
 * the questions that were right by formula and wrong as questions:
 *
 *  - «ما القيمة المنزلية للرقم 6 في العدد 64.36؟» — the digit occurs twice, so
 *    the question has two true answers (60 and 0.06);
 *  - «ما المساحة الجانبية لهرم … طول ضلعها 11 سم، وارتفاعه المائل 3 سم؟» — a
 *    slant height under half the base side: no such pyramid;
 *  - «AB = 6 و AC = 24 و BD = 12 … فما طول DC؟» keyed 48 — sides 6, 24, 60: no
 *    such triangle;
 *  - «نظّمها في فئات طول كل منها 5. ما الفئة المنوالية؟» — the first class is not
 *    named, and starting at the smallest mark gives another modal class;
 *  - «ما العمل الذي يأتي بعد «أتناول الفطور» مباشرة؟» with no list — every
 *    sibling question on that sheet prints four to choose from.
 *
 * The sweep draws every template in `TOPICS` at every tier and checks each item
 * whose wording matches.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';
import type { ConcreteItem, DiffTier } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every item every template draws, at every grade it serves. */
const ALL: ConcreteItem[] = (() => {
  const out: ConcreteItem[] = [];
  for (const topic of TOPICS) {
    const [g0, g1] = (topic as { grades?: [number, number] }).grades ?? [1, 10];
    for (let i = 0; i < 150; i += 1) {
      const grade = g0 + (i % (g1 - g0 + 1));
      try {
        out.push(makeTopicItem(topic, grade, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11)));
      } catch {
        // a template that refuses a tier is another test's business
      }
    }
  }
  return out;
})();
const prompts = (re: RegExp) => ALL.filter(item => re.test(item.promptAr ?? ''));

describe('the hand review of the ready-made sheets, on the generators', () => {
  it('a place-value question names a digit that occurs once in its number', () => {
    const found = prompts(/القيمة المنزلية للرقم/);
    assert.ok(found.length > 50, `only ${found.length} place-value items drawn`);
    for (const item of found) {
      const [, digit, number] = item.promptAr!.match(/للرقم (\d) في العدد ([\d.]+)/)!;
      const count = [...number!.replace('.', '')].filter(c => c === digit).length;
      assert.equal(count, 1, `«${item.promptAr}»: the digit ${digit} occurs ${count} times`);
    }
  });

  it('a square pyramid has a slant height over half its base side', () => {
    // Slant-height questions only: a tent's volume gives a vertical height, in metres.
    const found = prompts(/هرم.*قاعدته مربعة طول ضلعها.*المائل/);
    assert.ok(found.length > 20, `only ${found.length} pyramid items drawn`);
    for (const item of found) {
      const [, side, slant] = item.promptAr!.match(/طول ضلعها (\d+) سم.*?(\d+) سم؟/)!;
      assert.ok(Number(slant) * 2 > Number(side), `«${item.promptAr}»: no such pyramid`);
    }
  });

  it('the angle-bisector triangle exists', () => {
    const found = prompts(/AD منصف للزاوية A/);
    assert.ok(found.length > 10, `only ${found.length} bisector items drawn`);
    for (const item of found) {
      const [ab, ac, bd] = item.promptAr!.match(/AB = (\d+) سم و AC = (\d+) سم و BD = (\d+) سم/)!.slice(1).map(Number);
      const bc = bd! + Number(item.answer);
      const sides = [ab!, ac!, bc].sort((x, y) => x - y);
      assert.ok(sides[0]! + sides[1]! > sides[2]!, `«${item.promptAr}» → DC = ${item.answer}: sides ${sides.join(', ')} make no triangle`);
    }
  });

  it('grouping raw marks names the first class', () => {
    const found = prompts(/نظّمها في فئات طول كل منها/);
    assert.ok(found.length > 10, `only ${found.length} grouping items drawn`);
    for (const item of found) assert.match(item.promptAr!, /أولاها \d+–\d+/, item.promptAr);
  });

  it('«what comes next» in the school day lists what to choose from', () => {
    const found = prompts(/ما العمل الذي يأتي بعد/);
    assert.ok(found.length > 5, `only ${found.length} items drawn`);
    for (const item of found) {
      assert.ok(item.promptAr!.includes(item.answer), `«${item.promptAr}»: the answer is not among the listed`);
      for (const wrong of item.wrongs) assert.ok(item.promptAr!.includes(wrong), `«${wrong}» missing from «${item.promptAr}»`);
    }
  });
});
