/**
 * "Hearing two things at once is never useful": whichever audio starts stops
 * the others. The registry is pure so the rule is tested here; the players that
 * register with it import `expo-audio` and cannot be loaded under bare node.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAudioExclusive } from '../audioExclusive.ts';

describe('createAudioExclusive', () => {
  it('stops every other owner and never the one that claimed', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('word'));
    ex.register('quran', () => stopped.push('quran'));
    ex.claim('quran');
    assert.deepEqual(stopped, ['word']);
    ex.claim('word');
    assert.deepEqual(stopped, ['word', 'quran']);
  });

  it('is fine to claim a name nobody registered', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('word'));
    assert.doesNotThrow(() => ex.claim('other'));
    assert.deepEqual(stopped, ['word']);
  });

  it('a stop that throws does not block the rest', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('a', () => {
      throw new Error('player already released');
    });
    ex.register('b', () => stopped.push('b'));
    ex.register('c', () => stopped.push('c'));
    assert.doesNotThrow(() => ex.claim('c'));
    assert.deepEqual(stopped, ['b']);
  });

  it('registering a name again replaces its stop', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('old'));
    ex.register('word', () => stopped.push('new'));
    ex.claim('quran');
    assert.deepEqual(stopped, ['new']);
  });
});
