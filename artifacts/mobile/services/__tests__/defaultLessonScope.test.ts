/**
 * A teacher with no lesson picked yet is shown a default lesson — and it must
 * be in a grade/subject they said they teach on `/setup-subjects`, not the
 * Grade 10 maths demo lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_ACTIVE_LESSON_ID, defaultLessonIdFor, seedDefaultLessonMemory } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import { getBookForLesson, getLessonById } from '../knowledgeBase.ts';

const demoBook = getBookForLesson(getLessonById(DEFAULT_ACTIVE_LESSON_ID)!)!;

describe('defaultLessonIdFor', () => {
  it('keeps the demo lesson when there is no selection or it is within the selection', () => {
    assert.equal(defaultLessonIdFor(undefined), DEFAULT_ACTIVE_LESSON_ID);
    assert.equal(defaultLessonIdFor([]), DEFAULT_ACTIVE_LESSON_ID);
    assert.equal(
      defaultLessonIdFor([{ gradeId: demoBook.gradeId, subjectIds: [demoBook.subjectId] }]),
      DEFAULT_ACTIVE_LESSON_ID,
    );
  });

  it('moves to a lesson of the teacher\'s own grade and subject otherwise', () => {
    const other = { gradeId: 'grade-3', subjectIds: ['arabic'] };
    const id = defaultLessonIdFor([other]);
    assert.notEqual(id, DEFAULT_ACTIVE_LESSON_ID);
    const book = getBookForLesson(getLessonById(id)!)!;
    assert.equal(book.gradeId, other.gradeId);
    assert.equal(book.subjectId, other.subjectIds[0]);
  });

  it('seeds the chat memory with the scoped lesson', () => {
    const id = defaultLessonIdFor([{ gradeId: 'grade-3', subjectIds: ['arabic'] }]);
    assert.equal(seedDefaultLessonMemory(emptyChatSessionMemory(), id).activeLessonId, id);
  });
});
