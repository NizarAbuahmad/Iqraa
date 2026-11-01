/**
 * What this guards: what a teacher is told when generating questions into an
 * exam fails because the exam stopped being a draft.
 *
 * `POST /evaluations/:id/generate` answers 409 when the exam was published, closed
 * or deleted, either before the model was asked (no `code`) or while it was
 * writing (`no_longer_draft`). The screen used to show «تعذّر توليد الأسئلة.» for
 * that, the same line as a model outage, and kept showing a draft with a
 * regenerate button, so every further tap got the same refusal. The cause is
 * different (nothing is wrong, the exam moved on) and so is the right next step:
 * refresh the screen, not try again.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateFailure } from '../evaluationGenerateError.ts';
import translations from '../i18n.ts';

/** What `EvaluationError` carries, without importing the module that fetches. */
const apiError = (status: number, code = '') => Object.assign(new Error('x'), { status, code });

describe("a generate request that failed", () => {
  it("says the exam is no longer a draft, and asks for a refresh, on the lock check's 409", () => {
    assert.deepEqual(generateFailure(apiError(409, 'no_longer_draft')), {
      messageKey: 'evaluationGenerateNoLongerDraft',
      refetch: true,
    });
  });

  it("says the same on the early 409, which carries no code", () => {
    assert.deepEqual(generateFailure(apiError(409)), {
      messageKey: 'evaluationGenerateNoLongerDraft',
      refetch: true,
    });
  });

  it("keeps the generic line, and no refresh, for a generator that did not answer", () => {
    assert.deepEqual(generateFailure(apiError(502, 'generator_unavailable')), {
      messageKey: 'evaluationGenerateFailed',
      refetch: false,
    });
  });

  it("keeps the generic line for a spend cap, a server error, and anything that is not an API error", () => {
    for (const err of [apiError(429, 'budget_exceeded'), apiError(500), new Error('network'), 'boom', null, undefined]) {
      assert.deepEqual(generateFailure(err), { messageKey: 'evaluationGenerateFailed', refetch: false }, String(err));
    }
  });
});

describe("the exam screen's regenerate button", () => {
  // The screen imports React Native and cannot be loaded here, so this reads its
  // source, as paperOrder.test.ts does for the quiz picker. It pins the wiring: the
  // screen asks the helper what to say, and reloads when the helper says to.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const source = readFileSync(join(root, 'app', 'evaluations', '[id]', 'index.tsx'), 'utf8');
  const onRegenerate = source.slice(source.indexOf('const onRegenerate'), source.indexOf('const onClose'));

  it("imports the helper", () => {
    assert.match(source, /import \{ generateFailure \} from '@\/services\/evaluationGenerateError'/);
  });

  it("shows the helper's line and reloads the exam when it says to, instead of one fixed failure line", () => {
    assert.ok(onRegenerate.length > 0, 'found onRegenerate');
    assert.match(onRegenerate, /generateFailure\(err\)/);
    assert.match(onRegenerate, /setError\(t\(failure\.messageKey\)\)/);
    assert.match(onRegenerate, /if \(failure\.refetch\) await refetch\(\)/);
    assert.doesNotMatch(onRegenerate, /setError\(t\('evaluationGenerateFailed'\)\)/);
  });
});

describe("the line for an exam that is no longer a draft", () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`exists in ${lang} and differs from the generic failure`, () => {
      const table = (translations as unknown as Record<string, Record<string, unknown>>)[lang];
      const line = table['evaluationGenerateNoLongerDraft'];
      assert.equal(typeof line, 'string');
      assert.ok((line as string).length > 0);
      assert.notEqual(line, table['evaluationGenerateFailed']);
    });
  }

  it("tells the teacher nothing was changed", () => {
    const table = translations as unknown as Record<string, Record<string, unknown>>;
    assert.match(String(table['en']['evaluationGenerateNoLongerDraft']), /nothing was changed/i);
  });
});
