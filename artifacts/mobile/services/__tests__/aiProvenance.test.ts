import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiErrorMessageKey,
  aiFallbackNotice,
  carryProvenance,
  firstFallbackNotice,
  provenanceOf,
  aiSourceBadgeState,
  type AiGenerationRecord,
  describeAiError,
  generateWithProvenance,
  isAbortError,
  throwIfAborted,
  isCapError,
  startClassFailure,
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

test('isCapError recognises a cap by code, not by class', () => {
  // Duck-typed on purpose: ApiError lives in apiClient, which reaches
  // react-native and cannot be imported by this runner at all. The code is the
  // contract, the class is not.
  assert.equal(isCapError({ code: 'user_quota_exceeded' }), true);
  assert.equal(isCapError({ code: 'budget_exceeded' }), true);
  assert.equal(isCapError({ code: 'live_mode_off' }), true);
  assert.equal(isCapError({ code: 'generation_in_flight' }), true);
  // A failure that is genuinely a failure must still fall back.
  assert.equal(isCapError({ code: 'email_not_verified' }), false);
  assert.equal(isCapError(new Error('HTTP 500')), false);
  assert.equal(isCapError(null), false);
  assert.equal(isCapError('user_quota_exceeded'), false);
});

test('a pooled repeat is labelled a saved copy, not a live generation', async () => {
  fresh();
  // The server serves an already-generated variant when a cap refuses a fresh
  // one. It is real content — so `source` stays 'live' — but presenting it as
  // newly generated is the claim that would be false, especially to a teacher
  // who just pressed regenerate to get away from this exact worksheet.
  type Served = { title: string; servedReason?: string };
  const servedFromPool = async (): Promise<Served> =>
    ({ title: 'ورقة عمل', servedReason: 'quota' });
  const objectMock = async (): Promise<Served> => ({ title: 'mock' });

  const out = await generateWithProvenance('worksheet', servedFromPool, objectMock, {
    demoMode: false, strict: false, now: clock,
  });

  assert.equal((out as { title: string }).title, 'ورقة عمل', 'the artifact is still returned');
  assert.equal(getLastGeneration()?.reason, 'saved-copy');
  assert.equal(getLastGeneration()?.source, 'live', 'real content, really generated');
  assert.equal(
    aiSourceBadgeState(false, getLastGeneration())?.labelKey,
    'aiSavedCopyBadge',
    'the badge on every generator screen is what discloses it',
  );
});

test('an ordinary live answer is still labelled live', async () => {
  fresh();
  // Guards the other direction: servedReasonOf must not see a reason where
  // there is none, or every generation would claim to be a saved copy.
  await generateWithProvenance(
    'worksheet',
    async () => ({ title: 'ورقة عمل' }),
    async () => ({ title: 'mock' }),
    { demoMode: false, strict: false, now: clock },
  );
  assert.equal(getLastGeneration()?.reason, 'live');
  assert.equal(aiSourceBadgeState(false, getLastGeneration())?.labelKey, 'aiLiveBadge');
});

test('aiErrorMessageKey tells the three actionable states apart', () => {
  // A quota, a switched-off service and a genuine fault need three different
  // sentences: "reuse what you have", "come back later", "try again". Showing
  // generationFailed for all three is what made a spend cap read as an outage.
  assert.equal(aiErrorMessageKey({ code: 'user_quota_exceeded' }), 'aiQuotaSpent');
  assert.equal(aiErrorMessageKey({ code: 'budget_exceeded' }), 'aiQuotaSpent');
  assert.equal(aiErrorMessageKey({ code: 'live_mode_off' }), 'aiUnavailable');
  assert.equal(aiErrorMessageKey(new Error('HTTP 500')), 'generationFailed');
  assert.equal(aiErrorMessageKey({ code: 'something_new' }), 'generationFailed');
  assert.equal(aiErrorMessageKey(null), 'generationFailed');
  assert.equal(aiErrorMessageKey(undefined), 'generationFailed');
});

test('a capped call never substitutes mock content', async () => {
  fresh();
  let mockRan = false;
  const watchedMock = async () => { mockRan = true; return 'mock-content'; };
  const capped = async (): Promise<string> => {
    const e: Error & { code?: string } = new Error(
      'This teacher has used $1.0400 of their $1.00 monthly allowance.',
    );
    e.code = 'user_quota_exceeded';
    throw e;
  };

  // The reason this matters more than the cancel case: the teacher did not ask
  // for anything to stop, so a fabricated worksheet here looks exactly like the
  // one they asked for. The server has already tried the shared pool before
  // refusing, so there is genuinely nothing real to hand over.
  await assert.rejects(
    () => generateWithProvenance('worksheet', capped, watchedMock, {
      demoMode: false, strict: false, now: clock,
    }),
    /monthly allowance/,
  );
  assert.equal(mockRan, false, 'the mock generator must not run on a spending cap');
  assert.equal(getLastGeneration()?.reason, 'failed');
  assert.equal(getLastGeneration()?.source, 'none');
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

test('throwIfAborted rejects a cancelled signal the way fetch would', () => {
  // The slides screen joins two promises whose own catches swallow the abort.
  // A late Cancel must still surface as the AbortError the screen already
  // reports as "stopped", not as a finished deck.
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => throwIfAborted(controller.signal), (e: unknown) => isAbortError(e));
});

test('throwIfAborted is a no-op on a live signal', () => {
  const controller = new AbortController();
  assert.doesNotThrow(() => throwIfAborted(controller.signal));
});

// ─── startClassFailure ───────────────────────────────────────────────────────

test('startClassFailure says the allowance is spent, as a note rather than an error', () => {
  for (const code of ['user_quota_exceeded', 'budget_exceeded']) {
    assert.deepEqual(startClassFailure({ code }), { key: 'aiQuotaSpent', note: true });
  }
});

test('startClassFailure says the AI is switched off, as a note', () => {
  assert.deepEqual(startClassFailure({ code: 'live_mode_off' }), { key: 'aiUnavailable', note: true });
});

test('startClassFailure keeps the generic retry message for everything else', () => {
  for (const e of [new Error('boom'), { code: 'generation_in_flight' }, { code: 'no_question_bank' }, null, undefined]) {
    assert.deepEqual(startClassFailure(e), { key: 'startClassFailed', note: false });
  }
});

// ─── aiFallbackNotice ────────────────────────────────────────────────────────
//
// 2026-11-20: a Grade 6 teacher's «نشاط صفي» came back from the offline
// blueprint because the live call failed, and the only sign was the header
// pill «تعذّر الاتصال · محتوى تجريبي». The notice says it on the result itself,
// and it decides "fallback" through `aiSourceBadgeState`, so the pill and the
// notice can never disagree.

const rec = (over: Partial<AiGenerationRecord>): AiGenerationRecord => ({
  kind: 'activity', source: 'mock', reason: 'fallback', error: 'HTTP 502', at: AT, ...over,
});

test('aiFallbackNotice: a live call that fell back to sample content is announced', () => {
  const n = aiFallbackNotice(false, rec({}), 'activity');
  assert.deepEqual(n, {
    titleKey: 'aiFallbackNoticeTitle', bodyKey: 'aiFallbackNoticeBody', retryKey: 'aiFallbackRetry', detail: 'HTTP 502',
  });
});

test('aiFallbackNotice: nothing when the badge would not warn', () => {
  assert.equal(aiFallbackNotice(false, rec({ source: 'live', reason: 'live', error: undefined }), 'activity'), null);
  assert.equal(aiFallbackNotice(false, rec({ source: 'live', reason: 'saved-copy', error: undefined }), 'activity'), null);
  // Demo mode is the intended state, not a failure: the badge already says so.
  assert.equal(aiFallbackNotice(true, rec({ source: 'mock', reason: 'demo-mode', error: undefined }), 'activity'), null);
  assert.equal(aiFallbackNotice(true, rec({}), 'activity'), null);
  assert.equal(aiFallbackNotice(false, null, 'activity'), null);
});

test('aiFallbackNotice: a strict failure produced no content, so there is no result to annotate', () => {
  assert.equal(aiFallbackNotice(false, rec({ source: 'none', reason: 'failed' }), 'activity'), null);
});

test("aiFallbackNotice: another generator's fallback is not this result's", () => {
  assert.equal(aiFallbackNotice(false, rec({ kind: 'chat' }), 'activity'), null);
});

// ─── provenanceOf ────────────────────────────────────────────────────────────
// The worksheet's three-level mode runs three generations at once, so "the
// newest record since the call started" cannot say which record is which
// paper's. Each output carries its own.

test('provenanceOf: each output knows the record of the call that made it', async () => {
  fresh();
  const failing = () => Promise.reject(new Error('HTTP 502'));
  const [a, b, c] = await Promise.all([
    generateWithProvenance('worksheet', failing, async () => ({ level: 'easy' }), { demoMode: false, strict: false, now: clock }),
    generateWithProvenance('worksheet', async () => ({ level: 'medium' }), async () => ({ level: 'x' }), { demoMode: false, strict: false, now: clock }),
    generateWithProvenance('worksheet', failing, async () => ({ level: 'hard' }), { demoMode: false, strict: false, now: clock }),
  ]);
  assert.equal(provenanceOf(a)?.reason, 'fallback');
  assert.equal(provenanceOf(b)?.reason, 'live');
  assert.equal(provenanceOf(c)?.reason, 'fallback');
});

test('provenanceOf: demo mode, and an object no generator made', async () => {
  fresh();
  const out = await generateWithProvenance('quiz', async () => ({}), async () => ({ demo: true }), { demoMode: true, now: clock });
  assert.equal(provenanceOf(out)?.reason, 'demo-mode');
  assert.equal(provenanceOf({}), null);
  assert.equal(provenanceOf(null), null);
});

// ─── carryProvenance / firstFallbackNotice ───────────────────────────────────
// A service that copies the output after the provenance step (`plainActivity`,
// `applyClassroomSetup`) carries the record to the copy; a deck built from
// several calls shows the notice when any part of it is sample content.

test('carryProvenance: the copy has the original output record', async () => {
  fresh();
  const out = await generateWithProvenance('activity', () => Promise.reject(new Error('HTTP 502')), async () => ({ a: 1 }), { demoMode: false, strict: false, now: clock });
  const copy = carryProvenance(out, { ...out });
  assert.equal(provenanceOf(copy)?.reason, 'fallback');
  assert.equal(provenanceOf(carryProvenance({}, { b: 2 })), null);
});

test('firstFallbackNotice: any part that fell back gives the notice', () => {
  const live = rec({ kind: 'lesson-plan', source: 'live', reason: 'live', error: undefined });
  const fell = rec({ kind: 'classroom-activity' });
  assert.equal(firstFallbackNotice(false, [{ record: live, kind: 'lesson-plan' }, { record: null, kind: 'classroom-activity' }]), null);
  assert.equal(firstFallbackNotice(false, [{ record: live, kind: 'lesson-plan' }, { record: fell, kind: 'classroom-activity' }])?.detail, 'HTTP 502');
  // A record is only counted against its own kind.
  assert.equal(firstFallbackNotice(false, [{ record: fell, kind: 'lesson-plan' }]), null);
  assert.equal(firstFallbackNotice(true, [{ record: fell, kind: 'classroom-activity' }]), null);
});
