import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentScheduledLesson, lessonShown, loadPrepSkips, publishScheduledLesson, setActiveLessonContextUser, setPrepSkip,
  subscribeLessonPick, subscribeScheduledLesson, saveLessonPick, showsPeriodLine, timetableWins,
  type HomeLessonPick, type ScheduledLesson,
} from '../lessonContext.ts';
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

describe('timetableWins', () => {
  const today = '2026-09-27';
  it('lets the timetable replace a pick from an earlier day, or no pick', () => {
    assert.equal(timetableWins({ ...pick('Waves'), pickedOn: '2026-09-20' }, true, today), true);
    assert.equal(timetableWins({ ...pick('Waves') }, true, today), true); // saved before pickedOn existed
    assert.equal(timetableWins(null, true, today), true);
  });

  it('keeps a pick made today', () => {
    assert.equal(timetableWins({ ...pick('Waves'), pickedOn: today }, true, today), false);
  });

  it('never wins without a scheduled lesson', () => {
    assert.equal(timetableWins(null, false, today), false);
  });
});

describe('showsPeriodLine', () => {
  it('shows the next period when the card follows the timetable', () => {
    assert.equal(showsPeriodLine(true, true, true), true);
  });

  it('shows it when the class has no lesson yet, so a saved timetable is visible at once', () => {
    assert.equal(showsPeriodLine(true, false, false), true);
  });

  it('hides it when a lesson picked today is on the card instead of the period\'s lesson', () => {
    assert.equal(showsPeriodLine(true, true, false), false);
  });

  it('has nothing to show without a next period', () => {
    assert.equal(showsPeriodLine(false, false, false), false);
    assert.equal(showsPeriodLine(false, true, true), false);
  });
});

describe('lessonShown', () => {
  const today = '2026-10-26';
  const scheduled: ScheduledLesson = { topic: 'Stellar systems', lessonId: 'L-sched', gradeId: 'grade-10', subjectId: 'earth' };

  it('names the timetable\'s lesson when the pick is from an earlier day, so every surface agrees with Today', () => {
    const shown = lessonShown({ ...pick('Vocabulary'), pickedOn: '2026-10-20' }, scheduled, today);
    assert.equal(shown?.topic, 'Stellar systems');
    assert.equal(shown?.lessonId, 'L-sched');
    assert.equal(shown?.subjectId, 'earth');
  });

  it('names the timetable\'s lesson when there is no pick', () => {
    assert.equal(lessonShown(null, scheduled, today)?.topic, 'Stellar systems');
  });

  it('keeps a lesson picked today: it is a decision', () => {
    const shown = lessonShown({ ...pick('Vocabulary'), pickedOn: today }, scheduled, today);
    assert.equal(shown?.topic, 'Vocabulary');
  });

  it('keeps the pick when the timetable has no lesson', () => {
    const p = { ...pick('Vocabulary'), pickedOn: '2026-10-20' };
    assert.deepEqual(lessonShown(p, null, today), p);
    assert.equal(lessonShown(null, null, today), null);
  });
});

describe('the lesson the timetable puts on Today, shared with the other surfaces', () => {
  const lesson: ScheduledLesson = { topic: 'Stellar systems', lessonId: 'L1', gradeId: 'grade-10', subjectId: 'earth' };

  it('tells subscribers what Today resolved, and that there is none', () => {
    const seen: (ScheduledLesson | null)[] = [];
    const unsubscribe = subscribeScheduledLesson(l => seen.push(l));
    try {
      publishScheduledLesson(lesson);
      publishScheduledLesson(null);
      assert.deepEqual(seen, [lesson, null]);
    } finally {
      unsubscribe();
    }
    publishScheduledLesson(lesson);
    assert.equal(seen.length, 2, 'an unsubscribed listener hears nothing more');
    publishScheduledLesson(null);
  });

  it('is forgotten when another teacher signs in on the same device', () => {
    publishScheduledLesson(lesson);
    assert.deepEqual(currentScheduledLesson(), lesson);
    setActiveLessonContextUser('another-teacher');
    assert.equal(currentScheduledLesson(), null);
    setActiveLessonContextUser(null);
  });
});

describe('prep skips', () => {
  // AsyncStorage does not persist under the bare node runner, so a read-back
  // cannot be asserted here — only the list each call hands back.
  it('returns the lesson\'s list after marking and unmarking', async () => {
    assert.deepEqual(await setPrepSkip('L-skip', 'activity', true), ['activity']);
    assert.deepEqual(await setPrepSkip('L-skip', 'activity', false), []);
  });

  it('has nothing for a lesson with no key', async () => {
    assert.deepEqual(await loadPrepSkips(null), []);
  });
});
