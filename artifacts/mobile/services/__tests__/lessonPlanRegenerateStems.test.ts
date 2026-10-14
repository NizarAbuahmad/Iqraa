/**
 * «أعد التجهيز» on a lesson plan must change every section it CAN change, and
 * say how many it could not.
 *
 * Measured over 30 regenerations, for maths, chemistry and Arabic, direct and
 * collaborative: five of the plan's eight sections (the main activity, guided
 * and independent practice, assessment, differentiation) have ONE phrasing in
 * the offline generator, so they never change; only the introduction (2–3
 * phrasings), the closure and the homework (2 each) vary. And `freshOnRegenerate`
 * accepted any draw whose whole object differed, so a regenerate often changed
 * only one of those three — the teacher saw an identical plan.
 *
 * Two things are pinned: the three sections that can vary always do, and the
 * plan says how many sections stayed the same (`repeated`), because «أعد التجهيز»
 * returning a mostly identical plan with no explanation reads as a broken button.
 * Authoring alternatives for the five fixed sections is content work, not here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const SECTIONS = [
  'introduction', 'mainActivity', 'guidedPractice', 'independentPractice',
  'closure', 'assessment', 'differentiation', 'homework',
] as const;
/** The sections the offline generator has more than one phrasing for. */
const VARIES = ['introduction', 'closure', 'homework'] as const;

const CASES: Array<[string, Partial<AIRequest>]> = [
  ['chemistry', { subject: 'Chemistry', topic: 'الجدول الدوري وخواص العناصر', lessonId: 'kbl-chem-2-1' }],
  ['maths', { subject: 'Mathematics', topic: 'قانون الجيوب' }],
  ['arabic', { subject: 'Arabic', topic: 'الجملة الاسمية' }],
];

const req = (c: Partial<AIRequest>, style: string, extra: Partial<AIRequest> = {}) =>
  ({ grade: 'الصف العاشر', language: 'arabic', duration: 45, teachingStyle: style, ...c, ...extra }) as AIRequest;

const same = (a: LessonPlanOutput, b: LessonPlanOutput) => SECTIONS.filter(f => a[f] === b[f]);

describe('lesson plan regenerate', () => {
  for (const [label, c] of CASES) {
    for (const style of ['direct', 'collaborative']) {
      it(`${label}/${style}: every section that has an alternative changes`, async () => {
        let prev = await service.generateLessonPlan(req(c, style));
        for (let i = 0; i < 30; i++) {
          const next = await service.generateLessonPlan(req(c, style, { regenerate: true }));
          const kept = same(prev, next).filter(f => (VARIES as readonly string[]).includes(f));
          assert.deepEqual(kept, [], `regeneration ${i + 1} kept ${kept.join(', ')}`);
          prev = next;
        }
      });

      it(`${label}/${style}: the notice counts exactly the sections that stayed the same`, async () => {
        let prev = await service.generateLessonPlan(req(c, style));
        assert.equal(prev.repeated, undefined, 'a first generation is never a repeat');
        for (let i = 0; i < 10; i++) {
          const next = await service.generateLessonPlan(req(c, style, { regenerate: true }));
          assert.deepEqual(next.repeated, { count: same(prev, next).length, of: SECTIONS.length });
          prev = next;
        }
      });
    }
  }
});
