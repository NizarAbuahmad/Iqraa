/**
 * A grade named in the chat message overrides the picker's pinned lesson.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/gradeDetection.test.ts
 *
 * Reported from app.iqrra.com on 2026-09-24: "help make game to teach my
 * grade one studnet multibly in math" got answered against whatever grade
 * the top-right lesson picker had pinned (grade 10, by default) — nothing
 * ever read a grade out of the free-text query.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractQueryGradeId, shouldReuseActiveLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';

describe('extractQueryGradeId', () => {
  const named: Array<[string, string]> = [
    ['help make a game to teach my grade one student multiply in math', 'grade-1'],
    ['a worksheet for grade 1', 'grade-1'],
    ['quiz for 1st grade', 'grade-1'],
    ['a lesson plan for first grade', 'grade-1'],
    ['grade 12 chemistry activity', 'grade-12'],
    ['twelfth grade lesson plan', 'grade-12'],
    ['اشرح هذا لطلاب الصف الأول', 'grade-1'],
    ['اشرح هذا لطلاب الصف الاول', 'grade-1'],
    ['ورقة عمل الصف الثاني', 'grade-2'],
    ['اختبار الصف الحادي عشر', 'grade-11'],
    ['اختبار الصف الثاني عشر', 'grade-12'],
    ['نشاط الصف العاشر', 'grade-10'],
    // «لـ + الصف» is written «للصف» — the alef drops. This is how a teacher
    // actually says "for grade N", and it slipped past the first version.
    ['لعبة الجمع للصف الأول', 'grade-1'],
    ['لعبة القسمة للصف الرابع', 'grade-4'],
    ['ورقة عمل للصف الثاني', 'grade-2'],
    ['اختبار للصف الثاني عشر', 'grade-12'],
    ['خطة درس بالصف الثالث', 'grade-3'],
  ];
  for (const [query, gradeId] of named) {
    it(`"${query}" names "${gradeId}"`, () => {
      assert.equal(extractQueryGradeId(query), gradeId);
    });
  }

  const unnamed = ['كيف أشرح الكسور؟', 'what is a fraction?', 'خطة درس', 'make a worksheet'];
  for (const query of unnamed) {
    it(`"${query}" names no grade`, () => {
      assert.equal(extractQueryGradeId(query), null);
    });
  }
});

describe('shouldReuseActiveLesson on a grade conflict', () => {
  const hardPinned = {
    ...emptyChatSessionMemory(),
    activeLessonId: 'kbl-math-s2-nccd-u5_l3',
    activeTopicAr: 'تركيب الاقترانات',
    lessonPin: 'hard' as const,
  };

  it('keeps the hard pin when no grade is named', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'كيف أبدأ الحصة',
        hasConfidentKbHit: false,
        activeLessonGradeId: 'grade-10',
      }),
      true,
    );
  });

  it('drops it when the teacher names a different grade', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'help make a game to teach my grade one student multiply in math',
        hasConfidentKbHit: false,
        activeLessonGradeId: 'grade-10',
      }),
      false,
    );
  });

  it('keeps it when the named grade matches the active lesson', () => {
    assert.equal(
      shouldReuseActiveLesson({
        memory: hardPinned,
        intent: 'teaching',
        query: 'quiz for grade 10',
        hasConfidentKbHit: false,
        activeLessonGradeId: 'grade-10',
      }),
      true,
    );
  });
});
