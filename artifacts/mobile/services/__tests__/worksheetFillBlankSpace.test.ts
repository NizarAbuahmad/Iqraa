/**
 * A fill-blank question asks for one answer, on its own line.
 *
 * The offline worksheet appends an answer box («الإجابة:» and two ruled lines)
 * under every open question. A fill-blank stem already ends in its own
 * «الإجابة: __________», so it printed two answer places — found sweeping every
 * Grade 1 maths lesson on 2026-11-13, true of any grade.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { getLessonById } from '../knowledgeBase.ts';
import type { AIRequest } from '../ai/AIService.ts';

const LESSONS = ['kbl-g1-math-s1-nccd-u0_l3', 'kbl-g1-math-s1-nccd-u0_l4'];
const BOX = '\n\nالإجابة:\n_________________________________';

describe('fill-blank questions on a worksheet', () => {
  it('carry one answer place, not their own blank plus an answer box', async () => {
    const service = new MockAIService();
    (service as unknown as { delay: () => Promise<void> }).delay = async () => {};
    let blanks = 0;
    for (const id of LESSONS) {
      const lesson = getLessonById(id);
      assert.ok(lesson, `${id} is gone — update this test`);
      const ws = await service.generateWorksheet({
        grade: 'الصف الأول', subject: 'الرياضيات', topic: lesson.titleAr, lessonId: id, language: 'arabic',
        numQuestions: 8, questionTypes: ['fill_blank', 'short_answer'], difficulty: 'easy',
      } as AIRequest);
      for (const q of ws.sections.flatMap(s => s.questions)) {
        const box = q.text.indexOf(BOX);
        const stem = box >= 0 ? q.text.slice(0, box) : q.text;
        if (!/_{3,}/.test(stem)) continue;
        blanks++;
        assert.equal(box, -1, `two answer places: ${JSON.stringify(q.text)}`);
      }
    }
    assert.ok(blanks > 0, 'no fill-blank question was generated — the test checks nothing');
  });
});
