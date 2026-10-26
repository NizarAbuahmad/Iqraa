import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeLessonContextUser, getNextPeriod, getNextPeriodAgeMs, loadPrepSkips, publishNextPeriod, setActiveLessonContextUser, setPrepSkip,
  subscribeLessonPick, subscribeNextPeriod, saveLessonPick, showsPeriodLine, timetableWins, type HomeLessonPick,
} from '../lessonContext.ts';
import type { NextPeriodLesson } from '../scheduleCalendar.ts';
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

/*
  The period now/next is read by whoever shows or acts on the current lesson
  (Today on focus, the chat on mount, the tab layout on navigation, the Tools tab
  on a tap). One shared copy means a fresh read by any of them corrects all of
  them: the sidebar followed Today's reload instead of waiting for its own.
*/
describe('the shared next period', () => {
  const period = (lessonId: string | null): NextPeriodLesson => ({
    schoolName: '', periodNumber: 2, startTime: '23:00', durationMinutes: 50,
    classGroupId: 'class-1', subjectId: 'earth-science', date: '2026-10-26', happeningNow: false, lessonId,
  });

  it('is unread (undefined, not null) until someone publishes, and again after a different teacher signs in', () => {
    setActiveLessonContextUser('teacher-a');
    assert.equal(getNextPeriod(), undefined);
    publishNextPeriod(period('L1'), activeLessonContextUser());
    assert.equal(getNextPeriod()?.lessonId, 'L1');
    setActiveLessonContextUser('teacher-b');
    assert.equal(getNextPeriod(), undefined, 'teacher A\'s period must not be teacher B\'s');
  });

  it('keeps null as an answer: read, and nothing on the timetable', () => {
    setActiveLessonContextUser('teacher-c');
    publishNextPeriod(null, activeLessonContextUser());
    assert.equal(getNextPeriod(), null);
  });

  it('tells every subscriber, and stops once unsubscribed', () => {
    setActiveLessonContextUser('teacher-d');
    const seen: (NextPeriodLesson | null | undefined)[] = [];
    const unsubscribe = subscribeNextPeriod(n => seen.push(n));
    publishNextPeriod(period('L1'), activeLessonContextUser());
    unsubscribe();
    publishNextPeriod(period('L2'), activeLessonContextUser());
    assert.deepEqual(seen.map(n => n?.lessonId), ['L1']);
  });

  it('drops an answer that was asked for by a teacher who has since signed out', () => {
    setActiveLessonContextUser('teacher-e');
    const askedBy = activeLessonContextUser(); // the request starts…
    setActiveLessonContextUser('teacher-f'); // …another teacher signs in…
    const seen: (NextPeriodLesson | null | undefined)[] = [];
    const unsubscribe = subscribeNextPeriod(n => seen.push(n));
    assert.equal(publishNextPeriod(period('E-LESSON'), askedBy), false); // …and E's answer lands.
    unsubscribe();
    assert.equal(getNextPeriod(), undefined);
    assert.deepEqual(seen, []);
  });

  it('says how long ago anyone read it, so a surface can skip a read that was just made', () => {
    setActiveLessonContextUser('teacher-i');
    assert.equal(getNextPeriodAgeMs(), Infinity, 'never read');
    publishNextPeriod(period('L1'), activeLessonContextUser());
    const age = getNextPeriodAgeMs();
    assert.ok(age >= 0 && age < 1000, `just read, got ${age}`);
    setActiveLessonContextUser('teacher-j');
    assert.equal(getNextPeriodAgeMs(), Infinity, 'a different teacher has never read it');
  });

  it('tells subscribers the period is unread again when the teacher changes, and not when it is the same one', () => {
    setActiveLessonContextUser('teacher-g');
    publishNextPeriod(period('L1'), activeLessonContextUser());
    const seen: (NextPeriodLesson | null | undefined)[] = [];
    const unsubscribe = subscribeNextPeriod(n => seen.push(n));
    setActiveLessonContextUser('teacher-g'); // AuthContext repeats the call on restore
    assert.deepEqual(seen, []);
    assert.equal(getNextPeriod()?.lessonId, 'L1');
    setActiveLessonContextUser('teacher-h');
    unsubscribe();
    assert.deepEqual(seen, [undefined]);
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
