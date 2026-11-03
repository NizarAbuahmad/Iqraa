/**
 * What this guards: what a teacher is told when preparing worked steps fails.
 *
 * `POST /evaluations/:id/worked-steps` answers 429 `worked_steps_in_progress` when
 * the exam's worked steps (or its questions) are already being prepared: the app gives
 * up on that request after 45 s while the server is still going, and the teacher taps
 * again. «تعذّر تجهيز خطوات الحل» would be wrong, because the first request is still
 * running and will finish, and trying again gets the same answer. The spend-cap codes
 * keep their line, and so does everything else.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workedStepsFailure } from '../workedStepsError.ts';
import translations from '../i18n.ts';

/** What `EvaluationError` carries, without importing the module that fetches. */
const apiError = (status: number, code = '') => Object.assign(new Error('x'), { status, code });

describe("a worked-steps request that failed", () => {
  it("says it is already being prepared, and reloads, on the 429 for a second request", () => {
    assert.deepEqual(workedStepsFailure(apiError(429, 'worked_steps_in_progress')), {
      messageKey: 'prepareStepsInProgress',
      refetch: true,
    });
  });

  it("keeps the spend-cap line for both spend-cap codes", () => {
    for (const code of ['user_quota_exceeded', 'budget_exceeded']) {
      assert.deepEqual(workedStepsFailure(apiError(429, code)), { messageKey: 'aiQuotaSpent', refetch: false }, code);
    }
  });

  it("keeps the generic line for everything else, including a 429 with another code", () => {
    for (const err of [apiError(500), apiError(503, 'live_mode_off'), apiError(409, 'not_math'), apiError(429, 'rate_limited'), new Error('network'), 'boom', null, undefined]) {
      assert.deepEqual(workedStepsFailure(err), { messageKey: 'prepareStepsFailed', refetch: false }, String(err));
    }
  });
});

describe("the exam screen's worked-steps button", () => {
  // The screen imports React Native and cannot be loaded here, so this reads its source,
  // as evaluationGenerateError.test.ts does. It pins the wiring.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const source = readFileSync(join(root, 'app', 'evaluations', '[id]', 'index.tsx'), 'utf8');
  const handler = source.slice(source.indexOf('const onPrepareSteps'), source.indexOf('const onPublish'));

  it("imports the helper", () => {
    assert.match(source, /import \{ workedStepsFailure \} from '@\/services\/workedStepsError'/);
  });

  it("shows the helper's line and reloads the exam when it says to, instead of inline code checks", () => {
    assert.ok(handler.length > 0, 'found onPrepareSteps');
    assert.match(handler, /workedStepsFailure\(err\)/);
    assert.match(handler, /setError\(t\(failure\.messageKey\)\)/);
    assert.match(handler, /if \(failure\.refetch\) await refetch\(\)/);
    assert.doesNotMatch(handler, /user_quota_exceeded/, 'the code mapping lives in the helper');
  });
});

describe("the line for worked steps that are already being prepared", () => {
  const table = translations as unknown as Record<string, Record<string, unknown>>;
  for (const lang of ['ar', 'en'] as const) {
    it(`exists in ${lang} and differs from the generic failure and the spend-cap line`, () => {
      const line = table[lang]!['prepareStepsInProgress'];
      assert.equal(typeof line, 'string');
      assert.ok((line as string).length > 0);
      assert.notEqual(line, table[lang]!['prepareStepsFailed']);
      assert.notEqual(line, table[lang]!['aiQuotaSpent']);
    });
  }

  it("tells the teacher it is already running, not that it failed", () => {
    assert.match(String(table['en']!['prepareStepsInProgress']), /already being prepared/i);
  });
});
