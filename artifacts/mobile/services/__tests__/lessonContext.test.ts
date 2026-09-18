import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeLessonPick, saveLessonPick, type HomeLessonPick } from '../lessonContext.ts';

const pick = (topic: string): HomeLessonPick => ({ topic, unitOrder: null, gradeId: 'grade-10' });

describe('subscribeLessonPick', () => {
  it('notifies a subscriber with the saved pick', async () => {
    const seen: (HomeLessonPick | null)[] = [];
    const unsubscribe = subscribeLessonPick(p => seen.push(p));
    try {
      await saveLessonPick(pick('Functions'));
      assert.deepEqual(seen, [pick('Functions')]);
    } finally {
      unsubscribe();
    }
  });

  it('stops notifying once unsubscribed', async () => {
    const seen: (HomeLessonPick | null)[] = [];
    const unsubscribe = subscribeLessonPick(p => seen.push(p));
    unsubscribe();
    await saveLessonPick(pick('Rocks'));
    assert.deepEqual(seen, []);
  });

  it('notifies every subscriber, independently of the others', async () => {
    const seenA: (HomeLessonPick | null)[] = [];
    const seenB: (HomeLessonPick | null)[] = [];
    const unsubA = subscribeLessonPick(p => seenA.push(p));
    const unsubB = subscribeLessonPick(p => seenB.push(p));
    try {
      await saveLessonPick(pick('Meteorology'));
      assert.deepEqual(seenA, [pick('Meteorology')]);
      assert.deepEqual(seenB, [pick('Meteorology')]);
    } finally {
      unsubA();
      unsubB();
    }
  });
});
