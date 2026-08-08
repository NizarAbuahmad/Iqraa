/**
 * Generator tests for the quick-check classroom activity (whole-class ABCD
 * response with a verified answer key).
 *
 * Runs with Node's built-in test runner:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/quickCheck.test.ts
 *
 * Covers:
 *  1. Math topic → question slides carrying options, a valid correctIndex,
 *     and verified === true (answers come from the correct-by-construction
 *     concrete bank).
 *  2. options[correctIndex] equals the teacher panel's expectedAnswer — the
 *     projected reveal can never disagree with the teacher notes.
 *  3. Non-math topic → falls back to open all-write questions (no fabricated
 *     options, nothing falsely marked verified).
 *  4. Structural invariants shared with other activities: intro first,
 *     summary last, consecutive slideNumbers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';

const service = new MockAIService();

function baseReq(overrides: Partial<ClassroomActivityRequest>): ClassroomActivityRequest {
  return {
    grade: '10',
    subject: 'Math',
    topic: 'حل معادلات أسية',
    activityType: 'quick-check',
    duration: 15,
    difficulty: 'standard',
    groupType: 'whole-class',
    teachingGoal: 'assessment',
    language: 'arabic',
    ...overrides,
  };
}

function structuralChecks(a: ClassroomActivity) {
  assert.ok(a.slides.length >= 3, 'has intro + questions + summary');
  assert.equal(a.slides[0]!.type, 'intro');
  assert.equal(a.slides[a.slides.length - 1]!.type, 'summary');
  a.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1, `slideNumber consecutive at ${i}`));
  assert.equal(a.activityType, 'quick-check');
}

describe('quick-check — math topic (Arabic)', () => {
  it('produces verified question slides with valid options', async () => {
    const a = await service.generateClassroomActivity(baseReq({}));
    structuralChecks(a);

    const questions = a.slides.filter(s => s.type === 'question');
    assert.ok(questions.length >= 2, 'at least two question slides');

    for (const q of questions) {
      assert.ok(Array.isArray(q.options) && q.options.length >= 2, 'has options');
      assert.ok(
        typeof q.correctIndex === 'number'
          && q.correctIndex >= 0
          && q.correctIndex < q.options!.length,
        'correctIndex within options range',
      );
      assert.equal(q.verified, true, 'bank items are verified');
      assert.ok(q.durationSeconds > 0, 'question slides run a think timer');
      // The projected reveal must agree with the teacher panel.
      assert.equal(q.options![q.correctIndex!], q.teacher?.expectedAnswer);
    }
  });

  it('answerKey covers every question slide', async () => {
    const a = await service.generateClassroomActivity(baseReq({}));
    const questions = a.slides.filter(s => s.type === 'question');
    assert.equal(a.answerKey.length, questions.length);
  });
});

describe('quick-check — math topic (English)', () => {
  it('produces verified question slides in English', async () => {
    const a = await service.generateClassroomActivity(
      baseReq({ topic: 'Quadratic Equations', language: 'english' }),
    );
    structuralChecks(a);
    const questions = a.slides.filter(s => s.type === 'question');
    assert.ok(questions.length >= 2);
    for (const q of questions) {
      assert.equal(q.verified, true);
      assert.equal(q.options![q.correctIndex!], q.teacher?.expectedAnswer);
    }
  });
});

describe('quick-check — non-math topic falls back honestly', () => {
  it('uses open all-write questions with no fabricated options', async () => {
    const a = await service.generateClassroomActivity(
      baseReq({ subject: 'History', topic: 'الثورة العربية الكبرى' }),
    );
    structuralChecks(a);
    const questions = a.slides.filter(s => s.type === 'question');
    assert.equal(questions.length, 0, 'no MCQ slides without a verified bank');
    const open = a.slides.filter(s => s.type === 'challenge');
    assert.ok(open.length >= 1, 'has open all-write prompts instead');
    for (const s of a.slides) {
      assert.notEqual(s.verified, true, 'nothing falsely marked verified');
    }
  });
});
