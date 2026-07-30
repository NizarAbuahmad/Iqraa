/**
 * Lesson Flow Runner — failure-recovery tests
 *
 * Confirms that:
 *  - A successful run calls onStepDone for all 6 steps in order
 *  - A failure at any step throws LessonFlowStepError with the correct stepKey
 *  - Prior completed steps are NOT re-run on retry
 *  - A retry from the failed step runs through to completion
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runLessonFlowFrom,
  LessonFlowStepError,
  STEP_ORDER,
  type StepKey,
  type LessonFlowPrior,
  type RunnerAIService,
} from '../ai/lessonFlowRunner.ts';
import type { AIRequest } from '../ai/AIService.ts';

// ─── Minimal mock data ─────────────────────────────────────────────────────────

const MOCK_PLAN = {
  title: 'Quadratic Equations',
  grade: 'Grade 10',
  subject: 'Math',
  duration: 45,
  objectives: ['Identify quadratics', 'Solve by factoring'],
  materials: [],
  introduction: 'Intro text',
  mainActivity: 'Main activity',
  guidedPractice: 'Practice problem set A',
  independentPractice: 'IP text',
  closure: 'Exit text',
  assessment: 'Quiz',
  differentiation: '',
  homework: '',
};

const MOCK_ACTIVITY = {
  title: 'Activity',
  activityType: 'hands-on',
  totalDuration: 10,
  objective: 'Practice the concept',
  groupSize: 'pairs',
  materials: [],
  steps: [{ stepNumber: 1, title: 'Step 1', description: 'Do this', durationMin: 10 }],
  teacherTips: [],
  differentiation: '',
  assessment: '',
};

const MOCK_WORKSHEET = {
  title: 'WS',
  instructions: '',
  sections: [
    {
      type: 'short_answer' as const,
      title: 'Section 1',
      questions: [{ text: 'Q1', points: 1 }],
    },
  ],
  answerKey: [],
};

const MOCK_QUIZ = {
  title: 'Quiz',
  duration: 10,
  totalPoints: 5,
  questions: [
    {
      id: 'q1',
      text: 'Q1',
      type: 'multiple_choice' as const,
      options: ['A', 'B'],
      correctAnswer: 'A',
      points: 5,
      explanation: 'Because A',
    },
  ],
};

const BASE_REQ: AIRequest = {
  grade: 'Grade 10',
  subject: 'Math',
  topic: 'Quadratic Equations',
  language: 'english',
};

// ─── Mock factory helpers ──────────────────────────────────────────────────────

function makeWorkingAI(): RunnerAIService {
  return {
    generateLessonPlan: async () => ({ ...MOCK_PLAN }),
    generateActivity: async () => ({ ...MOCK_ACTIVITY }),
    generateWorksheet: async () => ({ ...MOCK_WORKSHEET }),
    generateQuiz: async () => ({ ...MOCK_QUIZ }),
  };
}

/**
 * Returns an AI mock that throws at the named step.
 * 'warmup' and 'activity' are both served by generateActivity; the mock
 * distinguishes them by activityType.
 */
function makeFailingAI(failAt: StepKey): RunnerAIService {
  const ok = makeWorkingAI();
  return {
    generateLessonPlan:
      failAt === 'objectives'
        ? async () => { throw new Error('Network error'); }
        : ok.generateLessonPlan,

    generateActivity: async (req) => {
      if (failAt === 'warmup' && req.activityType === 'hands-on') {
        throw new Error('Network error');
      }
      if (failAt === 'activity' && req.activityType === 'game') {
        throw new Error('Network error');
      }
      return { ...MOCK_ACTIVITY };
    },

    generateWorksheet:
      failAt === 'worksheet'
        ? async () => { throw new Error('Network error'); }
        : ok.generateWorksheet,

    generateQuiz:
      failAt === 'exitTicket'
        ? async () => { throw new Error('Network error'); }
        : ok.generateQuiz,
  };
}

function makeCallbacks() {
  const started: StepKey[] = [];
  const done: StepKey[] = [];
  return {
    callbacks: {
      onStepStart: (key: StepKey) => started.push(key),
      onStepDone: (key: StepKey) => done.push(key),
      onScroll: () => {},
    },
    started,
    done,
  };
}

/** Builds a LessonFlowPrior with the first N steps already completed. */
function buildPrior(upToExclusive: StepKey): LessonFlowPrior {
  const idx = STEP_ORDER.indexOf(upToExclusive);
  const p: LessonFlowPrior = {};
  if (idx > 0) { p.plan = { ...MOCK_PLAN }; p.objectives = [...MOCK_PLAN.objectives]; }
  if (idx > 1) p.warmup = { ...MOCK_ACTIVITY };
  if (idx > 2) p.activity = { ...MOCK_ACTIVITY };
  if (idx > 3) p.guidedPractice = MOCK_PLAN.guidedPractice;
  if (idx > 4) p.worksheet = { ...MOCK_WORKSHEET };
  return p;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runLessonFlowFrom — happy path', () => {
  it('completes all 6 steps from the start', async () => {
    const { callbacks, done } = makeCallbacks();
    const result = await runLessonFlowFrom('objectives', BASE_REQ, makeWorkingAI(), {}, callbacks);

    assert.deepEqual(done, [...STEP_ORDER]);
    assert.ok(Array.isArray(result.objectives) && result.objectives.length > 0);
    assert.ok(result.warmup);
    assert.ok(result.activity);
    assert.equal(result.guidedPractice, MOCK_PLAN.guidedPractice);
    assert.ok(result.worksheet);
    assert.ok(result.exitTicket);
  });

  it('does not re-invoke already-completed steps when resuming mid-sequence', async () => {
    // objectives + warmup already done
    const prior = buildPrior('activity');
    const { callbacks, started } = makeCallbacks();
    await runLessonFlowFrom('activity', BASE_REQ, makeWorkingAI(), prior, callbacks);

    assert.ok(!started.includes('objectives'), 'objectives should not re-run');
    assert.ok(!started.includes('warmup'), 'warmup should not re-run');
    assert.ok(started.includes('activity'));
    assert.ok(started.includes('guided'));
    assert.ok(started.includes('worksheet'));
    assert.ok(started.includes('exitTicket'));
  });

  it('preserves prior results in the returned accumulator', async () => {
    const prior = buildPrior('worksheet');
    const { callbacks } = makeCallbacks();
    const result = await runLessonFlowFrom('worksheet', BASE_REQ, makeWorkingAI(), prior, callbacks);

    assert.deepEqual(result.objectives, MOCK_PLAN.objectives);
    assert.ok(result.warmup);
    assert.ok(result.activity);
    assert.equal(result.guidedPractice, MOCK_PLAN.guidedPractice);
  });
});

describe('runLessonFlowFrom — failure at each step position', () => {
  const failableSteps: StepKey[] = ['objectives', 'warmup', 'activity', 'worksheet', 'exitTicket'];

  for (const failStep of failableSteps) {
    it(`throws LessonFlowStepError.stepKey="${failStep}" when that step's AI call rejects`, async () => {
      const prior = buildPrior(failStep);
      const { callbacks, done } = makeCallbacks();

      const err = await runLessonFlowFrom(
        failStep,
        BASE_REQ,
        makeFailingAI(failStep),
        prior,
        callbacks,
      ).catch(e => e);

      assert.ok(
        err instanceof LessonFlowStepError,
        `Expected LessonFlowStepError but got ${err?.constructor?.name}: ${err?.message}`,
      );
      assert.equal(err.stepKey, failStep, `stepKey should be "${failStep}"`);
      assert.ok(!done.includes(failStep), `"${failStep}" should not appear in done list`);
    });
  }

  it('does not call onStepDone for any step after the failing one', async () => {
    // warmup fails — activity, guided, worksheet, exitTicket must not run
    const { callbacks, done } = makeCallbacks();
    await runLessonFlowFrom('objectives', BASE_REQ, makeFailingAI('warmup'), {}, callbacks).catch(() => {});

    assert.ok(done.includes('objectives'), 'objectives should have completed before failure');
    assert.ok(!done.includes('warmup'));
    assert.ok(!done.includes('activity'));
    assert.ok(!done.includes('guided'));
    assert.ok(!done.includes('worksheet'));
    assert.ok(!done.includes('exitTicket'));
  });
});

describe('runLessonFlowFrom — retry after failure', () => {
  it('runs only remaining steps when retried from the failed step', async () => {
    // Simulate: objectives + warmup done, activity failed, now retrying from activity
    const prior = buildPrior('activity');
    const { callbacks, started, done } = makeCallbacks();
    const result = await runLessonFlowFrom('activity', BASE_REQ, makeWorkingAI(), prior, callbacks);

    assert.deepEqual(started, ['activity', 'guided', 'worksheet', 'exitTicket']);
    assert.deepEqual(done, ['activity', 'guided', 'worksheet', 'exitTicket']);
    assert.ok(result.activity);
    assert.ok(result.guidedPractice);
    assert.ok(result.worksheet);
    assert.ok(result.exitTicket);
    // Prior steps still in result
    assert.deepEqual(result.objectives, MOCK_PLAN.objectives);
    assert.ok(result.warmup);
  });

  it('handles a late retry (exitTicket only) without disturbing earlier results', async () => {
    const prior = buildPrior('exitTicket');
    prior.worksheet = { ...MOCK_WORKSHEET };
    const { callbacks, done } = makeCallbacks();
    const result = await runLessonFlowFrom('exitTicket', BASE_REQ, makeWorkingAI(), prior, callbacks);

    assert.deepEqual(done, ['exitTicket']);
    assert.ok(result.exitTicket);
    // Every earlier step is preserved unchanged
    assert.deepEqual(result.objectives, MOCK_PLAN.objectives);
    assert.ok(result.warmup);
    assert.ok(result.activity);
    assert.equal(result.guidedPractice, MOCK_PLAN.guidedPractice);
    assert.ok(result.worksheet);
  });

  it('full sequence: first run fails at worksheet, retry succeeds from worksheet', async () => {
    // First run — fails at worksheet
    const { callbacks: cb1, done: done1 } = makeCallbacks();
    const err = await runLessonFlowFrom(
      'objectives', BASE_REQ, makeFailingAI('worksheet'), {}, cb1,
    ).catch(e => e);

    assert.ok(err instanceof LessonFlowStepError);
    assert.equal(err.stepKey, 'worksheet');
    assert.deepEqual(done1, ['objectives', 'warmup', 'activity', 'guided']);

    // Retry — working AI from worksheet
    const priorAfterFailure = buildPrior('worksheet');
    const { callbacks: cb2, done: done2 } = makeCallbacks();
    const result = await runLessonFlowFrom('worksheet', BASE_REQ, makeWorkingAI(), priorAfterFailure, cb2);

    assert.deepEqual(done2, ['worksheet', 'exitTicket']);
    assert.ok(result.worksheet);
    assert.ok(result.exitTicket);
  });
});
