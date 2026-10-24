/**
 * The app, the generator and the audit name the same place for the English clips.
 * Read as text: the app is another package, and both scripts run on import.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ENGLISH_AUDIO_PREFIX } from '../englishAudioPlan.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const app = read('../../../../artifacts/mobile/services/englishAudio.ts');
const appBase = app.match(/export const ENGLISH_AUDIO_BASE_URL = '([^']+)'/)?.[1];

describe('where the English clips live', () => {
  it('the audit checks the URL the app plays from', () => {
    const audit = read('../../scripts/audit-english-audio.ts');
    const auditBase = audit.match(/export const DEFAULT_AUDIO_BASE_URL = '([^']+)'/)?.[1];
    assert.ok(appBase, 'ENGLISH_AUDIO_BASE_URL not found in the app');
    assert.equal(auditBase, appBase);
  });

  it('the generator uploads under the prefix the app reads', () => {
    assert.equal(ENGLISH_AUDIO_PREFIX, 'english-audio');
    assert.ok(appBase!.endsWith(`/${ENGLISH_AUDIO_PREFIX}`), appBase);
    const generator = read('../../scripts/generate-english-audio.ts');
    assert.match(generator, /^const PREFIX = ENGLISH_AUDIO_PREFIX;$/m);
  });
});
