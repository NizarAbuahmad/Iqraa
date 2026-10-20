/**
 * The Quran audio gate. The recordings are copied into the bucket by a script
 * the owner runs, and nobody has yet checked that each file is exactly its
 * ayah, so every listen control stays hidden in a production build until
 * QURAN_AUDIO_UPLOADED is flipped. Development builds always show them, so the
 * owner can try the controls before then.
 *
 * Like `quranRelease.test.ts`, this asserts the TYPE of the constant, not its
 * value: a test pinning `false` would make the owner's one-line flip a
 * two-file change for no safety gain.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_AUDIO_UPLOADED, quranAudioVisible } from '../quranAudioRelease.ts';

describe('quranAudioVisible', () => {
  it('shows the controls in a development build whether or not the audio is uploaded', () => {
    assert.equal(quranAudioVisible(false, true), true);
    assert.equal(quranAudioVisible(true, true), true);
  });

  it('shows them in a production build only once uploaded', () => {
    assert.equal(quranAudioVisible(true, false), true);
    assert.equal(quranAudioVisible(false, false), false);
  });
});

describe('QURAN_AUDIO_UPLOADED', () => {
  it('is a boolean, so a typo in the flag cannot read as truthy', () => {
    assert.equal(typeof QURAN_AUDIO_UPLOADED, 'boolean');
  });
});
