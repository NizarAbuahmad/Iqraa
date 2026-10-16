/**
 * The only real logic in Quran audio playback: what plays, in what order, how
 * many times, and what a late "finished" event does after Stop. The player
 * (`quranAudio.ts`, which imports `expo-audio`) is glue around this.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDLE_PLAYLIST,
  MAX_REPEAT,
  advancePlaylist,
  buildQueue,
  clampRepeat,
  currentOf,
  startPlaylist,
} from '../quranPlaylist.ts';

const a = { surah: 112, ayah: 1 };
const b = { surah: 112, ayah: 2 };
const c = { surah: 112, ayah: 3 };

describe('clampRepeat', () => {
  it('floors to an integer between 1 and the cap, and treats anything else as 1', () => {
    assert.equal(clampRepeat(1), 1);
    assert.equal(clampRepeat(0), 1);
    assert.equal(clampRepeat(-3), 1);
    assert.equal(clampRepeat(2.9), 2);
    assert.equal(clampRepeat(99), MAX_REPEAT);
    assert.equal(clampRepeat(NaN), 1);
    assert.equal(clampRepeat(Infinity), 1);
    assert.equal(clampRepeat('3'), 1);
    assert.equal(clampRepeat(undefined), 1);
  });
});

describe('buildQueue', () => {
  it('plays each ayah once by default, in the order given', () => {
    assert.deepEqual(buildQueue([a, b, c]), [a, b, c]);
  });
  it('repeats each ayah in place (a a b b), the way it is learned', () => {
    assert.deepEqual(buildQueue([a, b], 2), [a, a, b, b]);
  });
  it('handles a one-ayah range and an empty one', () => {
    assert.deepEqual(buildQueue([a], 3), [a, a, a]);
    assert.deepEqual(buildQueue([], 3), []);
  });
});

describe('the playlist reducer', () => {
  it('an empty queue never starts', () => {
    assert.equal(startPlaylist([]), IDLE_PLAYLIST);
    assert.equal(currentOf(startPlaylist([])), null);
  });

  it('walks the queue and goes idle after the last item', () => {
    let s = startPlaylist([a, b, c]);
    assert.deepEqual(currentOf(s), a);
    s = advancePlaylist(s);
    assert.deepEqual(currentOf(s), b);
    s = advancePlaylist(s);
    assert.deepEqual(currentOf(s), c);
    s = advancePlaylist(s);
    assert.equal(s.active, false);
    assert.equal(currentOf(s), null);
  });

  it('a one-item queue ends after one advance', () => {
    const s = advancePlaylist(startPlaylist([a]));
    assert.equal(currentOf(s), null);
  });

  it('a late "finished" after Stop cannot restart anything', () => {
    let s = advancePlaylist(startPlaylist([a, b, c]));
    assert.deepEqual(currentOf(s), b);
    s = IDLE_PLAYLIST; // what Stop does
    assert.equal(currentOf(advancePlaylist(s)), null);
    assert.equal(advancePlaylist(s).active, false);
  });
});
