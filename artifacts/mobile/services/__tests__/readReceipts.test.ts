/**
 * Which messages a thread screen reports as read when they come into view.
 *
 * Pure so `node --test` can load it; the FlatList wiring stays in
 * `app/messaging/[threadId].tsx`. The rules: never my own messages (a sender
 * has not "read" their own letter), never one already reported (the callback
 * fires on every scroll), and each id once per call.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pickUnreportedReads } from '../readReceipts.ts';

const ME = 'teacher-1';

describe('pickUnreportedReads', () => {
  it('skips my own messages', () => {
    const out = pickUnreportedReads(
      [{ id: 'm1', senderId: ME }, { id: 'm2', senderId: 'parent-1' }],
      ME,
      new Set(),
    );
    assert.deepEqual(out, ['m2']);
  });

  it('skips messages already reported', () => {
    const out = pickUnreportedReads(
      [{ id: 'm1', senderId: 'parent-1' }, { id: 'm2', senderId: 'parent-1' }],
      ME,
      new Set(['m1']),
    );
    assert.deepEqual(out, ['m2']);
  });

  it('returns each id once', () => {
    const out = pickUnreportedReads(
      [{ id: 'm1', senderId: 'parent-1' }, { id: 'm1', senderId: 'parent-1' }],
      ME,
      new Set(),
    );
    assert.deepEqual(out, ['m1']);
  });

  it('returns nothing when there is nothing new', () => {
    assert.deepEqual(pickUnreportedReads([], ME, new Set()), []);
    assert.deepEqual(pickUnreportedReads([{ id: 'm1', senderId: ME }], ME, new Set()), []);
  });
});
