import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiSourceBadgeState,
  describeAiError,
  generateWithProvenance,
  isAbortError,
  getGenerationHistory,
  getLastGeneration,
  recordGeneration,
  resetGenerationLog,
  subscribeToGenerations,
} from '../ai/aiProvenance.ts';

const AT = 1_700_000_000_000;
const clock = () => AT;

function fresh() {
  resetGenerationLog();
}

// ─── describeAiError ─────────────────────────────────────────────────────────

test('describeAiError takes the message, never the stack', () => {
  const e = new Error('HTTP 401');
  assert.equal(describeAiError(e), 'HTTP 401');
});

test('describeAiError collapses whitespace and truncates', () => {
  const html = new Error(`<html>\n  <body>  502 Bad Gateway ${'x'.repeat(400)}`);
  const out = describeAiError(html);
  assert.ok(out.length <= 120, `too long: ${out.length}`);
  assert.ok(!out.includes('\n'));
  assert.ok(out.endsWith('…'));
});

test('describeAiError never returns an empty label', () => {
  assert.equal(describeAiError(new Error('')), 'unknown error');
  assert.equal(describeAiError(undefined), 'unknown error');
  assert.equal(describeAiError({ secret: 'token' }), 'unknown error');
});

// ─── the log ─────────────────────────────────────────────────────────────────

test('the log starts empty, so nothing is claimed before anything is generated', () => {
  fresh();
  assert.equal(getLastGeneration(), null);
  assert.deepEqual(getGenerationHistory(), []);
});

test('history is bounded and keeps the newest', () => {
  fresh();
  for (let i = 0; i < 40; i++) {
    recordGeneration({ kind: 'quiz', source: 'live', reason: 'live', at: AT + i });
  }
  const history = getGenerationHistory();
  assert.equal(history.length, 25);
  assert.equal(history[0]!.at, AT + 15);
  assert.equal(getLastGeneration()!.at, AT + 39);
});

test('getGenerationHistory hands back a copy', () => {
  fresh();
  recordGeneration({ kind: 'quiz', source: 'live', reason: 'live', at: AT });
  getGenerationHistory().push({ kind: 'chat', source: 'mock', reason: 'demo-mode', at: AT });
  assert.equal(getGenerationHistory().length, 1);
});

test('subscribers hear every record and can unsubscribe', () => {
  fresh();
  const seen: string[] = [];
  const off = subscribeToGenerations(r => seen.push(r.reason));
  recordGeneration({ kind: 'quiz', source: 'live', reason: 'live', at: AT });
  off();
  recordGeneration({ kind: 'quiz', source: 'mock', reason: 'fallback', at: AT });
  assert.deepEqual(seen, ['live']);
});

// ─── the fallback policy ─────────────────────────────────────────────────────

const live = () => Promise.resolve('live-content');
const mock = () => Promise.resolve('mock-content');
const boom = () => Promise.reject(new Error('HTTP 500'));

test('demo mode returns mock content and says so, without calling live', async () => {
  fresh();
  let called = false;
  const out = await generateWithProvenance(
    'lesson-plan',
    () => { called = true; return live(); },
    mock,
    { demoMode: true, now: clock },
  );
  assert.equal(out, 'mock-content');
  assert.equal(called, false);
  assert.deepEqual(getLastGeneration(), {
    kind: 'lesson-plan', source: 'mock', reason: 'demo-mode', at: AT,
  });
});

test('a successful live call is recorded as live', async () => {
  fresh();
  const out = await generateWithProvenance('quiz', live, mock, { demoMode: false, now: clock });
  assert.equal(out, 'live-content');
  assert.deepEqual(getLastGeneration(), {
    kind: 'quiz', source: 'live', reason: 'live', at: AT,
  });
});

test('a failed live call still returns content — but is recorded as a fallback', async () => {
  fresh();
  const out = await generateWithProvenance('worksheet', boom, mock, {
    demoMode: false, strict: false, now: clock,
  });
  // The fallback itself is the behaviour we keep: a teacher mid-lesson gets
  // something. What must never happen again is it being indistinguishable.
  assert.equal(out, 'mock-content');
  assert.deepEqual(getLastGeneration(), {
    kind: 'worksheet', source: 'mock', reason: 'fallback', error: 'HTTP 500', at: AT,
  });
});

test('strict mode refuses to substitute and rethrows', async () => {
  fresh();
  await assert.rejects(
    () => generateWithProvenance('activity', boom, mock, {
      demoMode: false, strict: true, now: clock,
    }),
    /HTTP 500/,
  );
  assert.deepEqual(getLastGeneration(), {
    kind: 'activity', source: 'none', reason: 'failed', error: 'HTTP 500', at: AT,
  });
});

// ─── cancelling ──────────────────────────────────────────────────────────────

function aborted() {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return Promise.reject(e);
}

test('isAbortError recognises an abort by name, not by class', () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  assert.equal(isAbortError(e), true);
  assert.equal(isAbortError(new Error('HTTP 500')), false);
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError('AbortError'), false);
});

test('a cancelled call never substitutes mock content', async () => {
  fresh();
  let mockRan = false;
  const watchedMock = async () => { mockRan = true; return 'mock-content'; };

  // The whole point. Non-strict mode falls back on failure, and a cancel
  // arrives as a rejection like any other — so without the abort check, a
  // teacher who pressed Cancel would be handed a complete, plausible,
  // entirely fabricated worksheet instead of their form back.
  await assert.rejects(
    () => generateWithProvenance('worksheet', aborted, watchedMock, {
      demoMode: false, strict: false, now: clock,
    }),
    /aborted/,
  );
  assert.equal(mockRan, false, 'the mock generator must not run on a cancel');
});

test('a timeout falls back rather than being read as a cancel', async () => {
  fresh();
  let mockRan = false;
  const watchedMock = async () => { mockRan = true; return 'mock-content'; };
  // `postJSON` aborts its own fetch on a timeout, so the rejection reaching
  // here would be an `AbortError` and land in the cancel branch above — mock
  // suppressed, screen empty, teacher told «تعذر إتمام العملية». It throws a
  // `TimeoutError` instead, and this pins the half of that contract which
  // lives on this side: anything not literally named AbortError falls back.
  const timedOut = async (): Promise<string> => {
    const e = new Error('Request to /generate/classroom-activity timed out after 45000ms');
    e.name = 'TimeoutError';
    throw e;
  };

  const out = await generateWithProvenance('classroom-activity', timedOut, watchedMock, {
    demoMode: false, strict: false, now: clock,
  });

  assert.equal(out, 'mock-content');
  assert.equal(mockRan, true, 'a timeout must still get the teacher something');
  assert.equal(getLastGeneration()?.reason, 'fallback', 'not "cancelled"');
});

test('a cancelled call is recorded as cancelled, producing nothing', async () => {
  fresh();
  await assert.rejects(
    () => generateWithProvenance('quiz', aborted, mock, {
      demoMode: false, strict: false, now: clock,
    }),
    /aborted/,
  );
  assert.deepEqual(getLastGeneration(), {
    kind: 'quiz', source: 'none', reason: 'cancelled', at: AT,
  });
});

test('the badge says nothing after a cancel rather than claiming live AI', () => {
  // Falling through to the live badge here would assert that a model answered
  // when the teacher stopped it before it did.
  const cancelled = { kind: 'quiz' as const, source: 'none' as const, reason: 'cancelled' as const, at: AT };
  assert.equal(aiSourceBadgeState(false, cancelled), null);
  // Demo mode still outranks everything — it describes the whole session.
  assert.equal(aiSourceBadgeState(true, cancelled)?.labelKey, 'demoModeBadge');
});

test('strict mode never calls the mock generator at all', async () => {
  fresh();
  let called = false;
  await generateWithProvenance('activity', boom, () => { called = true; return mock(); }, {
    demoMode: false, strict: true, now: clock,
  }).catch(() => {});
  assert.equal(called, false);
});

test('a later success does not rewrite the earlier fallback in the log', async () => {
  fresh();
  await generateWithProvenance('quiz', boom, mock, { demoMode: false, strict: false, now: clock });
  await generateWithProvenance('quiz', live, mock, { demoMode: false, now: clock });
  const reasons = getGenerationHistory().map(r => r.reason);
  assert.deepEqual(reasons, ['fallback', 'live']);
});

test('every generation notifies subscribers, whichever path it took', async () => {
  fresh();
  const seen: string[] = [];
  subscribeToGenerations(r => seen.push(`${r.kind}:${r.reason}`));
  await generateWithProvenance('quiz', live, mock, { demoMode: false, now: clock });
  await generateWithProvenance('homework', boom, mock, { demoMode: false, strict: false, now: clock });
  await generateWithProvenance('chat', live, mock, { demoMode: true, now: clock });
  assert.deepEqual(seen, ['quiz:live', 'homework:fallback', 'chat:demo-mode']);
});

// ─── what the badge says ─────────────────────────────────────────────────────

test('demo mode keeps the badge it always had, whatever the log holds', () => {
  const state = aiSourceBadgeState(true, {
    kind: 'quiz', source: 'mock', reason: 'fallback', error: 'HTTP 500', at: AT,
  });
  assert.deepEqual(state, { labelKey: 'demoModeBadge', icon: 'flask-outline', tone: 'quiet' });
});

test('live mode with nothing generated yet claims nothing', () => {
  assert.equal(aiSourceBadgeState(false, null), null);
});

test('a live answer is labelled live, quietly', () => {
  const state = aiSourceBadgeState(false, {
    kind: 'quiz', source: 'live', reason: 'live', at: AT,
  });
  assert.deepEqual(state, { labelKey: 'aiLiveBadge', icon: 'sparkles-outline', tone: 'quiet' });
});

test('a fallback is labelled loudly and carries the reason out of the visible label', () => {
  const state = aiSourceBadgeState(false, {
    kind: 'quiz', source: 'mock', reason: 'fallback', error: 'HTTP 401', at: AT,
  })!;
  assert.equal(state.labelKey, 'aiFallbackBadge');
  assert.equal(state.tone, 'warn');
  assert.equal(state.icon, 'warning-outline');
  assert.equal(state.detail, 'HTTP 401');
});

test('a strict-mode failure warns too — nothing was generated', () => {
  const state = aiSourceBadgeState(false, {
    kind: 'quiz', source: 'none', reason: 'failed', error: 'HTTP 500', at: AT,
  })!;
  assert.equal(state.labelKey, 'aiFallbackBadge');
  assert.equal(state.tone, 'warn');
});

test('the badge follows the last generation, not the worst one', async () => {
  fresh();
  await generateWithProvenance('quiz', boom, mock, { demoMode: false, strict: false, now: clock });
  assert.equal(aiSourceBadgeState(false, getLastGeneration())!.tone, 'warn');
  await generateWithProvenance('quiz', live, mock, { demoMode: false, now: clock });
  // The teacher is now looking at a real answer; saying otherwise would be
  // its own kind of dishonesty.
  assert.equal(aiSourceBadgeState(false, getLastGeneration())!.labelKey, 'aiLiveBadge');
});
