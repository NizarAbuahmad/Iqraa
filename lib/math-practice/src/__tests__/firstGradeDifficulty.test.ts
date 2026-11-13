import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { firstGradeLoad, pickByDifficulty } from '../firstGradeDifficulty.ts';
import { makeTopicItem, topicFor } from '../topics.ts';

const d = (ar: string, answer: string) => ({ ar, answer });

describe('Grade 1 difficulty', () => {
  it('weighs the largest number (a ★ row by its length), then the words', () => {
    assert.ok(firstGradeLoad(d('3 + 4 = ؟', '7')) < firstGradeLoad(d('9 + 8 = ؟', '17')));
    assert.equal(firstGradeLoad(d('كم نجمة: ★ ★ ★ ★ ★؟', '5')), 500 + 2, 'five stars, two words');
    assert.ok(firstGradeLoad(d('ما عكس فوق؟', 'تحت')) < firstGradeLoad(d('إذا كانت القطة فوق الطاولة، فإن الطاولة ___ القطة.', 'تحت')));
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

  it('only Grade 1 is chosen by difficulty: a Grade 2 item of the same generator is drawn as before', () => {
    const topic = topicFor('العدد المفقود', 1)!;
    const rng = () => 0.42;
    // A fixed rng makes every draw identical, so Grade 1 and Grade 2 agree here; what differs is how many draws.
    let calls = 0;
    const counted = { ...topic, make: (c: Parameters<typeof topic.make>[0]) => { calls++; return topic.make(c); } };
    makeTopicItem(counted, 2, 'hard', new Set(), rng);
    const g2 = calls; calls = 0;
    makeTopicItem(counted, 1, 'hard', new Set(), Math.random);
    assert.equal(g2, 1, 'grade 2 stops at its first unserved kind');
    assert.ok(calls >= 15, `grade 1 drew ${calls}`);
  });
});
