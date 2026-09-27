/**
 * The chat only recognised chemistry and maths, and not in Arabic at all (JS
 * `\b` never matches next to Arabic letters). Reported 2026-09-26: with grade
 * 3 science picked, "i need study plan for english" was searched as free text
 * and answered with grade 7 financial literacy «الحاجات» ("Needs").
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractQuerySubjectId, shouldReuseActiveLesson } from '../lessonCopilot.ts';
import { topicFromQuery } from '../ai/artifactTopic.ts';
import { getBookForLesson, getLessonsInScope, searchKBRanked } from '../knowledgeBase.ts';
import { KB_CONFIDENT_SCORE } from '../kbSuggestion.ts';

describe('extractQuerySubjectId', () => {
  const cases: Array<[string, string | null]> = [
    ['i need study plan for english', 'english'],
    ['a quiz in Maths', 'mathematics'],
    ['worksheet for science', 'science'],
    ['بدي خطة للغة الإنجليزية', 'english'],
    ['اختبار انجليزي', 'english'],
    ['ورقة عمل في الكيمياء', 'chemistry'],
    ['درس للرياضيات', 'mathematics'],
    ['اختبار في العلوم', 'science'],
    ['العلوم الحياتية للصف التاسع', 'biology'],
    ['نشاط في اللغة العربية', 'arabic'],
    ['التربية الإسلامية', 'islamic'],
    // «علوم» inside «معلومات» is not a subject.
    ['أريد معلومات عن الخلية', null],
    ['make me a quiz', null],
  ];
  for (const [q, want] of cases) {
    it(JSON.stringify(q), () => assert.equal(extractQuerySubjectId(q), want));
  }
});

describe('the reported message', () => {
  const q = 'i need study plan for english';

  it('does not reuse a science lesson for an english ask', () => {
    assert.equal(shouldReuseActiveLesson({
      memory: { activeLessonId: 'x', lessonPin: 'hard' } as never,
      intent: 'artifact',
      query: q,
      hasConfidentKbHit: false,
      activeLessonGradeId: 'grade-3',
      activeLessonSubjectId: 'science',
    }), false);
  });

  it('has no confident grade 3 English match, so the chat offers lessons', () => {
    const scoped = searchKBRanked(topicFromQuery(q) || q, 'en', { gradeId: 'grade-3' })
      .filter(r => getBookForLesson(r.lesson)?.subjectId === 'english');
    assert.ok((scoped[0]?.score ?? 0) < KB_CONFIDENT_SCORE);
    const offered = getLessonsInScope('grade-3', 'english');
    assert.ok(offered.length > 0);
    assert.ok(offered.every(l => getBookForLesson(l)?.gradeId === 'grade-3'
      && getBookForLesson(l)?.subjectId === 'english'));
  });
});
