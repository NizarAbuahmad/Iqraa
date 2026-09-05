/**
 * What this guards: polling a thread must not replace the list. Assigning the
 * polled page would discard older pages the reader had scrolled back through,
 * and appending it blindly would double every message already on screen —
 * the newest page overlaps what is held, and a just-sent message is already
 * there optimistically.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mergeNewMessages } from '../messageMerge.ts';

const msg = (id: string) => ({ id, body: id });

describe('mergeNewMessages', () => {
  it('puts genuinely new messages in front — newest-first, like the inverted list', () => {
    const current = [msg('b'), msg('a')];
    const merged = mergeNewMessages(current, [msg('c'), msg('b')]);
    assert.deepEqual(merged.map(m => m.id), ['c', 'b', 'a']);
  });

  it('keeps older pages the reader had already loaded', () => {
    // The poll only ever returns the newest page; 'a' and 'b' came from
    // scrolling back and must survive.
    const current = [msg('d'), msg('c'), msg('b'), msg('a')];
    const merged = mergeNewMessages(current, [msg('e'), msg('d')]);
    assert.deepEqual(merged.map(m => m.id), ['e', 'd', 'c', 'b', 'a']);
  });

  it('does not duplicate a message that is already on screen', () => {
    // The message the reader just sent is added optimistically, then comes
    // back in the next poll.
    const current = [msg('sent-just-now'), msg('a')];
    const merged = mergeNewMessages(current, [msg('sent-just-now'), msg('a')]);
    assert.deepEqual(merged.map(m => m.id), ['sent-just-now', 'a']);
  });

  it('returns the same array reference when nothing is new', () => {
    // Identity, not just equality: a quiet poll must not trigger a re-render.
    const current = [msg('b'), msg('a')];
    assert.equal(mergeNewMessages(current, [msg('b'), msg('a')]), current);
    assert.equal(mergeNewMessages(current, []), current);
  });

  it('handles an empty screen — the first load through the same path', () => {
    const merged = mergeNewMessages([], [msg('b'), msg('a')]);
    assert.deepEqual(merged.map(m => m.id), ['b', 'a']);
  });
});
