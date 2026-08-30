/**
 * `MockAIService.generateLessonPlan` — the optional prior-knowledge review
 * section.
 *
 * DEMO_MODE ships `true` by default (see CLAUDE.md), so this mock is what
 * most teachers actually see. `priorReview` must appear only when the
 * teacher asked for it — via a ticked "prior knowledge review" checkbox
 * (`includePriorReview` + `priorKnowledge`) or via free-text notes on prior
 * topics to re-explain (`priorTopicsNotes`) — and never otherwise.
 *
 * Runs with Node's built-in test runner:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/mockLessonPlanPriorReview.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();

const BASE_REQ = {
  grade: 'الصف العاشر',
  subject: 'Mathematics',
  topic: 'المعادلات التربيعية',
  duration: 45,
  language: 'arabic',
} satisfies AIRequest;

describe('MockAIService.generateLessonPlan — priorReview', () => {
  it('omits priorReview when nothing was asked for', async () => {
    const plan = await service.generateLessonPlan(BASE_REQ);
    assert.equal(plan.priorReview, undefined);
  });

  it('omits priorReview when includePriorReview is set but priorKnowledge is empty', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      includePriorReview: true,
      priorKnowledge: [],
    });
    assert.equal(plan.priorReview, undefined);
  });

  it('includes the grounded concepts when includePriorReview + priorKnowledge are set', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      includePriorReview: true,
      priorKnowledge: ['حل معادلات تربيعية باستعمال التحليل', 'حل أنظمة معادلات خطية'],
    });
    assert.ok(plan.priorReview, 'expected a priorReview section');
    assert.match(plan.priorReview!, /حل معادلات تربيعية باستعمال التحليل/);
    assert.match(plan.priorReview!, /حل أنظمة معادلات خطية/);
    // Review content must not be presented as this lesson's own objectives.
    assert.ok(!plan.objectives.some(o => o.includes('حل معادلات تربيعية باستعمال التحليل')));
  });

  it('includes free-text teacher notes even without curriculum concepts', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      priorTopicsNotes: 'بعض الطلاب لم يستوعبوا حل المعادلات من الصف التاسع',
    });
    assert.ok(plan.priorReview, 'expected a priorReview section from notes alone');
    assert.match(plan.priorReview!, /بعض الطلاب لم يستوعبوا حل المعادلات من الصف التاسع/);
  });

  it('combines grounded concepts and teacher notes when both are present', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      includePriorReview: true,
      priorKnowledge: ['حل معادلات تربيعية باستعمال التحليل'],
      priorTopicsNotes: 'ركّز على المتعثرين في الصف التاسع',
    });
    assert.match(plan.priorReview!, /حل معادلات تربيعية باستعمال التحليل/);
    assert.match(plan.priorReview!, /ركّز على المتعثرين في الصف التاسع/);
  });

  it('does not fabricate a priorReview during the simplify-explanation branch', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      topic: 'تبسيط الشرح: المعادلات التربيعية',
      priorTopicsNotes: 'ملاحظات لن تُستخدم في وضع التبسيط',
    });
    assert.equal(plan.priorReview, undefined);
  });

  it('works in English too', async () => {
    const plan = await service.generateLessonPlan({
      ...BASE_REQ,
      language: 'english',
      topic: 'Quadratic Equations',
      priorTopicsNotes: 'Some students never grasped solving equations from grade 9',
    });
    assert.ok(plan.priorReview);
    assert.match(plan.priorReview!, /Some students never grasped solving equations from grade 9/);
  });
});
