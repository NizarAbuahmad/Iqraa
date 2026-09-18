/**
 * A generator grounds on the lesson it was GIVEN, not on one it guessed.
 *
 * `AIRequest.lessonId` has always been sent by the `/ai-tools` screens, and the
 * offline generator used to throw it away and re-resolve `req.topic` through
 * semantic search. Titles are not unique across the curriculum, so four of the
 * 33 Grade 10 maths lessons grounded on the wrong one:
 *
 *   «تبسيط المقادير الأسية»  → Grade 9 maths
 *   «النسب المثلثية»          → Grade 9 maths
 *   «المتتاليات»              → Grade 7 maths
 *   «جمع المتجهات وطرحها»     → Grade 10 PHYSICS
 *
 * The last one is the tell: a maths worksheet whose key terms came from a
 * physics lesson. It is not a wrong answer, it is a wrong *subject*, and it
 * renders as a perfectly ordinary worksheet.
 *
 * This is checked through the key terms, because that is what grounding
 * actually changes about the output. A lesson's own term appearing in its own
 * worksheet is the observable difference between grounded and guessed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { getLessonById } from '../knowledgeBase.ts';

/**
 * The colliding pairs, as ids. Kept explicit rather than recomputed: this is a
 * regression list, and the point is that these exact lessons were wrong.
 */
const COLLIDING = [
  { mine: 'kbl-math-s1-nccd-u1_l3', stolenBy: 'kbl-g9-math-s2-nccd-u6_l1' },
  { mine: 'kbl-math-s1-nccd-u3_l1', stolenBy: 'kbl-g9-math-s2-nccd-u5_l4' },
  { mine: 'kbl-math-s2-nccd-u5_l5', stolenBy: 'kbl-g7-math-s1-nccd-u3_l3' },
  { mine: 'kbl-math-s2-nccd-u7_l2', stolenBy: 'kbl-phys-s1-nccd-u1_l2' },
];

describe('grounding by id rather than by title', () => {
  it('still has colliding titles to defend against', () => {
    for (const { mine, stolenBy } of COLLIDING) {
      const a = getLessonById(mine);
      const b = getLessonById(stolenBy);
      assert.ok(a, `${mine} is gone — update this regression list`);
      assert.ok(b, `${stolenBy} is gone — update this regression list`);
      assert.equal(
        a.titleAr,
        b.titleAr,
        `${mine} and ${stolenBy} no longer share a title; this case is stale`,
      );
      assert.notEqual(a.id, b.id);
    }
  });

  it('uses the given lesson, not the same-titled one from another grade or subject', async () => {
    const service = new MockAIService();

    for (const { mine, stolenBy } of COLLIDING) {
      const lesson = getLessonById(mine)!;
      const other = getLessonById(stolenBy)!;

      // A term the wrong lesson has and the right one does not. Without such a
      // term there is nothing observable to assert, so skip rather than pretend.
      const mineTerms = new Set((lesson.keyTerms ?? []).map(t => t.ar));
      const giveaway = (other.keyTerms ?? []).map(t => t.ar).find(t => t && !mineTerms.has(t));
      if (!giveaway) continue;

      const sheet = await service.generateWorksheet({
        grade: 'الصف العاشر',
        subject: 'الرياضيات',
        topic: lesson.titleAr,
        lessonId: lesson.id,
        unitId: lesson.unitId,
        language: 'arabic',
        difficulty: 'medium',
        numQuestions: 10,
        questionTypes: ['multiple_choice', 'short_answer', 'fill_blank'],
        contextSource: 'curriculum',
      } as never);

      const text = [
        ...sheet.sections.flatMap(s => s.questions.map(q => q.text)),
        ...sheet.answerKey.map(k => k.answer),
      ].join(' ');

      assert.ok(
        !text.includes(giveaway),
        `${mine}: worksheet mentions «${giveaway}», which belongs to ${stolenBy}`,
      );
    }
  });
});
