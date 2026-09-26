import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeLessonPick, saveLessonPick, type HomeLessonPick } from '../lessonContext.ts';
import { todayISO } from '../planEntries.ts';

const pick = (topic: string): HomeLessonPick => ({ topic, unitOrder: null, gradeId: 'grade-10' });
/** What subscribers receive: the pick, stamped with the day it was made. */
const saved = (topic: string): HomeLessonPick => ({ ...pick(topic), pickedOn: todayISO() });

describe('subscribeLessonPick', () => {
  it('notifies a subscriber with the saved pick', async () => {
    const seen: (HomeLessonPick | null)[] = [];
    const unsubscribe = subscribeLessonPick(p => seen.push(p));
    try {
      await saveLessonPick(pick('Functions'));
      assert.deepEqual(seen, [saved('Functions')]);
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
      assert.deepEqual(seenA, [saved('Meteorology')]);
      assert.deepEqual(seenB, [saved('Meteorology')]);
    } finally {
      unsubA();
      unsubB();
    }
  });
});

describe('saveLessonPick', () => {
  it('keeps a pickedOn the caller already set', async () => {
    const seen: (HomeLessonPick | null)[] = [];
    const unsubscribe = subscribeLessonPick(p => seen.push(p));
    try {
      await saveLessonPick({ ...pick('Waves'), pickedOn: '2026-01-05' });
      assert.equal(seen[0]?.pickedOn, '2026-01-05');
    } finally {
      unsubscribe();
    }
  });
});
