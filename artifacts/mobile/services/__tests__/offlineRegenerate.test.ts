/**
 * An offline Regenerate must not hand back what is already on screen.
 *
 * The lesson plan, worksheet and homework generators vary by drawing at random
 * — from a bank of items, or from a pool of phrasings — and nothing stopped a
 * draw from landing on exactly what the teacher was already looking at. Measured
 * over twelve regenerations per case: the lesson plan repeated its predecessor
 * up to 4 times in 11, homework and worksheet up to 5 in 11 (small banks, such
 * as a single law-of-sines lesson, make the odds high), so «إعادة التوليد» often
 * did nothing visible.
 *
 * `MockAIService` now remembers what it last served for a request and, when the
 * same request comes back with `regenerate`, draws again until the result
 * differs (bounded, so a generator that cannot vary still returns).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const base = { grade: 'الصف العاشر', duration: 30, numQuestions: 6 };
const CASES: Array<{ label: string; req: Partial<AIRequest> }> = [
  { label: 'maths, law of sines (a small bank)', req: { topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic' } },
  { label: 'maths, english', req: { topic: 'Law of Sines', subject: 'Mathematics', language: 'english' } },
  { label: 'chemistry', req: { topic: 'الروابط الأيونية', subject: 'الكيمياء', language: 'arabic' } },
];
const NO_BANK: Array<{ label: string; req: Partial<AIRequest> }> = [
  { label: 'english lesson, grounded', req: { topic: 'الكتابة: تدوينة', subject: 'English', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7' } },
  { label: 'arabic, ungrounded', req: { topic: 'الجملة الاسمية', subject: 'Arabic', language: 'arabic' } },
  { label: 'a topic the book does not hold (en)', req: { topic: 'Persuasive writing', subject: 'English', language: 'english' } },
];

const GENERATORS: Array<[string, (r: AIRequest) => Promise<unknown>, typeof CASES]> = [
  ['lesson plan', r => service.generateLessonPlan({ ...r, teachingStyle: 'direct' } as AIRequest), [...CASES, ...NO_BANK]],
  ['worksheet', r => service.generateWorksheet(r), CASES],
  ['homework', r => service.generateHomework(r), CASES],
  ['quiz', r => service.generateQuiz({ ...r, questionTypes: ['multiple_choice', 'short_answer'] } as AIRequest), CASES],
];

const make = (c: { req: Partial<AIRequest> }, extra: Partial<AIRequest> = {}) =>
  ({ ...base, ...c.req, ...extra }) as AIRequest;

describe('Regenerate never repeats the previous result', () => {
  for (const [name, gen, cases] of GENERATORS) {
    for (const c of cases) {
      it(`${name} — ${c.label}: 20 regenerations in a row, none equal to the one before`, async () => {
        let prev = JSON.stringify(await gen(make(c)));
        for (let i = 0; i < 20; i++) {
          const next = JSON.stringify(await gen(make(c, { regenerate: true })));
          assert.notEqual(next, prev, `regeneration ${i + 1} returned what was already on screen`);
          prev = next;
        }
      });
    }
  }
});

describe('it only intervenes on a Regenerate', () => {
  it('a plain request is returned as drawn, with no comparison to the last one', async () => {
    const c = CASES[0]!;
    // Many plain requests: they must all succeed (and are free to repeat).
    for (let i = 0; i < 5; i++) assert.ok(await service.generateHomework(make(c)));
  });

  it('the first Regenerate of a request nobody has generated yet simply returns', async () => {
    const out = await service.generateWorksheet(make({ req: { topic: 'المعادلات الأسية', subject: 'الرياضيات', language: 'arabic' } }, { regenerate: true }));
    assert.ok(out);
  });

  it('two different requests are compared separately', async () => {
    const [a, b] = [CASES[0]!, CASES[1]!];
    const aFirst = JSON.stringify(await service.generateHomework(make(a)));
    await service.generateHomework(make(b));
    const aNext = JSON.stringify(await service.generateHomework(make(a, { regenerate: true })));
    assert.notEqual(aNext, aFirst);
  });
});

describe('a generator that cannot vary still returns', () => {
  it('the classroom activity (fixed templates) terminates on every Regenerate', async () => {
    const req = {
      grade: '10', difficulty: 'standard', groupType: 'groups', teachingGoal: 'revision', duration: 20,
      activityType: 'escape-challenge', topic: 'Persuasive writing', subject: 'English', language: 'english',
    } as const;
    const first = await service.generateClassroomActivity({ ...req });
    for (let i = 0; i < 3; i++) {
      const again = await service.generateClassroomActivity({ ...req, regenerate: true });
      assert.equal(again.slides.length, first.slides.length);
    }
  });
});
