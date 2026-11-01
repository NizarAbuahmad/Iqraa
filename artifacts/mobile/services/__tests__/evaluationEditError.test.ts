/**
 * What this guards: what a teacher is told when changing a draft exam is refused
 * because the exam stopped being a draft.
 *
 * Adding, editing or deleting a question answers 409 when the exam was published,
 * closed or removed (`no_longer_draft`, or `Only a draft can be edited` before the
 * lock), and deleting the exam answers 409 `still_published` when it was published
 * meanwhile. The exam screen showed one fixed «could not save / could not delete»
 * line for every failure, and the three question modals printed the server's English
 * `err.message` to an Arabic teacher. The right next step is different from a retry:
 * nothing was changed, and the screen should reload to show the exam as it is now.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { archiveFailure, editRefusedAsNotDraft } from '../evaluationEditError.ts';
import translations from '../i18n.ts';

/** What `EvaluationError` carries, without importing the module that fetches. */
const apiError = (status: number, code = '') => Object.assign(new Error('x'), { status, code });

describe("a question change that was refused", () => {
  it("is 'no longer a draft' on the lock check's 409 and on the early one, which has no code", () => {
    assert.equal(editRefusedAsNotDraft(apiError(409, 'no_longer_draft')), true);
    assert.equal(editRefusedAsNotDraft(apiError(409)), true);
  });

  it("is not, for a validation error, a missing question, a server error, or anything that is not an API error", () => {
    for (const err of [apiError(400), apiError(404), apiError(500), apiError(429), new Error('network'), 'boom', null, undefined]) {
      assert.equal(editRefusedAsNotDraft(err), false, String(err));
    }
  });
});

describe("deleting an exam that failed", () => {
  it("says it was just published, and reloads, on the 409 for a published exam", () => {
    assert.deepEqual(archiveFailure(apiError(409, 'still_published')), {
      messageKey: 'archiveEvaluationStillPublished',
      refetch: true,
    });
  });

  it("keeps the generic line, and no reload, for every other failure", () => {
    for (const err of [apiError(404), apiError(500), apiError(409, 'something_else'), new Error('network'), 'boom', null, undefined]) {
      assert.deepEqual(archiveFailure(err), { messageKey: 'archiveEvaluationFailed', refetch: false }, String(err));
    }
  });
});

describe("the screens that make these changes", () => {
  // They import React Native and cannot be loaded here, so this reads their source,
  // as evaluationGenerateError.test.ts does. It pins the wiring.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
  const screen = read('app', 'evaluations', '[id]', 'index.tsx');
  const between = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));

  it("the exam screen imports the helper", () => {
    assert.match(screen, /import \{ archiveFailure, editRefusedAsNotDraft \} from '@\/services\/evaluationEditError'/);
  });

  it("deleting a question says the exam moved on, and reloads, instead of 'could not save'", () => {
    const body = between(screen, 'await deleteEvaluationQuestion(id, q.id)', 'const onRegenerate');
    assert.ok(body.length > 0, 'found the delete handler');
    assert.match(body, /editRefusedAsNotDraft\(err\)/);
    assert.match(body, /t\('evaluationEditNoLongerDraft'\)/);
    assert.match(body, /await refetch\(\)/);
    assert.match(body, /t\('questionSaveFailed'\)/, 'other failures keep the generic line');
  });

  it("deleting the exam shows the helper's line and reloads when it says to", () => {
    const body = between(screen, 'await archiveEvaluation(id)', 'const onToggleRelease');
    assert.ok(body.length > 0, 'found the archive handler');
    assert.match(body, /archiveFailure\(err\)/);
    assert.match(body, /setError\(t\(failure\.messageKey\)\)/);
    assert.match(body, /if \(failure\.refetch\) await refetch\(\)/);
    assert.doesNotMatch(body, /setError\(t\('archiveEvaluationFailed'\)\)/);
  });

  it("the screen hands refetch to every question modal so a refused change reloads the exam", () => {
    for (const tag of ['AddReadAloudModal', 'EditQuestionModal', 'AddDictationModal']) {
      const open = screen.indexOf(`<${tag}`);
      assert.ok(open >= 0, `${tag} is rendered`);
      const props = screen.slice(open, screen.indexOf('/>', open));
      assert.match(props, /onStale=\{refetch\}/, `${tag} gets onStale`);
    }
  });

  for (const file of ['EditQuestionModal.tsx', 'AddReadAloudModal.tsx', 'AddDictationModal.tsx']) {
    it(`${file} shows the translated line, not the server's English, when the exam is no longer a draft`, () => {
      const src = read('components', file);
      assert.match(src, /import \{ editRefusedAsNotDraft \} from '@\/services\/evaluationEditError'/);
      assert.match(src, /editRefusedAsNotDraft\(err\)/);
      assert.match(src, /t\('evaluationEditNoLongerDraft'\)/);
      assert.match(src, /onStale\?\.\(\)/, 'tells the screen to reload');
    });
  }
});

describe("the lines for a refused change", () => {
  const table = translations as unknown as Record<string, Record<string, unknown>>;
  for (const lang of ['ar', 'en'] as const) {
    it(`exist in ${lang} and differ from the generic failures`, () => {
      const noDraft = table[lang]!['evaluationEditNoLongerDraft'];
      const stillPublished = table[lang]!['archiveEvaluationStillPublished'];
      for (const line of [noDraft, stillPublished]) {
        assert.equal(typeof line, 'string');
        assert.ok((line as string).length > 0);
      }
      assert.notEqual(noDraft, table[lang]!['questionSaveFailed']);
      assert.notEqual(stillPublished, table[lang]!['archiveEvaluationFailed']);
    });
  }

  it("tell the teacher nothing was changed, and what to do about a published exam", () => {
    assert.match(String(table['en']!['evaluationEditNoLongerDraft']), /nothing was changed/i);
    assert.match(String(table['en']!['archiveEvaluationStillPublished']), /close it first/i);
  });
});
