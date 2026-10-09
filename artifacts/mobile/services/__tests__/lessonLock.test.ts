/**
 * Which lessons a student sees locked. The rule that matters most is the
 * fail-open one: a lesson with no open quiz must never hold anyone back, or a
 * single published quiz would dead-end the rest of the book.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { lockState, NO_PROGRESS, type MasteryProgress } from '../lessonLock.ts';

const LESSONS = ['l1', 'l2', 'l3', 'l4'];

function progress(over: Partial<MasteryProgress> = {}): MasteryProgress {
  return { enabled: true, passedLessonIds: [], awaitingLessonIds: [], quizLessonIds: [], retakeEvaluationIds: [], ...over };
}

describe('lockState', () => {
  it('locks nothing while the gate is off, or when progress could not be loaded', () => {
    assert.equal(lockState(LESSONS, { ...progress({ quizLessonIds: ['l1'] }), enabled: false }).locked.size, 0);
    assert.equal(lockState(LESSONS, NO_PROGRESS).locked.size, 0);
  });

  it('locks nothing when no lesson has an open quiz', () => {
    assert.equal(lockState(LESSONS, progress()).locked.size, 0);
  });

  it('holds everything after the first unpassed quiz, and leaves that lesson open', () => {
    const s = lockState(LESSONS, progress({ quizLessonIds: ['l2'] }));
    assert.deepEqual([...s.locked], ['l3', 'l4']);
    assert.equal(s.blockedBy, 'l2');
  });

  it('opens the next lesson once the quiz is passed', () => {
    const s = lockState(LESSONS, progress({ quizLessonIds: ['l2'], passedLessonIds: ['l2'] }));
    assert.equal(s.locked.size, 0);
    assert.equal(s.blockedBy, null);
  });

  it('moves the block to the next unpassed quiz', () => {
    const s = lockState(LESSONS, progress({ quizLessonIds: ['l1', 'l3'], passedLessonIds: ['l1'] }));
    assert.deepEqual([...s.locked], ['l4']);
    assert.equal(s.blockedBy, 'l3');
  });

  it('does not lock when the last lesson is the only quiz', () => {
    assert.equal(lockState(LESSONS, progress({ quizLessonIds: ['l4'] })).locked.size, 0);
  });

  it('ignores a quiz for a lesson outside this unit', () => {
    assert.equal(lockState(LESSONS, progress({ quizLessonIds: ['elsewhere'] })).locked.size, 0);
  });

  it('keeps the next lesson locked while a handed-in quiz waits for release, and says so', () => {
    const s = lockState(LESSONS, progress({ quizLessonIds: ['l2'], awaitingLessonIds: ['l2'] }));
    assert.deepEqual([...s.locked], ['l3', 'l4']);
    assert.equal(s.blockedBy, 'l2');
    assert.equal(s.awaiting, true);
  });

  it('says "pass the quiz", not "waiting", when the blocking quiz is not handed in', () => {
    const s = lockState(LESSONS, progress({ quizLessonIds: ['l1', 'l3'], awaitingLessonIds: ['l3'] }));
    assert.equal(s.blockedBy, 'l1');
    assert.equal(s.awaiting, false);
  });

  it('is never "waiting" when nothing is locked', () => {
    assert.equal(lockState(LESSONS, progress({ quizLessonIds: ['l4'], awaitingLessonIds: ['l4'] })).awaiting, false);
  });
});
