/**
 * Early-grade books are fully vowelled («الْجَمْعُ»); teachers type bare
 * («الجمع»). With grade 2 picked, «اعمل لي اختبار عن الجمع» came back as a
 * grade 8 quiz: the chat's in-grade search found nothing in grade 2 to keep.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { searchKBRanked, getBookForLesson } from '../knowledgeBase.ts';

describe('grade-scoped KB search ignores harakat', () => {
  it('a bare word finds the vowelled grade 2 lesson', () => {
    const hits = searchKBRanked('الجمع', 'ar', { gradeId: 'grade-2' });
    assert.ok(hits.length > 0, 'no grade-2 hit');
    assert.ok(hits.every(h => getBookForLesson(h.lesson)?.gradeId === 'grade-2'));
    assert.match(hits[0]!.lesson.titleAr, /جَمْع/);
  });

  it('leaves the unscoped search alone (chemistry grounding depends on it)', () => {
    const top = searchKBRanked('التفاعلات الكيميائية', 'ar')[0]!;
    assert.equal(getBookForLesson(top.lesson)?.subjectId, 'chemistry');
  });
});
