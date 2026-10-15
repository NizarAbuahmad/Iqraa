/**
 * A derivative lesson's offline worksheet must be able to reach the length the
 * picker offers.
 *
 * The derivative family once held 5 items for the whole of Grade 10, so a
 * teacher asking for 15 on «القيم العظمى والقيم الصغرى» got 5 (one studied, one
 * half-solved, three to practise) plus the review questions — and the same
 * thin paper for «تقدير ميل المنحنى» and «الاشتقاق», which share the family.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const LESSON_IDS = [
  'kbl-math-s2-nccd-u6_l1', // تقدير ميل المنحنى
  'kbl-math-s2-nccd-u6_l2', // الاشتقاق
  'kbl-math-s2-nccd-u6_l3', // القيم العظمى والقيم الصغرى
];

const req = (id: string, numQuestions: number, over: Partial<AIRequest> = {}) => {
  const lesson = KB_LESSONS.find(l => l.id === id)!;
  return {
    grade: getBookForLesson(lesson)!.gradeId, subject: 'Mathematics', topic: lesson.titleAr, lessonId: id,
    language: 'arabic', numQuestions, difficulty: 'mixed', totalMarks: 30, ...over,
  } as AIRequest;
};

/** Everything on the paper: numbered questions plus the worked example. */
const items = (sheet: Awaited<ReturnType<MockAIService['generateWorksheet']>>) =>
  sheet.sections.reduce((n, s) => n + s.questions.length, 0) + (sheet.workedExample ? 1 : 0);

describe('derivative lessons: the picker count is honoured offline', () => {
  it('finds the three lessons', () => {
    for (const id of LESSON_IDS) assert.ok(KB_LESSONS.some(l => l.id === id), id);
  });

  for (const id of LESSON_IDS) {
    it(`${id}: 15 asked, 15 on the paper, no shortfall (multiple choice only)`, async () => {
      const sheet = await service.generateWorksheet(req(id, 15, { questionTypes: ['multiple_choice'] }));
      assert.equal(items(sheet), 15, `produced ${items(sheet)}`);
      assert.equal(sheet.shortfall, undefined);
    });

    it(`${id}: 15 asked with the default mix and a prior review`, async () => {
      const sheet = await service.generateWorksheet(req(id, 15, { includePriorReview: true, priorKnowledge: ['تعريف المماس والقاطع'] }));
      assert.equal(sheet.shortfall, undefined);
      assert.ok(items(sheet) >= 15, `produced ${items(sheet)}`);
    });
  }

  it('a Regenerate can differ from the paper before it', async () => {
    const a = await service.generateWorksheet(req(LESSON_IDS[2], 10, { questionTypes: ['multiple_choice'] }));
    const texts = (s: typeof a) => s.sections.flatMap(x => x.questions.map(q => q.text)).join('|');
    let differs = false;
    for (let i = 0; i < 10 && !differs; i++) {
      const b = await service.generateWorksheet(req(LESSON_IDS[2], 10, { questionTypes: ['multiple_choice'], regenerate: true }));
      differs = texts(a) !== texts(b);
    }
    assert.ok(differs, 'ten regenerations all returned the same paper');
  });
});
