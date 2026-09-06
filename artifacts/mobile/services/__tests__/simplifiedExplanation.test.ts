/**
 * `MockAIService.generateSimplifiedExplanation` — «تبسيط الشرح».
 *
 * This tool spent its life as `generateLessonPlan` behind an `isSimplify`
 * flag: same output type, same endpoint, same PDF. Its subtitle promised
 * students a direct explanation while the artifact was a teacher's plan with
 * objectives, assessment and homework in it. These tests pin the two things
 * that made it a real tool — a student-facing shape, and answers that only
 * claim the provenance they actually have.
 *
 * DEMO_MODE ships `true` (see CLAUDE.md), so this mock is what teachers see.
 *
 * The live twin is pinned by
 * `artifacts/api-server/src/lib/__tests__/simplifiedExplanationPrompts.test.ts`
 * — a format lives in two places and both must move.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { EXPLAINER_SHAPE } from '../ai/explainerBlueprint.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();

/** A grounded Grade 10 maths lesson — the concrete bank applies. */
const MATH_REQ = {
  grade: 'الصف العاشر',
  subject: 'Mathematics',
  topic: 'المعادلات التربيعية',
  language: 'arabic',
} satisfies AIRequest;

/** A topic no KB lesson resolves to — nothing may be asserted about it. */
const UNGROUNDED_REQ = {
  grade: 'الصف العاشر',
  subject: 'Mathematics',
  topic: 'موضوع لا وجود له في المنهاج إطلاقًا',
  language: 'arabic',
} satisfies AIRequest;

describe('the shape both paths promise', () => {
  it('matches the literals the live prompt states', () => {
    // Hand-pinned from this side; `EXPLAINER_SHAPE` in
    // `artifacts/api-server/src/lib/prompts.ts` declares the same numbers and
    // its own test pins them from there. The two modules cannot import each
    // other, so this pair of assertions is what keeps them in step.
    assert.deepEqual({ ...EXPLAINER_SHAPE }, { minSteps: 3, maxSteps: 5, checks: 3 });
  });
});

describe('generateSimplifiedExplanation — shape', () => {
  for (const language of ['arabic', 'english'] as const) {
    it(`returns every required field (${language})`, async () => {
      const out = await service.generateSimplifiedExplanation({ ...MATH_REQ, language });
      for (const f of ['title', 'bigIdea', 'workedExample', 'misconception'] as const) {
        assert.ok(out[f], `${f} should be present`);
      }
      assert.ok(out.explanation.length > 0);
      assert.ok(out.workedExample.text.trim().length > 0);
      assert.ok(out.workedExample.answer.trim().length > 0);
      assert.ok(out.misconception.claim.trim().length > 0);
      assert.ok(out.misconception.correction.trim().length > 0);
      assert.equal(out.grade, MATH_REQ.grade);
      assert.equal(out.subject, MATH_REQ.subject);
    });
  }

  it('keeps the explanation within the step band both paths promise', async () => {
    const out = await service.generateSimplifiedExplanation(MATH_REQ);
    assert.ok(out.explanation.length >= EXPLAINER_SHAPE.minSteps);
    assert.ok(out.explanation.length <= EXPLAINER_SHAPE.maxSteps);
  });

  it('always produces the promised number of self-checks', async () => {
    for (const req of [MATH_REQ, UNGROUNDED_REQ]) {
      const out = await service.generateSimplifiedExplanation(req);
      assert.equal(out.checks.length, EXPLAINER_SHAPE.checks, `for ${req.topic}`);
    }
  });

  it('omits keyWords rather than sending an empty list', async () => {
    // `missingFields` does not require the field, and an empty array renders
    // an empty heading on a sheet a student is holding.
    const out = await service.generateSimplifiedExplanation(UNGROUNDED_REQ);
    assert.equal(out.keyWords, undefined);
    assert.ok(!Object.keys(out).includes('keyWords'));
  });
});

describe('generateSimplifiedExplanation — it is not a lesson plan', () => {
  it('carries none of the teacher-facing lesson-plan fields', async () => {
    // The regression this whole tool was rebuilt to fix. A student handed
    // `objectives` and `assessment` is reading instructions addressed to
    // someone else.
    const out = await service.generateSimplifiedExplanation(MATH_REQ) as unknown as Record<string, unknown>;
    for (const f of [
      'objectives', 'materials', 'introduction', 'mainActivity', 'guidedPractice',
      'independentPractice', 'closure', 'assessment', 'differentiation', 'homework',
      'priorReview', 'duration',
    ]) {
      assert.equal(out[f], undefined, `${f} belongs to a lesson plan, not a handout`);
    }
  });
});

describe('generateSimplifiedExplanation — answer provenance', () => {
  it('labels bank-drawn checks as bank, never verified', async () => {
    const out = await service.generateSimplifiedExplanation(MATH_REQ);
    const answered = out.checks.filter(c => c.answer !== undefined);
    assert.ok(answered.length > 0, 'a grounded maths lesson should draw from the bank');
    for (const c of answered) {
      assert.equal(c.answerSource, 'bank');
      assert.ok((c.answer ?? '').trim().length > 0);
    }
  });

  it('omits the answer rather than guessing when nothing established one', async () => {
    const out = await service.generateSimplifiedExplanation(UNGROUNDED_REQ);
    const guessed = out.checks.filter(c => c.answer !== undefined && !c.answerSource);
    assert.deepEqual(guessed, [], 'an answer with no source is a guess printed as a key');
    for (const c of out.checks) {
      if (c.answer === undefined) assert.equal(c.answerSource, undefined);
    }
  });

  it('never emits a `verified` field anywhere in the artifact', async () => {
    // Nothing in this path runs the verifier. CLAUDE.md records what shipped
    // the last time a code-computed fallback set this flag.
    for (const req of [MATH_REQ, UNGROUNDED_REQ]) {
      const out = await service.generateSimplifiedExplanation(req);
      assert.doesNotMatch(JSON.stringify(out), /"verified"/);
    }
  });
});
