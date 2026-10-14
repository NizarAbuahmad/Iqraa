/**
 * «أعد التجهيز» on a worksheet or homework must change the QUESTIONS too.
 *
 * Same defect, and measured worse than the quiz: `freshOnRegenerate` compared
 * the whole object, so the same questions in another order or with shuffled
 * options counted as fresh. Over 30 regenerations on the periodic-table lesson
 * a regenerated 5-question worksheet repeated 4.0–4.2 of its questions on
 * average and a 6-question homework 4.4–4.7. The banks set a floor: the
 * worksheet draws from 7 distinct stems (so never fewer than 5 + 5 − 7 = 3
 * shared), and every homework carries 3 fixed questions plus at least one more
 * from a pool of three (floor 4). What is pinned here is "as close to that floor
 * as the draws allow", plus the notice for the questions that could not change
 * (`quizRegenerateStems.test.ts` has the quiz's version).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const chem: Partial<AIRequest> = {
  subject: 'Chemistry',
  topic: 'الجدول الدوري وخواص العناصر',
  lessonId: 'kbl-chem-2-1',
};
// A small maths bank whose homework is fixed templates: nothing can change.
const sines: Partial<AIRequest> = { subject: 'Mathematics', topic: 'قانون الجيوب' };

const req = (c: Partial<AIRequest>, extra: Partial<AIRequest> = {}) =>
  ({ grade: 'الصف العاشر', language: 'arabic', duration: 30, numQuestions: 6, difficulty: 'medium', ...c, ...extra }) as AIRequest;

/** Every question a teacher reads, the worked example included. */
const stems = (w: WorksheetOutput) => [
  ...(w.workedExample ? [w.workedExample.problem] : []),
  ...w.sections.flatMap(s => s.questions.map(q => q.text)),
];
const shared = (a: WorksheetOutput, b: WorksheetOutput) => stems(b).filter(t => stems(a).includes(t)).length;

/** [name, generator, the average-repeat ceiling: just above the bank's floor, below the unfixed average]. */
const GENERATORS: Array<[string, (r: AIRequest) => Promise<WorksheetOutput>, number]> = [
  ['worksheet', r => service.generateWorksheet(r), 3.5],
  ['homework', r => service.generateHomework(r), 4.25],
];

describe('worksheet and homework regenerate change the questions', () => {
  for (const [name, gen, ceiling] of GENERATORS) {
    it(`${name}: a small-bank lesson repeats close to the fewest questions its bank allows`, async () => {
      let prev = await gen(req(chem));
      let total = 0;
      const runs = 30;
      for (let i = 0; i < runs; i++) {
        const next = await gen(req(chem, { regenerate: true }));
        total += shared(prev, next);
        prev = next;
      }
      assert.ok(total / runs < ceiling, `${name} repeated ${(total / runs).toFixed(2)} questions per regeneration on average`);
    });

    it(`${name}: the notice counts exactly the questions that repeated, and only then`, async () => {
      for (const c of [chem, sines]) {
        let prev = await gen(req(c));
        assert.equal(prev.repeated, undefined, 'a first generation is never a repeat');
        for (let i = 0; i < 10; i++) {
          const next = await gen(req(c, { regenerate: true }));
          const n = shared(prev, next);
          if (n === 0) assert.equal(next.repeated, undefined);
          else assert.deepEqual(next.repeated, { count: n, of: stems(next).length }, `${name}: ${n} repeated`);
          prev = next;
        }
      }
    });
  }

  it('freshness does not shrink the paper', async () => {
    const first = await service.generateWorksheet(req(chem));
    for (let i = 0; i < 10; i++) {
      const next = await service.generateWorksheet(req(chem, { regenerate: true }));
      assert.equal(stems(next).length, stems(first).length);
    }
  });
});
