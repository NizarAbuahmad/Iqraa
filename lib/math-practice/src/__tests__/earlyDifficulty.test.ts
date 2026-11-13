import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyLoad, pickByDifficulty } from '../earlyDifficulty.ts';
import { makeTopicItem, topicFor } from '../topics.ts';

const d = (ar: string, answer: string) => ({ ar, answer });

describe('grades 1–4 difficulty', () => {
  it('weighs the largest number (a ★ row by its length), then the words', () => {
    assert.ok(difficultyLoad(d('3 + 4 = ؟', '7')) < difficultyLoad(d('9 + 8 = ؟', '17')));
    assert.equal(difficultyLoad(d('كم نجمة: ★ ★ ★ ★ ★؟', '5')), 500 + 2, 'five stars, two words');
    assert.ok(difficultyLoad(d('ما عكس فوق؟', 'تحت')) < difficultyLoad(d('إذا كانت القطة فوق الطاولة، فإن الطاولة ___ القطة.', 'تحت')));
  });

  it('easy takes from the lightest third, hard from the heaviest', () => {
    const drafts = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => d(`${n} + 0 = ؟`, String(n)));
    const rng = Math.random;
    for (let i = 0; i < 50; i++) {
      assert.ok(Number(pickByDifficulty(drafts, 'easy', rng, x => x).answer) <= 3);
      assert.ok(Number(pickByDifficulty(drafts, 'hard', rng, x => x).answer) >= 7);
      const m = Number(pickByDifficulty(drafts, 'medium', rng, x => x).answer);
      assert.ok(m >= 4 && m <= 6);
    }
  });

  it('grades 1–4 choose by difficulty; grade 5 draws as before', () => {
    const topic = topicFor('العدد المفقود', 1)!;
    let calls = 0;
    const counted = { ...topic, make: (c: Parameters<typeof topic.make>[0]) => { calls++; return topic.make(c); } };
    // A constant rng makes every draw the same unserved kind, so grade 5 stops at its first.
    makeTopicItem(counted, 5, 'hard', new Set(), () => 0.42);
    assert.equal(calls, 1, 'grade 5 stops at its first unserved kind');
    for (const g of [1, 2, 3, 4]) {
      calls = 0;
      makeTopicItem(counted, g, 'hard', new Set(), Math.random);
      assert.ok(calls >= 15, `grade ${g} drew ${calls}`);
    }
  });
});
