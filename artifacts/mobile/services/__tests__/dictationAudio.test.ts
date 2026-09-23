/**
 * The play counter, which is the only part of dictation playback with a
 * decision in it. `playPrompt` and `isPlaybackSupported` are browser calls with
 * nothing to pin.
 *
 * Worth a test because the inputs come from two untrusted places at once: the
 * limit is a jsonb field a teacher (or a generator) wrote, and the count is a
 * jsonb field the student's own device wrote. Neither is guaranteed to be a
 * sensible number, and a NaN here silently disables the button on a question
 * the child has not heard once.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_PLAY_LIMIT, playsLeft } from '../dictationAudio.ts';

describe('playsLeft', () => {
  it('counts down from the question’s own limit', () => {
    assert.equal(playsLeft(3, 0), 3);
    assert.equal(playsLeft(3, 1), 2);
    assert.equal(playsLeft(3, 3), 0);
  });

  it('falls back to the default when the question sets no limit', () => {
    assert.equal(playsLeft(undefined, 0), DEFAULT_PLAY_LIMIT);
    assert.equal(playsLeft(null, 1), DEFAULT_PLAY_LIMIT - 1);
  });

  it('never returns a negative count', () => {
    // A stored count above the limit is reachable: a teacher can lower
    // playLimit on a question students have already opened.
    assert.equal(playsLeft(2, 5), 0);
  });

  it('ignores junk rather than disabling the button', () => {
    // The failure this guards: NaN or a string arriving from jsonb makes every
    // comparison false, the count reads as 0, and a child who has never heard
    // the word is told they are out of plays.
    for (const junk of [NaN, 'three', {}, [], -1, 2.5]) {
      assert.equal(playsLeft(junk, 0), DEFAULT_PLAY_LIMIT, `limit ${String(junk)}`);
    }
    for (const junk of [NaN, 'one', {}, null, undefined, -4]) {
      assert.equal(playsLeft(3, junk), 3, `played ${String(junk)}`);
    }
  });
});
