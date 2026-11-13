/**
 * A worksheet never prints the same question twice: when a maths lesson has
 * nothing new left, the paper is shorter and says so, as the quiz does
 * (`pushUnique` in `generateQuiz`).
 *
 * Found 2026-11-13: the Grade 2 lesson «المجسمات» has five question shapes, and
 * a ten-question worksheet printed «أي مجسم يشبه كرة القدم؟» three times with
 * no shortfall, while the quiz for the same lesson stopped at five.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
import { buildWorksheetRequest } from '../generatorRequests.ts';

const SOLIDS_ID = 'kbl-g2-math-s2-nccd-u8_l3'; // «المجسمات», Grade 2

// The question as printed, before its answer line: the repeats found were word for word.
const stemOf = (text: string) => text.split(/\n\s*\n(?:الإجابة|Answer)/)[0]!.replace(/\s+/g, ' ').trim();

describe('worksheet repeats', () => {
  it('a spent lesson gives a shorter worksheet with a shortfall, not a repeated question', async () => {
    const grounding = resolveGeneratorGrounding('المجسمات', 'ar', {
      scope: { gradeId: 'grade-2', subjectId: 'mathematics' }, lessonId: SOLIDS_ID,
    });
    assert.equal(grounding.lesson?.id, SOLIDS_ID);
    for (let run = 0; run < 5; run++) {
      const req = buildWorksheetRequest({
        gradeName: 'الصف الثاني', subjectName: 'Mathematics', topic: 'المجسمات', lang: 'ar',
        difficulty: 'medium', numQuestions: 20,
        questionTypes: ['multiple_choice', 'short_answer', 'fill_blank'], includePriorReview: false,
      } as Parameters<typeof buildWorksheetRequest>[0], grounding);
      const w = await aiService.generateWorksheet(req);
      const stems = w.sections.flatMap(s => s.questions.map(q => stemOf(q.text)));
      assert.equal(new Set(stems).size, stems.length, `repeated question:\n${stems.join('\n')}`);
      if (stems.length < 20) assert.ok(w.shortfall, `${stems.length} of 20 with no shortfall`);
    }
  });
});
