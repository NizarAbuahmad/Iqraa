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

describe('mergeNewMessages — seen', () => {
  it('marks a held message seen when the poll says it was', () => {
    const current = [{ id: 'b', seen: false }, { id: 'a', seen: false }];
    const merged = mergeNewMessages(current, [{ id: 'b', seen: true }]);
    assert.deepEqual(merged, [{ id: 'b', seen: true }, { id: 'a', seen: false }]);
  });

  it('never unmarks one, and a quiet poll keeps the same array', () => {
    const current = [{ id: 'a', seen: true }];
    assert.equal(mergeNewMessages(current, [{ id: 'a', seen: false }]), current);
  });
});

describe('mergeNewMessages — reactions', () => {
  // One declared shape for every literal below: the generic merge infers its
  // type from both arguments, and `{ id }` next to `{ id, reactions }` would not typecheck.
  type M = { id: string; seen?: boolean; reactions?: { emoji: string; count: number; mine: boolean; userIds?: string[] }[] };
  const r = (emoji: string, count: number, mine = false) => ({ emoji, count, mine });

  it('adopts changed reactions on a message already on screen', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', reactions: [r('👍', 2), r('🙏', 1)] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', reactions: [r('👍', 2), r('🙏', 1)] }]);
  });

  it('keeps the same array reference when reactions did not change', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1, true)] }];
    const polled: M[] = [{ id: 'a', reactions: [r('👍', 1, true)] }];
    assert.equal(mergeNewMessages(current, polled), current);
  });

  it('notices the same chip held by different people (teacher view)', () => {
    const current: M[] = [{ id: 'a', reactions: [{ emoji: '👍', count: 1, mine: false, userIds: ['x'] }] }];
    const polled: M[] = [{ id: 'a', reactions: [{ emoji: '👍', count: 1, mine: false, userIds: ['y'] }] }];
    assert.notEqual(mergeNewMessages(current, polled), current);
  });

  it('treats a poll without a reactions field (older API build) as "no news", not "all removed"', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a' }];
    assert.equal(mergeNewMessages(current, polled), current);
  });

  it('clears reactions when the poll says there are none', () => {
    const current: M[] = [{ id: 'a', reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', reactions: [] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', reactions: [] }]);
  });

  it('applies reactions and new messages together, leaving other held messages alone', () => {
    const current: M[] = [{ id: 'b', reactions: [r('👍', 1)] }, { id: 'a', reactions: [r('🙏', 1)] }];
    const polled: M[] = [{ id: 'c', reactions: [] }, { id: 'b', reactions: [r('👍', 2)] }];
    const merged = mergeNewMessages(current, polled);
    assert.deepEqual(merged.map(m => m.id), ['c', 'b', 'a']);
    assert.deepEqual(merged[1]!.reactions, [r('👍', 2)]);
    assert.equal(merged[2], current[1]);
  });

  it('still adopts a new seen alongside reactions', () => {
    const current: M[] = [{ id: 'a', seen: false, reactions: [r('👍', 1)] }];
    const polled: M[] = [{ id: 'a', seen: true, reactions: [r('👍', 2)] }];
    assert.deepEqual(mergeNewMessages(current, polled), [{ id: 'a', seen: true, reactions: [r('👍', 2)] }]);
  });
});
